// Simple DOCX -> PDF converter using libreoffice-convert
// Requirements: LibreOffice installed and 'soffice' available in PATH
// Usage:
//   node server/docx_to_pdf.js <input.docx> <output.pdf>

import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import libre from 'libreoffice-convert';

libre.convertAsync = promisify(libre.convert);

async function docxToPdf(inputPath, outputPath) {
  const buf = fs.readFileSync(inputPath);
  const ext = '.pdf';
  const pdfBuf = await libre.convertAsync(buf, ext, undefined);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, pdfBuf);
}

async function main() {
  const [,, inArg, outArg] = process.argv;
  if (!inArg || !outArg) {
    console.error('Usage: node server/docx_to_pdf.js <input.docx> <output.pdf>');
    process.exit(1);
  }
  const inputPath = path.resolve(inArg);
  const outputPath = path.resolve(outArg);
  try {
    await docxToPdf(inputPath, outputPath);
    console.log('Done:', outputPath);
  } catch (err) {
    console.error('Conversion failed. Ensure LibreOffice (soffice) is installed and in PATH.');
    console.error(err?.message || err);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Invoked directly
  main();
}

export { docxToPdf };
