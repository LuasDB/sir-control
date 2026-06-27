// ── UI Components — Identidad Visual SIRSA ────────────────────────────────────
import { cn, getStatusColor, getPriorityColor, getInitials, STATUS_LABELS, PRIORITY_LABELS } from '../../lib/utils'
import { X, Check } from 'lucide-react'
import { useEffect, useRef } from 'react'

// ── Button ────────────────────────────────────────────────────────────────────
export const Button = ({
  children, variant = 'primary', size = 'md',
  className, disabled, loading, icon, onClick, type = 'button', ...props
}) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F8CD24] focus-visible:ring-offset-1'

  const variants = {
    // Primario: amarillo SIRSA
    primary : 'bg-[#F8CD24] text-[#1D1C19] hover:bg-[#E6BE1F] shadow-btn font-semibold',
    gold    : 'bg-[#F8CD24] text-[#1D1C19] hover:bg-[#E6BE1F] shadow-btn font-semibold',
    // Secundario: negro SIRSA
    secondary:'bg-[#1D1C19] text-[#FBFBFB] hover:bg-[#303030] shadow-btn font-semibold',
    navy    : 'bg-[#1D1C19] text-[#FBFBFB] hover:bg-[#303030] shadow-btn',
    // Éxito
    success : 'bg-[#2BA84A] text-white hover:bg-[#239A40] shadow-btn font-semibold',
    // Info
    info    : 'bg-[#2E75B6] text-white hover:bg-[#2566A0] shadow-btn',
    // Peligro
    danger  : 'bg-[#E63946] text-white hover:bg-[#D03040] shadow-btn',
    // Outline
    outline : 'border-2 border-[#D9D9D9] text-[#1D1C19] hover:border-[#F8CD24] hover:bg-[rgba(248,205,36,0.06)] bg-white',
    ghost   : 'text-[#626261] hover:bg-[rgba(248,205,36,0.08)] hover:text-[#1D1C19]',
  }
  const sizes = {
    sm  : 'px-3 py-1.5 text-xs gap-1.5 min-h-[32px]',
    md  : 'px-4 py-2.5 text-sm gap-2 min-h-[40px]',
    lg  : 'px-6 py-3 text-sm gap-2 min-h-[48px]',
    icon: 'p-2 min-w-[36px] min-h-[36px]',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {loading
        ? <Spinner size="sm" className="text-current opacity-70" />
        : icon}
      {children}
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export const Card = ({ children, className, onClick, ...props }) => (
  <div
    onClick={onClick}
    className={cn(
      'bg-white rounded-xl border border-black/[0.06] shadow-card',
      onClick && 'cursor-pointer',
      className
    )}
    {...props}>
    {children}
  </div>
)
Card.Header = ({ children, className }) => (
  <div className={cn('px-5 py-3.5 border-b border-[#F0F0F0] flex items-center justify-between', className)}>
    {children}
  </div>
)
Card.Title = ({ children, className }) => (
  <h3 className={cn('text-sm font-semibold text-[#1D1C19]', className)}>{children}</h3>
)
Card.Body = ({ children, className }) => (
  <div className={cn('p-5', className)}>{children}</div>
)
Card.Footer = ({ children, className }) => (
  <div className={cn('px-5 py-3 border-t border-[#F0F0F0] flex items-center gap-2', className)}>
    {children}
  </div>
)

// ── Input ─────────────────────────────────────────────────────────────────────
export const Input = ({ label, error, className, icon, hint, ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label className="text-xs font-medium text-[#626261]">{label}</label>
    )}
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A09F] pointer-events-none">
          {icon}
        </span>
      )}
      <input
        className={cn(
          'input-sirsa',
          icon && 'pl-9',
          error && 'error',
          className
        )}
        {...props}
      />
    </div>
    {hint && !error && <p className="text-2xs text-[#A0A09F]">{hint}</p>}
    {error && <p className="text-2xs text-[#E63946] flex items-center gap-1"><span>⚠</span>{error}</p>}
  </div>
)

// ── Textarea ──────────────────────────────────────────────────────────────────
export const Textarea = ({ label, error, className, hint, ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-xs font-medium text-[#626261]">{label}</label>}
    <textarea
      rows={3}
      className={cn(
        'input-sirsa resize-none min-h-[88px]',
        error && 'error',
        className
      )}
      {...props}
    />
    {hint && !error && <p className="text-2xs text-[#A0A09F]">{hint}</p>}
    {error && <p className="text-2xs text-[#E63946]">⚠ {error}</p>}
  </div>
)

// ── Select ────────────────────────────────────────────────────────────────────
export const Select = ({ label, error, options = [], className, placeholder, hint, ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-xs font-medium text-[#626261]">{label}</label>}
    <select
      className={cn('input-sirsa appearance-none cursor-pointer', error && 'error', className)}
      {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {hint && !error && <p className="text-2xs text-[#A0A09F]">{hint}</p>}
    {error && <p className="text-2xs text-[#E63946]">⚠ {error}</p>}
  </div>
)

// ── Badge ─────────────────────────────────────────────────────────────────────
export const Badge = ({ children, variant = 'default', className }) => {
  const v = {
    default : 'bg-[#F0F0F0] text-[#626261]',
    black   : 'bg-[#1D1C19] text-[#FBFBFB]',
    yellow  : 'bg-[rgba(248,205,36,0.18)] text-[#B08629]',
    green   : 'bg-[rgba(43,168,74,0.12)] text-[#2BA84A]',
    blue    : 'bg-[rgba(46,117,182,0.12)] text-[#2E75B6]',
    red     : 'bg-[rgba(230,57,70,0.10)] text-[#E63946]',
    amber   : 'bg-[rgba(176,134,41,0.12)] text-[#B08629]',
    violet  : 'bg-violet-50 text-violet-600',
    // backward compat
    navy    : 'bg-[rgba(29,28,25,0.08)] text-[#1D1C19]',
  }
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
      v[variant] || v.default,
      className
    )}>
      {children}
    </span>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
export const StatusBadge = ({ status }) => (
  <span className={cn(
    'inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold',
    getStatusColor(status)
  )}>
    {STATUS_LABELS[status] || status}
  </span>
)

// ── Priority Dot ──────────────────────────────────────────────────────────────
export const PriorityDot = ({ priority, showLabel = false }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', getPriorityColor(priority))} />
    {showLabel && (
      <span className="text-xs text-[#626261] font-medium">
        {PRIORITY_LABELS[priority] || priority}
      </span>
    )}
  </span>
)

// ── Avatar ────────────────────────────────────────────────────────────────────
// Usando negro y amarillo SIRSA para los colores de avatares
const AVATAR_BG = [
  'bg-[#1D1C19]','bg-[#2E75B6]','bg-[#2BA84A]',
  'bg-[#B08629]','bg-[#626261]','bg-[#E63946]',
]
export const Avatar = ({ name = '', size = 'md', className, src }) => {
  const idx   = (name.charCodeAt(0) || 0) % AVATAR_BG.length
  const sizes = {
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-12 h-12 text-base',
  }
  // Si hay URL de foto real, mostrarla; si no, el avatar de iniciales
  if (src) {
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api/v1','') || 'http://192.168.1.73:3000'
    const imgSrc  = src.startsWith('http') ? src : `${baseUrl}${src}`
    return (
      <img
        src={imgSrc}
        alt={name}
        className={cn('rounded-full object-cover flex-shrink-0', sizes[size], className)}
        onError={e => {
          // Si la imagen falla, mostrar iniciales como fallback
          e.target.style.display = 'none'
          e.target.parentNode?.classList?.add('show-initials')
        }}
      />
    )
  }
  return (
    <span className={cn(
      'rounded-full flex items-center justify-center font-bold text-white flex-shrink-0',
      AVATAR_BG[idx], sizes[size], className
    )}>
      {getInitials(name)}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 'md', className }) => {
  const sizes = { sm:'w-3.5 h-3.5', md:'w-5 h-5', lg:'w-8 h-8', xl:'w-12 h-12' }
  return (
    <svg className={cn('animate-spin text-[#1D1C19]', sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-80" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

// ── Progress ──────────────────────────────────────────────────────────────────
export const Progress = ({ value = 0, className, showLabel = false, size = 'sm' }) => {
  const v = Math.min(100, Math.max(0, value))
  const color = v >= 80 ? '#2BA84A' : v >= 40 ? '#F8CD24' : '#E63946'
  const heights = { sm:'h-1.5', md:'h-2', lg:'h-3' }
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex-1 bg-[#F0F0F0] rounded-full overflow-hidden', heights[size])}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${v}%`, background: color }}
        />
      </div>
      {showLabel && (
        <span className="text-2xs font-semibold text-[#626261] w-8 text-right tabular-nums">
          {v}%
        </span>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, size = 'md', footer }) => {
  const overlayRef = useRef()
  const sizes = { sm:'max-w-sm', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center pt-[72px] sm:pt-4 px-4 pb-4"
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && onClose?.()}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-[#1D1C19]/40 backdrop-blur-[2px]" />
      {/* Panel */}
      <div className={cn(
        'relative bg-white rounded-xl shadow-modal w-full animate-fade-in flex flex-col',
        'max-h-[calc(100vh-80px)] sm:max-h-[90vh]',
        sizes[size]
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0] flex-shrink-0">
          <h2 className="text-base font-semibold text-[#1D1C19]">{title}</h2>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#A0A09F]
              hover:bg-[#F5F5F5] hover:text-[#1D1C19] transition-colors">
            <X size={15} />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto scrollbar-thin flex-1">
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[#F0F0F0] flex items-center justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export const Empty = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
    {icon && (
      <div className="w-14 h-14 rounded-2xl bg-[#F5F5F5] flex items-center justify-center
        text-[#A0A09F]">
        {icon}
      </div>
    )}
    <div>
      <p className="text-sm font-semibold text-[#1D1C19]">{title}</p>
      {description && <p className="text-xs text-[#A0A09F] mt-1">{description}</p>}
    </div>
    {action && <div className="mt-2">{action}</div>}
  </div>
)

// ── Divider ───────────────────────────────────────────────────────────────────
export const Divider = ({ label, className }) => (
  <div className={cn('flex items-center gap-3', className)}>
    <div className="flex-1 h-px bg-[#F0F0F0]" />
    {label && <span className="text-2xs text-[#A0A09F] font-medium">{label}</span>}
    <div className="flex-1 h-px bg-[#F0F0F0]" />
  </div>
)

// ── Tooltip (CSS) ─────────────────────────────────────────────────────────────
export const Tooltip = ({ children, content }) => (
  <span className="relative group inline-flex">
    {children}
    {content && (
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 text-xs
        bg-[#1D1C19] text-white rounded-lg whitespace-nowrap opacity-0 pointer-events-none shadow-modal
        group-hover:opacity-100 transition-opacity duration-150 z-50">
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent
          border-t-[#1D1C19]" />
      </span>
    )}
  </span>
)

// ── Alert Banner ──────────────────────────────────────────────────────────────
export const Alert = ({ type = 'info', children, className }) => {
  const types = {
    info   : 'bg-[rgba(46,117,182,0.08)] border-[#2E75B6] text-[#2E75B6]',
    success: 'bg-[rgba(43,168,74,0.08)] border-[#2BA84A] text-[#2BA84A]',
    warning: 'bg-[rgba(248,205,36,0.12)] border-[#B08629] text-[#B08629]',
    danger : 'bg-[rgba(230,57,70,0.08)] border-[#E63946] text-[#E63946]',
  }
  return (
    <div className={cn('rounded-lg border-l-4 px-4 py-3 text-sm', types[type], className)}>
      {children}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
export const KpiCard = ({ icon: Icon, label, value, sub, color = 'default', accent }) => {
  const colors = {
    default: 'text-[#1D1C19]',
    yellow : 'text-[#B08629]',
    green  : 'text-[#2BA84A]',
    blue   : 'text-[#2E75B6]',
    red    : 'text-[#E63946]',
  }
  return (
    <Card className={cn(accent && 'border-l-[3px] border-l-[#F8CD24]')}>
      <Card.Body className="py-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#626261] mb-1 flex items-center gap-1.5">
              {Icon && <Icon size={12} className="flex-shrink-0" />} {label}
            </p>
            <p className={cn('text-3xl font-bold tabular-nums', colors[color])}>{value}</p>
            {sub && (
              <p className="text-xs text-[#A0A09F] mt-1">{sub}</p>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────
export const SectionHeader = ({ title, action, description, className }) => (
  <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
    <div>
      <h2 className="text-lg font-bold text-[#1D1C19]">{title}</h2>
      {description && <p className="text-xs text-[#A0A09F] mt-0.5">{description}</p>}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
)
