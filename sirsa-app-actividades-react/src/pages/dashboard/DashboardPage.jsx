import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, ClipboardList, Clock, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import { projectsAPI } from '../../services/api'
import { Card, Badge, StatusBadge, Progress, Spinner, Empty, Avatar, Button, KpiCard, SectionHeader } from '../../components/ui'
import { formatDate, daysUntil, AREAS, cn } from '../../lib/utils'
import { useAuth } from '../../context/AppContext'
import toast from 'react-hot-toast'

// ── Gráfica de barras CSS ─────────────────────────────────────────────────────
const BAR_CFG = {
  pendiente  : { label:'Pendientes',  color:'#A0A09F' },
  en_proceso : { label:'En proceso',  color:'#2E75B6' },
  retrasado  : { label:'Retrasadas',  color:'#B08629' },
  en_revision: { label:'En revisión', color:'#8B5CF6' },
  cerrado    : { label:'Cerradas',    color:'#2BA84A' },
  cancelado  : { label:'Canceladas',  color:'#E63946' },
}

const ActivityChart = ({ byStatus = {} }) => {
  const max  = Math.max(1, ...Object.values(byStatus))
  const data = Object.entries(BAR_CFG).filter(([k]) => (byStatus[k] || 0) > 0)

  if (!data.length) return (
    <div className="h-28 flex items-center justify-center text-sm text-[#A0A09F]">
      Sin datos
    </div>
  )

  return (
    <div className="flex items-end gap-3 h-28 pt-2">
      {Object.entries(BAR_CFG).map(([status, { label, color }]) => {
        const count = byStatus[status] || 0
        const pct   = (count / max) * 100
        return (
          <div key={status} className="flex-1 flex flex-col items-center gap-1.5">
            <span className="text-xs font-bold text-[#1D1C19]">{count}</span>
            <div className="w-full rounded-t-md transition-all duration-700"
              style={{ height:`${Math.max(count ? 6 : 0, pct * 0.80)}px`, background: color }} />
            <span className="text-[9px] text-[#A0A09F] text-center leading-tight">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoad]  = useState(true)
  const [area, setArea]     = useState('')

  const load = useCallback(async () => {
    setLoad(true)
    try {
      const res = await projectsAPI.getDashboard(area ? { area } : {})
      setData(res.data.data)
    } catch { toast.error('Error al cargar el dashboard') } finally { setLoad(false) }
  }, [area])

  useEffect(() => { load() }, [load])

  const ps  = data?.projects?.byStatus  || {}
  const as  = data?.activities?.byStatus || {}
  const totalProjects   = data?.projects?.total    || 0
  const totalActivities = data?.activities?.total   || 0
  const delayed         = as.retrasado || 0
  const closed          = as.cerrado   || 0

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1D1C19]">Dashboard</h1>
          <p className="text-sm text-[#626261] mt-0.5">
            Resumen general del departamento técnico
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={area} onChange={e => setArea(e.target.value)}
            className="text-sm border border-[#D9D9D9] rounded-lg px-3 py-2 bg-white
              text-[#1D1C19] focus:outline-none focus:border-[#F8CD24] min-h-[40px]">
            <option value="">Todas las áreas</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <Button variant="outline" size="md" icon={<RefreshCw size={13} />} onClick={load}>
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={FolderOpen}    label="Proyectos activos"
          value={totalProjects}
          sub={`${ps.en_proceso || 0} en proceso`}
          color="default" accent />
        <KpiCard icon={ClipboardList} label="Actividades totales"
          value={totalActivities}
          sub={`${as.en_proceso || 0} en curso`}
          color="blue" accent />
        <KpiCard icon={AlertTriangle} label="Retrasadas"
          value={delayed}
          sub={delayed > 0 ? 'Requieren atención' : 'Sin retrasos ✓'}
          color={delayed > 0 ? 'red' : 'green'} accent/>
        <KpiCard icon={CheckCircle2}  label="Actividades cerradas"
          value={closed}
          sub="Total acumulado"
          color="green" accent/>
      </div>

      {/* Fila media */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Tabla de proyectos */}
        <Card className="lg:col-span-3">
          <Card.Header>
            <Card.Title>Proyectos activos</Card.Title>
            <button onClick={() => navigate('/projects')}
              className="text-xs text-[#2E75B6] hover:underline font-medium">
              Ver todos →
            </button>
          </Card.Header>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_90px_80px] gap-2 px-5 py-2
            bg-[#1D1C19] text-[#FBFBFB] text-2xs font-semibold uppercase tracking-wider">
            <span>Proyecto</span>
            <span>Área</span>
            <span className="text-center">Avance</span>
            <span className="text-right">Estatus</span>
          </div>

          <div className="divide-y divide-[#F5F5F5]">
            {(data?.projects?.active || []).length === 0
              ? <Empty title="Sin proyectos activos" />
              : (data?.projects?.active || []).slice(0, 6).map(p => (
                <div key={p._id}
                  className="grid grid-cols-[1fr_auto_90px_80px] gap-2 px-5 py-3
                    items-center table-row-hover cursor-pointer transition-colors"
                  onClick={() => navigate(`/projects/${p._id}`)}>
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-[#A0A09F]">{p.folio_os}</p>
                    <p className="text-sm font-semibold text-[#1D1C19] truncate">{p.name}</p>
                  </div>
                  <div>
                    {p.area && (
                      <Badge variant="default" className="text-2xs whitespace-nowrap">
                        {p.area}
                      </Badge>
                    )}
                  </div>
                  <Progress value={p.progress || 0} showLabel />
                  <div className="text-right">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))
            }
          </div>
        </Card>

        {/* Gráfica */}
        <Card className="lg:col-span-2">
          <Card.Header><Card.Title>Actividades por estatus</Card.Title></Card.Header>
          <Card.Body>
            <ActivityChart byStatus={as} />
            <div className="mt-4 pt-3 border-t border-[#F5F5F5] flex justify-between text-xs">
              <span className="text-[#A0A09F]">Total actividades</span>
              <span className="font-bold text-[#1D1C19]">{totalActivities}</span>
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Fila inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Por vencer */}
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <Clock size={14} className="text-[#B08629]" />
              Próximas a vencer
            </Card.Title>
            <button onClick={() => navigate('/activities?overdue=true')}
              className="text-xs text-[#2E75B6] hover:underline font-medium">
              Ver todas →
            </button>
          </Card.Header>
          <div className="divide-y divide-[#F5F5F5]">
            {(data?.activities?.upcoming || []).length === 0
              ? <Empty title="Sin actividades próximas a vencer" />
              : (data?.activities?.upcoming || []).map(a => {
                const d = daysUntil(a.target_date)
                return (
                  <div key={a._id}
                    className="px-5 py-3 flex items-center gap-3 table-row-hover cursor-pointer"
                    onClick={() => navigate(`/activities/${a._id}`)}>
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                      d < 0 ? 'bg-[#E63946]' : d <= 1 ? 'bg-[#B08629]' : 'bg-[#2E75B6]')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1D1C19] truncate">{a.name}</p>
                      <p className="text-xs text-[#A0A09F]">{a.project?.folio_os}</p>
                    </div>
                    <span className={cn('text-xs font-bold flex-shrink-0',
                      d < 0 ? 'text-[#E63946]' : d <= 1 ? 'text-[#B08629]' : 'text-[#2E75B6]')}>
                      {d < 0 ? 'Vencida' : d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${d}d`}
                    </span>
                  </div>
                )
              })
            }
          </div>
        </Card>

        {/* Carga de trabajo */}
        <Card>
          <Card.Header><Card.Title>Carga de trabajo</Card.Title></Card.Header>
          <div className="divide-y divide-[#F5F5F5]">
            {(data?.workload || []).length === 0
              ? <Empty title="Sin datos de carga" />
              : (data?.workload || []).map(w => {
                const max  = data.workload[0]?.total || 1
                const pct  = Math.round((w.total / max) * 100)
                const col  = pct >= 80 ? 'red' : pct >= 50 ? 'yellow' : 'default'
                const barC = pct >= 80 ? '#E63946' : pct >= 50 ? '#F8CD24' : '#2BA84A'
                return (
                  <div key={w._id} className="px-5 py-3 flex items-center gap-3">
                    <Avatar name={w.user?.name} size="sm" src={w.user?.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1D1C19] truncate">{w.user?.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width:`${pct}%`, background: barC }} />
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-[#626261] flex-shrink-0 font-medium">
                      {w.total} act.
                    </span>
                  </div>
                )
              })
            }
          </div>
        </Card>
      </div>
    </div>
  )
}

export default DashboardPage
