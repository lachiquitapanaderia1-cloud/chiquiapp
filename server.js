import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  createOrder,
  createProduct,
  dailyReport,
  getProductById,
  listAvailableProducts,
  listProducts
} from './db.js';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = new URL('./public/', import.meta.url).pathname;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

function sendJson(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data)
  });
  res.end(data);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Payload demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('JSON inválido'));
      }
    });
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathName = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(PUBLIC_DIR, pathName);
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendError(res, 404, 'Archivo no encontrado');
      return;
    }
    const contents = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(contents);
  } catch (error) {
    sendError(res, 404, 'Recurso no encontrado');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api')) {
    try {
      if (req.method === 'GET' && url.pathname === '/api/products') {
        sendJson(res, 200, { products: listProducts() });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/products/available') {
        sendJson(res, 200, { products: listAvailableProducts() });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/products') {
        const payload = await parseJson(req);
        const name = String(payload.name || '').trim();
        const price = Number(payload.price);
        const photoUrl = payload.photoUrl ? String(payload.photoUrl).trim() : '';
        const available = Boolean(payload.available);

        if (!name) {
          sendError(res, 400, 'El nombre es obligatorio');
          return;
        }
        if (!Number.isFinite(price) || price < 0) {
          sendError(res, 400, 'El precio debe ser un número positivo');
          return;
        }

        const id = createProduct({ name, price, photoUrl, available });
        sendJson(res, 201, { id });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/orders') {
        const payload = await parseJson(req);
        const customer = String(payload.customer || '').trim();
        const notes = payload.notes ? String(payload.notes).trim() : '';
        const items = Array.isArray(payload.items) ? payload.items : [];

        if (!customer) {
          sendError(res, 400, 'El cliente es obligatorio');
          return;
        }
        if (!items.length) {
          sendError(res, 400, 'Selecciona al menos un producto');
          return;
        }

        const normalizedItems = [];
        for (const item of items) {
          const productId = Number(item.productId);
          const quantity = Number(item.quantity);
          if (!Number.isInteger(productId) || productId <= 0) {
            sendError(res, 400, 'Producto inválido');
            return;
          }
          if (!Number.isInteger(quantity) || quantity <= 0) {
            sendError(res, 400, 'Cantidad inválida');
            return;
          }
          const product = getProductById(productId);
          if (!product || !product.available) {
            sendError(res, 400, `Producto no disponible: ${product?.name || productId}`);
            return;
          }
          normalizedItems.push({ productId, quantity });
        }

        const id = createOrder({ customer, notes, items: normalizedItems });
        sendJson(res, 201, { id });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/report') {
        const date = url.searchParams.get('date');
        if (!date) {
          sendError(res, 400, 'La fecha es obligatoria (YYYY-MM-DD)');
          return;
        }
        const report = dailyReport(date);
        sendJson(res, 200, report);
        return;
      }

      sendError(res, 404, 'Ruta no encontrada');
    } catch (error) {
      sendError(res, 500, error.message || 'Error interno');
    }
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
