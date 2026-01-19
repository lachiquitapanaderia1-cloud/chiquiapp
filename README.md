# ChiquiApp - MVP para panadería

MVP sencillo para gestionar catálogo de productos, pedidos y un reporte diario.

## Requisitos

- Node.js 22+ (incluye el módulo `node:sqlite`).

## Cómo correr en local

```bash
npm install
npm run dev
```

Luego abre `http://localhost:3000`.

## Datos almacenados

La base SQLite se guarda en `data/chiquiapp.db`. Puedes borrar el archivo para reiniciar la información.

## Endpoints disponibles

- `GET /api/products` — lista completa del catálogo.
- `POST /api/products` — crea un producto.
- `GET /api/products/available` — productos disponibles para pedidos.
- `POST /api/orders` — registra un pedido.
- `GET /api/report?date=YYYY-MM-DD` — reporte diario.
