import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sir_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sir_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login         : (data) => api.post('/auth/login', data),
  register      : (data) => api.post('/auth/register', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword : (data) => api.post('/auth/reset-password', data),
}
export const usersAPI = {
  getAll: (params)  => api.get('/users', { params }),
  getOne: (id)      => api.get(`/users/${id}`),
  create: (data)    => api.post('/users', data),
  update: (id, d)   => api.patch(`/users/${id}`, d),
  remove: (id)      => api.delete(`/users/${id}`),
}
export const departmentsAPI = {
  getAll    : (params)   => api.get('/departments', { params }),
  getOne    : (id)       => api.get(`/departments/${id}`),
  create    : (data)     => api.post('/departments', data),
  update    : (id, d)    => api.patch(`/departments/${id}`, d),
  deactivate: (id)       => api.delete(`/departments/${id}`),
  addArea   : (id, name) => api.post(`/departments/${id}/areas`, { name }),
  removeArea: (id, area) => api.delete(`/departments/${id}/areas/${encodeURIComponent(area)}`),
}
export const clientsAPI = {
  getAll: (params) => api.get('/clients', { params }),
  getOne: (id)     => api.get(`/clients/${id}`),
  create: (data)   => api.post('/clients', data),
  update: (id, d)  => api.patch(`/clients/${id}`, d),
}
export const projectsAPI = {
  getAll        : (params)        => api.get('/projects', { params }),
  getOne        : (id)            => api.get(`/projects/${id}`),
  create        : (data)          => api.post('/projects', data),
  update        : (id, d)         => api.patch(`/projects/${id}`, d),
  close         : (id)            => api.post(`/projects/${id}/close`),
  cancel        : (id)            => api.post(`/projects/${id}/cancel`),
  getDashboard  : (params)        => api.get('/projects/dashboard', { params }),
  getProjectDash: (id)            => api.get(`/projects/${id}/dashboard`),
  addPhase      : (id, d)         => api.post(`/projects/${id}/phases`, d),
  updatePhase   : (id, pid, d)    => api.patch(`/projects/${id}/phases/${pid}`, d),
  deletePhase   : (id, pid)       => api.delete(`/projects/${id}/phases/${pid}`),
  // Cambio 6: gestión de miembros del proyecto
  addMember     : (id, userId)    => api.post(`/projects/${id}/members`, { userId }),
  removeMember  : (id, userId)    => api.delete(`/projects/${id}/members/${userId}`),
}
export const activitiesAPI = {
  getAll          : (params)         => api.get('/activities', { params }),
  getOne          : (id)             => api.get(`/activities/${id}`),
  create          : (data)           => api.post('/activities', data),
  update          : (id, d)          => api.patch(`/activities/${id}`, d),
  updateStatus    : (id, d)          => api.patch(`/activities/${id}/status`, d),
  addNote         : (id, note)       => api.post(`/activities/${id}/notes`, { note }),
  getLogs         : (id, params)     => api.get(`/activities/${id}/logs`, { params }),
  addChecklistItem: (id, d)          => api.post(`/activities/${id}/checklist`, d),
  toggleChecklist : (id, itemId, d)  => api.patch(`/activities/${id}/checklist/${itemId}`, d),
  deleteChecklist : (id, itemId)     => api.delete(`/activities/${id}/checklist/${itemId}`),
  uploadFiles     : (id, form)       => api.post(`/activities/${id}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteAttachment: (id, attId)      => api.delete(`/activities/${id}/attachments/${attId}`),
}
export const chatAPI = {
  getMessages  : (projectId, params)        => api.get(`/projects/${projectId}/chat`, { params }),
  sendMessage  : (projectId, data)          => api.post(`/projects/${projectId}/chat`, data),
  editMessage  : (projectId, msgId, data)   => api.patch(`/projects/${projectId}/chat/${msgId}`, data),
  deleteMessage: (projectId, msgId)         => api.delete(`/projects/${projectId}/chat/${msgId}`),
}
export const notificationsAPI = {
  getAll        : (params) => api.get('/notifications', { params }),
  getUnreadCount: ()       => api.get('/notifications/unread-count'),
  markRead      : (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead   : ()       => api.patch('/notifications/read-all'),
}

export const eventsAPI = {
  getAll    : (params)        => api.get('/events', { params }),
  getUpcoming: (days = 3)    => api.get('/events/upcoming', { params: { days } }),
  getOne    : (id)            => api.get(`/events/${id}`),
  create    : (data)          => api.post('/events', data),
  update    : (id, d)         => api.patch(`/events/${id}`, d),
  remove    : (id)            => api.delete(`/events/${id}`),
}

export const reportsAPI = {
  getWorkload: (params) => api.get('/reports/workload', { params }),
}

export default api
