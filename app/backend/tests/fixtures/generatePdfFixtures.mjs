// Genera PDFs ficticios pequenos para los tests de extraccion de texto.
//
// SIN dependencias (solo `zlib`). NO contiene material real (regla del
// proyecto: nunca usar contenido sensible en fixtures). Se ejecuta a mano para
// regenerar los binarios commiteados en este mismo directorio:
//
//   node app/backend/tests/fixtures/generatePdfFixtures.mjs
//
// Casos cubiertos (blocker de extraccion PDF corrupta):
//   - compressed-text.pdf : stream FlateDecode con texto legible (el extractor
//     naive antiguo NO sabia descomprimirlo).
//   - tounicode.pdf       : fuente simple con mapa /ToUnicode + stream
//     comprimido; el texto solo se recupera resolviendo ToUnicode.
//   - scanned-image.pdf   : pagina con una imagen y SIN capa de texto
//     (simula un escaneado) -> no debe quedar `completed`.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const L = (s) => Buffer.from(s, 'latin1');

// Ensambla un PDF a partir de objetos. Cada objeto es { dict, stream? }.
// Calcula offsets y tabla xref reales.
function buildPdf(objects) {
  const chunks = [];
  let offset = 0;
  const push = (buf) => {
    chunks.push(buf);
    offset += buf.length;
  };
  const xref = [];
  push(L('%PDF-1.5\n%\xE2\xE3\xCF\xD3\n'));
  objects.forEach((obj, i) => {
    const num = i + 1;
    xref[num] = offset;
    push(L(`${num} 0 obj\n${obj.dict}\n`));
    if (obj.stream) {
      push(L('stream\n'));
      push(obj.stream);
      push(L('\nendstream\n'));
    }
    push(L('endobj\n'));
  });
  const size = objects.length + 1;
  const xrefStart = offset;
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) {
    table += String(xref[i]).padStart(10, '0') + ' 00000 n \n';
  }
  push(L(table));
  push(L(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

function streamObj(dict, body) {
  const compressed = deflateSync(body);
  return {
    dict: `<< ${dict} /Length ${compressed.length} /Filter /FlateDecode >>`,
    stream: compressed,
  };
}

// 1) PDF con texto legible y stream comprimido (Helvetica estandar).
function compressedTextPdf() {
  const content =
    'BT /F1 18 Tf 72 740 Td (Tema 1. La Constitucion espanola de 1978.) Tj ' +
    '0 -28 Td (Articulo 14. Los espanoles son iguales ante la ley.) Tj ET';
  return buildPdf([
    { dict: '<< /Type /Catalog /Pages 2 0 R >>' },
    { dict: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    {
      dict:
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
        '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    },
    { dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
    streamObj('', L(content)),
  ]);
}

// Texto que SOLO se recupera resolviendo /ToUnicode (ver `toUnicodePdf`).
export const TOUNICODE_TEXT = 'Tema 7. ToUnicode OK 1978';

// 2) PDF cuyo texto solo se recupera resolviendo /ToUnicode. A cada caracter se
//    le asigna un codigo de byte propio (0x21+) y el CMap lo mapea a su Unicode
//    real; la codificacion base daria otros simbolos, asi que recuperar el texto
//    exige honrar ToUnicode (lo que el extractor naive antiguo no hacia).
function toUnicodePdf() {
  const text = TOUNICODE_TEXT;
  const showBytes = [];
  const bfchar = [];
  for (let i = 0; i < text.length; i++) {
    const code = 0x21 + i; // codigos imprimibles y unicos
    showBytes.push(code);
    const hex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    const cp = text.codePointAt(i).toString(16).padStart(4, '0').toUpperCase();
    bfchar.push(`<${hex(code)}> <${cp}>`);
  }
  const first = 0x21;
  const last = 0x21 + text.length - 1;
  const widths = new Array(text.length).fill('600').join(' ');
  const toUnicode =
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap ' +
    '/CMapName /Adobe-Identity-UCS def /CMapType 2 def ' +
    '1 begincodespacerange <00> <ff> endcodespacerange ' +
    `${bfchar.length} beginbfchar ${bfchar.join(' ')} endbfchar ` +
    'endcmap CMapName currentdict /CMap defineresource pop end end';
  // Cadena en hexadecimal para no tener que escapar bytes especiales ( ) \.
  const showHex = showBytes
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const content = `BT /F1 24 Tf 72 720 Td <${showHex}> Tj ET`;
  return buildPdf([
    { dict: '<< /Type /Catalog /Pages 2 0 R >>' },
    { dict: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    {
      dict:
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
        '/Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >>',
    },
    {
      dict:
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica ' +
        `/FirstChar ${first} /LastChar ${last} /Widths [${widths}] /ToUnicode 5 0 R >>`,
    },
    streamObj('', L(toUnicode)),
    streamObj('', L(content)),
  ]);
}

// 3) PDF "escaneado": una imagen 1x1 y NINGUN operador de texto.
function scannedImagePdf() {
  const content = 'q 200 0 0 200 100 400 cm /Im1 Do Q';
  return buildPdf([
    { dict: '<< /Type /Catalog /Pages 2 0 R >>' },
    { dict: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    {
      dict:
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
        '/Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>',
    },
    {
      dict:
        '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 ' +
        '/ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>',
      stream: Buffer.from([0x80]),
    },
    streamObj('', L(content)),
  ]);
}

const outputs = {
  'compressed-text.pdf': compressedTextPdf(),
  'tounicode.pdf': toUnicodePdf(),
  'scanned-image.pdf': scannedImagePdf(),
};

for (const [name, bytes] of Object.entries(outputs)) {
  const path = join(HERE, name);
  writeFileSync(path, bytes);
  console.log(`wrote ${name} (${bytes.length} bytes)`);
}
