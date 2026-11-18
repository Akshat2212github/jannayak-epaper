#!/usr/bin/env node
'use strict';
/*
  Tiny local web server for testing (no dependencies).
    npm run dev      ->  http://localhost:3000
  - serves the public/ folder
  - rebuilds the list of editions on every request to /editions.json
  - supports HTTP Range requests (needed by the PDF viewer)
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { build, serialize } = require('./build-manifest.js');

const ROOT = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-cache' }, headers || {}));
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'Bad request');
  }

  if (pathname === '/editions.json') {
    const { manifest, warnings } = build();
    warnings.forEach((w) => console.warn('[manifest] WARNING: ' + w));
    return send(res, 200, serialize(manifest), { 'Content-Type': MIME['.json'] });
  }

  let file = path.normalize(path.join(ROOT, pathname));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found');

  const size = fs.statSync(file).size;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const baseHeaders = { 'Content-Type': type, 'Accept-Ranges': 'bytes' };
  const range = req.headers.range;

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m && (m[1] !== '' || m[2] !== '')) {
      let start;
      let end;
      if (m[1] === '') {
        start = Math.max(0, size - Number(m[2]));
        end = size - 1;
      } else {
        start = Number(m[1]);
        end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
      }
      if (start > end || start >= size) {
        return send(res, 416, '', { 'Content-Range': `bytes */${size}` });
      }
      res.writeHead(206, Object.assign({ 'Cache-Control': 'no-cache' }, baseHeaders, {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1,
      }));
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
  }

  res.writeHead(200, Object.assign({ 'Cache-Control': 'no-cache' }, baseHeaders, { 'Content-Length': size }));
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Jannayak e-paper dev server: http://localhost:${PORT}`);
  console.log('Put PDFs in public/pdfs/<city>/dd_mm__yyyy.pdf and refresh the page.');
});
