import 'dotenv/config'

export default {
  port:process.env.PORT || 3000,
  server:process.env.SERVER,
  mongoURI:process.env.MONGO_URI,
  database:process.env.MONGO_DATABASE,
  jwtSecret:process.env.JWT_SECRET,
  serviceEmail:process.env.SERVICE_EMAIL,
  emailSupport:process.env.EMAIL_SUPPORT,
  passSupport:process.env.PASS_SUPPORT,
  urlApp:process.env.URL_APP,
  vapidPublicKey:process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey:process.env.VAPID_PRIVATE_KEY,
  vapidSubject:process.env.VAPID_SUBJECT || 'mailto:soporte@siradiacion.com.mx'
}
