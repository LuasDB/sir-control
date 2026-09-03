import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs) => twMerge(clsx(inputs))

// ── Labels ────────────────────────────────────────────────────────────────────
export const STATUS_LABELS = {
  pendiente  : 'Pendiente',
  en_proceso : 'En proceso',
  retrasado  : 'Retrasado',
  en_revision: 'En revisión',
  cerrado    : 'Cerrado',
  cancelado  : 'Cancelado',
}
export const PRIORITY_LABELS = {
  baja:'Baja', media:'Media', alta:'Alta', urgente:'Urgente'
}
export const ROLE_LABELS = {
  superadmin:'Superadmin', admin:'Admin TI', gerente:'Gerente',
  coordinador:'Coordinador', ingeniero:'Ingeniero', auxiliar:'Auxiliar',
}
export const AREAS = [
  'Trabajos especiales','Dosimetría','TI','QHSE',
  'Metrología','Medicina Nuclear','Gerencia'
]
export const MANAGEMENT_ROLES = ['superadmin','admin','gerente','coordinador']

// Cambio 4: Niveles de complejidad con peso fijo
export const COMPLEXITY_LEVELS = {
  basica    : { label:'Básica',     weight:1, color:'#2BA84A' },
  intermedia: { label:'Intermedia', weight:2, color:'#2E75B6' },
  avanzada  : { label:'Avanzada',   weight:4, color:'#B08629' },
  critica   : { label:'Crítica',    weight:8, color:'#E63946' },
}

// ── Colores de estatus (SIRSA) ────────────────────────────────────────────────
export const getStatusColor = (status) => ({
  pendiente  : 'bg-gray-100 text-gray-500',
  en_proceso : 'text-[#2E75B6] bg-[rgba(46,117,182,0.10)]',
  retrasado  : 'text-[#B08629] bg-[rgba(176,134,41,0.12)]',
  en_revision: 'text-violet-600 bg-violet-50',
  cerrado    : 'text-[#2BA84A] bg-[rgba(43,168,74,0.10)]',
  cancelado  : 'text-[#E63946] bg-[rgba(230,57,70,0.10)]',
}[status] || 'bg-gray-100 text-gray-500')

// ── Colores de prioridad (SIRSA) ──────────────────────────────────────────────
export const getPriorityColor = (p) => ({
  baja   : 'bg-[#A0A09F]',
  media  : 'bg-[#2E75B6]',
  alta   : 'bg-[#B08629]',
  urgente: 'bg-[#E63946]',
}[p] || 'bg-[#A0A09F]')

// ── Helpers ───────────────────────────────────────────────────────────────────
export const getInitials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

export const truncate = (str, n = 40) =>
  str?.length > n ? str.slice(0, n) + '…' : str

export const formatDate = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-MX', {
    day:'2-digit', month:'short', year:'numeric'
  })
}
export const formatRelative = (date) => {
  if (!date) return '—'
  const diff = Math.floor((new Date() - new Date(date)) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7)  return `Hace ${diff} días`
  return formatDate(date)
}
export const daysUntil = (date) => {
  if (!date) return null
  return Math.ceil((new Date(date) - new Date()) / 86400000)
}

// Convierte una fecha (o hoy) al formato YYYY-MM-DD que espera <input type="date">,
// usando la zona horaria local para evitar corrimientos de un día.
export const toDateInput = (date) => {
  const dt = date ? new Date(date) : new Date()
  if (isNaN(dt.getTime())) return ''
  const off = dt.getTimezoneOffset() * 60000
  return new Date(dt.getTime() - off).toISOString().slice(0, 10)
}

// Convierte el valor YYYY-MM-DD de un <input type="date"> a ISO fijando el mediodía
// local, de modo que la fecha guardada no "retroceda" un día por la zona horaria.
export const dateInputToISO = (value) => {
  if (!value) return null
  const dt = new Date(`${value}T12:00:00`)
  return isNaN(dt.getTime()) ? null : dt.toISOString()
}

// Deriva la ruta interna del elemento al que apunta una notificación.
// Debe reflejar la lógica de notificationUrl() del backend.
export const notifTarget = (n) => {
  if (!n) return null
  const activityId = n.activity_id?._id || n.activity_id
  const projectId  = n.project_id?._id  || n.project_id
  if (n.type === 'project_comment' && projectId) return `/projects/${projectId}?tab=chat`
  if (activityId) return `/activities/${activityId}`
  if (projectId)  return `/projects/${projectId}`
  return null
}

// Etiqueta corta del destino ("actividad", "proyecto", "chat")
export const notifTargetLabel = (n) => {
  if (!n) return null
  if (n.type === 'project_comment') return 'chat'
  if (n.activity_id) return 'actividad'
  if (n.project_id)  return 'proyecto'
  return null
}
