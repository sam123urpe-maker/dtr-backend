const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');

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
// CONEXIÓN A MONGODB
// ============================================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin:password@cluster0.mongodb.net/dtr-informes?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI).then(() => {
  console.log('✅ Conectado a MongoDB');
}).catch(err => {
  console.error('❌ Error conectando a MongoDB:', err);
});

// ============================================================
// ESQUEMA Y MODELO DE INFORME
// ============================================================
const informeSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  informeId: String,
  datos: mongoose.Schema.Types.Mixed,
  creadoEn: Date,
  expiraEn: Date,
  estado: String
});

const Informe = mongoose.model('Informe', informeSchema);

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
// ENDPOINT: SUBIR IMAGEN BASE64 A CLOUDINARY
// ============================================================
app.post('/api/imagen/subir', async (req, res) => {
  try {
    const { base64, informeId, seccion, descripcion } = req.body;

    if (!base64) {
      return res.status(400).json({ ok: false, error: 'No se recibió imagen en base64' });
    }

    // Convertir base64 a buffer
    const buffer = Buffer.from(base64.split(',')[1] || base64, 'base64');

    const resultado = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'dtr-informes',
          public_id: `${informeId}-${seccion}-${Date.now()}`,
          resource_type: 'image',
          transformation: [{ width: 1200, crop: 'limit' }, { quality: 'auto' }]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    res.json({
      ok: true,
      url: resultado.secure_url,
      publicId: resultado.public_id,
      width: resultado.width,
      height: resultado.height,
      orientacion: resultado.width > resultado.height ? 'horizontal' : 'vertical',
      mensaje: 'Imagen subida correctamente a Cloudinary'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al subir la imagen: ' + err.message });
  }
});

// ============================================================
// ENDPOINT: GUARDAR INFORME (CON MONGODB)
// ============================================================
app.post('/api/informe/guardar', async (req, res) => {
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

    // ✅ GUARDAR EN MONGODB
    const nuevoInforme = new Informe({
      id: id,
      informeId: payload.informe.id,
      datos: payload,
      creadoEn: ahora,
      expiraEn: new Date(ahora.getTime() + 24 * 60 * 60 * 1000),
      estado: 'pendiente'
    });

    await nuevoInforme.save();

    console.log('✅ Informe guardado en MongoDB:', id);

    res.json({
      ok: true,
      id: id,
      informeId: payload.informe.id,
      expiraEn: payload.meta.expiraEn,
      mensaje: `Informe guardado correctamente. Código: ${id}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// ENDPOINT: OBTENER INFORME (CON MONGODB)
// ============================================================
app.get('/api/informe/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ BUSCAR EN MONGODB
    const informe = await Informe.findOne({ id: id });

    if (!informe) {
      return res.status(404).json({ ok: false, error: 'Código no encontrado o expirado' });
    }

    if (new Date() > new Date(informe.expiraEn)) {
      // Eliminar si expiró
      await Informe.deleteOne({ id: id });
      return res.status(410).json({ ok: false, error: 'El código ha expirado' });
    }

    res.json({ 
      ok: true, 
      informe: informe.datos, 
      informeId: informe.informeId 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// ENDPOINT: LISTAR INFORMES (OPCIONAL, PARA ADMIN)
// ============================================================
app.get('/api/informes', async (req, res) => {
  try {
    const informes = await Informe.find({});
    
    const resultado = informes.map(inf => ({
      id: inf.id,
      informeId: inf.informeId,
      cliente: inf.datos?.cliente?.nombre || 'Sin nombre',
      tipo: inf.datos?.informe?.tipo || 'Sin tipo',
      fecha: inf.datos?.informe?.fecha || 'Sin fecha',
      tecnico: inf.datos?.informe?.tecnico || 'Sin técnico',
      creadoEn: inf.creadoEn,
      expiraEn: inf.expiraEn,
      estado: inf.estado
    }));

    res.json({ ok: true, total: resultado.length, informes: resultado });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// ENDPOINT: ELIMINAR INFORME (OPCIONAL, PARA ADMIN)
// ============================================================
app.delete('/api/informe/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await Informe.deleteOne({ id: id });

    if (resultado.deletedCount === 0) {
      return res.status(404).json({ ok: false, error: 'Informe no encontrado' });
    }

    res.json({ ok: true, mensaje: 'Informe eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({ ok: true, mensaje: 'Backend funcionando correctamente' });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend corriendo en puerto ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});