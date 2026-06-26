import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ClipboardList, Search, CheckSquare, Square, Paperclip,
  History, ChevronRight, Upload, Trash2, FileText, Image, File,
  AlertCircle, StickyNote, Plus, Pencil
} from 'lucide-react'
import { activitiesAPI, usersAPI } from '../../services/api'
import {
  Card, Button, Input, Select, Textarea, StatusBadge, PriorityDot,
  Badge, Avatar, Modal, Spinner, Empty, Progress
} from '../../components/ui'
import { formatDate, daysUntil, MANAGEMENT_ROLES, STATUS_LABELS, PRIORITY_LABELS,
         COMPLEXITY_LEVELS, cn } from '../../lib/utils'
import { useAuth, useSocket } from '../../context/AppContext'
import toast from 'react-hot-toast'

// ── Activities List ───────────────────────────────────────────────────────────
export const ActivitiesPage = () => {
  const navigate = useNavigate()
  const [activities, setActivities] = useState([])
  const [loading, setLoading]       = useState(true)
  const [filters, setFilters]       = useState({
    search: '', status: '', priority: '',
    overdue: new URLSearchParams(location.search).get('overdue') || ''
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.status)   params.status   = filters.status
      if (filters.priority) params.priority  = filters.priority
      if (filters.overdue)  params.overdue   = filters.overdue
      const res = await activitiesAPI.getAll(params)
      setActivities(res.data.data)
    } catch { toast.error('Error al cargar actividades') } finally { setLoading(false) }
  }, [filters.status, filters.priority, filters.overdue])

  useEffect(() => { load() }, [load])

  const filtered = filters.search
    ? activities.filter(a => a.name?.toLowerCase().includes(filters.search.toLowerCase()))
    : activities

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-charcoal">Actividades</h1>
          <p className="text-xs text-charcoal-muted mt-0.5">{activities.length} actividades en total</p>
        </div>
      </div>

      <Card>
        <Card.Body className="py-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-40">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-muted" />
              <input placeholder="Buscar actividades…" value={filters.search}
                onChange={e => setFilters(f => ({...f, search: e.target.value}))}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-silver-border rounded bg-white
                  focus:outline-none focus:border-navy" />
            </div>
            <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))}
              className="text-sm border border-silver-border rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-navy">
              <option value="">Todos los estatus</option>
              {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={filters.priority} onChange={e => setFilters(f => ({...f, priority: e.target.value}))}
              className="text-sm border border-silver-border rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-navy">
              <option value="">Toda prioridad</option>
              {Object.entries(PRIORITY_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={() => setFilters(f => ({...f, overdue: f.overdue ? '' : 'true'}))}
              className={cn('text-sm px-3 py-1.5 rounded border transition-colors',
                filters.overdue
                  ? 'bg-amber-50 border-amber-400 text-amber-700'
                  : 'border-silver-border bg-white text-charcoal')}>
              <AlertCircle size={13} className="inline mr-1" />Solo vencidas
            </button>
          </div>
        </Card.Body>
      </Card>

      {loading
        ? <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        : filtered.length === 0
          ? <Empty icon={<ClipboardList size={40} />} title="Sin actividades"
              description="Las actividades se crean desde el detalle de cada proyecto" />
          : (
            <div className="space-y-2">
              {filtered.map(a => (
                <Card key={a._id} className="hover:border-navy/30 cursor-pointer transition-colors group"
                  onClick={() => navigate(`/activities/${a._id}`)}>
                  <Card.Body className="py-2.5">
                    <div className="flex items-start gap-3">
                      <PriorityDot priority={a.priority} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-charcoal group-hover:text-navy truncate">
                            {a.name}
                          </p>
                          {a.depends_on_info && (
                            <Badge variant="amber" className="text-[10px] shrink-0">Dependiente</Badge>
                          )}
                        </div>
                        {/* Cambio 7: asignados debajo del nombre */}
                        {a.assignees_info?.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {a.assignees_info.map(u => (
                              <span key={u._id} className="flex items-center gap-1">
                                <Avatar name={u.name} size="xs" />
                                <span className="text-[10px] text-charcoal-muted">{u.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-charcoal-muted">{a.project?.folio_os}</span>
                          {a.checklist?.length > 0 && (
                            <span className="text-[10px] text-charcoal-muted">
                              {a.checklist.filter(c=>c.completed).length}/{a.checklist.length} subtareas
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {a.target_date && (() => {
                          const d = daysUntil(a.target_date)
                          return (
                            <span className={cn('text-xs font-medium',
                              d < 0 ? 'text-red-500' : d <= 3 ? 'text-amber-500' : 'text-charcoal-muted')}>
                              {d < 0 ? `${Math.abs(d)}d venc.` : d === 0 ? 'Hoy' : `${d}d`}
                            </span>
                          )
                        })()}
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )
      }
    </div>
  )
}

// ── Activity Detail ───────────────────────────────────────────────────────────
export const ActivityDetailPage = () => {
  const { id }    = useParams()
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const socket    = useSocket()
  const isManager = MANAGEMENT_ROLES.includes(user?.role)
  const userId    = user?._id || user?.userId

  const [activity, setActivity] = useState(null)
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('detail')
  const [statusModal, setStatusModal]   = useState(false)
  const [noteModal, setNoteModal]       = useState(false)
  const [editModal, setEditModal]       = useState(false)  // Cambio 1

  const isAssigned = activity?.assignees
    ?.map(a => a.toString()).includes(userId?.toString())
  const canEdit = isManager || isAssigned
  const CLOSING_ROLES = ['superadmin','admin','gerente','coordinador']
  const canClose = CLOSING_ROLES.includes(user?.role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [actRes, logsRes] = await Promise.all([
        activitiesAPI.getOne(id),
        activitiesAPI.getLogs(id)
      ])
      setActivity(actRes.data.data)
      setLogs(logsRes.data.data)
    } catch { toast.error('Error al cargar la actividad') } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  // Cambio 3: Escuchar actualizaciones en tiempo real
  useEffect(() => {
    if (!socket) return
    const onUpdated = (data) => { if (data.id === id) load() }
    const onStatus  = (data) => { if (data.id === id) load() }
    socket.on('activity:updated', onUpdated)
    socket.on('activity:status_changed', onStatus)
    socket.on('activity:checklist_updated', onUpdated)
    socket.on('activity:note_added', onUpdated)
    return () => {
      socket.off('activity:updated', onUpdated)
      socket.off('activity:status_changed', onStatus)
      socket.off('activity:checklist_updated', onUpdated)
      socket.off('activity:note_added', onUpdated)
    }
  }, [socket, id, load])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!activity) return <Empty title="Actividad no encontrada" />

  const checklistDone  = activity.checklist?.filter(c => c.completed).length || 0
  const checklistTotal = activity.checklist?.length || 0

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <Card>
        <Card.Body>
          <div className="flex items-center gap-1.5 mb-2 text-xs text-charcoal-muted">
            <button onClick={() => navigate('/projects')} className="hover:text-navy">Proyectos</button>
            <ChevronRight size={11} />
            <button onClick={() => navigate(`/projects/${activity.project?._id}`)} className="hover:text-navy">
              {activity.project?.folio_os}
            </button>
            <ChevronRight size={11} />
            <span>Actividad</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <PriorityDot priority={activity.priority} showLabel />
              </div>
              <h1 className="text-lg font-semibold text-charcoal">{activity.name}</h1>
              {activity.description && (
                <p className="text-sm text-charcoal-muted mt-1">{activity.description}</p>
              )}

              <div className="flex flex-wrap gap-4 mt-3 text-xs text-charcoal-muted">
                <span className="flex items-center gap-1">
                  <ClipboardList size={11} /> Inicio: {formatDate(activity.start_date)}
                </span>
                <span className="flex items-center gap-1">
                  <History size={11} /> Objetivo: {formatDate(activity.target_date)}
                </span>
                {activity.complexity && (() => {
                  const cx = COMPLEXITY_LEVELS[activity.complexity]
                  return cx ? (
                    <span className="flex items-center gap-1.5">
                      Complejidad:
                      <span className="font-semibold px-2 py-0.5 rounded text-xs text-white"
                        style={{ background: cx.color }}>
                        {cx.label} (×{cx.weight})
                      </span>
                    </span>
                  ) : null
                })()}
                {activity.depends_on_info && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertCircle size={11} /> Depende de: {activity.depends_on_info.name}
                  </span>
                )}
              </div>

              {/* Cambio 7: asignados con avatares y nombres */}
              {activity.assignees_info?.length > 0 && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-xs text-charcoal-muted">Asignados a:</span>
                  {activity.assignees_info.map(u => (
                    <span key={u._id} className="flex items-center gap-1.5 bg-silver px-2 py-1 rounded-full">
                      <Avatar name={u.name} size="xs" />
                      <span className="text-xs text-charcoal font-medium">{u.name}</span>
                      <Badge variant="default" className="text-[9px] px-1">{u.role}</Badge>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={activity.status} />
              {checklistTotal > 0 && (
                <div className="w-28">
                  <div className="text-xs text-charcoal-muted text-right mb-1">
                    {checklistDone}/{checklistTotal} subtareas
                  </div>
                  <Progress value={Math.round((checklistDone/checklistTotal)*100)} showLabel />
                </div>
              )}
              {/* Cambio 1: managers pueden editar libremente la actividad */}
              {canEdit && !['cerrado','cancelado'].includes(activity.status) && (
                <div className="flex gap-2 flex-wrap justify-end">
                  {isManager && (
                    <Button variant="outline" size="sm" icon={<Pencil size={13} />}
                      onClick={() => setEditModal(true)}>
                      Editar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" icon={<StickyNote size={13} />}
                    onClick={() => setNoteModal(true)}>
                    Registrar avance
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setStatusModal(true)}>
                    Cambiar estatus
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-silver-border flex-wrap">
        {[
          { id:'detail',      label:'Detalle' },
          { id:'checklist',   label:`Checklist (${checklistDone}/${checklistTotal})` },
          { id:'attachments', label:`Adjuntos (${activity.attachments?.length || 0})` },
          { id:'logs',        label:'Bitácora' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-navy text-navy' : 'border-transparent text-charcoal-muted hover:text-navy')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'detail' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <Card.Header><Card.Title>Información general</Card.Title></Card.Header>
            <Card.Body className="space-y-3 text-sm">
              <Row label="Proyecto">{activity.project?.folio_os} — {activity.project?.name}</Row>
              <Row label="Creado por">{activity.created_by_user?.name || '—'}</Row>
              <Row label="Fecha inicio">{formatDate(activity.start_date)}</Row>
              <Row label="Fecha objetivo">{formatDate(activity.target_date)}</Row>
              {activity.closed_at && <Row label="Fecha cierre">{formatDate(activity.closed_at)}</Row>}
              {activity.days_taken != null && <Row label="Días tomados"><strong>{activity.days_taken}</strong></Row>}
            </Card.Body>
          </Card>
          <Card>
            <Card.Header><Card.Title>Bitácora reciente</Card.Title></Card.Header>
            <div className="divide-y divide-silver-border max-h-64 overflow-y-auto scrollbar-thin">
              {logs.slice(0,5).map(log => (
                <div key={log._id} className="px-4 py-2.5 flex items-start gap-2">
                  <Avatar name={log.user?.name} size="xs" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-charcoal">{log.user?.name}</span>
                    <span className="text-xs text-charcoal-muted ml-1.5">{LOG_LABELS[log.action] || log.action}</span>
                    {log.detail?.note && <p className="text-xs text-charcoal-muted mt-0.5 truncate">{log.detail.note}</p>}
                    {log.detail?.new_status && (
                      <span className="text-xs text-charcoal-muted"> → <StatusBadge status={log.detail.new_status} /></span>
                    )}
                  </div>
                  <span className="text-[10px] text-charcoal-muted flex-shrink-0">{formatDate(log.createdAt)}</span>
                </div>
              ))}
              {logs.length === 0 && <Empty title="Sin entradas" />}
            </div>
          </Card>
        </div>
      )}

      {/* Cambio 2: todos los asignados pueden gestionar checklist */}
      {tab === 'checklist' && (
        <ChecklistTab activityId={id} checklist={activity.checklist}
          canEdit={canEdit} onRefresh={load} />
      )}

      {/* Cambio 2: todos los asignados pueden subir y eliminar adjuntos */}
      {tab === 'attachments' && (
        <AttachmentsTab activityId={id} attachments={activity.attachments}
          canEdit={canEdit} onRefresh={load} />
      )}

      {tab === 'logs' && (
        <Card>
          <Card.Header><Card.Title>Bitácora completa</Card.Title></Card.Header>
          <div className="divide-y divide-silver-border max-h-96 overflow-y-auto scrollbar-thin">
            {logs.length === 0
              ? <Empty title="Sin entradas" />
              : logs.map(log => (
                <div key={log._id} className="px-4 py-3 flex items-start gap-3">
                  <Avatar name={log.user?.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-charcoal">{log.user?.name}</span>
                      <Badge variant="default" className="text-[10px]">{LOG_LABELS[log.action] || log.action}</Badge>
                    </div>
                    {log.detail?.note && <p className="text-sm text-charcoal-muted mt-0.5">{log.detail.note}</p>}
                    {log.detail?.prev_status && (
                      <p className="text-xs text-charcoal-muted mt-0.5">
                        {STATUS_LABELS[log.detail.prev_status]} → {STATUS_LABELS[log.detail.new_status]}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-charcoal-muted flex-shrink-0">{formatDate(log.createdAt)}</span>
                </div>
              ))
            }
          </div>
        </Card>
      )}

      {statusModal && (
        <StatusChangeModal activity={activity} user={user} isManager={isManager} canClose={canClose}
          onClose={() => setStatusModal(false)} onSaved={load} />
      )}
      {noteModal && (
        <NoteModal activityId={id} onClose={() => setNoteModal(false)} onSaved={load} />
      )}
      {/* Cambio 1: Modal de edición completa para managers */}
      {editModal && (
        <ActivityEditModal activity={activity} onClose={() => setEditModal(false)} onSaved={load} />
      )}
    </div>
  )
}

// ── Checklist Tab ─────────────────────────────────────────────────────────────
// Cambio 2: canEdit (asignados) pueden crear, marcar y eliminar ítems
const ChecklistTab = ({ activityId, checklist = [], canEdit, onRefresh }) => {
  const [newItem, setNewItem] = useState('')
  const [adding, setAdding]   = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newItem.trim()) return
    setAdding(true)
    try {
      await activitiesAPI.addChecklistItem(activityId, { title: newItem.trim() })
      setNewItem(''); onRefresh()
    } catch { toast.error('Error al agregar subtarea') } finally { setAdding(false) }
  }

  const handleToggle = async (item) => {
    try {
      await activitiesAPI.toggleChecklist(activityId, item._id, { completed: !item.completed })
      onRefresh()
    } catch { toast.error('Error al actualizar') }
  }

  const handleDelete = async (itemId) => {
    try {
      await activitiesAPI.deleteChecklist(activityId, itemId)
      onRefresh()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') }
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>Checklist de subtareas</Card.Title>
        <span className="text-xs text-charcoal-muted">
          {checklist.filter(c=>c.completed).length}/{checklist.length} completadas
        </span>
      </Card.Header>
      <Card.Body className="space-y-2">
        {checklist.length === 0 && (
          <Empty icon={<CheckSquare size={28} />} title="Sin subtareas"
            description="Agrega subtareas para dividir el trabajo" />
        )}
        {checklist.map(item => (
          <div key={item._id} className="flex items-center gap-2 group">
            <button onClick={() => canEdit && handleToggle(item)}
              className={cn('flex-shrink-0 transition-colors',
                item.completed ? 'text-green-600' : 'text-charcoal-muted hover:text-navy',
                !canEdit && 'cursor-default')}>
              {item.completed ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <span className={cn('flex-1 text-sm', item.completed && 'line-through text-charcoal-muted')}>
              {item.title}
            </span>
            {item.completed && item.days_taken != null && (
              <span className="text-xs text-charcoal-muted">{item.days_taken}d</span>
            )}
            {/* Cambio 2: cualquier asignado puede eliminar */}
            {canEdit && (
              <button onClick={() => handleDelete(item._id)}
                className="opacity-0 group-hover:opacity-100 text-charcoal-muted hover:text-red-500 transition-all">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}

        {canEdit && (
          <form onSubmit={handleAdd} className="flex gap-2 mt-3 pt-3 border-t border-silver-border">
            <input placeholder="Nueva subtarea…" value={newItem}
              onChange={e => setNewItem(e.target.value)}
              className="flex-1 text-sm px-3 py-1.5 rounded border border-silver-border bg-white
                focus:outline-none focus:border-navy" />
            <Button type="submit" variant="outline" size="sm" loading={adding}>
              <Plus size={13} />
            </Button>
          </form>
        )}
      </Card.Body>
    </Card>
  )
}

// ── Attachments Tab ───────────────────────────────────────────────────────────
// Cambio 2 y 3: todos los asignados pueden subir y eliminar adjuntos
const AttachmentsTab = ({ activityId, attachments = [], canEdit, onRefresh }) => {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e) => {
    const files = e.target.files
    if (!files.length) return
    setUploading(true)
    try {
      const form = new FormData()
      Array.from(files).forEach(f => form.append('files', f))
      await activitiesAPI.uploadFiles(activityId, form)
      // Cambio 3: el servidor guarda en uploads/activities/<folio_os>/
      toast.success(`${files.length} archivo(s) subido(s)`)
      onRefresh()
    } catch (e) { toast.error(e.response?.data?.message || 'Error al subir archivos') } finally { setUploading(false) }
  }

  const handleDelete = async (attId) => {
    try {
      await activitiesAPI.deleteAttachment(activityId, attId)
      toast.success('Adjunto eliminado'); onRefresh()
    } catch { toast.error('Error al eliminar') }
  }

  const getIcon = (mime = '') => {
    if (mime.startsWith('image/')) return <Image size={16} className="text-blue-500" />
    if (mime.includes('pdf'))      return <FileText size={16} className="text-red-500" />
    return <File size={16} className="text-charcoal-muted" />
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-1.5">
          <Paperclip size={14} /> Documentos y evidencias
        </Card.Title>
        {canEdit && (
          <label className={cn('cursor-pointer', uploading && 'opacity-50 pointer-events-none')}>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-navy
              bg-navy/8 hover:bg-navy/15 px-2.5 py-1.5 rounded transition-colors">
              {uploading ? <Spinner size="sm" /> : <Upload size={12} />}
              Subir archivos
            </span>
            <input type="file" multiple className="hidden" onChange={handleUpload}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.zip" />
          </label>
        )}
      </Card.Header>
      <Card.Body>
        {attachments.length === 0
          ? <Empty icon={<Paperclip size={32} />} title="Sin adjuntos"
              description="Sube fotos, reportes o certificados relacionados" />
          : (
            <div className="space-y-2">
              {attachments.map(att => (
                <div key={att._id} className="flex items-center gap-3 p-2.5 rounded-lg bg-silver
                  border border-silver-border group">
                  {getIcon(att.mimetype)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{att.original_name}</p>
                    <p className="text-xs text-charcoal-muted">
                      v{att.version} · {(att.size / 1024).toFixed(0)} KB · {formatDate(att.uploaded_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`${import.meta.env.VITE_API_URL?.replace('/api/v1','')}/${att.path}`}
                      target="_blank" rel="noreferrer"
                      className="text-xs text-navy hover:underline" onClick={e => e.stopPropagation()}>
                      Ver
                    </a>
                    {/* Cambio 2: cualquier asignado puede eliminar */}
                    {canEdit && (
                      <button onClick={() => handleDelete(att._id)}
                        className="opacity-0 group-hover:opacity-100 text-charcoal-muted hover:text-red-500 transition-all">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }
        <p className="text-xs text-charcoal-muted mt-3">
          Máx. 20 MB por archivo · PDF, Word, Excel, imágenes, ZIP
          {/* Cambio 3: indicar dónde se guardan */}
          · Guardado por proyecto (uploads/activities/&lt;folio_os&gt;/)
        </p>
      </Card.Body>
    </Card>
  )
}

// ── Status Change Modal ───────────────────────────────────────────────────────
// Cambio 1: todos los asignados pueden cambiar estatus; solo managers pueden cerrar/cancelar
const StatusChangeModal = ({ activity, user, isManager, canClose, onClose, onSaved }) => {
  const [status, setStatus] = useState(activity.status)
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)

  // Cambio 1: filtrar estatus disponibles según el rol
  const ALL_STATUSES = Object.entries(STATUS_LABELS)
  const options = ALL_STATUSES.filter(([v]) => {
    if (['cerrado','cancelado'].includes(v)) return canClose
    return true
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await activitiesAPI.updateStatus(activity._id, { status, note })
      toast.success(`Estatus actualizado a "${STATUS_LABELS[status]}"`)
      onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') } finally { setSaving(false) }
  }

  return (
    <Modal open title="Cambiar estatus" onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="gold" loading={saving} onClick={handleSubmit}>Guardar</Button>
      </>}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Select label="Nuevo estatus" value={status}
          onChange={e => setStatus(e.target.value)}
          options={options.map(([v,l]) => ({value:v, label:l}))} />
        {!canClose && (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded border border-amber-200">
            Solo gerentes y coordinadores pueden cerrar o cancelar actividades.
          </p>
        )}
        <Textarea label="Nota (opcional)" placeholder="Agrega contexto sobre el cambio…"
          value={note} onChange={e => setNote(e.target.value)} />
      </form>
    </Modal>
  )
}

// ── Note Modal ────────────────────────────────────────────────────────────────
const NoteModal = ({ activityId, onClose, onSaved }) => {
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    try {
      await activitiesAPI.addNote(activityId, note)
      toast.success('Avance registrado')
      onSaved(); onClose()
    } catch { toast.error('Error al registrar el avance') } finally { setSaving(false) }
  }

  return (
    <Modal open title="Registrar avance" onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="gold" loading={saving} onClick={handleSubmit}>Registrar</Button>
      </>}>
      <form onSubmit={handleSubmit}>
        <Textarea label="Nota de avance *" rows={4}
          placeholder="Describe el avance realizado, hallazgos o próximos pasos…"
          value={note} onChange={e => setNote(e.target.value)} required />
      </form>
    </Modal>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const LOG_LABELS = {
  created         : 'Creó la actividad',
  updated         : 'Actualizó',
  status_change   : 'Cambió estatus',
  progress_update : 'Registró avance',
  checklist_update: 'Actualizó checklist',
  attachment_added: 'Adjuntó archivo',
  comment         : 'Comentó',
}

const Row = ({ label, children }) => (
  <div className="flex gap-2">
    <span className="text-charcoal-muted w-32 flex-shrink-0">{label}</span>
    <span className="text-charcoal font-medium flex-1">{children}</span>
  </div>
)

// ── Activity Edit Modal (Cambio 1 — solo managers) ────────────────────────────
const ActivityEditModal = ({ activity, onClose, onSaved }) => {
  const [allUsers, setAllUsers] = useState([])
  const [form, setForm] = useState({
    name       : activity.name || '',
    description: activity.description || '',
    priority   : activity.priority || 'media',
    complexity : activity.complexity || 'basica',
    target_date: activity.target_date ? activity.target_date.slice(0,10) : '',
    assignees  : activity.assignees?.map(a => a._id?.toString() || a.toString()) || [],
    depends_on : activity.depends_on_info?._id?.toString() || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    usersAPI.getAll({ active: true }).then(r => setAllUsers(r.data.data)).catch(() => {})
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
    if (form.assignees.length === 0) { toast.error('Asigna al menos un usuario'); return }
    setSaving(true)
    try {
      await activitiesAPI.update(activity._id, form)
      toast.success('Actividad actualizada')
      onSaved(); onClose()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') } finally { setSaving(false) }
  }

  return (
    <Modal open title="Editar actividad" onClose={onClose} size="lg"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={handleSubmit}>Guardar cambios</Button>
      </>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nombre *" value={form.name}
          onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
        <Textarea label="Descripción" value={form.description}
          onChange={e => setForm(f => ({...f, description: e.target.value}))} />
        <div className="grid grid-cols-3 gap-3">
          <Select label="Prioridad" value={form.priority}
            onChange={e => setForm(f => ({...f, priority: e.target.value}))}
            options={Object.entries(PRIORITY_LABELS).map(([v,l]) => ({value:v,label:l}))} />
          <Select label="Complejidad" value={form.complexity}
            onChange={e => setForm(f => ({...f, complexity: e.target.value}))}
            options={Object.entries(COMPLEXITY_LEVELS).map(([v,m]) => ({
              value:v, label:`${m.label} (×${m.weight})`
            }))} />
          <Input label="Fecha objetivo" type="date" value={form.target_date}
            onChange={e => setForm(f => ({...f, target_date: e.target.value}))} />
        </div>
        <div>
          <label className="text-xs font-medium text-[#626261] block mb-1.5">
            Asignados * <span className="font-normal text-[#A0A09F]">({form.assignees.length} seleccionado(s))</span>
          </label>
          <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto scrollbar-thin
            border border-[#D9D9D9] rounded-lg p-2 bg-[#FBFBFB]">
            {allUsers.map(u => {
              const uid = u._id?.toString()
              const sel = form.assignees.includes(uid)
              return (
                <button key={uid} type="button" onClick={() => toggleAssignee(uid)}
                  className={cn('flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors',
                    sel ? 'bg-[#1D1C19] text-white' : 'hover:bg-[rgba(248,205,36,0.08)] text-[#1D1C19]')}>
                  <Avatar name={u.name} size="xs" />
                  <span className="truncate text-xs">{u.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </form>
    </Modal>
  )
}
