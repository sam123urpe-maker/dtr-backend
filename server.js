const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Carpeta para guardar JSONs
const DATA_DIR = '/tmp/data'; // Netlify usa /tmp
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================================
// 1. GENERAR ID ÚNICO
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
// 2. GUARDAR INFORME
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

    // Guardar en archivo
    const filePath = path.join(DATA_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

    res.json({
      ok: true,
      id: id,
      informeId: payload.informe.id,
      expiraEn: payload.meta.expiraEn,
      mensaje: `Informe guardado. Tu código es: ${id}`
    });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// 3. OBTENER INFORME POR ID
// ============================================================
app.get('/api/informe/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(DATA_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'ID no encontrado o expirado' });
    }

    const datos = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Verificar expiración
    if (new Date() > new Date(datos.meta.expiraEn)) {
      fs.unlinkSync(filePath);
      return res.status(410).json({ ok: false, error: 'El código ha expirado' });
    }

    res.json({ ok: true, datos: datos });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// 4. HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({ ok: true, mensaje: 'Backend funcionando' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend corriendo en puerto ${PORT}`));