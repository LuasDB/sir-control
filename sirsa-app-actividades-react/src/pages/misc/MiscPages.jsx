// ─── Páginas: Usuarios, Departamentos y Notificaciones ───────────────────────
import { useState, useEffect, useCallback } from 'react'
import { Users, Building2, Plus, Pencil, Trash2, Bell, BellOff, ChevronRight, Shield } from 'lucide-react'
import { usersAPI, departmentsAPI, notificationsAPI } from '../../services/api'
import { Card, Button, Input, Select, Badge, Avatar, Modal, Spinner, Empty, StatusBadge } from '../../components/ui'
import { ROLE_LABELS, MANAGEMENT_ROLES, cn, formatRelative, formatDate, AREAS } from '../../lib/utils'
import { useAuth, useNotifications } from '../../context/AppContext'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════════════════════
// USERS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export const UsersPage = () => {
  const { user }  = useAuth()
  const isAdmin   = ['superadmin','admin'].includes(user?.role)
  const canCreate = MANAGEMENT_ROLES.includes(user?.role)

  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [roleFilter, setRole]     = useState('')
  const [editUser, setEditUser]   = useState(null)
  const [showForm, setShowForm]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (roleFilter) params.role = roleFilter
      const res = await usersAPI.getAll(params)
      setUsers(res.data.data)
    } catch { toast.error('Error al cargar usuarios') } finally { setLoading(false) }
  }, [roleFilter])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? users.filter(u => u.name?.toLowerCase().includes(search.toLowerCase())
        || u.email?.toLowerCase().includes(search.toLowerCase()))
    : users

  const handleToggleActive = async (u) => {
    try {
      await usersAPI.update(u._id, { active: !u.active })
      toast.success(`Usuario ${u.active ? 'desactivado' : 'activado'}`)
      load()
    } catch { toast.error('Error al actualizar el usuario') }
  }

  const ROLE_BADGE = {
    superadmin  : 'violet', admin: 'navy', gerente: 'green',
    coordinador : 'blue', ingeniero: 'amber', auxiliar: 'default'
  }

  return (
    <div className="space-y-4 animate-fade-in min-h-[90vh]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-charcoal">Usuarios</h1>
          <p className="text-xs text-charcoal-muted mt-0.5">{users.length} usuarios en el sistema</p>
        </div>
        {canCreate && (
          <Button variant="gold" icon={<Plus size={14} />} onClick={() => { setEditUser(null); setShowForm(true) }}>
            Nuevo usuario
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <Card.Body className="py-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-40">
              <input placeholder="Buscar por nombre o correo…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-3 pr-3 py-1.5 text-sm border border-silver-border rounded bg-white
                  focus:outline-none focus:border-navy" />
            </div>
            <select value={roleFilter} onChange={e => setRole(e.target.value)}
              className="text-sm border border-silver-border rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-navy">
              <option value="">Todos los roles</option>
              {Object.entries(ROLE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </Card.Body>
      </Card>

      {loading
        ? <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        : (
          <Card>
            <div className="divide-y divide-silver-border">
              {filtered.length === 0
                ? <Empty icon={<Users size={36} />} title="Sin usuarios" />
                : filtered.map(u => (
                  <div key={u._id} className="px-4 py-3 flex items-center gap-3">
                    <Avatar name={u.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-charcoal">{u.name}</p>
                        <Badge variant={ROLE_BADGE[u.role] || 'default'}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                        {!u.active && <Badge variant="red">Inactivo</Badge>}
                      </div>
                      <p className="text-xs text-charcoal-muted">{u.email}</p>
                    </div>
                    {canCreate && (
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm"
                          icon={<Pencil size={13} />}
                          onClick={() => { setEditUser(u); setShowForm(true) }} />
                        {isAdmin && (
                          <Button variant="ghost" size="sm"
                            icon={u.active ? <BellOff size={13} /> : <Bell size={13} />}
                            onClick={() => handleToggleActive(u)} />
                        )}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          </Card>
        )
      }

      {showForm && (
        <UserFormModal user={editUser} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  )
}

// ── User Form Modal ───────────────────────────────────────────────────────────
const UserFormModal = ({ user: editUser, onClose, onSaved }) => {
  const { user } = useAuth()
  const isEdit   = !!editUser
  const [departments, setDepts] = useState([])
  const [form, setForm] = useState({
    name       : editUser?.name        || '',
    email      : editUser?.email       || '',
    role       : editUser?.role        || 'auxiliar',
    area       : editUser?.area        || '',
    gerencia_id: editUser?.gerencia_id?.toString() || '',
    password   : '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    departmentsAPI.getAll().then(r => setDepts(r.data.data)).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        const { password, ...data } = form
        await usersAPI.update(editUser._id, data)
        toast.success('Usuario actualizado')
      } else {
        await usersAPI.create(form)
        toast.success('Usuario creado. Si no se ingresó contraseña, recibirá un correo para crearla.')
      }
      onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') } finally { setSaving(false) }
  }

  const canSetRole = ['superadmin','admin'].includes(user?.role)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal open title={isEdit ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={handleSubmit}>
          {isEdit ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </>}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Nombre completo *" placeholder="Juan Pérez García"
          value={form.name} onChange={e => f('name', e.target.value)} required />
        <Input label="Correo electrónico *" type="email" placeholder="juan@siradiacion.com.mx"
          value={form.email} onChange={e => f('email', e.target.value)} required disabled={isEdit} />
        <div className="grid grid-cols-2 gap-3">
          {canSetRole && (
            <Select label="Rol" value={form.role} onChange={e => f('role', e.target.value)}
              options={Object.entries(ROLE_LABELS).map(([v,l]) => ({ value:v, label:l }))} />
          )}
          {/* Cambio 8: campo Área */}
          <Select label="Área" value={form.area} onChange={e => f('area', e.target.value)}
            placeholder="Selecciona área"
            options={AREAS.map(a => ({ value:a, label:a }))} />
        </div>
        {/* Cambio 8: campo Gerencia */}
        {departments.length > 0 && (
          <Select label="Gerencia / Departamento" value={form.gerencia_id}
            onChange={e => f('gerencia_id', e.target.value)}
            placeholder="Sin gerencia asignada"
            options={departments.map(d => ({ value: d._id, label: d.name }))} />
        )}
        {!isEdit && (
          <div>
            <Input label="Contraseña (opcional)" type="password"
              placeholder="Dejar vacío para enviar correo de activación"
              value={form.password} onChange={e => f('password', e.target.value)} />
            <p className="text-2xs text-[#A0A09F] mt-1">
              Si dejas la contraseña vacía, el usuario recibirá un correo para crearla.
            </p>
          </div>
        )}
      </form>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export const DepartmentsPage = () => {
  const { user }  = useAuth()
  const isAdmin   = ['superadmin','admin'].includes(user?.role)

  const [departments, setDepts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editDept, setEditDept] = useState(null)
  const [expanded, setExpanded] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await departmentsAPI.getAll()
      setDepts(res.data.data)
    } catch { toast.error('Error al cargar departamentos') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeactivate = async (id) => {
    try {
      await departmentsAPI.deactivate(id)
      toast.success('Departamento desactivado'); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') }
  }

  const handleRemoveArea = async (deptId, area) => {
    try {
      await departmentsAPI.removeArea(deptId, area)
      toast.success('Área eliminada'); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-charcoal">Departamentos</h1>
          <p className="text-xs text-charcoal-muted mt-0.5">{departments.length} departamentos</p>
        </div>
        {isAdmin && (
          <Button variant="gold" icon={<Plus size={14} />}
            onClick={() => { setEditDept(null); setShowForm(true) }}>
            Nuevo departamento
          </Button>
        )}
      </div>

      {loading
        ? <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        : departments.length === 0
          ? <Empty icon={<Building2 size={40} />} title="Sin departamentos"
              description="Crea el primer departamento" />
          : (
            <div className="space-y-3">
              {departments.map(d => (
                <Card key={d._id} className={!d.active ? 'opacity-60' : ''}>
                  <div className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                    onClick={() => setExpanded(e => ({ ...e, [d._id]: !e[d._id] }))}>
                    <Building2 size={16} className="text-navy flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-charcoal">{d.name}</p>
                      <p className="text-xs text-charcoal-muted">{d.areas?.length || 0} áreas</p>
                    </div>
                    {!d.active && <Badge variant="red">Inactivo</Badge>}
                    {isAdmin && (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" icon={<Pencil size={13} />}
                          onClick={() => { setEditDept(d); setShowForm(true) }} />
                        {d.active && (
                          <Button variant="ghost" size="sm" icon={<Trash2 size={13} />}
                            onClick={() => handleDeactivate(d._id)} />
                        )}
                      </div>
                    )}
                    <ChevronRight size={14} className={cn('text-charcoal-muted transition-transform',
                      expanded[d._id] && 'rotate-90')} />
                  </div>

                  {expanded[d._id] && (
                    <div className="px-4 pb-3 border-t border-silver-border pt-3">
                      <div className="flex flex-wrap gap-2">
                        {(d.areas || []).map(area => (
                          <div key={area} className="flex items-center gap-1 bg-silver px-2.5 py-1
                            rounded-full text-xs text-charcoal">
                            {area}
                            {isAdmin && (
                              <button onClick={() => handleRemoveArea(d._id, area)}
                                className="text-charcoal-muted hover:text-red-500 ml-1">
                                <X size={10} />
                              </button>
                            )}
                          </div>
                        ))}
                        {isAdmin && <AddAreaInline deptId={d._id} onSaved={load} />}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )
      }

      {showForm && (
        <DeptFormModal dept={editDept} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  )
}

const AddAreaInline = ({ deptId, onSaved }) => {
  const [open, setOpen]   = useState(false)
  const [name, setName]   = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await departmentsAPI.addArea(deptId, name.trim())
      setName(''); setOpen(false); onSaved()
    } catch { toast.error('Error') } finally { setSaving(false) }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1 text-xs text-navy border border-dashed border-navy/30
        hover:border-navy px-2.5 py-1 rounded-full transition-colors">
      <Plus size={11} /> Agregar área
    </button>
  )

  return (
    <form onSubmit={handleAdd} className="flex items-center gap-1">
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="Nombre del área"
        className="text-xs border border-silver-border rounded-full px-2.5 py-1 bg-white
          focus:outline-none focus:border-navy w-32" />
      <Button type="submit" size="sm" variant="navy" loading={saving}><Plus size={11} /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>✕</Button>
    </form>
  )
}

const DeptFormModal = ({ dept, onClose, onSaved }) => {
  const isEdit  = !!dept
  const [name, setName] = useState(dept?.name || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) { await departmentsAPI.update(dept._id, { name }); toast.success('Departamento actualizado') }
      else        { await departmentsAPI.create({ name });            toast.success('Departamento creado') }
      onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') } finally { setSaving(false) }
  }

  return (
    <Modal open title={isEdit ? 'Editar departamento' : 'Nuevo departamento'} onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="gold" loading={saving} onClick={handleSubmit}>
          {isEdit ? 'Guardar' : 'Crear'}
        </Button>
      </>}>
      <form onSubmit={handleSubmit}>
        <Input label="Nombre del departamento *" placeholder="Ej. Departamento Técnico"
          value={name} onChange={e => setName(e.target.value)} required />
      </form>
    </Modal>
  )
}

// Importación faltante
import { X } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export const NotificationsPage = () => {
  const { resetUnread }             = useNotifications()
  const [notifications, setNotifs] = useState([])
  const [loading, setLoading]      = useState(true)
  const [page, setPage]            = useState(1)
  const [total, setTotal]          = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificationsAPI.getAll({ page, limit: 20 })
      const d   = res.data.data
      setNotifs(d.notifications)
      setTotal(d.total)
    } catch { toast.error('Error al cargar notificaciones') } finally { setLoading(false) }
  }, [page])

  useEffect(() => { load() }, [load])

  const handleMarkAll = async () => {
    try {
      await notificationsAPI.markAllRead()
      resetUnread()
      toast.success('Todas marcadas como leídas')
      load()
    } catch { toast.error('Error') }
  }

  const handleMark = async (id) => {
    try {
      await notificationsAPI.markRead(id)
      setNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
      resetUnread()
    } catch {}
  }

  const NOTIF_ICONS = {
    activity_assigned : '📋',
    progress_update   : '📝',
    project_comment   : '💬',
    status_changed    : '🔄',
    due_soon          : '⏰',
    overdue           : '⚠️',
    project_created   : '📁',
    project_closed    : '✅',
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-charcoal">Notificaciones</h1>
          <p className="text-xs text-charcoal-muted mt-0.5">{total} en total</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleMarkAll}>
          Marcar todas como leídas
        </Button>
      </div>

      <Card>
        {loading
          ? <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          : notifications.length === 0
            ? <Empty icon={<Bell size={36} />} title="Sin notificaciones"
                description="Aquí aparecerán las alertas de actividades, comentarios y vencimientos" />
            : (
              <div className="divide-y divide-silver-border">
                {notifications.map(n => (
                  <div key={n._id}
                    className={cn('px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-silver/50 transition-colors',
                      !n.read && 'bg-navy/5')}
                    onClick={() => !n.read && handleMark(n._id)}>
                    <div className="w-8 h-8 rounded-full bg-silver flex items-center justify-center text-base flex-shrink-0">
                      {NOTIF_ICONS[n.type] || '🔔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm', !n.read ? 'font-semibold text-charcoal' : 'font-medium text-charcoal-light')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-charcoal-muted mt-0.5 line-clamp-2">{n.body}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] text-charcoal-muted">{formatRelative(n.createdAt)}</span>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-gold" />}
                    </div>
                  </div>
                ))}
              </div>
            )
        }
      </Card>
    </div>
  )
}
