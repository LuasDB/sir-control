import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Plus, Search, FolderOpen, ChevronRight, Layers, Building2,
  Calendar, MessageSquare, Send, X, UserPlus, UserMinus, Users, Pencil
} from 'lucide-react'
import {
  projectsAPI, chatAPI, activitiesAPI, usersAPI, clientsAPI
} from '../../services/api'
import {
  Card, Button, Input, Select, Textarea, StatusBadge, Progress,
  Badge, Avatar, Modal, Spinner, Empty
} from '../../components/ui'
import { formatDate, daysUntil, AREAS, MANAGEMENT_ROLES, COMPLEXITY_LEVELS, cn } from '../../lib/utils'
import { useAuth, useSocket } from '../../context/AppContext'
import toast from 'react-hot-toast'
import { ClipboardList } from 'lucide-react'


// ── Projects List ─────────────────────────────────────────────────────────────
export const ProjectsPage = () => {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const canCreate  = MANAGEMENT_ROLES.includes(user?.role)
  const isManager = MANAGEMENT_ROLES.includes(user?.role)

  const [projects, setProjects]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [filters, setFilters]     = useState({ search:'', status:'', area:'' })
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.status) params.status = filters.status
      if (filters.area)   params.area   = filters.area
      const res = await projectsAPI.getAll(params)
      setProjects(res.data.data)
    } catch { toast.error('Error al cargar proyectos') } finally { setLoading(false) }
  }, [filters.status, filters.area])

  useEffect(() => { load() }, [load])

  const searched = filters.search
    ? projects.filter(p =>
        p.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        p.folio_os?.toLowerCase().includes(filters.search.toLowerCase()))
    : projects

  return (
    <div className="space-y-4 animate-fade-in min-h-[90vh]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-semibold text-charcoal">Proyectos</h1>
          {/* Cambio 6: aviso de que cada usuario solo ve sus proyectos */}
          <p className="text-xs text-charcoal-muted mt-0.5">
            {MANAGEMENT_ROLES.includes(user?.role)
              ? `${projects.length} proyecto(s) en el sistema`
              : `${projects.length} proyecto(s) asignado(s) a ti`}
          </p>
        </div>
        {canCreate && (
          <Button variant="gold" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>
            Nuevo proyecto
          </Button>
        )}
      </div>

      <Card>
        <Card.Body className="py-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-40">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-muted" />
              <input placeholder="Buscar por nombre o folio OS…" value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-silver-border rounded bg-white
                  focus:outline-none focus:border-navy" />
            </div>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              className="text-sm border border-silver-border rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-navy">
              <option value="">Todos los estatus</option>
              {['pendiente','en_proceso','retrasado','en_revision','cerrado','cancelado'].map(s => (
                <option key={s} value={s}>{s.replace('_',' ')}</option>
              ))}
            </select>
            {isManager && (<select value={filters.area} onChange={e => setFilters(f => ({ ...f, area: e.target.value }))}
              className="text-sm border border-silver-border rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-navy">
              <option value="">Todas las áreas</option>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>)}
          </div>
        </Card.Body>
      </Card>

      {loading
        ? <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        : searched.length === 0
          ? <Empty icon={<FolderOpen size={40} />} title="Sin proyectos"
              description={canCreate ? 'Crea el primer proyecto' : 'No tienes proyectos asignados aún'}
              action={canCreate && <Button variant="gold" icon={<Plus size={14} />}
                onClick={() => setShowModal(true)}>Nuevo proyecto</Button>} />
          : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {searched.map(p => <ProjectCard key={p._id} project={p} />)}
            </div>
          )
      }

      {showModal && <ProjectFormModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  )
}

// ── Project Card ──────────────────────────────────────────────────────────────
const ProjectCard = ({ project: p }) => {
  const navigate = useNavigate()
  const days     = daysUntil(p.target_date)

  return (
    <Card className="hover:border-navy/30 cursor-pointer transition-colors group"
      onClick={() => navigate(`/projects/${p._id}`)}>
      <Card.Body>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono text-charcoal-muted">{p.folio_os}</span>
              {p.area && <Badge variant="navy" className="text-[10px] px-1.5">{p.area}</Badge>}
            </div>
            <h3 className="text-sm font-semibold text-charcoal truncate group-hover:text-navy transition-colors">
              {p.name}
            </h3>
          </div>
          <StatusBadge status={p.status} />
        </div>

        {p.client?.razon_social && (
          <p className="text-xs text-charcoal-muted mb-2 flex items-center gap-1">
            <Building2 size={11} /> {p.client.razon_social}
          </p>
        )}

        <Progress value={p.progress || 0} showLabel className="mb-2" />

        {/* Cambio 6: mostrar avatares de miembros en la tarjeta */}
        {p.members_info?.length > 0 && (
          <div className="flex items-center gap-1 mb-2">
            {p.members_info.slice(0, 5).map(m => (
              <Avatar key={m._id} name={m.name} size="xs" title={m.name} src={m.avatar_url}/>
            ))}
            {p.members_info.length > 5 && (
              <span className="text-[10px] text-charcoal-muted ml-1">
                +{p.members_info.length - 5} más
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-charcoal-muted">
          <span className="flex items-center gap-1">
            <Calendar size={11} /> {formatDate(p.target_date)}
          </span>
          {days !== null && !['cerrado','cancelado'].includes(p.status) && (
            <span className={cn('font-medium',
              days < 0 ? 'text-red-500' : days <= 3 ? 'text-amber-500' : 'text-charcoal-muted')}>
              {days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Vence hoy' : `${days}d restantes`}
            </span>
          )}
        </div>
      </Card.Body>
    </Card>
  )
}

// ── Project Detail ────────────────────────────────────────────────────────────
export const ProjectDetailPage = () => {
  const { id }    = useParams()
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const socket    = useSocket()
  const isManager = MANAGEMENT_ROLES.includes(user?.role)

  const [project, setProject]       = useState(null)
  const [dashboard, setDash]        = useState(null)
  const [activities, setActs]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('activities')
  const [showCloseConfirm, setCloseConfirm] = useState(false)
  const [showEditProject, setEditProject]   = useState(false) // Cambio 1

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projRes, dashRes, actsRes] = await Promise.all([
        projectsAPI.getOne(id),
        projectsAPI.getProjectDash(id),
        activitiesAPI.getAll({ project_id: id })
      ])
      setProject(projRes.data.data)
      console.log(projRes.data.data)
      setDash(dashRes.data.data)
      setActs(actsRes.data.data)
    } catch { toast.error('Error al cargar el proyecto') } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  // Cambio 3: Sincronización en tiempo real
  useEffect(() => {
    if (!socket) return
    const onUpdate = (data) => { if (data.projectId === id) load() }
    const onActUpdate = () => load()
    socket.on('project:updated', onUpdate)
    socket.on('project:closed', onUpdate)
    socket.on('project:member_added', onUpdate)
    socket.on('activity:created', onActUpdate)
    socket.on('activity:updated', onActUpdate)
    socket.on('activity:status_changed', onActUpdate)
    return () => {
      socket.off('project:updated', onUpdate)
      socket.off('project:closed', onUpdate)
      socket.off('project:member_added', onUpdate)
      socket.off('activity:created', onActUpdate)
      socket.off('activity:updated', onActUpdate)
      socket.off('activity:status_changed', onActUpdate)
    }
  }, [socket, id, load])

  const handleClose = async () => {
    try {
      await projectsAPI.close(id)
      toast.success('Proyecto cerrado'); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') } finally { setCloseConfirm(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!project) return <Empty title="Proyecto no encontrado" />

  const byStatus = dashboard?.activities?.byStatus || {}
  const CLOSING_ROLES = ['superadmin','admin','gerente','coordinador']

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <Card>
        <Card.Body className="py-3">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <button onClick={() => navigate('/projects')}
                  className="text-xs text-charcoal-muted hover:text-navy">Proyectos</button>
                <ChevronRight size={12} className="text-charcoal-muted" />
                <span className="text-xs font-mono text-charcoal-muted">{project.folio_os}</span>
              </div>
              <h1 className="text-lg font-semibold text-charcoal">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-charcoal-muted mt-0.5">{project.description}</p>
              )}
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#626261]">
                {project.area && <span className="flex items-center gap-1"><Layers size={11}/>{project.area}</span>}
                {project.target_date && <span className="flex items-center gap-1"><Calendar size={11}/>Objetivo: {formatDate(project.target_date)}</span>}
              </div>

              {/* Cambio 2: Datos completos del cliente */}
              {project.client && (
                <div className="mt-3 p-3 bg-[#F5F5F5] rounded-xl border border-[#F0F0F0]">
                  <p className="text-2xs font-bold text-[#A0A09F] uppercase tracking-wider mb-2">
                    Cliente / Contacto
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-[#626261]">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={11} className="text-[#A0A09F]" />
                      <strong className="text-[#1D1C19]">{project.client.razon_social}</strong>
                    </span>
                    {project.client.contact_name && (
                      <span className="flex items-center gap-1.5">
                        <Users size={11} className="text-[#A0A09F]" />
                        {project.client.contact_name}
                      </span>
                    )}
                    {project.client.phone && (
                      <span className="flex items-center gap-1.5">
                        <span className="text-[#A0A09F] text-[10px]">📞</span>
                        <a href={`tel:${project.client.phone}`}
                          className="text-[#2E75B6] hover:underline">
                          {project.client.phone}
                        </a>
                      </span>
                    )}
                    {project.client.email && (
                      <span className="flex items-center gap-1.5">
                        <span className="text-[#A0A09F] text-[10px]">✉</span>
                        <a href={`mailto:${project.client.email}`}
                          className="text-[#2E75B6] hover:underline truncate max-w-[160px]">
                          {project.client.email}
                        </a>
                      </span>
                    )}
                  </div>
                </div>
              )}
              {/* Cambio 6: miembros del proyecto */}
              {project.members_info?.length > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-charcoal-muted flex items-center gap-1">
                    <Users size={11}/> Equipo:
                  </span>
                  {project.members_info.map(m => (
                    <span key={m._id} className="flex items-center gap-1">
                      <Avatar name={m.name} size="xs" src={m.avatar_url}/>
                      <span className="text-xs text-charcoal">{m.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={project.status} />
              <div className="text-right">
                <div className="text-2xl font-semibold text-navy">{project.progress || 0}%</div>
                <div className="text-xs text-charcoal-muted">completado</div>
              </div>
              <Progress value={project.progress || 0} className="w-32" />
              {/* Cambio 1: solo managers pueden cerrar */}
              {CLOSING_ROLES.includes(user?.role) && !['cerrado','cancelado'].includes(project.status) && (
                <div className="flex gap-2">
                  {isManager && (
                    <Button variant="outline" size="sm" icon={<Pencil size={13} />}
                      onClick={() => setEditProject(true)}>
                      Editar
                    </Button>
                  )}

                  {/* ── NUEVO: selector de estatus ── */}
                  <select
                    value={project.status}
                    onChange={async (e) => {
                      try {
                        await projectsAPI.updateStatus(project._id, e.target.value)
                        toast.success(`Estatus actualizado a "${e.target.value}"`)
                        load()
                      } catch (err) {
                        toast.error(err.response?.data?.message || 'Error')
                      }
                    }}
                    className="text-sm border border-[#D9D9D9] rounded-lg px-3 py-2 bg-white
                      text-[#1D1C19] focus:outline-none focus:border-[#F8CD24] min-h-[40px]">
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="en_revision">En revisión</option>
                    <option value="retrasado">Retrasado</option>
                    <option value="cerrado">Cerrado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>

                  <Button variant="outline" size="sm" onClick={() => setCloseConfirm(true)}>
                    Cerrar proyecto
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card.Body>

        {/* Mini KPIs */}
        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-silver-border border-t border-silver-border">
          {Object.entries({
            pendiente:'Pendientes', en_proceso:'En proceso', retrasado:'Retrasadas',
            en_revision:'Revisión', cerrado:'Cerradas', cancelado:'Canceladas'
          }).map(([k, label]) => (
            <div key={k} className="py-2 px-3 text-center">
              <div className="text-base font-semibold text-charcoal">{byStatus[k] || 0}</div>
              <div className="text-[10px] text-charcoal-muted">{label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-silver-border flex-wrap">
        {[
          { id:'activities', label:'Actividades' },
          { id:'chat',       label:'Chat del proyecto' },
          // Cambio 6: pestaña de miembros
          { id:'members',    label:`Equipo (${project.members_info?.length || 0})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-navy text-navy' : 'border-transparent text-charcoal-muted hover:text-navy')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'activities' && (
        <ProjectActivities projectId={id} activities={activities} onRefresh={load} />
      )}
      {tab === 'chat' && <ProjectChat projectId={id} user={user} socket={socket} />}
      {tab === 'phases' && (
        <ProjectPhases phases={project.phases || []} projectId={id} isManager={isManager} onRefresh={load} />
      )}
      {/* Cambio 6: pestaña de miembros del proyecto */}
      {tab === 'members' && (
        <ProjectMembers
          projectId={id}
          members={project.members_info || []}
          isManager={isManager}
          onRefresh={load}
        />
      )}

      <Modal open={showCloseConfirm} onClose={() => setCloseConfirm(false)}
        title="Cerrar proyecto"
        footer={<>
          <Button variant="outline" onClick={() => setCloseConfirm(false)}>Cancelar</Button>
          <Button variant="success" onClick={handleClose}>Confirmar cierre</Button>
        </>}>
        <p className="text-sm text-[#1D1C19]">
          ¿Confirmas el cierre formal del proyecto <strong>{project.name}</strong>?
          Esta acción registrará la fecha de cierre y cambiará el estatus a "Cerrado".
        </p>
      </Modal>

      {/* Cambio 1: Modal de edición de proyecto para managers */}
      {showEditProject && (
        <ProjectEditModal project={project} onClose={() => setEditProject(false)} onSaved={load} />
      )}
    </div>
  )
}

// ── Project Activities Tab ────────────────────────────────────────────────────
const ProjectActivities = ({ projectId, activities, onRefresh }) => {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-charcoal-muted">{activities.length} actividades</span>
        <Button variant="gold" size="sm" icon={<Plus size={13} />} onClick={() => setShowForm(true)}>
          Nueva actividad
        </Button>
      </div>
      {activities.length === 0
        ? <Empty icon={<ClipboardList size={36} />} title="Sin actividades" description="Agrega la primera actividad" />
        : (
          <div className="space-y-2">
            {activities.map(a => (
              <Card key={a._id} className="hover:border-navy/30 cursor-pointer transition-colors group"
                onClick={() => navigate(`/activities/${a._id}`)}>
                <Card.Body className="py-2.5">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5',
                      {baja:'bg-gray-400',media:'bg-blue-500',alta:'bg-amber-500',urgente:'bg-red-500'}[a.priority]
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal group-hover:text-navy truncate">
                        {a.name}
                      </p>
                      {/* Cambio 7: asignados visibles debajo del nombre */}
                      {a.assignees_info?.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {a.assignees_info.map(u => (
                            <span key={u._id} className="flex items-center gap-1">
                              <Avatar name={u.name} size="xs" src={u.avatar_url}/>
                              <span className="text-[10px] text-charcoal-muted">{u.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {a.target_date && (
                        <span className="text-xs text-charcoal-muted">{formatDate(a.target_date)}</span>
                      )}
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                  {a.checklist?.length > 0 && (
                    <div className="mt-1.5 ml-5">
                      <Progress value={Math.round((a.checklist.filter(c=>c.completed).length / a.checklist.length)*100)} />
                    </div>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        )
      }
      {showForm && <ActivityFormModal projectId={projectId} onClose={() => setShowForm(false)} onSaved={onRefresh} />}
    </div>
  )
}

// ── Project Chat ──────────────────────────────────────────────────────────────
const ProjectChat = ({ projectId, user, socket }) => {
  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore]   = useState(false)
  const [text, setText]         = useState('')
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef()

  const load = useCallback(async (before) => {
    try {
      const res = await chatAPI.getMessages(projectId, { limit: 30, before })
      setMessages(prev => before ? [...res.data.data.messages, ...prev] : res.data.data.messages)
      setHasMore(res.data.data.hasMore)
    } catch {} finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    if (!socket) return
    socket.emit('chat:join', projectId)
    const onMsg    = (msg) => setMessages(prev => [...prev, msg])
    const onEdit   = ({ messageId, message }) =>
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, message, edited: true } : m))
    const onDelete = ({ messageId }) =>
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deleted: true } : m))
    socket.on('chat:message', onMsg)
    socket.on('chat:message_edited', onEdit)
    socket.on('chat:message_deleted', onDelete)
    return () => {
      socket.emit('chat:leave', projectId)
      socket.off('chat:message', onMsg)
      socket.off('chat:message_edited', onEdit)
      socket.off('chat:message_deleted', onDelete)
    }
  }, [socket, projectId])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await chatAPI.sendMessage(projectId, { message: text.trim() })
      setText('')
    } catch { toast.error('Error al enviar el mensaje') } finally { setSending(false) }
  }

  const userId = user._id || user.userId

  return (
    <Card className="bg-[#FBFBFB] border border-[#A0A09F] shadow-lg overflow-hidden">
  <Card.Header className="bg-[#1D1C19] text-[#FBFBFB] border-b border-[#B08629]">
    <Card.Title className="flex items-center gap-2">
      <MessageSquare size={16} className="text-[#F8CD24]" />
      Chat del proyecto
    </Card.Title>
  </Card.Header>

  <div className="flex flex-col" style={{ height: '420px' }}>
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#FBFBFB]">

      {hasMore && (
        <button
          onClick={() => load(messages[0]?._id)}
          className="w-full text-xs text-[#B08629] hover:text-[#1D1C19] hover:underline py-1 transition"
        >
          Cargar mensajes anteriores
        </button>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : messages.length === 0 ? (
        <Empty
          icon={<MessageSquare size={28} className="text-[#B08629]" />}
          title="Sin mensajes aún"
          description="Sé el primero en escribir"
        />
      ) : (
        messages.map(m => {
          const isMe = m.user_id?.toString() === userId?.toString()

          return (
            <div
              key={m._id}
              className={cn(
                'flex gap-2',
                isMe && 'flex-row-reverse'
              )}
            >
              <Avatar
                name={m.user?.name}
                size="sm"
                className="flex-shrink-0 mt-0.5"
                src={m.user?.avatar_url}
              />

              <div
                className={cn(
                  'max-w-[75%]',
                  isMe && 'items-end flex flex-col'
                )}
              >
                <div className="flex items-baseline gap-1.5 mb-1">

                  {!isMe && (
                    <span className="text-xs font-semibold text-[#B08629]">
                      {m.user?.name}
                    </span>
                  )}

                  <span className="text-[10px] text-[#626261]">
                    {new Date(m.createdAt).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>

                  {m.edited && (
                    <span className="text-[10px] text-[#626261]">
                      (editado)
                    </span>
                  )}

                </div>

                <div
                  className={cn(
                    'px-4 py-2 rounded-2xl shadow-sm text-sm leading-relaxed',

                    m.deleted
                      ? 'italic text-xs bg-[#A0A09F]/30 text-[#626261]'

                      : isMe
                        ? 'bg-[#F8CD24] text-[#1D1C19] rounded-br-md'

                        : 'bg-white text-[#1D1C19] border border-[#A0A09F]/40 rounded-bl-md'
                  )}
                >
                  {m.deleted
                    ? 'Mensaje eliminado'
                    : m.message}
                </div>

              </div>
            </div>
          )
        })
      )}

      <div ref={bottomRef} />
    </div>

    <form
      onSubmit={send}
      className="border-t border-[#A0A09F] bg-white px-3 py-3 flex items-center gap-2"
    >
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Escribe un mensaje…"
        className="
          flex-1
          rounded-full
          border
          border-[#A0A09F]
          bg-[#FBFBFB]
          px-4
          py-2
          text-sm
          text-[#1D1C19]
          placeholder:text-[#626261]
          focus:outline-none
          focus:border-[#F8CD24]
          focus:ring-2
          focus:ring-[#F8CD24]/40
          transition
        "
      />

      <Button
        type="submit"
        loading={sending}
        size="icon"
        className="
          bg-[#1D1C19]
          hover:bg-[#F8CD24]
          hover:text-[#1D1C19]
          text-white
          rounded-full
          transition-all
        "
        icon={!sending && <Send size={15} />}
      />
    </form>
  </div>
</Card>
  )
}

// ── Project Phases ─────────────────────────────────────────────────────────────
const ProjectPhases = ({ phases, projectId, isManager, onRefresh }) => {
  const [showForm, setShowForm] = useState(false)

  const handleDelete = async (phaseId) => {
    try {
      await projectsAPI.deletePhase(projectId, phaseId)
      toast.success('Fase eliminada'); onRefresh()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-charcoal-muted">{phases.length} fases</span>
        {isManager && (
          <Button variant="outline" size="sm" icon={<Plus size={13} />} onClick={() => setShowForm(true)}>
            Agregar fase
          </Button>
        )}
      </div>
      {phases.length === 0
        ? <Empty icon={<Layers size={36} />} title="Sin fases" />
        : (
          <div className="space-y-2">
            {[...phases].sort((a,b) => a.order_index - b.order_index).map((phase, i) => (
              <Card key={phase._id}>
                <Card.Body className="py-2.5 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-navy/10 text-navy text-xs font-semibold
                    flex items-center justify-center flex-shrink-0">{i + 1}</div>
                  <p className="flex-1 text-sm font-medium text-charcoal">{phase.name}</p>
                  <StatusBadge status={phase.status} />
                  {isManager && (
                    <button onClick={() => handleDelete(phase._id)}
                      className="text-charcoal-muted hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        )
      }
      {showForm && <PhaseFormModal projectId={projectId} onClose={() => setShowForm(false)} onSaved={onRefresh} />}
    </div>
  )
}

// ── Cambio 6: Project Members Tab ──────────────────────────────────────────────
const ProjectMembers = ({ projectId, members, isManager, onRefresh }) => {
  const [allUsers, setAllUsers]   = useState([])
  const [search, setSearch]       = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [loading, setLoading]     = useState(false)

  const memberIds = members.map(m => m._id?.toString())

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await usersAPI.getAll({ active: true })
      setAllUsers(res.data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { if (showAdd) loadUsers() }, [showAdd])

  const handleAdd = async (userId) => {
    try {
      await projectsAPI.addMember(projectId, userId)
      toast.success('Usuario agregado'); onRefresh()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') }
  }

  const handleRemove = async (userId) => {
    try {
      await projectsAPI.removeMember(projectId, userId)
      toast.success('Usuario removido'); onRefresh()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') }
  }

  const available = allUsers.filter(u =>
    !memberIds.includes(u._id?.toString()) &&
    (u.name?.toLowerCase().includes(search.toLowerCase()) ||
     u.email?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-charcoal-muted">{members.length} miembro(s)</span>
        {isManager && (
          <Button variant="gold" size="sm" icon={<UserPlus size={13} />} onClick={() => setShowAdd(true)}>
            Agregar miembro
          </Button>
        )}
      </div>

      {members.length === 0
        ? <Empty icon={<Users size={36} />} title="Sin miembros asignados"
            description="Agrega usuarios para que puedan ver y trabajar en este proyecto" />
        : (
          <Card>
            <div className="divide-y divide-silver-border">
              {members.map(m => (
                <div key={m._id} className="px-4 py-3 flex items-center gap-3">
                  <Avatar name={m.name} size="md" src={m.avatar_url}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal">{m.name}</p>
                    <p className="text-xs text-charcoal-muted">{m.email}</p>
                  </div>
                  <Badge variant="navy" className="text-[10px]">{m.role}</Badge>
                  {isManager && (
                    <button onClick={() => handleRemove(m._id)}
                      className="text-charcoal-muted hover:text-red-500 transition-colors p-1">
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )
      }

      {/* Modal para agregar miembros */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setSearch('') }}
        title="Agregar miembro al proyecto">
        <div className="space-y-3">
          <input placeholder="Buscar usuario…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-silver-border rounded bg-white
              focus:outline-none focus:border-navy" />
          {loading
            ? <div className="flex justify-center py-4"><Spinner /></div>
            : available.length === 0
              ? <p className="text-sm text-charcoal-muted text-center py-4">
                  {search ? 'Sin resultados' : 'Todos los usuarios ya están en el proyecto'}
                </p>
              : (
                <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
                  {available.map(u => (
                    <button key={u._id} onClick={() => { handleAdd(u._id); setShowAdd(false); setSearch('') }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-silver
                        transition-colors text-left">
                      <Avatar name={u.name} size="sm" src={u.avatar_url}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal">{u.name}</p>
                        <p className="text-xs text-charcoal-muted">{u.email}</p>
                      </div>
                      <Badge variant="navy" className="text-[10px]">{u.role}</Badge>
                    </button>
                  ))}
                </div>
              )
          }
        </div>
      </Modal>
    </div>
  )
}

// ── Activity Form Modal (con asignación obligatoria) ──────────────────────────
const ActivityFormModal = ({ projectId, onClose, onSaved }) => {
  const [allUsers, setAllUsers] = useState([])
  const [form, setForm] = useState({
    name:'', description:'', priority:'media',
    complexity:'basica', target_date:'', assignees:[]
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    usersAPI.getAll({ active: true })
      .then(r => setAllUsers(r.data.data))
      .catch(() => {})
  }, [])

  const toggleAssignee = (uid) => {
    setForm(f => ({
      ...f,
      assignees: f.assignees.includes(uid)
        ? f.assignees.filter(id => id !== uid)
        : [...f.assignees, uid]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.assignees.length === 0) {
      toast.error('Debes asignar la actividad a al menos un usuario'); return
    }
    setSaving(true)
    try {
      await activitiesAPI.create({ ...form, project_id: projectId })
      toast.success('Actividad creada — se notificó a los asignados')
      onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') } finally { setSaving(false) }
  }

  return (
    <Modal open title="Nueva actividad" onClose={onClose} size="lg"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={handleSubmit}>Crear actividad</Button>
      </>}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Nombre de la actividad *" placeholder="Ej. Calibración detector"
          value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
        <Textarea label="Descripción"
          value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
        <div className="grid grid-cols-3 gap-3">
          <Select label="Prioridad" value={form.priority}
            onChange={e => setForm(f => ({...f, priority: e.target.value}))}
            options={[
              {value:'baja',    label:'Baja'},
              {value:'media',   label:'Media'},
              {value:'alta',    label:'Alta'},
              {value:'urgente', label:'Urgente'},
            ]} />
          <Select label="Complejidad" value={form.complexity}
            onChange={e => setForm(f => ({...f, complexity: e.target.value}))}
            options={Object.entries(COMPLEXITY_LEVELS).map(([v, m]) => ({
              value: v,
              label: `${m.label} (x${m.weight})`
            }))} />
          <Input label="Fecha objetivo" type="date" value={form.target_date}
            onChange={e => setForm(f => ({...f, target_date: e.target.value}))} />
        </div>

        <div>
          <label className="text-xs font-medium text-[#626261] block mb-1.5">
            Asignar a * <span className="text-[#A0A09F] font-normal">(mínimo 1 usuario)</span>
          </label>
          {allUsers.length === 0
            ? <div className="flex justify-center py-3"><Spinner /></div>
            : (
              <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto scrollbar-thin
                border border-[#D9D9D9] rounded-lg p-2 bg-[#FBFBFB]">
                {allUsers.map(u => {
                  const selected = form.assignees.includes(u._id)
                  return (
                    <button key={u._id} type="button" onClick={() => toggleAssignee(u._id)}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors',
                        selected
                          ? 'bg-[#1D1C19] text-white'
                          : 'hover:bg-[rgba(248,205,36,0.08)] text-[#1D1C19]'
                      )}>
                      <Avatar name={u.name} size="xs" src={u.avatar_url}/>
                      <span className="truncate text-xs">{u.name}</span>
                    </button>
                  )
                })}
              </div>
            )
          }
          {form.assignees.length > 0 && (
            <p className="text-xs text-[#2BA84A] mt-1">
              {form.assignees.length} usuario(s) seleccionado(s)
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}

// ── Project Form Modal ─────────────────────────────────────────────────────────
const ProjectFormModal = ({ onClose, onSaved }) => {
  const { user }  = useAuth()
  const [allUsers, setAllUsers] = useState([])
  const [form, setForm] = useState({
    folio_os:'', clave:'', name:'', description:'', area:'',
    received_at:'', target_date:'', members:[],
    client: { razon_social:'', contact_name:'', phone:'', email:'' }
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    usersAPI.getAll({ active: true }).then(r => setAllUsers(r.data.data)).catch(() => {})
  }, [])

  const toggleMember = (uid) => {
    setForm(f => ({
      ...f,
      members: f.members.includes(uid)
        ? f.members.filter(id => id !== uid)
        : [...f.members, uid]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await projectsAPI.create({ ...form, created_by: user?._id || user?.userId })
      toast.success('Proyecto creado')
      onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') } finally { setSaving(false) }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fc = (k, v) => setForm(p => ({ ...p, client: { ...p.client, [k]: v } }))

  return (
    <Modal open title="Nuevo proyecto (Orden de Servicio)" onClose={onClose} size="lg"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="gold" loading={saving} onClick={handleSubmit}>Crear proyecto</Button>
      </>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Folio OS *" placeholder="OS-2026-001"
            value={form.folio_os} onChange={e => f('folio_os', e.target.value)} required />
          <Input label="Clave interna" placeholder="CLAVE-001"
            value={form.clave} onChange={e => f('clave', e.target.value)} />
        </div>
        <Input label="Nombre / Actividad principal *"
          value={form.name} onChange={e => f('name', e.target.value)} required />
        <Textarea label="Descripción del alcance"
          value={form.description} onChange={e => f('description', e.target.value)} />
        <div className="grid grid-cols-3 gap-3">
          <Select label="Área" value={form.area} onChange={e => f('area', e.target.value)}
            placeholder="Selecciona área" options={AREAS.map(a => ({value:a, label:a}))} />
          <Input label="Fecha de recepción OS" type="date"
            value={form.received_at} onChange={e => f('received_at', e.target.value)} />
          <Input label="Fecha objetivo" type="date"
            value={form.target_date} onChange={e => f('target_date', e.target.value)} />
        </div>

        {/* Cambio 6: selección de miembros del equipo al crear */}
        <div>
          <label className="text-xs font-medium text-charcoal-light block mb-1.5">
            Equipo del proyecto
            <span className="text-charcoal-muted font-normal ml-1">(puedes agregar más después)</span>
          </label>
          <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto scrollbar-thin border border-silver-border rounded p-2">
            {allUsers.map(u => {
              const selected = form.members.includes(u._id)
              return (
                <button key={u._id} type="button" onClick={() => toggleMember(u._id)}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors',
                    selected ? 'bg-yellow-500 text-gray-800' : 'hover:bg-silver text-charcoal'
                  )}>
                  <Avatar name={u.name} size="xs" src={u.avatar_url} />
                  <span className="truncate">{u.name}</span>
                </button>
              )
            })}
          </div>
          {form.members.length > 0 && (
            <p className="text-xs text-green-600 mt-1">{form.members.length} miembro(s) seleccionado(s)</p>
          )}
        </div>

        {/* Datos del cliente */}
        <div className="border-t border-silver-border pt-3">
          <p className="text-xs font-semibold text-charcoal mb-3 uppercase tracking-wide">Datos del cliente</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Razón social" className="col-span-2"
              value={form.client.razon_social} onChange={e => fc('razon_social', e.target.value)} />
            <Input label="Contacto"
              value={form.client.contact_name} onChange={e => fc('contact_name', e.target.value)} />
            <Input label="Teléfono" type="tel"
              value={form.client.phone} onChange={e => fc('phone', e.target.value)} />
            <Input label="Correo" type="email" className="col-span-2"
              value={form.client.email} onChange={e => fc('email', e.target.value)} />
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Phase Form Modal ──────────────────────────────────────────────────────────
const PhaseFormModal = ({ projectId, onClose, onSaved }) => {
  const [name, setName]     = useState('')
  const [saving, setSaving] = useState(false)
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await projectsAPI.addPhase(projectId, { name })
      toast.success('Fase agregada'); onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') } finally { setSaving(false) }
  }
  return (
    <Modal open title="Agregar fase" onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="gold" loading={saving} onClick={handleSubmit}>Agregar</Button>
      </>}>
      <form onSubmit={handleSubmit}>
        <Input label="Nombre de la fase *" placeholder="Ej. Instalación, Calibración, Entrega"
          value={name} onChange={e => setName(e.target.value)} required />
      </form>
    </Modal>
  )
}

// ── Project Edit Modal (Cambio 1 — solo managers) ─────────────────────────────
const ProjectEditModal = ({ project, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name       : project.name || '',
    description: project.description || '',
    area       : project.area || '',
    target_date: project.target_date ? project.target_date.slice(0,10) : '',
    clave      : project.clave || '',
  })
  const [clientForm, setClientForm] = useState({
    razon_social : project.client?.razon_social  || '',
    contact_name : project.client?.contact_name  || '',
    phone        : project.client?.phone         || '',
    email        : project.client?.email         || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await projectsAPI.update(project._id, form)
      // Si hay cliente, actualizar sus datos también
      if (project.client?._id) {
        await clientsAPI.update(project.client._id, clientForm)
      }
      toast.success('Proyecto actualizado')
      onSaved(); onClose()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') } finally { setSaving(false) }
  }

  const f  = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fc = (k, v) => setClientForm(p => ({ ...p, [k]: v }))

  return (
    <Modal open title="Editar proyecto" onClose={onClose} size="lg"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={handleSubmit}>Guardar cambios</Button>
      </>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre del proyecto *" value={form.name}
            onChange={e => f('name', e.target.value)} required />
          <Input label="Clave interna" value={form.clave}
            onChange={e => f('clave', e.target.value)} />
        </div>
        <Textarea label="Descripción" value={form.description}
          onChange={e => f('description', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Área" value={form.area}
            onChange={e => f('area', e.target.value)}
            placeholder="Selecciona área"
            options={AREAS.map(a => ({ value:a, label:a }))} />
          <Input label="Fecha objetivo" type="date" value={form.target_date}
            onChange={e => f('target_date', e.target.value)} />
        </div>
        {/* Datos del cliente */}
        {project.client && (
          <div className="border-t border-[#F0F0F0] pt-4">
            <p className="text-xs font-bold text-[#1D1C19] mb-3 uppercase tracking-wider">
              Datos del cliente
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Razón social" className="col-span-2" value={clientForm.razon_social}
                onChange={e => fc('razon_social', e.target.value)} />
              <Input label="Nombre de contacto" value={clientForm.contact_name}
                onChange={e => fc('contact_name', e.target.value)} />
              <Input label="Teléfono" type="tel" value={clientForm.phone}
                onChange={e => fc('phone', e.target.value)} />
              <Input label="Correo electrónico" type="email" className="col-span-2"
                value={clientForm.email} onChange={e => fc('email', e.target.value)} />
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
