import { ObjectId } from 'mongodb'
import { db } from '../db/mongoClient.js'
import Boom from '@hapi/boom'
import { COMPLEXITY_LEVELS } from './activities.service.js'

/*
 * reports.service.js
 *
 * Genera reportes de:
 * - Carga de trabajo ponderada (por área, gerencia y persona)
 * - Eficiencia (actividades cerradas vs totales)
 * - Actividades en curso / finalizadas por periodo
 *
 * Todos los cálculos se basan en el campo `weight` (calculado desde complexity)
 * y en rangos de fechas definidos por el usuario.
 */

// Peso máximo posible por actividad (nivel crítico = 8)
const MAX_WEIGHT = 8

class Reports {
  constructor() {}

  /*
   * Construye el match de fechas para el pipeline.
   * Filtra actividades cuyo start_date o closed_at caen en el rango.
   */
  _dateMatch(from, to) {
    const match = {}
    if (from || to) {
      match.$or = []
      const rangeFilter = {}
      if (from) rangeFilter.$gte = new Date(from)
      if (to)   rangeFilter.$lte = new Date(to)
      match.$or.push({ start_date: rangeFilter })
      match.$or.push({ createdAt: rangeFilter })
    }
    return match
  }

  /*
   * ── Reporte Principal ─────────────────────────────────────────────────────
   * Devuelve en una sola llamada:
   * 1. Estadísticas globales (total, en curso, cerradas, retrasadas)
   * 2. Carga de trabajo % por persona
   * 3. Carga de trabajo % por área
   * 4. Eficiencia por persona (cerradas / total asignadas)
   * 5. Desglose por gerencia
   *
   * @param filters.from       ISO date string
   * @param filters.to         ISO date string
   * @param filters.area       String (nombre del área)
   * @param filters.gerencia_id ObjectId string
   * @param filters.user_id    ObjectId string (para filtrar por persona)
   */
  async getWorkloadReport(filters = {}) {
    try {
      const { from, to, area, gerencia_id, user_id } = filters

      // ── Match base de actividades ──
      const baseMatch = this._dateMatch(from, to)
      baseMatch.status = { $ne: 'cancelado' }

      if (area) {
        // Necesitamos hacer lookup de proyecto para filtrar por área
        // Se hace más abajo en el pipeline
      }

      // ── 1. Estadísticas globales ──────────────────────────────────────────
      const globalPipeline = [
        { $match: baseMatch },
        ...(area ? [
          { $lookup: { from:'projects', localField:'project_id', foreignField:'_id',
              pipeline:[{ $project:{ area:1 } }], as:'proj' } },
          { $unwind: { path:'$proj', preserveNullAndEmptyArrays: true } },
          { $match: { 'proj.area': area } }
        ] : []),
        {
          $group: {
            _id    : null,
            total  : { $sum: 1 },
            en_curso : { $sum: { $cond: [{ $in:['$status',['en_proceso','en_revision','retrasado']] }, 1, 0] } },
            cerradas : { $sum: { $cond: [{ $eq:['$status','cerrado'] }, 1, 0] } },
            retrasadas:{ $sum: { $cond: [{ $eq:['$status','retrasado'] }, 1, 0] } },
            pendientes:{ $sum: { $cond: [{ $eq:['$status','pendiente'] }, 1, 0] } },
            totalWeight: { $sum: { $ifNull:['$weight',1] } },
          }
        }
      ]
      const globalResult = await db.collection('activities').aggregate(globalPipeline).toArray()
      const global = globalResult[0] || { total:0, en_curso:0, cerradas:0, retrasadas:0, pendientes:0, totalWeight:0 }

      // ── 2. Carga de trabajo por PERSONA ───────────────────────────────────
      /*
       * Algoritmo de carga %:
       * - Cada actividad asignada tiene un weight (1/2/4/8)
       * - sumWeight del usuario = suma de weights de sus actividades activas (no cerradas/canceladas)
       * - La carga % = (sumWeight del usuario / MAX_WEIGHT * cant_actividades_activas_globales) * 100
       * Para normalizar: usamos el máximo sumWeight entre todos los usuarios = 100%
       */
      const byPersonPipeline = [
        {
          $match: {
            ...baseMatch,
            status: { $nin: ['cerrado','cancelado'] }
          }
        },
        ...(area ? [
          { $lookup: { from:'projects', localField:'project_id', foreignField:'_id',
              pipeline:[{ $project:{ area:1 } }], as:'proj' } },
          { $unwind: { path:'$proj', preserveNullAndEmptyArrays: true } },
          { $match: { 'proj.area': area } }
        ] : []),
        { $unwind: '$assignees' },
        {
          $group: {
            _id        : '$assignees',
            activeCount: { $sum: 1 },
            sumWeight  : { $sum: { $ifNull:['$weight',1] } },
            byComplexity: {
              $push: '$complexity'
            }
          }
        },
        {
          $lookup: {
            from     : 'users',
            localField: '_id',
            foreignField: '_id',
            pipeline : [{ $project: { name:1, role:1, area:1, gerencia_id:1 } }],
            as       : 'user'
          }
        },
        { $unwind: { path:'$user', preserveNullAndEmptyArrays: true } },
        ...(gerencia_id && ObjectId.isValid(gerencia_id) ? [
          { $match: { 'user.gerencia_id': new ObjectId(gerencia_id) } }
        ] : []),
        ...(user_id && ObjectId.isValid(user_id) ? [
          { $match: { _id: new ObjectId(user_id) } }
        ] : []),
        { $sort: { sumWeight: -1 } }
      ]

      const byPerson = await db.collection('activities').aggregate(byPersonPipeline).toArray()

      // Calcular % relativo al usuario con más carga
      const maxWeight = byPerson.length > 0 ? byPerson[0].sumWeight : 1
      const byPersonWithPct = byPerson.map(p => {
        const pct = maxWeight > 0 ? Math.round((p.sumWeight / maxWeight) * 100) : 0
        // Contar por nivel de complejidad
        const complexityCount = { basica:0, intermedia:0, avanzada:0, critica:0 }
        ;(p.byComplexity || []).forEach(c => {
          if (complexityCount[c] !== undefined) complexityCount[c]++
        })
        return {
          user       : p.user,
          activeCount: p.activeCount,
          sumWeight  : p.sumWeight,
          loadPct    : pct,
          complexity : complexityCount
        }
      })

      // ── 3. Eficiencia por PERSONA (actividades cerradas en el periodo) ────
      const efficiencyPipeline = [
        { $match: { ...baseMatch, status: 'cerrado' } },
        ...(area ? [
          { $lookup: { from:'projects', localField:'project_id', foreignField:'_id',
              pipeline:[{ $project:{ area:1 } }], as:'proj' } },
          { $unwind: { path:'$proj', preserveNullAndEmptyArrays: true } },
          { $match: { 'proj.area': area } }
        ] : []),
        { $unwind: '$assignees' },
        {
          $group: {
            _id        : '$assignees',
            closed     : { $sum: 1 },
            avgDaysTaken: { $avg: { $ifNull:['$days_taken', null] } }
          }
        }
      ]
      const efficiencyData = await db.collection('activities').aggregate(efficiencyPipeline).toArray()
      const efficiencyMap  = {}
      efficiencyData.forEach(e => {
        efficiencyMap[e._id.toString()] = {
          closed: e.closed,
          avgDays: e.avgDaysTaken ? Math.round(e.avgDaysTaken * 10) / 10 : null
        }
      })

      // Combinar eficiencia con carga
      const byPersonFull = byPersonWithPct.map(p => {
        const uid = p.user?._id?.toString()
        const eff = uid ? (efficiencyMap[uid] || { closed:0, avgDays:null }) : { closed:0, avgDays:null }
        const totalForUser = p.activeCount + eff.closed
        const effPct = totalForUser > 0 ? Math.round((eff.closed / totalForUser) * 100) : 0
        return { ...p, closed: eff.closed, avgDays: eff.avgDays, efficiencyPct: effPct }
      })

      // ── 4. Carga por ÁREA ─────────────────────────────────────────────────
      const byAreaPipeline = [
        {
          $match: {
            ...baseMatch,
            status: { $nin: ['cerrado','cancelado'] }
          }
        },
        {
          $lookup: {
            from     : 'projects',
            localField: 'project_id',
            foreignField: '_id',
            pipeline : [{ $project: { area:1 } }],
            as       : 'proj'
          }
        },
        { $unwind: { path:'$proj', preserveNullAndEmptyArrays: true } },
        ...(area ? [{ $match: { 'proj.area': area } }] : []),
        {
          $group: {
            _id       : '$proj.area',
            activeCount: { $sum: 1 },
            sumWeight : { $sum: { $ifNull:['$weight',1] } }
          }
        },
        { $sort: { sumWeight: -1 } }
      ]
      const byAreaRaw = await db.collection('activities').aggregate(byAreaPipeline).toArray()
      const maxAreaWeight = byAreaRaw.length > 0 ? byAreaRaw[0].sumWeight : 1
      const byArea = byAreaRaw.map(a => ({
        area       : a._id || 'Sin área',
        activeCount: a.activeCount,
        sumWeight  : a.sumWeight,
        loadPct    : maxAreaWeight > 0 ? Math.round((a.sumWeight / maxAreaWeight) * 100) : 0
      }))

      // ── 5. Actividades cerradas por ÁREA en el periodo ────────────────────
      const closedByAreaPipeline = [
        { $match: { ...baseMatch, status: 'cerrado' } },
        {
          $lookup: {
            from     : 'projects',
            localField: 'project_id',
            foreignField: '_id',
            pipeline : [{ $project: { area:1 } }],
            as       : 'proj'
          }
        },
        { $unwind: { path:'$proj', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id   : '$proj.area',
            closed: { $sum: 1 }
          }
        }
      ]
      const closedByAreaRaw = await db.collection('activities').aggregate(closedByAreaPipeline).toArray()
      const closedByAreaMap = {}
      closedByAreaRaw.forEach(a => { closedByAreaMap[a._id || 'Sin área'] = a.closed })

      // Enriquecer byArea con cerradas
      const byAreaFull = byArea.map(a => ({
        ...a,
        closed: closedByAreaMap[a.area] || 0,
        total : a.activeCount + (closedByAreaMap[a.area] || 0),
        efficiencyPct: (() => {
          const tot = a.activeCount + (closedByAreaMap[a.area] || 0)
          return tot > 0 ? Math.round(((closedByAreaMap[a.area] || 0) / tot) * 100) : 0
        })()
      }))

      // ── 6. Proyectos involucrados ─────────────────────────────────────────
      const projectsPipeline = [
        { $match: baseMatch },
        ...(area ? [
          { $lookup: { from:'projects', localField:'project_id', foreignField:'_id',
              pipeline:[{ $project:{ area:1 } }], as:'proj' } },
          { $unwind: { path:'$proj', preserveNullAndEmptyArrays: true } },
          { $match: { 'proj.area': area } }
        ] : []),
        {
          $group: {
            _id     : '$project_id',
            total   : { $sum: 1 },
            cerradas: { $sum: { $cond:[{ $eq:['$status','cerrado'] },1,0] } }
          }
        },
        {
          $lookup: {
            from     : 'projects',
            localField: '_id',
            foreignField: '_id',
            pipeline : [{ $project: { folio_os:1, name:1, area:1, status:1 } }],
            as       : 'project'
          }
        },
        { $unwind: { path:'$project', preserveNullAndEmptyArrays: true } },
        { $sort: { total: -1 } }
      ]
      const projectsInvolved = await db.collection('activities').aggregate(projectsPipeline).toArray()

      return {
        period: { from: from || null, to: to || null },
        filters: { area: area || null, gerencia_id: gerencia_id || null },
        global,
        byPerson: byPersonFull,
        byArea  : byAreaFull,
        projects: projectsInvolved,
        complexityLevels: COMPLEXITY_LEVELS
      }

    } catch (error) {
      if (Boom.isBoom(error)) throw error
      throw Boom.badImplementation('No se pudo generar el reporte', error)
    }
  }
}

export default Reports
