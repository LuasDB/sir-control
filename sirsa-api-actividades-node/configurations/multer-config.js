import multer from 'multer'
import path from 'path'
import fs from 'fs'

/*
 * multer-config.js
 *
 * Cambio 3: Los adjuntos de actividades se organizan por folio OS del proyecto:
 *   uploads/activities/<folio_os>/<archivo>
 *
 * El folio OS se pasa como req.folioOs desde el router de actividades
 * (se consulta antes de que multer procese el archivo).
 *
 * Para otros módulos (sin folio OS) se sigue usando la carpeta del collection.
 */

const storageConfig = (collection) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      // Cambio 3: si viene folioOs en el request, subcarpeta por OS
      const subFolder = req.folioOs
        ? req.folioOs.replace(/[^a-zA-Z0-9\-_]/g, '_')  // sanitizar nombre
        : ''

      const uploadPath = subFolder
        ? `uploads/${collection}/${subFolder}`
        : `uploads/${collection}`

      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true })
      }

      cb(null, uploadPath)
    },
    filename: (req, file, cb) => {
      const id = Date.now() + '_' + Math.round(Math.random() * 1E9)
      cb(null, `${file.fieldname}_${id}${path.extname(file.originalname)}`)
    }
  })
}

const upload = (collection) => {
  return multer({
    storage: storageConfig(collection),
    limits: { fileSize: 20 * 1024 * 1024 }  // 20 MB
  })
}

export default upload
