const express = require('express');
const cors = require('cors');
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

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000
    });
    console.log('✅ Conectado a MongoDB');
  } catch (err) {
    console.error('❌ Error conectando a MongoDB:', err);
    setTimeout(connectDB, 5000);
  }
};

connectDB();

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
// CONFIGURACIÓN MULTER
// ============================================================
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  }
});

// ============================================================
// BASE DE DATOS DE EQUIPOS
// ============================================================
const EQUIPOS_DB = [
  { "codigo": "JL-001", "tipo": "LED", "marca": "MAGNUM", "año": "2023", "modelo": "MLT4060J", "serie": "JL0123001", "color": "NARANJA", "motor": "KUBOTA D1105", "chasis": "658478" },
  { "codigo": "TL-001", "tipo": "LUMINARIA", "marca": "WACKER NEUSON", "año": "2013", "modelo": "LTN6", "serie": "5944654", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "" },
  { "codigo": "TL-002", "tipo": "LED", "marca": "TEREX", "año": "2018", "modelo": "RL-4000", "serie": "RL-413-6071", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "AA4305" },
  { "codigo": "TL-004", "tipo": "LED", "marca": "ATLAS COPCO", "año": "2013", "modelo": "QLT M10", "serie": "897282850", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "1DG1881" },
  { "codigo": "TL-005", "tipo": "LED", "marca": "MAGNUM", "año": "2019", "modelo": "MLT4060 M", "serie": "1106727", "color": "AMARILLO", "motor": "MITSUBISHI L3E", "chasis": "138061C5" },
  { "codigo": "TL-006", "tipo": "LED", "marca": "TEREX", "año": "2014", "modelo": "RL-4000", "serie": "RL-411-3002", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "CG1689" },
  { "codigo": "TL-007", "tipo": "LED", "marca": "TEREX", "año": "2018", "modelo": "RL-4000", "serie": "RL-411-381", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "AR0524" },
  { "codigo": "TL-008", "tipo": "LED", "marca": "GENERAC", "año": "2019", "modelo": "RL-4016-760", "serie": "E9885", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "" },
  { "codigo": "TL-009", "tipo": "LED", "marca": "TEREX", "año": "2019", "modelo": "RL-4000", "serie": "RL-4016-760", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "E9885" },
  { "codigo": "TL-010", "tipo": "LED", "marca": "MAGNUM", "año": "2019", "modelo": "MLT4060 M", "serie": "175180D", "color": "AMARILLO", "motor": "MITSUBISHI L3E", "chasis": "1635546" },
  { "codigo": "TL-011", "tipo": "LED", "marca": "GENERAC", "año": "2022", "modelo": "VVT8", "serie": "1403120", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "BM3293" },
  { "codigo": "TL-012", "tipo": "HALOGENURO", "marca": "WACKER NEUSON", "año": "", "modelo": "", "serie": "", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "" },
  { "codigo": "TL-015", "tipo": "LED", "marca": "TEREX", "año": "2018", "modelo": "RL-4000", "serie": "RL-416-4310", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "1CX2670" },
  { "codigo": "TL-016", "tipo": "LED", "marca": "TEREX", "año": "2018", "modelo": "RL-4000", "serie": "RL412-4478", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "AA4308" },
  { "codigo": "TL-023", "tipo": "LED", "marca": "KUBOTA", "año": "2023", "modelo": "TLT4WL", "serie": "TPS01FJ191135", "color": "AMARILLO", "motor": "KUBOTA Z482", "chasis": "4KN5788" },
  { "codigo": "TL-024", "tipo": "LED", "marca": "KUBOTA", "año": "2023", "modelo": "TLT4WL", "serie": "TPS01FJ171137", "color": "AMARILLO", "motor": "KUBOTA Z482", "chasis": "4KN5791" },
  { "codigo": "TL-025", "tipo": "LUMINARIA", "marca": "ATLAS COPCO", "año": "2014", "modelo": "QLMT", "serie": "1513D1412A", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "1001154" },
  { "codigo": "TL-026", "tipo": "LUMINARIA", "marca": "WANCO", "año": "2014", "modelo": "QLMT", "serie": "1001154", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "8W3074" },
  { "codigo": "TL-027", "tipo": "LED", "marca": "WANCO", "año": "2019", "modelo": "QLMT", "serie": "AKBXL015BCC", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "AQ7292" },
  { "codigo": "TL-028", "tipo": "LED", "marca": "WANCO", "año": "2020", "modelo": "WLTC4", "serie": "03586", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "AL1654" },
  { "codigo": "TL-030", "tipo": "LED", "marca": "WACKER NEUSON", "año": "2019", "modelo": "LTN6", "serie": "20078957", "color": "AMARILLO", "motor": "KOHLER KDW1003GE", "chasis": "9126226" },
  { "codigo": "TL-035", "tipo": "LUMINARIA", "marca": "TEREX", "año": "2018", "modelo": "RL-4000", "serie": "RL-411-4650", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "1CU8598" },
  { "codigo": "TL-036", "tipo": "HALOGENURO", "marca": "ATLAS COPCO", "año": "2013", "modelo": "QLMT M10", "serie": "897282850", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "1DG7264" },
  { "codigo": "TL-037", "tipo": "LED", "marca": "KUBOTA", "año": "2023", "modelo": "TLT4WL", "serie": "TPS01FJ191134", "color": "AMARILLO", "motor": "KUBOTA Z482", "chasis": "4KN5782" },
  { "codigo": "TL-038", "tipo": "LED", "marca": "TEREX", "año": "2018", "modelo": "RL-4000", "serie": "RL413-6052", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "1CU6492" },
  { "codigo": "TL-039", "tipo": "LED", "marca": "KUBOTA", "año": "2022", "modelo": "TLT4WL", "serie": "TPS01FJ191133", "color": "AMARILLO", "motor": "KUBOTA Z428", "chasis": "4KN5785" },
  { "codigo": "TL-040", "tipo": "LUMINARIA", "marca": "TEREX", "año": "2018", "modelo": "RL-4000", "serie": "RL-416-6095", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "1CU4981" },
  { "codigo": "TL-041", "tipo": "LUMINARIA", "marca": "TEREX", "año": "2018", "modelo": "RL-4000", "serie": "RL-411-3253", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "BG2183" },
  { "codigo": "TL-042", "tipo": "LED", "marca": "TEREX", "año": "2018", "modelo": "RL-4000", "serie": "RL411-3303", "color": "AMARILLO", "motor": "KUBOTA D1105", "chasis": "BG1471" },
  { "codigo": "TL-003", "tipo": "HALOGENURO", "marca": "MAGNUM", "año": "2018", "modelo": "MLT 3060 M", "serie": "1101371", "color": "AMARILLO", "motor": "MITSUBISHI L3E", "chasis": "150131A6" },
  { "codigo": "TL-3025", "tipo": "HALOGENURO", "marca": "MAGNUM", "año": "", "modelo": "MLT4060 M", "serie": "1006060", "color": "BLANCO", "motor": "MITSUBISHI L3E", "chasis": "212693-FO" },
  { "codigo": "CAP-01", "tipo": "COMPRESORA", "marca": "CAMPBELL HAUSFELD", "año": "2022", "modelo": "EXTREME DUTY HS538000AJ", "serie": "HS538000AJ", "color": "AMARILLO", "motor": "SIEMENS TRIFÁSICO", "chasis": "GR2206902" }
];

// ============================================================
// ENDPOINT: OBTENER EQUIPOS
// ============================================================
app.get('/api/equipos', (req, res) => {
  res.json({ ok: true, total: EQUIPOS_DB.length, equipos: EQUIPOS_DB });
});

// ============================================================
// ENDPOINT: BUSCAR RUC (VERSIÓN CORREGIDA)
// ============================================================
app.get('/api/ruc/:ruc', async (req, res) => {
  try {
    const { ruc } = req.params;
    console.log(`\n🔍 CONSULTANDO RUC: ${ruc}`);

    const response = await fetch(`https://api.apis.net.pe/v1/ruc?numero=${ruc}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer sk_14814.75lcjB3u7tUofo0SCz8FYTyceBAKcxMO'
      }
    });

    const data = await response.json();
    console.log('RESPUESTA COMPLETA DE LA API:', JSON.stringify(data, null, 2));

    const nombre = data.nombre || data.razonSocial || data.nombre_o_razon_social;
    const direccion = data.direccion || data.domicilio_fiscal || data.direccion_completa || '';

    if (nombre) {
      console.log('✅ ÉXITO - Nombre encontrado:', nombre);
      return res.json({ ok: true, nombre: nombre.trim(), direccion: direccion.trim() });
    } else {
      console.log('❌ No se encontró nombre en la respuesta');
      return res.json({ ok: false, error: 'RUC no encontrado o inválido' });
    }

  } catch (err) {
    console.error('❌ ERROR AL CONSULTAR RUC:', err.message);
    res.status(500).json({ ok: false, error: 'Error al consultar RUC' });
  }
});

// ============================================================
// ENDPOINT: SUBIR IMAGEN (FormData)
// ============================================================
app.post('/api/upload', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió imagen' });

    const resultado = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'dtr-informes', resource_type: 'image', transformation: [{ width: 1200, crop: 'limit' }, { quality: 'auto' }] },
        (error, result) => error ? reject(error) : resolve(result)
      );
      uploadStream.end(req.file.buffer);
    });

    res.json({ ok: true, url: resultado.secure_url, publicId: resultado.public_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al subir imagen' });
  }
});

// ============================================================
// ENDPOINT: SUBIR IMAGEN BASE64
// ============================================================
app.post('/api/imagen/subir', async (req, res) => {
  try {
    const { base64, informeId, seccion } = req.body;
    if (!base64) return res.status(400).json({ ok: false, error: 'No se recibió base64' });

    const buffer = Buffer.from(base64.split(',')[1] || base64, 'base64');

    const resultado = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'dtr-informes',
          public_id: `${informeId}-${seccion}-${Date.now()}`,
          resource_type: 'image',
          transformation: [{ width: 1200, crop: 'limit' }, { quality: 'auto' }]
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
      uploadStream.end(buffer);
    });

    res.json({
      ok: true,
      url: resultado.secure_url,
      publicId: resultado.public_id,
      width: resultado.width,
      height: resultado.height,
      orientacion: resultado.width > resultado.height ? 'horizontal' : 'vertical'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al subir imagen' });
  }
});

// ============================================================
// GENERAR ID
// ============================================================
function generarId() {
  const ahora = new Date();
  const fecha = ahora.getFullYear().toString() + String(ahora.getMonth()+1).padStart(2,'0') + String(ahora.getDate()).padStart(2,'0');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `DTR-${fecha}-${rand}`;
}

// ============================================================
// GUARDAR INFORME
// ============================================================
app.post('/api/informe/guardar', async (req, res) => {
  try {
    const datos = req.body;
    const id = generarId();
    const ahora = new Date();

    const payload = { ...datos };
    if (!payload.meta) payload.meta = {};
    payload.meta.id = id;
    payload.meta.creadoEn = ahora.toISOString();
    payload.meta.expiraEn = new Date(ahora.getTime() + 24*60*60*1000).toISOString();
    payload.meta.estado = 'pendiente';

    const nuevoInforme = new Informe({
      id,
      informeId: payload.informe?.id || `IT-${id.replace('DTR-','')}`,
      datos: payload,
      creadoEn: ahora,
      expiraEn: new Date(ahora.getTime() + 24*60*60*1000),
      estado: 'pendiente'
    });

    await nuevoInforme.save();
    res.json({ ok: true, id, mensaje: `Informe guardado: ${id}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// OBTENER INFORME
// ============================================================
app.get('/api/informe/:id', async (req, res) => {
  try {
    const informe = await Informe.findOne({ id: req.params.id });
    if (!informe) return res.status(404).json({ ok: false, error: 'Informe no encontrado' });
    res.json({ ok: true, informe: informe.datos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// LISTAR INFORMES
// ============================================================
app.get('/api/informes', async (req, res) => {
  try {
    const informes = await Informe.find({});
    res.json({ ok: true, total: informes.length, informes });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// ELIMINAR INFORME
// ============================================================
app.delete('/api/informe/:id', async (req, res) => {
  try {
    await Informe.deleteOne({ id: req.params.id });
    res.json({ ok: true, mensaje: 'Informe eliminado' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => res.json({ ok: true, mensaje: 'Backend funcionando correctamente' }));

// ============================================================
// INICIAR SERVIDOR
// ============================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend corriendo en puerto ${PORT}`);
});