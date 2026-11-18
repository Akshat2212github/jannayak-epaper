#!/usr/bin/env node
'use strict';
/*
  Scans  public/pdfs/<city-folder>/dd_mm__yyyy.pdf  and writes  public/editions.json

  - Vercel runs this automatically on every deploy (see vercel.json -> buildCommand).
  - To run it yourself:  npm run build
  - Optional front-page image: put  dd_mm__yyyy.jpg (or .webp / .png)  next to the PDF
    and the site will use it as the thumbnail instead of rendering the PDF.
*/
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PDF_DIR = path.join(PUBLIC_DIR, 'pdfs');
const OUT_FILE = path.join(PUBLIC_DIR, 'editions.json');

// dd_mm__yyyy.pdf  (one underscore before the year is tolerated as well)
const PDF_RE = /^(\d{2})_(\d{2})_{1,2}(\d{4})\.pdf$/i;
const THUMB_EXTS = ['.webp', '.jpg', '.jpeg', '.png'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function isRealDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function build() {
  const warnings = [];
  const cities = {};
  let entries = [];
  try {
    entries = fs.readdirSync(PDF_DIR, { withFileTypes: true });
  } catch (e) {
    warnings.push('Folder public/pdfs was not found.');
  }
  const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

  for (const folder of folders) {
    const dir = path.join(PDF_DIR, folder);
    const files = fs.readdirSync(dir);
    const byLower = new Map(files.map((f) => [f.toLowerCase(), f]));
    const byDate = new Map();

    for (const f of files) {
      if (!/\.pdf$/i.test(f)) continue;
      const m = PDF_RE.exec(f);
      if (!m) {
        warnings.push(`Skipped pdfs/${folder}/${f} - the name must look like dd_mm__yyyy.pdf (e.g. 18_11__2026.pdf)`);
        continue;
      }
      const d = Number(m[1]);
      const mo = Number(m[2]);
      const y = Number(m[3]);
      if (!isRealDate(y, mo, d)) {
        warnings.push(`Skipped pdfs/${folder}/${f} - ${m[1]}/${m[2]}/${m[3]} is not a real date`);
        continue;
      }
      const iso = `${y}-${pad(mo)}-${pad(d)}`;
      const base = f.slice(0, -4);
      let thumb = null;
      for (const ext of THUMB_EXTS) {
        const hit = byLower.get((base + ext).toLowerCase());
        if (hit) {
          thumb = hit;
          break;
        }
      }
      const entry = { d: iso, f, t: thumb };
      if (byDate.has(iso)) {
        const prev = byDate.get(iso);
        warnings.push(`pdfs/${folder} has two files for ${iso} (${prev.f} and ${f}); using one of them`);
        if (!prev.f.includes('__') && f.includes('__')) byDate.set(iso, entry);
        continue;
      }
      byDate.set(iso, entry);
    }

    cities[folder] = Array.from(byDate.values()).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  }

  return { manifest: { cities }, warnings };
}

function serialize(manifest) {
  const blocks = Object.keys(manifest.cities).map((k) => {
    const rows = manifest.cities[k].map((e) => '    ' + JSON.stringify(e));
    return `  ${JSON.stringify(k)}: [${rows.length ? '\n' + rows.join(',\n') + '\n  ' : ''}]`;
  });
  return `{\n "cities": {\n${blocks.join(',\n')}\n }\n}\n`;
}

function write() {
  const { manifest, warnings } = build();
  fs.writeFileSync(OUT_FILE, serialize(manifest));
  const summary = Object.keys(manifest.cities)
    .map((k) => `${k}: ${manifest.cities[k].length}`)
    .join(', ');
  console.log(`[manifest] public/editions.json written (${summary || 'no city folders'})`);
  warnings.forEach((w) => console.warn('[manifest] WARNING: ' + w));
  return manifest;
}

if (require.main === module) write();

module.exports = { build, write, serialize };
