import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { BotIcon, Mail, Lock, Eye, EyeOff, ArrowLeft, } from 'lucide-react'
import { useAuth } from '../../context/AppContext'
import { Button, Input } from '../../components/ui'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'

// ── Wrapper de autenticación ──────────────────────────────────────────────────
const AuthShell = ({ children }) => (
  <div className="min-h-screen bg-[#1D1C19] flex items-center justify-center p-4">
    {/* Patrón decorativo de fondo */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full
        bg-[rgba(248,205,36,0.04)]" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full
        bg-[rgba(248,205,36,0.03)]" />
    </div>
    <div className="w-full max-w-[400px] relative z-10">{children}</div>
  </div>
)

// ── Login ─────────────────────────────────────────────────────────────────────
export const LoginPage = () => {
  const { login }   = useAuth()
  const navigate    = useNavigate()
  const [form, setForm]     = useState({ email:'', password:'' })
  const [showPass, setShow] = useState(false)
  const [loading, setLoad]  = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoad(true)
    try {
      await login(form)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Correo o contraseña incorrectos')
    } finally { setLoad(false) }
  }

  return (
    <AuthShell>
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[#F8CD24] flex items-center justify-center mb-4 shadow-card">
          <BotIcon size={26} className="text-[#1D1C19]" />
        </div>
        <h1 className="text-xl font-bold text-white">SIR-Flow</h1>
        <p className="text-sm text-[#626261] mt-1">
          Servicios Integrales para la Radiación
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-modal p-8">
        <h2 className="text-lg font-bold text-[#1D1C19] mb-1">Iniciar sesión</h2>
        <p className="text-xs text-[#A0A09F] mb-6">
          Ingresa tus credenciales para continuar
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Correo electrónico"
            type="email"
            placeholder="usuario@siradiacion.com.mx"
            value={form.email}
            onChange={e => setForm(f => ({...f, email:e.target.value}))}
            icon={<Mail size={15} />}
            required
          />

          {/* Password con toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#626261]">Contraseña</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A09F] pointer-events-none">
                <Lock size={15} />
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({...f, password:e.target.value}))}
                required
                className="input-sirsa pl-9 pr-10"
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A09F] hover:text-[#1D1C19] transition-colors">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-[#E63946] bg-[rgba(230,57,70,0.08)] border border-[rgba(230,57,70,0.20)]
              rounded-lg px-3.5 py-2.5">
              ⚠ {error}
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" size="lg" loading={loading}>
            Iniciar sesión
          </Button>
        </form>

        <div className="mt-5 text-center">
          <Link to="/forgot-password"
            className="text-xs text-[#626261] hover:text-[#1D1C19] transition-colors">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>

      <p className="text-center text-2xs text-[#626261] mt-6">
        Made with 💛 by Saul De la Fuente (LuasDB)
      </p>
    </AuthShell>
  )
}

// ── Forgot Password ───────────────────────────────────────────────────────────
export const ForgotPasswordPage = () => {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoad]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoad(true)
    try {
      await authAPI.forgotPassword({ email })
      setSent(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al enviar el correo')
    } finally { setLoad(false) }
  }

  return (
    <AuthShell>
      <div className="bg-white rounded-2xl shadow-modal p-8">
        <Link to="/login"
          className="inline-flex items-center gap-1.5 text-xs text-[#626261]
            hover:text-[#1D1C19] mb-6 transition-colors">
          <ArrowLeft size={13} /> Volver al login
        </Link>

        {!sent ? (
          <>
            <h2 className="text-lg font-bold text-[#1D1C19] mb-1">Recuperar contraseña</h2>
            <p className="text-xs text-[#A0A09F] mb-6">
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Correo electrónico" type="email"
                placeholder="usuario@siradiacion.com.mx"
                value={email} onChange={e => setEmail(e.target.value)}
                icon={<Mail size={15} />} required />
              <Button type="submit" variant="primary" className="w-full" size="lg" loading={loading}>
                Enviar enlace
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-[rgba(43,168,74,0.10)] rounded-2xl flex items-center
              justify-center mx-auto mb-4">
              <Mail size={24} className="text-[#2BA84A]" />
            </div>
            <h3 className="text-base font-bold text-[#1D1C19] mb-2">Correo enviado</h3>
            <p className="text-sm text-[#626261]">
              Revisa tu bandeja de entrada en <strong>{email}</strong> y sigue las instrucciones.
            </p>
          </div>
        )}
      </div>
    </AuthShell>
  )
}

// ── Reset Password ────────────────────────────────────────────────────────────
export const ResetPasswordPage = () => {
  const [form, setForm]   = useState({ password:'', confirm:'' })
  const [loading, setLoad] = useState(false)
  const [done, setDone]   = useState(false)
  const navigate = useNavigate()
  const token = new URLSearchParams(window.location.search).get('token')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Las contraseñas no coinciden'); return }
    if (form.password.length < 6) { toast.error('Mínimo 6 caracteres'); return }
    setLoad(true)
    try {
      await authAPI.resetPassword({ token, newPassword: form.password })
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al restablecer la contraseña')
    } finally { setLoad(false) }
  }

  return (
    <AuthShell>
      <div className="bg-white rounded-2xl shadow-modal p-8">
        <h2 className="text-lg font-bold text-[#1D1C19] mb-6">Nueva contraseña</h2>
        {!done ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nueva contraseña" type="password" placeholder="••••••••"
              value={form.password} onChange={e => setForm(f => ({...f, password:e.target.value}))} required />
            <Input label="Confirmar contraseña" type="password" placeholder="••••••••"
              value={form.confirm} onChange={e => setForm(f => ({...f, confirm:e.target.value}))} required />
            <Button type="submit" variant="primary" className="w-full" size="lg" loading={loading}>
              Guardar contraseña
            </Button>
          </form>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-[#2BA84A]">✓ Contraseña actualizada</p>
            <p className="text-xs text-[#A0A09F] mt-1">Redirigiendo al login…</p>
          </div>
        )}
      </div>
    </AuthShell>
  )
}
