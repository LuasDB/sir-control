// ─── Catálogo: Tipos de actividad ────────────────────────────────────────────
// Los coordinadores y administradores dan de alta los tipos de actividad
// (ej. "Trámites", "Seguimiento a correo", "Informe anual") que luego se
// eligen en el formulario de alta de cada actividad.
import { useState, useEffect, useCallback } from 'react'
import { Tags, Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { activityTypesAPI } from '../../services/api'
import { Card, Button, Input, Textarea, Badge, Modal, Spinner, Empty } from '../../components/ui'
import { MANAGEMENT_ROLES, cn } from '../../lib/utils'
import { useAuth } from '../../context/AppContext'
import toast from 'react-hot-toast'

export const ActivityTypesPage = () => {
  const { user }  = useAuth()
  const canManage = MANAGEMENT_ROLES.includes(user?.role)

  const [types, setTypes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editType, setEditType] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await activityTypesAPI.getAll()
      setTypes(res.data.data)
    } catch { toast.error('Error al cargar los tipos de actividad') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeactivate = async (id) => {
    try {
      await activityTypesAPI.remove(id)
      toast.success('Tipo de actividad desactivado'); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') }
  }

  const handleActivate = async (id) => {
    try {
      await activityTypesAPI.activate(id)
      toast.success('Tipo de actividad reactivado'); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') }
  }

  const activeCount = types.filter(t => t.active).length

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-charcoal">Tipos de actividad</h1>
          <p className="text-xs text-charcoal-muted mt-0.5">
            {activeCount} activo(s) · {types.length} en total
          </p>
        </div>
        {canManage && (
          <Button variant="gold" icon={<Plus size={14} />}
            onClick={() => { setEditType(null); setShowForm(true) }}>
            Nuevo tipo
          </Button>
        )}
      </div>

      {loading
        ? <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        : types.length === 0
          ? <Empty icon={<Tags size={40} />} title="Sin tipos de actividad"
              description='Crea el primero, por ejemplo "Trámites" o "Seguimiento a correo"' />
          : (
            <Card>
              <div className="divide-y divide-silver-border">
                {types.map(t => (
                  <div key={t._id} className={cn('px-4 py-3 flex items-center gap-3', !t.active && 'opacity-55')}>
                    <Tags size={16} className="text-navy flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-charcoal">{t.name}</p>
                        {!t.active && <Badge variant="red">Inactivo</Badge>}
                      </div>
                      {t.description && (
                        <p className="text-xs text-charcoal-muted mt-0.5">{t.description}</p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" icon={<Pencil size={13} />}
                          onClick={() => { setEditType(t); setShowForm(true) }} />
                        {t.active
                          ? <Button variant="ghost" size="sm" icon={<Trash2 size={13} />}
                              onClick={() => handleDeactivate(t._id)} />
                          : <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />}
                              onClick={() => handleActivate(t._id)} />
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )
      }

      {showForm && (
        <ActivityTypeFormModal type={editType}
          onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  )
}

const ActivityTypeFormModal = ({ type, onClose, onSaved }) => {
  const isEdit = !!type
  const [form, setForm]     = useState({
    name       : type?.name || '',
    description: type?.description || '',
  })
  const [saving, setSaving] = useState(false)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      if (isEdit) {
        await activityTypesAPI.update(type._id, form)
        toast.success('Tipo de actividad actualizado')
      } else {
        await activityTypesAPI.create(form)
        toast.success('Tipo de actividad creado')
      }
      onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.message || 'Error') } finally { setSaving(false) }
  }

  return (
    <Modal open title={isEdit ? 'Editar tipo de actividad' : 'Nuevo tipo de actividad'} onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="gold" loading={saving} onClick={handleSubmit}>
          {isEdit ? 'Guardar' : 'Crear'}
        </Button>
      </>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nombre *" placeholder="Ej. Trámites, Seguimiento a correo, Informe anual"
          value={form.name} onChange={e => f('name', e.target.value)} required autoFocus />
        <Textarea label="Descripción (opcional)"
          placeholder="Para qué sirve este tipo de actividad…"
          value={form.description} onChange={e => f('description', e.target.value)} />
      </form>
    </Modal>
  )
}

export default ActivityTypesPage
