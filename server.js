const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================================
// CONFIGURACIÓN DE CLOUDINARY
// ============================================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// ============================================================
// CONFIGURACIÓN MULTER (para recibir imágenes)
// ============================================================
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // máximo 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  }
});

// Carpeta para guardar JSONs
const DATA_DIR = '/tmp/data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================================
// GENERAR ID ÚNICO
// ============================================================
function generarId() {
  const ahora = new Date();
  const fecha = ahora.getFullYear().toString() +
    String(ahora.getMonth() + 1).padStart(2, '0') +
    String(ahora.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `DTR-${fecha}-${rand}`;
}

// ============================================================
// ENDPOINT: SUBIR IMAGEN A CLOUDINARY
// ============================================================
app.post('/api/upload', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No se recibió ninguna imagen' });
    }

    const resultado = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'dtr-informes',
          resource_type: 'image',
          transformation: [{ width: 1200, crop: 'limit' }, { quality: 'auto' }]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    res.json({
      ok: true,
      url: resultado.secure_url,
      publicId: resultado.public_id,
      mensaje: 'Imagen subida correctamente a Cloudinary'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al subir la imagen' });
  }
});

// ============================================================
// ENDPOINT: GUARDAR INFORME
// ============================================================
app.post('/api/informe/guardar', (req, res) => {
  try {
    const datos = req.body;
    const id = generarId();
    const ahora = new Date();

    const payload = {
      ...datos,
      meta: {
        ...datos.meta,
        id: id,
        creadoEn: ahora.toISOString(),
        expiraEn: new Date(ahora.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        estado: 'pendiente'
      },
      informe: {
        ...datos.informe,
        id: `IT-${id.replace('DTR-', '')}`
      }
    };

    const filePath = path.join(DATA_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

    res.json({
      ok: true,
      id: id,
      informeId: payload.informe.id,
      expiraEn: payload.meta.expiraEn,
      mensaje: `Informe guardado correctamente. Código: ${id}`
    });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// ENDPOINT: OBTENER INFORME
// ============================================================
app.get('/api/informe/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(DATA_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'Código no encontrado o expirado' });
    }

    const datos = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (new Date() > new Date(datos.meta.expiraEn)) {
      fs.unlinkSync(filePath);
      return res.status(410).json({ ok: false, error: 'El código ha expirado' });
    }

    res.json({ ok: true, datos });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ ok: true, mensaje: 'Backend funcionando correctamente' });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend corriendo en puerto ${PORT}`);
});