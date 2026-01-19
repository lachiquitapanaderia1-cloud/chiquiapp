import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const dbPath = resolve('data', 'chiquiapp.db');
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    photo_url TEXT,
    available INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS order_items (
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    PRIMARY KEY (order_id, product_id)
  );
`);

export function listProducts() {
  const stmt = db.prepare(`
    SELECT id, name, price, photo_url as photoUrl, available
    FROM products
    ORDER BY created_at DESC
  `);
  return stmt.all();
}

export function createProduct({ name, price, photoUrl, available }) {
  const stmt = db.prepare(`
    INSERT INTO products (name, price, photo_url, available)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(name, price, photoUrl || null, available ? 1 : 0);
  return info.lastInsertRowid;
}

export function listAvailableProducts() {
  const stmt = db.prepare(`
    SELECT id, name, price
    FROM products
    WHERE available = 1
    ORDER BY name ASC
  `);
  return stmt.all();
}

export function createOrder({ customer, notes, items }) {
  const insertOrder = db.prepare(`
    INSERT INTO orders (customer, notes)
    VALUES (?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity)
    VALUES (?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const info = insertOrder.run(customer, notes || null);
    const orderId = info.lastInsertRowid;
    for (const item of items) {
      insertItem.run(orderId, item.productId, item.quantity);
    }
    return orderId;
  });

  return transaction();
}

export function dailyReport(date) {
  const totalsStmt = db.prepare(`
    SELECT
      COUNT(DISTINCT o.id) as orders,
      COALESCE(SUM(oi.quantity * p.price), 0) as total
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE date(o.created_at) = ?
  `);
  const topProductsStmt = db.prepare(`
    SELECT p.name, SUM(oi.quantity) as quantity
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE date(o.created_at) = ?
    GROUP BY p.id
    ORDER BY quantity DESC
    LIMIT 5
  `);

  return {
    totals: totalsStmt.get(date),
    topProducts: topProductsStmt.all(date)
  };
}

export function getProductById(id) {
  const stmt = db.prepare('SELECT id, name, price, available FROM products WHERE id = ?');
  return stmt.get(id);
}
