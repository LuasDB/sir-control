import { useState, useCallback } from 'react'
import {
  BarChart2, Users, Clock, CheckCircle2, AlertTriangle,
  Download, Filter, TrendingUp, Layers
} from 'lucide-react'
import { reportsAPI } from '../../services/api'
import { Card, Button, Select, Spinner, Empty, Avatar, Badge } from '../../components/ui'
import { AREAS, COMPLEXITY_LEVELS, cn, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'

// ── Barra de progreso con color dinámico ──────────────────────────────────────
const WorkloadBar = ({ pct, color }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1 h-2.5 bg-[#F0F0F0] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width:`${pct}%`, background: color }} />
    </div>
    <span className="text-sm font-bold tabular-nums w-10 text-right"
      style={{ color }}>
      {pct}%
    </span>
  </div>
)

const getLoadColor = (pct) => {
  if (pct >= 80) return '#E63946'
  if (pct >= 50) return '#B08629'
  return '#2BA84A'
}

// ── Tabla de carga por persona ────────────────────────────────────────────────
const WorkloadTable = ({ data }) => {
  if (!data?.length) return (
    <Empty icon={<Users size={32} />} title="Sin datos de carga"
      description="No hay actividades en el periodo seleccionado" />
  )

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div className="grid grid-cols-[300px_80px_80px_80px_80px_80px_80px_120px_80px] gap-2
        px-4 py-2.5 bg-[#1D1C19] text-white text-2xs font-semibold uppercase tracking-wider
        rounded-t-lg">
        <span>Usuario</span>
        <span className="text-center">Activas</span>
        <span className="text-center">Cerradas</span>
        <span className="text-center">Básica</span>
        <span className="text-center">Intermedia</span>
        <span className="text-center">Avanzada</span>
        <span className="text-center">Critica</span>
        <span>Carga %</span>
        <span className="text-center">Eficiencia</span>
      </div>

      <div className="divide-y divide-[#F5F5F5] border border-t-0 border-[#F0F0F0] rounded-b-lg">
        {data.map((row, i) => {
          const loadColor = getLoadColor(row.loadPct)
          const effColor  = row.efficiencyPct >= 70 ? '#2BA84A'
                          : row.efficiencyPct >= 40 ? '#B08629' : '#E63946'
          return (
            <div key={row.user?._id || i}
              className="grid grid-cols-[300px_80px_80px_80px_80px_80px_80px_120px_80px] gap-2
                px-4 py-3 items-center hover:bg-[rgba(248,205,36,0.04)] transition-colors">

              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={row.user?.name} size="sm" src={row.user?.avatar_url} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1D1C19] truncate">
                    {row.user?.name || 'Usuario eliminado'}
                  </p>
                  <p className="text-2xs text-[#A0A09F]">{row.user?.area || row.user?.role}</p>
                </div>
              </div>

              <p className="text-sm font-bold text-[#1D1C19] text-center"> {row.activeCount}</p>
              <p className="text-sm font-bold text-[#2BA84A] text-center">{row.closed}</p>
              <p className="text-xs text-center text-[#2E75B6]">{row.complexity?.basica || 0}</p>
              <p className="text-xs text-center text-[#d9cb08]">{row.complexity?.intermedia || 0}</p>
              <p className="text-xs text-center text-[#d92dcb]">{row.complexity?.avanzada || 0}</p>
              <p className="text-xs text-center text-[#ea304c]">{row.complexity?.critica || 0}</p>

              <WorkloadBar pct={row.loadPct} color={loadColor} />

              <div className="flex justify-center">
                <span className="text-sm font-bold px-2 py-0.5 rounded-full"
                  style={{ color: effColor, background: `${effColor}18` }}>
                  {row.efficiencyPct}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tabla de carga por área ───────────────────────────────────────────────────
const AreaTable = ({ data }) => {
  if (!data?.length) return (
    <Empty icon={<Layers size={32} />} title="Sin datos por área" />
  )

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[1fr_80px_80px_80px_120px_80px] gap-2
        px-4 py-2.5 bg-[#1D1C19] text-white text-2xs font-semibold uppercase tracking-wider rounded-t-lg">
        <span>Área</span>
        <span className="text-center">Activas</span>
        <span className="text-center">Cerradas</span>
        <span className="text-center">Total</span>
        <span>Carga %</span>
        <span className="text-center">Eficiencia</span>
      </div>
      <div className="divide-y divide-[#F5F5F5] border border-t-0 border-[#F0F0F0] rounded-b-lg">
        {data.map((row, i) => {
          const loadColor = getLoadColor(row.loadPct)
          const effColor  = row.efficiencyPct >= 70 ? '#2BA84A'
                          : row.efficiencyPct >= 40 ? '#B08629' : '#E63946'
          return (
            <div key={row.area || i}
              className="grid grid-cols-[1fr_80px_80px_80px_120px_80px] gap-2
                px-4 py-3 items-center hover:bg-[rgba(248,205,36,0.04)] transition-colors">
              <p className="text-sm font-semibold text-[#1D1C19]">{row.area}</p>
              <p className="text-sm text-center text-[#1D1C19]">{row.activeCount}</p>
              <p className="text-sm text-center text-[#2BA84A]">{row.closed}</p>
              <p className="text-sm text-center font-bold text-[#1D1C19]">{row.total}</p>
              <WorkloadBar pct={row.loadPct} color={loadColor} />
              <div className="flex justify-center">
                <span className="text-sm font-bold px-2 py-0.5 rounded-full"
                  style={{ color: effColor, background: `${effColor}18` }}>
                  {row.efficiencyPct}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── ReportsPage ───────────────────────────────────────────────────────────────
const ReportsPage = () => {
  const [filters, setFilters] = useState({
    from: '', to: '', area: ''
  })
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setTab]   = useState('person')

  const runReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.from) params.from = new Date(filters.from).toISOString()
      if (filters.to)   params.to   = new Date(filters.to + 'T23:59:59').toISOString()
      if (filters.area) params.area = filters.area
      const res = await reportsAPI.getWorkload(params)
      setData(res.data.data)
    } catch { toast.error('Error al generar el reporte') } finally { setLoading(false) }
  }, [filters])

  const f = (k, v) => setFilters(p => ({ ...p, [k]: v }))

  const global = data?.global

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1D1C19]">Reportes</h1>
          <p className="text-sm text-[#626261] mt-0.5">
            Carga de trabajo y eficiencia por periodo, área y persona
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <Card.Body className="py-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#626261]">Desde</label>
              <input type="date" value={filters.from}
                onChange={e => f('from', e.target.value)}
                className="input-sirsa w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#626261]">Hasta</label>
              <input type="date" value={filters.to}
                onChange={e => f('to', e.target.value)}
                className="input-sirsa w-40" />
            </div>
            <Select label="Área" value={filters.area}
              onChange={e => f('area', e.target.value)}
              placeholder="Todas las áreas"
              options={AREAS.map(a => ({ value:a, label:a }))}
              className="w-48" />
            <Button variant="primary" icon={<Filter size={14} />}
              onClick={runReport} loading={loading}>
              Generar reporte
            </Button>
            {data && (
              <p className="text-xs text-[#A0A09F] self-end pb-2.5">
                Periodo: {filters.from ? formatDate(filters.from) : 'Todo'} —
                {filters.to ? ` ${formatDate(filters.to)}` : ' Hoy'}
              </p>
            )}
          </div>
        </Card.Body>
      </Card>

      {!data && !loading && (
        <Empty icon={<BarChart2 size={40} />}
          title="Selecciona un periodo y genera el reporte"
          description="Puedes filtrar por área o ver todos los departamentos" />
      )}

      {loading && (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      )}

      {data && !loading && (
        <>
          {/* KPIs globales */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="border-l-[3px] border-l-[#F8CD24]">
              <Card.Body className="py-4">
                <p className="text-2xs text-[#626261] mb-1 flex items-center gap-1">
                  <ClipboardList size={11} /> Total actividades
                </p>
                <p className="text-3xl font-bold text-[#1D1C19]">{global?.total || 0}</p>
              </Card.Body>
            </Card>
            <Card>
              <Card.Body className="py-4">
                <p className="text-2xs text-[#626261] mb-1 flex items-center gap-1">
                  <Clock size={11} /> En curso
                </p>
                <p className="text-3xl font-bold text-[#2E75B6]">{global?.en_curso || 0}</p>
              </Card.Body>
            </Card>
            <Card>
              <Card.Body className="py-4">
                <p className="text-2xs text-[#626261] mb-1 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Cerradas
                </p>
                <p className="text-3xl font-bold text-[#2BA84A]">{global?.cerradas || 0}</p>
              </Card.Body>
            </Card>
            <Card>
              <Card.Body className="py-4">
                <p className="text-2xs text-[#626261] mb-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> Retrasadas
                </p>
                <p className="text-3xl font-bold text-[#E63946]">{global?.retrasadas || 0}</p>
              </Card.Body>
            </Card>
            <Card>
              <Card.Body className="py-4">
                <p className="text-2xs text-[#626261] mb-1 flex items-center gap-1">
                  <TrendingUp size={11} /> Eficiencia global
                </p>
                <p className="text-3xl font-bold text-[#2BA84A]">
                  {global?.total > 0
                    ? Math.round((global.cerradas / global.total) * 100)
                    : 0}%
                </p>
              </Card.Body>
            </Card>
          </div>

          {/* Leyenda de complejidad */}
          <Card>
            <Card.Body className="py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#626261]">Ponderación:</span>
                {Object.entries(COMPLEXITY_LEVELS).map(([k, m]) => (
                  <span key={k} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background:`${m.color}18`, color: m.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                    {m.label} = ×{m.weight}
                  </span>
                ))}
                <span className="text-2xs text-[#A0A09F] ml-2">
                  · Carga % = peso acumulado relativo al usuario con más carga
                </span>
              </div>
            </Card.Body>
          </Card>

          {/* Tabs: Por persona / Por área / Proyectos */}
          <div className="flex gap-1 border-b border-[#F0F0F0]">
            {[
              { id:'person',   label:`Por persona (${data.byPerson?.length || 0})` },
              { id:'area',     label:`Por área (${data.byArea?.length || 0})` },
              { id:'projects', label:`Proyectos (${data.projects?.length || 0})` },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === t.id
                    ? 'border-[#F8CD24] text-[#1D1C19] font-bold'
                    : 'border-transparent text-[#626261] hover:text-[#1D1C19]')}>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'person' && (
            <Card>
              <Card.Header>
                <Card.Title className="flex items-center gap-2">
                  <Users size={15} /> Carga de trabajo y eficiencia por persona
                </Card.Title>
              </Card.Header>
              <Card.Body className="p-0 pb-4">
                <WorkloadTable data={data.byPerson} />
              </Card.Body>
            </Card>
          )}

          {activeTab === 'area' && (
            <Card>
              <Card.Header>
                <Card.Title className="flex items-center gap-2">
                  <Layers size={15} /> Carga de trabajo por área
                </Card.Title>
              </Card.Header>
              <Card.Body className="p-0 pb-4">
                <AreaTable data={data.byArea} />
              </Card.Body>
            </Card>
          )}

          {activeTab === 'projects' && (
            <Card>
              <Card.Header>
                <Card.Title className="flex items-center gap-2">
                  <BarChart2 size={15} /> Actividades por proyecto en el periodo
                </Card.Title>
              </Card.Header>
              <div className="divide-y divide-[#F5F5F5]">
                {data.projects?.length === 0
                  ? <Empty title="Sin proyectos en el periodo" />
                  : data.projects.map(p => {
                    const pct = p.total > 0 ? Math.round((p.cerradas / p.total) * 100) : 0
                    return (
                      <div key={p._id} className="px-5 py-3.5 flex items-center gap-4
                        hover:bg-[rgba(248,205,36,0.04)] transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-[#A0A09F]">{p.project?.folio_os}</p>
                          <p className="text-sm font-semibold text-[#1D1C19] truncate">{p.project?.name}</p>
                          <p className="text-2xs text-[#A0A09F]">{p.project?.area}</p>
                        </div>
                        <div className="flex items-center gap-6 text-sm flex-shrink-0">
                          <div className="text-center">
                            <p className="text-lg font-bold text-[#1D1C19]">{p.total}</p>
                            <p className="text-2xs text-[#A0A09F]">Total</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-[#2BA84A]">{p.cerradas}</p>
                            <p className="text-2xs text-[#A0A09F]">Cerradas</p>
                          </div>
                          <div className="w-28">
                            <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden mb-1">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width:`${pct}%`, background: getLoadColor(pct) }} />
                            </div>
                            <p className="text-2xs text-right font-bold"
                              style={{ color: getLoadColor(pct) }}>
                              {pct}% completado
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// Import faltante
import { ClipboardList } from 'lucide-react'

export default ReportsPage
