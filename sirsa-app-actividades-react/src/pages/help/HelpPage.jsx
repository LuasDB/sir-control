import { useState } from 'react'
import {
  HelpCircle, ChevronDown, ChevronRight, RadioTower,
  LayoutDashboard, FolderOpen, ClipboardList, Users, Bell,
  MessageSquare, CalendarDays, BarChart2, Building2, Settings,BotIcon
} from 'lucide-react'
import { Card } from '../../components/ui'
import { cn } from '../../lib/utils'

// ── Contenido de secciones ────────────────────────────────────────────────────
const SECTIONS = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    items: [
      {
        label: 'Vista según tu rol',
        text: 'El dashboard muestra información diferente dependiendo de tu rol en el sistema.',
        bullets: [
          'Gerente, Coordinador, Admin, Superadmin: ven estadísticas globales del departamento — todos los proyectos, todas las actividades y la carga de trabajo de cada usuario.',
          'Ingeniero, Auxiliar: ven únicamente los proyectos en los que están asignados como miembros y las actividades que tienen asignadas.',
        ]
      },
      {
        label: 'KPIs (tarjetas superiores)',
        bullets: [
          'Proyectos activos: total de proyectos que no están cerrados ni cancelados.',
          'Actividades totales: suma de todas las actividades visibles para ti.',
          'Retrasadas: actividades cuya fecha objetivo ya venció y aún no están cerradas.',
          'Actividades cerradas: total acumulado de actividades completadas.',
        ]
      },
      {
        label: 'Tabla de proyectos activos',
        text: 'Muestra los proyectos con su folio OS, área, porcentaje de avance y estatus. Haz clic en cualquier fila para abrir el detalle del proyecto.',
      },
      {
        label: 'Próximas a vencer',
        text: 'Lista las actividades cuya fecha objetivo es dentro de los próximos 7 días o ya venció. El indicador de color señala la urgencia: rojo = vencida, ámbar = 1 día, azul = más de 1 día.',
      },
      {
        label: 'Carga de trabajo',
        text: 'Visible solo para roles de gestión. Muestra cuántas actividades activas tiene asignadas cada usuario para apoyar la distribución de tareas. La barra cambia de verde a amarillo o rojo conforme aumenta la carga.',
      },
      {
        label: 'Filtro por área',
        text: 'Visible solo para roles de gestión. Usa el selector en la parte superior derecha para filtrar toda la información por Dosimetría, Metrología, QHSE, TI, etc.',
      },
    ]
  },
  {
    icon: FolderOpen,
    title: 'Proyectos',
    items: [
      {
        label: '¿Qué es un proyecto?',
        text: 'Cada proyecto representa una Orden de Servicio (OS) del área técnica. Agrupa todas las actividades, fases y comunicación relacionadas con esa OS.',
      },
      {
        label: 'Crear un proyecto',
        text: 'Solo Gerente, Coordinador, Admin y Superadmin pueden crear proyectos.',
        steps: [
          'Haz clic en "Nuevo proyecto" en la página de Proyectos.',
          'Ingresa el folio OS (debe ser único), nombre, área y fecha objetivo.',
          'Selecciona el cliente y, opcionalmente, agrega miembros al proyecto.',
          'Guarda el proyecto.',
        ]
      },
      {
        label: 'Miembros del proyecto',
        text: 'Los miembros son los usuarios que tienen acceso al proyecto. Un ingeniero o auxiliar solo verá los proyectos donde figure como miembro. El creador del proyecto queda incluido automáticamente.',
      },
      {
        label: 'Pestañas del proyecto',
        bullets: [
          'Actividades: lista de tareas del proyecto con estatus, prioridad y progreso.',
          'Chat: comunicación interna del equipo sobre el proyecto.',
          'Fases: etapas del ciclo de vida (instalación, calibración, entrega, etc.).',
        ]
      },
      {
        label: 'Estatus del proyecto',
        bullets: [
          'Pendiente → En proceso → En revisión → Cerrado.',
          'Retrasado: se asigna automáticamente si la fecha objetivo vence sin cerrarse.',
          'Solo roles de gestión pueden cerrar o cancelar un proyecto.',
        ]
      },
      {
        label: 'Avance del proyecto',
        text: 'El porcentaje de avance se calcula automáticamente con base en las actividades cerradas vs el total de actividades no canceladas del proyecto.',
      },
    ]
  },
  {
    icon: ClipboardList,
    title: 'Actividades',
    items: [
      {
        label: 'Crear una actividad',
        text: 'Los Ingenieros y roles superiores pueden crear actividades desde la pestaña "Actividades" dentro de un proyecto. Los Auxiliares no pueden crear actividades.',
        steps: [
          'Abre el proyecto y ve a la pestaña "Actividades".',
          'Haz clic en "Nueva actividad".',
          'Completa nombre, prioridad, complejidad, fecha objetivo y asigna uno o más responsables.',
          'Opcionalmente define una dependencia (la actividad solo podrá iniciarse cuando la actividad de la que depende esté cerrada).',
        ]
      },
      {
        label: 'Prioridades',
        bullets: [
          'Baja (●gris): sin urgencia.',
          'Media (●azul): estándar, predeterminada.',
          'Alta (●ámbar): requiere atención pronta.',
          'Urgente (●rojo): atención inmediata.',
        ]
      },
      {
        label: 'Complejidad',
        text: 'Indica el peso de la actividad en el cálculo de carga de trabajo.',
        bullets: [
          'Básica (×1): tarea simple.',
          'Intermedia (×2): requiere criterio técnico.',
          'Avanzada (×4): trabajo especializado.',
          'Crítica (×8): impacto alto en el proyecto.',
        ]
      },
      {
        label: 'Cambio de estatus',
        bullets: [
          'Ingeniero y Auxiliar: pueden cambiar a "En proceso" o "En revisión".',
          'Gerente, Coordinador, Admin, Superadmin: pueden mover a cualquier estatus, incluyendo "Cerrado" y "Cancelado".',
          'Una actividad marcada como dependiente no puede iniciarse hasta que su actividad predecesora esté cerrada.',
        ]
      },
      {
        label: 'Filtros de la lista de actividades',
        bullets: [
          'Buscar: filtra por nombre en tiempo real (sin llamada al servidor).',
          'Estatus y Prioridad: filtros enviados al servidor para reducir resultados.',
          'Solo vencidas: muestra únicamente actividades cuya fecha objetivo ya pasó.',
          'Mis actividades: muestra solo las actividades en las que tú estás asignado. Útil para enfocarte en tu carga personal.',
        ]
      },
      {
        label: 'Checklist de subtareas',
        text: 'Divide el trabajo en pasos más pequeños. Cualquier usuario asignado puede agregar, marcar y eliminar subtareas. Al marcar una como completada se registra el número de días que tomó.',
      },
      {
        label: 'Registrar avance',
        text: 'Usa el botón "Registrar avance" para dejar una nota de progreso. Queda en la bitácora con tu nombre y la fecha. No es necesario cambiar el estatus para registrar un avance.',
      },
      {
        label: 'Adjuntos',
        text: 'Sube fotos, reportes, certificados o cualquier evidencia. Formatos aceptados: PDF, Word, Excel, imágenes y ZIP. Máximo 20 MB por archivo.',
        bullets: [
          'El botón "Ver" abre el archivo en una nueva ventana del navegador (PDFs e imágenes se muestran directamente; otros tipos se descargan).',
          'El sistema mantiene versionado automático: si subes un archivo con el mismo nombre, se registra como versión 2, 3, etc.',
          'Los archivos se organizan en carpetas por folio OS del proyecto.',
        ]
      },
      {
        label: 'Bitácora',
        text: 'Cada acción queda registrada automáticamente: creación, cambios de estatus, avances, modificaciones al checklist y archivos subidos. Visible en la pestaña "Bitácora" del detalle de la actividad.',
      },
    ]
  },
  {
    icon: CalendarDays,
    title: 'Calendario',
    items: [
      {
        label: '¿Para qué sirve el calendario?',
        text: 'El calendario permite registrar eventos del departamento: reuniones, visitas a cliente, fechas de entrega importantes, mantenimientos, etc. Es complementario a las actividades del proyecto.',
      },
      {
        label: 'Crear un evento',
        steps: [
          'Ve a la sección "Calendario" en el menú lateral.',
          'Haz clic en el botón "Nuevo evento" o directamente en un día del calendario.',
          'Ingresa título, fecha, hora de inicio y fin, y una descripción opcional.',
          'Guarda el evento.',
        ]
      },
      {
        label: 'Vista del calendario',
        text: 'Al iniciar sesión se muestra un aviso si tienes eventos próximos en los siguientes 3 días. Puedes navegar entre meses con las flechas y hacer clic en un evento para ver su detalle.',
      },
      {
        label: 'Editar y eliminar',
        text: 'Puedes editar o eliminar los eventos que tú creaste. Los roles de gestión pueden editar cualquier evento del departamento.',
      },
    ]
  },
  {
    icon: BarChart2,
    title: 'Reportes',
    items: [
      {
        label: 'Acceso',
        text: 'La sección de Reportes es visible solo para Gerente, Coordinador, Admin y Superadmin.',
      },
      {
        label: 'Reporte de carga de trabajo',
        text: 'Muestra la distribución de actividades activas entre todos los usuarios del departamento. Permite identificar quién tiene más carga para redistribuir tareas de forma equitativa.',
        bullets: [
          'Puedes filtrar por área o rango de fechas.',
          'El peso de cada actividad considera su nivel de complejidad (Básica ×1, Intermedia ×2, Avanzada ×4, Crítica ×8).',
        ]
      },
    ]
  },
  {
    icon: Bell,
    title: 'Notificaciones',
    items: [
      {
        label: '¿Cuándo recibes notificaciones?',
        bullets: [
          'Cuando te asignan una nueva actividad.',
          '3 días antes de que venza una actividad asignada.',
          '1 día antes de que venza una actividad asignada.',
          'Cuando una actividad vence y su estatus cambia a "Retrasado".',
          'Cuando alguien cambia el estatus de una actividad en la que participas.',
        ]
      },
      {
        label: 'Badge de notificaciones',
        text: 'El número en amarillo sobre el ícono de campana en la barra superior indica cuántas notificaciones no has leído. Se actualiza en tiempo real sin necesidad de refrescar la página.',
      },
      {
        label: 'Ver y gestionar',
        text: 'Haz clic en la campana o ve a "Notificaciones" en el menú para ver el listado completo. Puedes marcar notificaciones individuales como leídas o usar "Marcar todas como leídas" con un solo clic.',
      },
    ]
  },
  {
    icon: MessageSquare,
    title: 'Chat de proyecto',
    items: [
      {
        label: 'Acceso',
        text: 'Cada proyecto tiene su propio chat interno. Entra al detalle de cualquier proyecto y ve a la pestaña "Chat del proyecto".',
      },
      {
        label: 'Funciones',
        bullets: [
          'Envía mensajes de texto de hasta 2 000 caracteres.',
          'Los mensajes eliminados muestran "Mensaje eliminado" para mantener el hilo de la conversación.',
          'Los mensajes llegan en tiempo real a todos los miembros del proyecto que tengan el chat abierto.',
        ]
      },
      {
        label: 'Historial',
        text: 'El chat carga los últimos 30 mensajes al abrirse. Haz clic en "Cargar mensajes anteriores" para ver el historial completo.',
      },
    ]
  },
  {
    icon: Users,
    title: 'Usuarios y roles',
    items: [
      {
        label: 'Roles del sistema',
        table: {
          headers: ['Rol', 'Puede crear proyectos', 'Puede cerrar actividades', 'Ve todo el sistema'],
          rows: [
            ['Superadmin',   '✓', '✓', '✓'],
            ['Admin TI',     '✓', '✓', '✓'],
            ['Gerente',      '✓', '✓', '✓'],
            ['Coordinador',  '✓', '✓', '✓'],
            ['Ingeniero',    '✗', '✗', 'Solo asignados'],
            ['Auxiliar',     '✗', '✗', 'Solo asignados'],
          ]
        }
      },
      {
        label: 'Recuperar contraseña',
        steps: [
          'En la pantalla de login haz clic en "¿Olvidaste tu contraseña?".',
          'Ingresa tu correo registrado.',
          'Recibirás un enlace de restablecimiento válido por 15 minutos.',
          'Haz clic en el enlace y define tu nueva contraseña.',
        ]
      },
      {
        label: 'Mi cuenta',
        text: 'Desde el menú de usuario (esquina superior derecha) accede a "Mi cuenta" para actualizar tu nombre, correo, contraseña y foto de perfil.',
      },
    ]
  },
  {
    icon: Building2,
    title: 'Departamentos',
    items: [
      {
        label: 'Acceso',
        text: 'La sección de Departamentos es visible solo para Superadmin y Admin TI.',
      },
      {
        label: 'Gestión de departamentos',
        bullets: [
          'Crea departamentos y agrégales áreas (Dosimetría, Metrología, TI, etc.).',
          'Asigna usuarios a un departamento para organizar la estructura del equipo.',
          'Desactivar un departamento lo oculta del sistema sin eliminar sus datos históricos.',
        ]
      },
    ]
  },
  {
    icon: Settings,
    title: 'Configuración de cuenta',
    items: [
      {
        label: 'Acceso',
        text: 'Haz clic en tu nombre en la barra superior y selecciona "Mi cuenta", o ve directamente a Configuración en el menú.',
      },
      {
        label: 'Qué puedes cambiar',
        bullets: [
          'Nombre completo y correo electrónico.',
          'Contraseña (requiere ingresar la contraseña actual).',
          'Foto de perfil (avatar): sube una imagen desde tu dispositivo. Se muestra en la barra superior, en los listados de actividades y en el chat.',
        ]
      },
    ]
  },
]

// ── Renderizador de contenido ─────────────────────────────────────────────────
const InlineText = ({ text }) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="font-semibold text-charcoal">{p.slice(2, -2)}</strong>
          : p
      )}
    </span>
  )
}

const RoleTable = ({ table }) => (
  <div className="overflow-x-auto mt-2">
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-[#1D1C19] text-white">
          {table.headers.map(h => (
            <th key={h} className="px-3 py-2 text-left font-semibold first:rounded-tl-lg last:rounded-tr-lg">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}>
            {row.map((cell, j) => (
              <td key={j} className={cn(
                'px-3 py-2 border-b border-[#F0F0F0]',
                j === 0 ? 'font-semibold text-charcoal' : 'text-charcoal-muted text-center'
              )}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const HelpItem = ({ label, text, bullets, steps, table }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-bold text-[#1D1C19] uppercase tracking-wide">{label}</p>
    {text && (
      <p className="text-sm text-charcoal-muted leading-relaxed">
        <InlineText text={text} />
      </p>
    )}
    {bullets && (
      <ul className="space-y-1 ml-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-charcoal-muted">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#D9D9D9] flex-shrink-0" />
            <InlineText text={b} />
          </li>
        ))}
      </ul>
    )}
    {steps && (
      <ol className="space-y-1 ml-1">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-charcoal-muted">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1D1C19] text-white
              text-[10px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <InlineText text={s} />
          </li>
        ))}
      </ol>
    )}
    {table && <RoleTable table={table} />}
  </div>
)

// ── Sección colapsable ────────────────────────────────────────────────────────
const HelpSection = ({ icon: Icon, title, items }) => {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <button className="w-full px-4 py-3 flex items-center gap-3 text-left"
        onClick={() => setOpen(v => !v)}>
        <div className="w-8 h-8 rounded-lg bg-navy/8 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-navy" />
        </div>
        <span className="flex-1 text-sm font-semibold text-charcoal">{title}</span>
        {open
          ? <ChevronDown size={15} className="text-charcoal-muted" />
          : <ChevronRight size={15} className="text-charcoal-muted" />}
      </button>

      {open && (
        <div className="border-t border-silver-border divide-y divide-[#F5F5F5]">
          {items.map((item, i) => (
            <div key={i} className="px-5 py-4">
              <HelpItem {...item} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
const HelpPage = () => (
  <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">

    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center">
        <BotIcon size={18} className="text-gold" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-charcoal">Guía de usuario — SIR-Flow</h1>
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
              Haz clic en cada sección para expandir su contenido.
              Para dudas técnicas (acceso, usuarios bloqueados, configuración del servidor)
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
          SIR-Flow v1.0 · Made with 💛 by Saul De la fuente
        </p>
      </Card.Body>
    </Card>

  </div>
)

export default HelpPage
