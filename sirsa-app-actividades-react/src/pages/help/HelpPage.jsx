import { useState } from 'react'
import {
  HelpCircle, ChevronDown, ChevronRight, RadioTower,
  LayoutDashboard, FolderOpen, ClipboardList, Users, Bell, MessageSquare
} from 'lucide-react'
import { Card } from '../../components/ui'
import { cn } from '../../lib/utils'

const SECTIONS = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    content: `El dashboard muestra el resumen general del departamento técnico.

**KPIs:** Verás 4 tarjetas con el total de proyectos activos, actividades, actividades retrasadas y actividades cerradas.

**Filtro por área:** Usa el selector de áreas en la parte superior derecha para filtrar toda la información por Dosimetría, Metrología, QHSE, TI, etc.

**Tabla de proyectos:** Muestra los proyectos activos con su porcentaje de avance y estatus. Haz clic en cualquier fila para abrir el detalle del proyecto.

**Por vencer:** Lista las actividades cuya fecha objetivo está próxima o ya venció, con indicador de días restantes.

**Carga de trabajo:** Muestra a los usuarios con más actividades asignadas para apoyar a la gerencia en la distribución de tareas.`
  },
  {
    icon: FolderOpen,
    title: 'Proyectos',
    content: `Cada proyecto corresponde a una **Orden de Servicio** del área técnica.

**Crear un proyecto (Gerente, Coordinador, Admin):**
1. Haz clic en "Nuevo proyecto"
2. Ingresa el folio de la OS, nombre, área y fecha objetivo
3. Completa los datos del cliente: razón social, contacto, teléfono y correo
4. Guarda el proyecto

**Dentro del proyecto encontrarás 3 pestañas:**
- **Actividades:** Lista de actividades del proyecto con su estatus y progreso
- **Chat:** Espacio de comunicación del equipo sobre el proyecto
- **Fases:** Etapas del proyecto (instalación, calibración, entrega, etc.)

**Estatus automático:** Si la fecha objetivo vence sin cerrarse, el proyecto cambia automáticamente a "Retrasado".

**Cerrar proyecto:** Solo gerente, coordinador, admin o superadmin pueden cerrar formalmente un proyecto.`
  },
  {
    icon: ClipboardList,
    title: 'Actividades',
    content: `Las actividades son las tareas que componen cada proyecto.

**Crear actividad (Ingeniero o superior):**
1. Abre el proyecto y ve a la pestaña "Actividades"
2. Haz clic en "Nueva actividad"
3. Asigna nombre, prioridad, fecha objetivo y responsables

**Prioridades:**
- 🔵 Media (predeterminada)
- 🟡 Alta
- 🔴 Urgente
- ⚪ Baja

**Cambiar estatus:**
- Ingeniero/Auxiliar pueden cambiar a "En proceso" o "En revisión"
- Gerente/Coordinador pueden mover a cualquier estatus, incluyendo "Cerrado"

**Checklist:** Cada actividad puede tener subtareas. Márcalas como completadas registrando los días que tomó.

**Adjuntos:** Sube fotos, reportes, certificados o cualquier evidencia. Máximo 20 MB por archivo. El sistema mantiene un versionado automático si subes una nueva versión del mismo archivo.

**Bitácora:** Cada cambio de estatus, avance registrado o archivo subido queda registrado en la bitácora con fecha y usuario.`
  },
  {
    icon: Bell,
    title: 'Notificaciones',
    content: `Las notificaciones se muestran en el ícono de campana en la barra superior.

**Cuándo recibes notificaciones:**
- Cuando te asignan una nueva actividad
- Cuando alguien registra un avance en una actividad tuya
- Cuando hay un mensaje nuevo en el chat de un proyecto donde participas
- 3 días antes de que venza una actividad asignada
- 1 día antes de que venza una actividad asignada
- Cuando una actividad vence (estatus cambia a Retrasado)

**El número en naranja** sobre la campana indica cuántas notificaciones no has leído.

Haz clic en la campana o ve a "Notificaciones" para ver el listado completo.
Puedes marcar todas como leídas con un solo clic.`
  },
  {
    icon: MessageSquare,
    title: 'Chat de proyecto',
    content: `Cada proyecto tiene su propio chat interno para comunicación del equipo.

**Acceso:** Dentro del detalle de cualquier proyecto, ve a la pestaña "Chat del proyecto".

**Funciones:**
- Envía mensajes de texto de hasta 2000 caracteres
- Puedes editar tus propios mensajes haciendo doble clic (próximamente)
- Los mensajes eliminados muestran "Mensaje eliminado" para mantener el hilo

**Histórico:** El chat carga los últimos 30 mensajes. Haz clic en "Cargar mensajes anteriores" para ver el historial completo.

**Notificaciones de chat:** Todos los miembros del proyecto reciben notificación cuando hay un nuevo mensaje.`
  },
  {
    icon: Users,
    title: 'Usuarios y roles',
    content: `**Roles del sistema:**

| Rol | Descripción |
|---|---|
| Superadmin | Acceso total. Gestión de departamentos y configuración global |
| Admin TI | Alta y edición de usuarios, soporte técnico |
| Gerente | Crea y cierra proyectos, ve estadísticas, informes |
| Coordinador | Mismas capacidades que Gerente |
| Ingeniero | Crea actividades, registra avances propios |
| Auxiliar | Solo registra avances de actividades asignadas |

**Recuperar contraseña:** En la pantalla de login haz clic en "¿Olvidaste tu contraseña?" e ingresa tu correo. Recibirás un enlace válido por 15 minutos.

**Cambiar contraseña:** Actualmente se gestiona mediante el flujo de recuperación. Contacta a soporte TI para reestablecimiento manual.`
  },
]

const HelpSection = ({ icon: Icon, title, content }) => {
  const [open, setOpen] = useState(false)

  const renderContent = (text) =>
    text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold text-charcoal mt-3 mb-1">{line.slice(2,-2)}</p>
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="text-sm text-charcoal-muted ml-4 list-disc">{line.slice(2)}</li>
      }
      if (line.startsWith('|')) return null // saltar tablas en renderizado simple
      if (line.match(/^\d+\./)) {
        return <li key={i} className="text-sm text-charcoal-muted ml-4 list-decimal">{line.replace(/^\d+\.\s/,'')}</li>
      }
      if (!line.trim()) return <div key={i} className="h-1" />
      return <p key={i} className="text-sm text-charcoal-muted leading-relaxed">{line.replace(/\*\*(.*?)\*\*/g, (_, m) => m)}</p>
    })

  return (
    <Card>
      <button className="w-full px-4 py-3 flex items-center gap-3 text-left"
        onClick={() => setOpen(v => !v)}>
        <div className="w-8 h-8 rounded-lg bg-navy/8 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-navy" />
        </div>
        <span className="flex-1 text-sm font-semibold text-charcoal">{title}</span>
        {open ? <ChevronDown size={15} className="text-charcoal-muted" />
               : <ChevronRight size={15} className="text-charcoal-muted" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-silver-border pt-3 space-y-1">
          {renderContent(content)}
        </div>
      )}
    </Card>
  )
}

const HelpPage = () => (
  <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center">
        <RadioTower size={18} className="text-gold" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-charcoal">Guía de usuario — SIR-Track</h1>
        <p className="text-xs text-charcoal-muted mt-0.5">
          Plataforma de seguimiento de proyectos del departamento técnico
        </p>
      </div>
    </div>

    <Card>
      <Card.Body>
        <div className="flex items-start gap-3">
          <HelpCircle size={18} className="text-gold flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-charcoal mb-1">¿Cómo usar esta guía?</p>
            <p className="text-sm text-charcoal-muted">
              Haz clic en cada sección para expandir la ayuda correspondiente.
              Si tienes dudas técnicas (acceso, configuración del servidor, usuarios bloqueados),
              contacta al equipo de TI.
            </p>
          </div>
        </div>
      </Card.Body>
    </Card>

    <div className="space-y-2">
      {SECTIONS.map(s => <HelpSection key={s.title} {...s} />)}
    </div>

    <Card>
      <Card.Body>
        <p className="text-xs text-charcoal-muted text-center">
          SIR-Track v1.0 · Servicios Integrales para la Radiación S.A. de C.V. · Soporte TI interno
        </p>
      </Card.Body>
    </Card>
  </div>
)

export default HelpPage
