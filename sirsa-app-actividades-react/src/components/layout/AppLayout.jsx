import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, ClipboardList, Users, Building2,
  Bell, LogOut, BotIcon, ChevronDown, Menu, X, HelpCircle,
  CalendarDays, BarChart2, Settings
} from 'lucide-react'
import { useAuth, useNotifications } from '../../context/AppContext'
import { Avatar, Tooltip } from '../ui'
import { cn, ROLE_LABELS } from '../../lib/utils'

const NAV_ITEMS = [
  { to:'/dashboard',   icon:LayoutDashboard, label:'Dashboard'     },
  { to:'/projects',    icon:FolderOpen,      label:'Proyectos'     },
  { to:'/activities',  icon:ClipboardList,   label:'Actividades'   },
  { to:'/calendar',    icon:CalendarDays,    label:'Calendario'    },
  { to:'/reports',     icon:BarChart2,       label:'Reportes',       roles:['superadmin','admin','gerente','coordinador'] },
  { to:'/users',       icon:Users,           label:'Usuarios',       roles:['superadmin','admin','gerente','coordinador'] },
  { to:'/departments', icon:Building2,        label:'Departamentos',  roles:['superadmin','admin'] },
]

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ collapsed }) => {
  const { user } = useAuth()
  const filtered = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(user?.role))

  return (
    <aside className={cn(
      'flex flex-col bg-white border-r border-[#F0F0F0] transition-all duration-200 z-30 flex-shrink-0',
      'fixed inset-y-0 left-0 lg:relative shadow-[1px_0_0_rgba(0,0,0,0.04)]',
      collapsed ? '-translate-x-full lg:translate-x-0 lg:w-[58px]' : 'translate-x-0 w-[220px]'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-[#F0F0F0] h-[56px] flex-shrink-0',
        collapsed ? 'justify-center px-0' : 'gap-3 px-4'
      )}>
        <div className="w-8 h-8 rounded-lg bg-[#1D1C19] flex items-center justify-center flex-shrink-0">
          <BotIcon size={15} className="text-[#F8CD24]" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#1D1C19] leading-tight">SIR-Track</div>
            <div className="text-2xs text-[#A0A09F] leading-tight">Dept. Técnico</div>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 px-2.5 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin">
        {filtered.map(({ to, icon: Icon, label }) => (
          <Tooltip key={to} content={collapsed ? label : ''}>
            <NavLink to={to} className={({ isActive }) =>
              cn('nav-item', isActive && 'active', collapsed && 'justify-center px-0')
            }>
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          </Tooltip>
        ))}
      </nav>

      {/* Footer nav */}
      <div className="py-3 px-2.5 border-t border-[#F0F0F0]">
        <Tooltip content={collapsed ? 'Ayuda' : ''}>
          <NavLink to="/help" className={({ isActive }) =>
            cn('nav-item', isActive && 'active', collapsed && 'justify-center px-0')
          }>
            <HelpCircle size={16} className="flex-shrink-0" />
            {!collapsed && <span>Ayuda</span>}
          </NavLink>
        </Tooltip>
      </div>
    </aside>
  )
}

// ── Topbar ────────────────────────────────────────────────────────────────────
const Topbar = ({ onToggle, collapsed }) => {
  const { user, logout }             = useAuth()
  const { unread }                   = useNotifications()
  const navigate                     = useNavigate()
  const [menuOpen, setMenu]          = useState(false)

  return (
    <header className="h-[56px] bg-[#1D1C19] flex items-center px-4 gap-3 flex-shrink-0 z-40">
      {/* Toggle */}
      <button onClick={onToggle}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#A0A09F]
          hover:bg-white/10 hover:text-white transition-colors flex-shrink-0">
        {collapsed ? <Menu size={17} /> : <X size={17} />}
      </button>

      {/* Titulo de página — vacío, el contenido lo da la página */}
      <div className="flex-1" />

      {/* Notificaciones */}
      <button onClick={() => navigate('/notifications')}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg
          text-[#A0A09F] hover:bg-white/10 hover:text-white transition-colors">
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 bg-[#F8CD24] text-[#1D1C19] text-[9px] font-bold
            min-w-[16px] h-4 rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* User menu */}
      <div className="relative">
        <button onClick={() => setMenu(v => !v)}
          className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg
            hover:bg-white/10 transition-colors">
          {user?.avatar_url
            ? <img src={`${import.meta.env.VITE_API_URL?.replace('/api/v1','') || 'http://localhost:3000'}${user.avatar_url}`}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover border border-white/20" />
            : <Avatar name={user?.name} size="sm" src={user?.avatar_url} />
          }
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-white leading-tight truncate max-w-[110px]">
              {user?.name}
            </div>
            <div className="text-2xs text-[#A0A09F] leading-tight">
              {ROLE_LABELS[user?.role] || user?.role}
            </div>
          </div>
          <ChevronDown size={12} className="text-[#626261] flex-shrink-0" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl
              border border-[#F0F0F0] shadow-modal z-50 py-1.5 animate-fade-in">
              <div className="px-4 py-2.5 border-b border-[#F5F5F5]">
                <p className="text-sm font-semibold text-[#1D1C19] truncate">{user?.name}</p>
                <p className="text-2xs text-[#A0A09F] truncate">{user?.email}</p>
              </div>
              <button onClick={() => { navigate('/settings'); setMenu(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1D1C19]
                  hover:bg-[rgba(248,205,36,0.06)] transition-colors">
                <Settings size={14} className="text-[#626261]" /> Mi cuenta
              </button>
              <button onClick={() => { logout(); setMenu(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#E63946]
                  hover:bg-[rgba(230,57,70,0.06)] transition-colors">
                <LogOut size={14} /> Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

// ── AppLayout ─────────────────────────────────────────────────────────────────
const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F5]">
      <Sidebar collapsed={collapsed} />

      {/* Overlay móvil */}
      {!collapsed && (
        <div className="fixed inset-0 bg-[#1D1C19]/40 z-20 lg:hidden"
          onClick={() => setCollapsed(true)} />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onToggle={() => setCollapsed(v => !v)} collapsed={collapsed} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-[1400px] mx-auto p-5 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
