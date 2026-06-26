import { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react'
import { authAPI, notificationsAPI } from '../services/api'
import { io } from 'socket.io-client'

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload, isAuthenticated: true, loading: false }
    case 'LOGOUT':
      return { user: null, isAuthenticated: false, loading: false }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    default:
      return state
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
    loading: true,
  })
  // Controla si se muestra el prompt de bienvenida (estilo Outlook)
  const [showWelcomePrompt, setShowWelcomePrompt] = useState(false)

  // Restaurar sesión desde localStorage al montar
  useEffect(() => {
    const token = localStorage.getItem('sir_token')
    const user  = localStorage.getItem('sir_user')
    if (token && user) {
      try {
        dispatch({ type: 'LOGIN', payload: JSON.parse(user) })
        // No mostramos el prompt al refrescar la página, solo al login activo
      } catch {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    } else {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const res   = await authAPI.login(credentials)
    const token = res.data.token
    const payload = JSON.parse(atob(token.split('.')[1]))
    localStorage.setItem('sir_token', token)
    localStorage.setItem('sir_user', JSON.stringify(payload))
    dispatch({ type: 'LOGIN', payload })
    // Mostrar prompt de bienvenida al hacer login activo
    setShowWelcomePrompt(true)
    return payload
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sir_token')
    localStorage.removeItem('sir_user')
    dispatch({ type: 'LOGOUT' })
    setShowWelcomePrompt(false)
  }, [])

  const dismissWelcomePrompt = useCallback(() => {
    setShowWelcomePrompt(false)
  }, [])

  return (
    <AuthContext.Provider value={{
      ...state, login, logout,
      showWelcomePrompt, dismissWelcomePrompt
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ─── Notifications Context ────────────────────────────────────────────────────
const NotificationsContext = createContext(null)

const notifReducer = (state, action) => {
  switch (action.type) {
    case 'SET_UNREAD':
      return { ...state, unread: action.payload }
    case 'INCREMENT':
      return { ...state, unread: state.unread + 1 }
    case 'RESET':
      return { ...state, unread: 0 }
    case 'ADD':
      return { ...state, items: [action.payload, ...state.items], unread: state.unread + 1 }
    default:
      return state
  }
}

export const NotificationsProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth()
  const [state, dispatch] = useReducer(notifReducer, { unread: 0, items: [] })

  const fetchUnread = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await notificationsAPI.getUnreadCount()
      dispatch({ type: 'SET_UNREAD', payload: res.data.data.unread })
    } catch { /* silent */ }
  }, [isAuthenticated])

  useEffect(() => {
    fetchUnread()
  }, [fetchUnread])

  const addNotification = useCallback((notif) => {
    dispatch({ type: 'ADD', payload: notif })
  }, [])

  const resetUnread = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return (
    <NotificationsContext.Provider value={{ ...state, fetchUnread, addNotification, resetUnread }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}

// ─── Socket Context ───────────────────────────────────────────────────────────
const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user }  = useAuth()
  const { addNotification }        = useNotifications()
  const [socket, setSocket]        = useReducer((_, s) => s, null)

  useEffect(() => {
    if (!isAuthenticated || !user) return

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'
    const s = io(socketUrl, { transports: ['websocket'], reconnectionAttempts: 5 })

    s.on('connect', () => {
      const userId = user._id || user.userId
      s.emit('user:register', userId)
      console.log('🔌 Socket conectado:', s.id)
    })

    // Escuchar notificaciones personales
    const userId = user._id || user.userId
    s.on(`notification:${userId}`, (notif) => {
      addNotification(notif)
    })

    s.on('disconnect', () => console.log('❌ Socket desconectado'))

    setSocket(s)

    return () => {
      s.disconnect()
      setSocket(null)
    }
  }, [isAuthenticated, user])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
