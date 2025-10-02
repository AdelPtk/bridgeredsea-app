// Express server to convert DOCX -> PDF using LibreOffice
// Requirements: Install LibreOffice and ensure 'soffice' is in PATH

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { promisify } from 'node:util';
import libre from 'libreoffice-convert';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
libre.convertAsync = promisify(libre.convert);

app.use(cors());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded (expected field name "file")' });
    }
    const pdf = await libre.convertAsync(req.file.buffer, '.pdf', undefined);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"');
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.error('Conversion failed:', err);
    res.status(500).json({ error: 'conversion-failed', details: String(err?.message || err) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`DOCX->PDF server listening on http://localhost:${PORT}`);
});
