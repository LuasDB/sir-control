import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, X, Clock, Calendar,
  Users, FolderOpen, AlertCircle, Coffee, Bell
} from 'lucide-react'
import { eventsAPI, usersAPI, projectsAPI } from '../../services/api'
import {
  Card, Button, Input, Select, Textarea,
  Avatar, Modal, Spinner, Badge
} from '../../components/ui'
import { cn, MANAGEMENT_ROLES } from '../../lib/utils'
import { useAuth } from '../../context/AppContext'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
const DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TYPE_META = {
  reunion      : { label:'Reunión',       color:'#2E75B6', icon: Users    },
  recordatorio : { label:'Recordatorio',  color:'#B08629', icon: Bell     },
  tarea        : { label:'Tarea',         color:'#626261', icon: AlertCircle },
  vencimiento  : { label:'Vencimiento',   color:'#E63946', icon: Clock    },
}

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate()

const toLocalISO = (date) => {
  const d = new Date(date)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16)
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT DE BIENVENIDA — estilo Outlook
// ─────────────────────────────────────────────────────────────────────────────
export const WelcomePrompt = ({ onDismiss, onGoCalendar }) => {
  const { user }         = useAuth()
  const [events, setEvents]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    eventsAPI.getUpcoming(3)
      .then(r => setEvents(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const today    = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2)

  const groupByDay = (evts) => {
    const groups = [
      { label: 'Hoy', date: today,    items: [] },
      { label: 'Mañana', date: tomorrow, items: [] },
      { label: DAYS_ES[dayAfter.getDay()], date: dayAfter, items: [] },
    ]
    evts.forEach(ev => {
      const d = new Date(ev.start)
      groups.forEach(g => { if (isSameDay(d, g.date)) g.items.push(ev) })
    })
    return groups.filter(g => g.items.length > 0)
  }

  const grouped = groupByDay(events)
  const hasEvents = events.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-[#1D1C19]/50 backdrop-blur-[2px]" onClick={onDismiss} />

      {/* Panel — ancho fijo similar a Outlook */}
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-[420px] animate-fade-in overflow-hidden">

        {/* Header negro SIRSA */}
        <div className="bg-[#1D1C19] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[#F8CD24] text-xs font-semibold uppercase tracking-wider mb-1">
                Buenos días
              </p>
              <h2 className="text-white text-lg font-bold leading-tight">
                {user?.name?.split(' ')[0] || 'Usuario'} 👋
              </h2>
              <p className="text-[#626261] text-xs mt-1">
                {today.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })}
              </p>
            </div>
            <button onClick={onDismiss}
              className="text-[#626261] hover:text-white transition-colors mt-0.5">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Franja amarilla decorativa */}
        <div className="h-1 bg-[#F8CD24]" />

        {/* Contenido */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !hasEvents ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F5F5] flex items-center justify-center
                mx-auto mb-3">
                <Coffee size={24} className="text-[#A0A09F]" />
              </div>
              <p className="text-sm font-semibold text-[#1D1C19]">Sin eventos próximos</p>
              <p className="text-xs text-[#A0A09F] mt-1">
                No tienes reuniones ni recordatorios en los próximos 3 días
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[#626261]">
                Tienes <strong className="text-[#1D1C19]">{events.length}</strong> evento(s) próximo(s)
              </p>

              {grouped.map(group => (
                <div key={group.label}>
                  {/* Separador de día */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-[#1D1C19]">{group.label}</span>
                    <div className="flex-1 h-px bg-[#F0F0F0]" />
                    <span className="text-2xs text-[#A0A09F]">
                      {group.date.toLocaleDateString('es-MX', { day:'2-digit', month:'short' })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.items.map(ev => {
                      const meta  = TYPE_META[ev.type] || TYPE_META.reunion
                      const Icon  = meta.icon
                      const start = new Date(ev.start)
                      const end   = ev.end ? new Date(ev.end) : null
                      return (
                        <div key={ev._id}
                          className="flex items-start gap-3 p-3 rounded-xl border border-[#F0F0F0]
                            hover:bg-[rgba(248,205,36,0.04)] transition-colors">
                          {/* Indicador de color */}
                          <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                            <div className="w-3 h-3 rounded-full" style={{ background: ev.color || meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1D1C19] truncate">{ev.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-2xs font-medium"
                                style={{ color: ev.color || meta.color }}>
                                {meta.label}
                              </span>
                              {!ev.all_day && (
                                <span className="text-2xs text-[#626261] flex items-center gap-0.5">
                                  <Clock size={9} />
                                  {start.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}
                                  {end && ` – ${end.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`}
                                </span>
                              )}
                              {ev.all_day && (
                                <span className="text-2xs text-[#A0A09F]">Todo el día</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div className="px-6 pb-5 flex items-center gap-3">
          <Button variant="primary" className="flex-1" onClick={onGoCalendar}
            icon={<Calendar size={14} />}>
            Ver calendario
          </Button>
          <Button variant="outline" onClick={onDismiss}>
            Recordar después
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULARIO DE EVENTO
// ─────────────────────────────────────────────────────────────────────────────
const EventForm = ({ event, onClose, onSaved, defaultDate }) => {
  const { user }  = useAuth()
  const userId    = user?._id || user?.userId
  const isEdit    = !!event

  const [allUsers, setAllUsers]     = useState([])
  const [projects, setProjects]     = useState([])
  const [saving, setSaving]         = useState(false)

  const defaultStart = defaultDate
    ? toLocalISO(defaultDate)
    : toLocalISO(new Date())

  const [form, setForm] = useState({
    title       : event?.title       || '',
    description : event?.description || '',
    type        : event?.type        || 'reunion',
    start       : event?.start ? toLocalISO(event.start) : defaultStart,
    end         : event?.end   ? toLocalISO(event.end)   : '',
    all_day     : event?.all_day     || false,
    project_id  : event?.project_id?._id || event?.project_id || '',
    participants: event?.participants?.map(p => p._id?.toString() || p.toString()) || [userId?.toString()],
  })

  useEffect(() => {
    Promise.all([
      usersAPI.getAll({ active: true }),
      projectsAPI.getAll({})
    ]).then(([u, p]) => {
      setAllUsers(u.data.data)
      setProjects(p.data.data)
    }).catch(() => {})
  }, [])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const toggleParticipant = (uid) => {
    if (uid === userId?.toString()) return // el creador no se puede quitar
    setForm(p => ({
      ...p,
      participants: p.participants.includes(uid)
        ? p.participants.filter(id => id !== uid)
        : [...p.participants, uid]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('El título es obligatorio'); return }
    if (!form.start)        { toast.error('La fecha de inicio es obligatoria'); return }

    setSaving(true)
    try {
      if (isEdit) {
        await eventsAPI.update(event._id, form)
        toast.success('Evento actualizado')
      } else {
        await eventsAPI.create(form)
        toast.success('Evento creado')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar el evento')
    } finally { setSaving(false) }
  }

  return (
    <Modal open title={isEdit ? 'Editar evento' : 'Nuevo evento'} onClose={onClose} size="lg"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={handleSubmit}>
          {isEdit ? 'Guardar cambios' : 'Crear evento'}
        </Button>
      </>}>
      <form onSubmit={handleSubmit} className="space-y-4">

        <Input label="Título *" placeholder="Ej. Reunión de avance OS-2026-041"
          value={form.title} onChange={e => f('title', e.target.value)} required />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo de evento" value={form.type}
            onChange={e => f('type', e.target.value)}
            options={Object.entries(TYPE_META).map(([v,m]) => ({ value:v, label:m.label }))} />
          {projects.length > 0 && (
            <Select label="Proyecto relacionado (opcional)" value={form.project_id}
              onChange={e => f('project_id', e.target.value)}
              placeholder="Sin proyecto"
              options={projects.map(p => ({ value:p._id, label:`${p.folio_os} — ${p.name}` }))} />
          )}
        </div>

        {/* Fechas */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[#626261] cursor-pointer">
            <input type="checkbox" checked={form.all_day}
              onChange={e => f('all_day', e.target.checked)}
              className="w-4 h-4 rounded accent-[#F8CD24]" />
            Todo el día
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Inicio *" type={form.all_day ? 'date' : 'datetime-local'}
            value={form.all_day ? form.start.slice(0,10) : form.start}
            onChange={e => f('start', e.target.value)} required />
          <Input label="Fin" type={form.all_day ? 'date' : 'datetime-local'}
            value={form.all_day ? form.end?.slice(0,10) : form.end}
            onChange={e => f('end', e.target.value)}
            hint="Opcional" />
        </div>

        <Textarea label="Descripción / Notas" rows={2}
          placeholder="Agenda, lugar, enlace de videollamada…"
          value={form.description} onChange={e => f('description', e.target.value)} />

        {/* Participantes */}
        <div>
          <label className="text-xs font-medium text-[#626261] block mb-1.5">
            Participantes
            <span className="text-[#A0A09F] font-normal ml-1">
              ({form.participants.length} seleccionado(s))
            </span>
          </label>
          <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto scrollbar-thin
            border border-[#D9D9D9] rounded-lg p-2 bg-[#FBFBFB]">
            {allUsers.map(u => {
              const uid      = u._id?.toString()
              const selected = form.participants.includes(uid)
              const isMe     = uid === userId?.toString()
              return (
                <button key={uid} type="button"
                  onClick={() => toggleParticipant(uid)}
                  disabled={isMe}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors',
                    selected
                      ? 'bg-[#1D1C19] text-white'
                      : 'hover:bg-[rgba(248,205,36,0.08)] text-[#1D1C19]',
                    isMe && 'opacity-60 cursor-default'
                  )}>
                  <Avatar name={u.name} size="xs" />
                  <span className="truncate text-xs">{u.name}</span>
                  {isMe && <span className="text-2xs opacity-60 ml-auto">Tú</span>}
                </button>
              )
            })}
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// POPUP DE EVENTO (al hacer clic en el calendario)
// ─────────────────────────────────────────────────────────────────────────────
const EventPopup = ({ event, onClose, onEdit, onDelete, currentUserId, userRole }) => {
  if (!event) return null
  const meta    = TYPE_META[event.type] || TYPE_META.reunion
  const Icon    = meta.icon
  const start   = new Date(event.start)
  const end     = event.end ? new Date(event.end) : null
  const isAdmin = ['superadmin','admin'].includes(userRole)
  const isOwner = event.created_by?.toString() === currentUserId?.toString() ||
                  event.creator?._id?.toString() === currentUserId?.toString()
  const canEdit = isAdmin || isOwner

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-[#1D1C19]/20" />
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-sm animate-fade-in"
        onClick={e => e.stopPropagation()}>

        {/* Cabecera de color */}
        <div className="rounded-t-2xl px-5 py-4 flex items-start justify-between gap-3"
          style={{ background: event.color || meta.color }}>
          <div className="flex items-start gap-3">
            <Icon size={18} className="text-white flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-bold text-base leading-tight">{event.title}</p>
              <p className="text-white/70 text-xs mt-0.5">{meta.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Fecha y hora */}
          <div className="flex items-center gap-2 text-sm text-[#626261]">
            <Clock size={14} className="text-[#A0A09F] flex-shrink-0" />
            <span>
              {event.all_day
                ? `Todo el día · ${start.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}`
                : `${start.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})} · 
                   ${start.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}
                   ${end ? ` – ${end.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}` : ''}`
              }
            </span>
          </div>

          {/* Proyecto */}
          {event.project && (
            <div className="flex items-center gap-2 text-sm text-[#626261]">
              <FolderOpen size={14} className="text-[#A0A09F] flex-shrink-0" />
              <span>{event.project.folio_os} — {event.project.name}</span>
            </div>
          )}

          {/* Descripción */}
          {event.description && (
            <p className="text-sm text-[#626261] bg-[#F5F5F5] rounded-lg px-3 py-2.5">
              {event.description}
            </p>
          )}

          {/* Participantes */}
          {event.participants_info?.length > 0 && (
            <div>
              <p className="text-xs text-[#A0A09F] mb-2 flex items-center gap-1">
                <Users size={11} /> {event.participants_info.length} participante(s)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {event.participants_info.map(p => (
                  <div key={p._id} className="flex items-center gap-1.5 bg-[#F5F5F5]
                    px-2 py-1 rounded-full">
                    <Avatar name={p.name} size="xs" />
                    <span className="text-xs text-[#1D1C19] font-medium">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="px-5 pb-5 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
              Editar
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              Eliminar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDARIO MENSUAL
// ─────────────────────────────────────────────────────────────────────────────
const CalendarGrid = ({ year, month, events, today, onDayClick, onEventClick }) => {
  const firstDay  = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells     = []

  // Celdas vacías antes del primer día
  for (let i = 0; i < firstDay; i++) cells.push(null)
  // Días del mes
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header de días */}
      <div className="grid grid-cols-7 border-b border-[#F0F0F0]">
        {DAYS_ES.map(d => (
          <div key={d} className="py-2.5 text-center text-2xs font-bold text-[#A0A09F] uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7 flex-1 divide-x divide-[#F5F5F5]">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="bg-[#FBFBFB] min-h-[100px]" />

          const isToday   = isSameDay(day, today)
          const dayEvents = events.filter(ev => isSameDay(new Date(ev.start), day))
          const maxShow   = 3
          const hidden    = dayEvents.length - maxShow

          return (
            <div key={day.toISOString()}
              className="min-h-[100px] p-1.5 border-b border-[#F5F5F5] cursor-pointer
                hover:bg-[rgba(248,205,36,0.04)] transition-colors group"
              onClick={() => onDayClick(day)}>

              {/* Número del día */}
              <div className={cn(
                'w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1 mx-auto',
                isToday
                  ? 'bg-[#F8CD24] text-[#1D1C19]'
                  : 'text-[#626261] group-hover:text-[#1D1C19]'
              )}>
                {day.getDate()}
              </div>

              {/* Eventos del día */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, maxShow).map(ev => {
                  const meta = TYPE_META[ev.type] || TYPE_META.reunion
                  return (
                    <div key={ev._id}
                      className="text-2xs font-medium px-1.5 py-0.5 rounded-md truncate cursor-pointer
                        hover:opacity-80 transition-opacity text-white"
                      style={{ background: ev.color || meta.color }}
                      onClick={e => { e.stopPropagation(); onEventClick(ev) }}>
                      {ev.all_day ? '' : `${new Date(ev.start).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})} `}
                      {ev.title}
                    </div>
                  )
                })}
                {hidden > 0 && (
                  <div className="text-2xs text-[#A0A09F] px-1.5">
                    +{hidden} más
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL DEL CALENDARIO
// ─────────────────────────────────────────────────────────────────────────────
const CalendarPage = () => {
  const { user }  = useAuth()
  const userId    = user?._id || user?.userId
  const today     = new Date()

  const [year, setYear]           = useState(today.getFullYear())
  const [month, setMonth]         = useState(today.getMonth())
  const [events, setEvents]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [popupEvent, setPopup]    = useState(null)
  const [defaultDate, setDefault] = useState(null)
  const [typeFilter, setType]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const from = new Date(year, month, 1).toISOString()
      const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
      const res  = await eventsAPI.getAll({ from, to, type: typeFilter || undefined })
      setEvents(res.data.data)
    } catch { toast.error('Error al cargar el calendario') }
    finally { setLoading(false) }
  }, [year, month, typeFilter])

  useEffect(() => { load() }, [load])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const handleDayClick = (day) => {
    setDefault(day)
    setEditEvent(null)
    setShowForm(true)
  }

  const handleEventClick = async (ev) => {
    try {
      const res = await eventsAPI.getOne(ev._id)
      setPopup(res.data.data)
    } catch {
      setPopup(ev) // fallback con datos básicos
    }
  }

  const handleDelete = async () => {
    if (!popupEvent) return
    try {
      await eventsAPI.remove(popupEvent._id)
      toast.success('Evento eliminado')
      setPopup(null)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') }
  }

  const handleEdit = () => {
    setEditEvent(popupEvent)
    setPopup(null)
    setShowForm(true)
  }

  // Eventos de la semana actual para el panel lateral
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay())
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const thisWeek  = events.filter(ev => {
    const d = new Date(ev.start)
    return d >= weekStart && d <= weekEnd
  })

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1D1C19]">Calendario</h1>
          <p className="text-sm text-[#626261] mt-0.5">
            Reuniones, recordatorios y vencimientos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={typeFilter} onChange={e => setType(e.target.value)}
            className="text-sm border border-[#D9D9D9] rounded-lg px-3 py-2 bg-white
              text-[#1D1C19] focus:outline-none focus:border-[#F8CD24] min-h-[40px]">
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_META).map(([v,m]) => (
              <option key={v} value={v}>{m.label}</option>
            ))}
          </select>
          <Button variant="primary" icon={<Plus size={14} />}
            onClick={() => { setEditEvent(null); setDefault(today); setShowForm(true) }}>
            Nuevo evento
          </Button>
        </div>
      </div>

      <div className="flex gap-4 min-h-0 flex-1">

        {/* Columna izquierda — mini agenda + leyenda */}
        <div className="hidden lg:flex flex-col gap-4 w-[220px] flex-shrink-0">

          {/* Leyenda de tipos */}
          <Card>
            <Card.Body className="py-4">
              <p className="text-xs font-bold text-[#1D1C19] mb-3 uppercase tracking-wider">Tipos</p>
              <div className="space-y-2">
                {Object.entries(TYPE_META).map(([k, m]) => {
                  const Icon = m.icon
                  return (
                    <button key={k}
                      onClick={() => setType(typeFilter === k ? '' : k)}
                      className={cn(
                        'flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left',
                        'text-sm transition-colors',
                        typeFilter === k
                          ? 'font-semibold text-[#1D1C19]'
                          : 'text-[#626261] hover:bg-[#F5F5F5]'
                      )}>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: m.color }} />
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </Card.Body>
          </Card>

          {/* Eventos de esta semana */}
          <Card className="flex-1 overflow-hidden">
            <Card.Header>
              <Card.Title className="text-xs">Esta semana</Card.Title>
              <span className="text-2xs text-[#A0A09F]">{thisWeek.length} evento(s)</span>
            </Card.Header>
            <div className="overflow-y-auto scrollbar-thin max-h-64 divide-y divide-[#F5F5F5]">
              {thisWeek.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-[#A0A09F]">
                  Sin eventos esta semana
                </div>
              ) : thisWeek.map(ev => {
                const meta = TYPE_META[ev.type] || TYPE_META.reunion
                const d    = new Date(ev.start)
                return (
                  <button key={ev._id} className="w-full px-4 py-2.5 text-left
                    hover:bg-[rgba(248,205,36,0.04)] transition-colors flex items-start gap-2"
                    onClick={() => handleEventClick(ev)}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: ev.color || meta.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#1D1C19] truncate">{ev.title}</p>
                      <p className="text-2xs text-[#A0A09F]">
                        {DAYS_ES[d.getDay()]} {d.getDate()}
                        {!ev.all_day && ` · ${d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Calendario principal */}
        <Card className="flex-1 flex flex-col overflow-hidden min-h-[500px]">
          {/* Controles de navegación */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0F0F0]
            flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg
                  border border-[#D9D9D9] hover:border-[#F8CD24] hover:bg-[rgba(248,205,36,0.06)]
                  transition-colors text-[#626261]">
                <ChevronLeft size={15} />
              </button>
              <button onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg
                  border border-[#D9D9D9] hover:border-[#F8CD24] hover:bg-[rgba(248,205,36,0.06)]
                  transition-colors text-[#626261]">
                <ChevronRight size={15} />
              </button>
              <h2 className="text-lg font-bold text-[#1D1C19]">
                {MONTHS_ES[month]} {year}
              </h2>
            </div>
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
              className="text-xs font-semibold text-[#2E75B6] hover:underline">
              Hoy
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <CalendarGrid
              year={year} month={month}
              events={events} today={today}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          )}
        </Card>
      </div>

      {/* Modals */}
      {showForm && (
        <EventForm
          event={editEvent}
          defaultDate={defaultDate}
          onClose={() => { setShowForm(false); setEditEvent(null) }}
          onSaved={load}
        />
      )}

      {popupEvent && (
        <EventPopup
          event={popupEvent}
          currentUserId={userId?.toString()}
          userRole={user?.role}
          onClose={() => setPopup(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

export default CalendarPage
