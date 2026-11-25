import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'nmart.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for performance and data integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'staff')),
      pin_code TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode_qr TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT DEFAULT '',
      unit TEXT DEFAULT 'pcs',
      retail_price REAL NOT NULL,
      wholesale_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      current_stock REAL DEFAULT 0,
      min_stock_alert REAL DEFAULT 5,
      location TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wholesale_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      gstin TEXT DEFAULT '',
      address TEXT DEFAULT '',
      credit_limit REAL DEFAULT 50000,
      outstanding_balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      sale_type TEXT NOT NULL CHECK(sale_type IN ('retail', 'wholesale')),
      customer_name TEXT DEFAULT 'Walk-in Customer',
      customer_phone TEXT DEFAULT '',
      wholesale_customer_id INTEGER,
      staff_id INTEGER,
      staff_name TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      total REAL NOT NULL,
      paid_amount REAL NOT NULL,
      change_amount REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      payment_mode TEXT NOT NULL,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wholesale_customer_id) REFERENCES wholesale_customers(id) ON DELETE SET NULL,
      FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      barcode_qr TEXT NOT NULL,
      unit TEXT DEFAULT 'pcs',
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      quantity REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wholesale_customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      notes TEXT DEFAULT '',
      received_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wholesale_customer_id) REFERENCES wholesale_customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL CHECK(transaction_type IN ('purchase', 'sale', 'adjustment', 'return')),
      quantity_change REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      notes TEXT DEFAULT '',
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT DEFAULT 'cash',
      notes TEXT DEFAULT '',
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default settings if empty
  const countSettings = db.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (countSettings.count === 0) {
    const defaultSettings = [
      ['shop_name', 'N Mart'],
      ['tagline', 'Quality & Wholesale Superstore'],
      ['phone', '+91 98765 43210'],
      ['email', 'contact@nmart.com'],
      ['address', 'Main Market Road, Commercial Complex, Floor 1'],
      ['gstin', '32AAECN1234F1Z5'],
      ['upi_id', 'nmart@upi'],
      ['currency_symbol', '₹'],
      ['thermal_printer_width', '80mm'],
      ['default_tax_rate', '0'],
      ['invoice_prefix', 'NM-'],
      ['cloud_backup_path', '']
    ];

    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of defaultSettings) {
      insertSetting.run(k, v);
    }
  }

  // Seed default Owner and Staff if users empty
  const countUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (countUsers.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, pin_code, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    // Default Owner login: admin / 1234
    insertUser.run('owner', '1234', 'Mohammed Nuzaif (Owner)', 'owner', '1234');
    // Default Staff login: staff / 0000
    insertUser.run('staff', '0000', 'Cashier Counter 1', 'staff', '0000');
  }

  // Seed initial inventory catalog if empty
  const countProducts = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (countProducts.count === 0) {
    const sampleProducts = [
      {
        barcode_qr: 'NM-1001',
        name: 'Aashirvaad Shudh Chakki Atta 5kg',
        category: 'Grains & Flours',
        brand: 'Aashirvaad',
        unit: 'packet',
        retail_price: 245.0,
        wholesale_price: 215.0,
        cost_price: 198.0,
        current_stock: 45,
        min_stock_alert: 10,
        location: 'Aisle 1 - Rack A'
      },
      {
        barcode_qr: 'NM-1002',
        name: 'Fortune Sunlite Refined Sunflower Oil 1L',
        category: 'Oils & Ghee',
        brand: 'Fortune',
        unit: 'packet',
        retail_price: 135.0,
        wholesale_price: 120.0,
        cost_price: 110.0,
        current_stock: 60,
        min_stock_alert: 15,
        location: 'Aisle 1 - Rack B'
      },
      {
        barcode_qr: 'NM-1003',
        name: 'Tata Salt Vacuum Evaporated 1kg',
        category: 'Spices & Salt',
        brand: 'Tata',
        unit: 'packet',
        retail_price: 28.0,
        wholesale_price: 23.0,
        cost_price: 20.0,
        current_stock: 120,
        min_stock_alert: 20,
        location: 'Aisle 2 - Shelf 1'
      },
      {
        barcode_qr: 'NM-1004',
        name: 'India Gate Basmati Rice Feast Rozzana 1kg',
        category: 'Rice & Pulses',
        brand: 'India Gate',
        unit: 'packet',
        retail_price: 95.0,
        wholesale_price: 82.0,
        cost_price: 74.0,
        current_stock: 35,
        min_stock_alert: 8,
        location: 'Aisle 2 - Shelf 3'
      },
      {
        barcode_qr: 'NM-1005',
        name: 'Amul Butter Pasteurised 500g',
        category: 'Dairy',
        brand: 'Amul',
        unit: 'pcs',
        retail_price: 275.0,
        wholesale_price: 255.0,
        cost_price: 242.0,
        current_stock: 25,
        min_stock_alert: 5,
        location: 'Chiller 1'
      },
      {
        barcode_qr: 'NM-1006',
        name: 'Maggi 2-Minute Noodles Masala 70g (Pack of 12)',
        category: 'Snacks & Instant Food',
        brand: 'Nestle',
        unit: 'packet',
        retail_price: 168.0,
        wholesale_price: 148.0,
        cost_price: 135.0,
        current_stock: 50,
        min_stock_alert: 10,
        location: 'Aisle 3 - Front'
      },
      {
        barcode_qr: 'NM-1007',
        name: 'Surf Excel Quick Wash Detergent Powder 1kg',
        category: 'Household & Cleaning',
        brand: 'Surf Excel',
        unit: 'packet',
        retail_price: 145.0,
        wholesale_price: 128.0,
        cost_price: 118.0,
        current_stock: 40,
        min_stock_alert: 10,
        location: 'Aisle 4 - Rack 2'
      },
      {
        barcode_qr: 'NM-1008',
        name: 'Colgate Strong Teeth Toothpaste 300g Saver Pack',
        category: 'Personal Care',
        brand: 'Colgate',
        unit: 'pcs',
        retail_price: 160.0,
        wholesale_price: 138.0,
        cost_price: 125.0,
        current_stock: 30,
        min_stock_alert: 6,
        location: 'Aisle 5 - Shelf 2'
      },
      {
        barcode_qr: 'NM-1009',
        name: 'Dettol Original Germ Protection Soap 125g (Buy 4 Get 1)',
        category: 'Personal Care',
        brand: 'Dettol',
        unit: 'pack',
        retail_price: 210.0,
        wholesale_price: 185.0,
        cost_price: 168.0,
        current_stock: 22,
        min_stock_alert: 5,
        location: 'Aisle 5 - Shelf 3'
      },
      {
        barcode_qr: 'NM-1010',
        name: 'Red Label Tea 500g Box',
        category: 'Beverages',
        brand: 'Brooke Bond',
        unit: 'box',
        retail_price: 260.0,
        wholesale_price: 232.0,
        cost_price: 215.0,
        current_stock: 40,
        min_stock_alert: 8,
        location: 'Aisle 3 - Shelf 4'
      }
    ];

    const insertProd = db.prepare(`
      INSERT INTO products (barcode_qr, name, category, brand, unit, retail_price, wholesale_price, cost_price, current_stock, min_stock_alert, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of sampleProducts) {
      insertProd.run(
        p.barcode_qr,
        p.name,
        p.category,
        p.brand,
        p.unit,
        p.retail_price,
        p.wholesale_price,
        p.cost_price,
        p.current_stock,
        p.min_stock_alert,
        p.location
      );
    }
  }

  // Seed sample wholesale customers if empty
  const countCustomers = db.prepare('SELECT COUNT(*) as count FROM wholesale_customers').get();
  if (countCustomers.count === 0) {
    const insertWholesaleCustomer = db.prepare(`
      INSERT INTO wholesale_customers (name, business_name, phone, gstin, address, credit_limit, outstanding_balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertWholesaleCustomer.run(
      'Abdul Rahman',
      'Rahman General Stores',
      '+91 98450 12345',
      '32BAPPR8921M1ZC',
      'Bazaar Road, Sector 4',
      100000,
      14200
    );
    insertWholesaleCustomer.run(
      'Suresh Kumar',
      'New City Traders',
      '+91 94471 67890',
      '32AANCS4432K1ZP',
      'Wholesale Market Yard, Gate 2',
      150000,
      0
    );
  }
}
