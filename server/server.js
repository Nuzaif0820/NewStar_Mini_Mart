import express from 'express';
import cors from 'cors';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { db, initDatabase } from './db.js';
import { createBackup, listBackups, getBackupFilePath } from './backupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed data
initDatabase();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded logos and assets
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Helper: Get local network IP addresses
function getLocalNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  const primaryIp = addresses[0] || 'localhost';
  return {
    primaryIp,
    addresses,
    port: PORT,
    clientPort: 5173,
    url: `http://${primaryIp}:${PORT}`,
    clientUrl: `http://${primaryIp}:5173`
  };
}

// -------------------------------------------------------------
// 1. SYSTEM & NETWORK INFO
// -------------------------------------------------------------
app.get('/api/network-info', async (req, res) => {
  try {
    const netInfo = getLocalNetworkInfo();
    // Generate QR code for mobile connection
    const qrDataUrl = await QRCode.toDataURL(netInfo.clientUrl, {
      margin: 1,
      width: 280,
      color: { dark: '#064e3b', light: '#ffffff' }
    });
    res.json({
      success: true,
      ...netInfo,
      qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 2. AUTHENTICATION & USERS
// -------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password, pin } = req.body;
    let user;

    if (pin) {
      user = db.prepare('SELECT id, username, full_name, role, pin_code, active FROM users WHERE pin_code = ? AND active = 1').get(pin);
    } else if (username && password) {
      user = db.prepare('SELECT id, username, full_name, role, pin_code, active FROM users WHERE username = ? AND password_hash = ? AND active = 1').get(username, password);
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials or PIN' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        pinCode: user.pin_code
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, full_name, role, pin_code, active, created_at FROM users ORDER BY id ASC').all();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const { username, password, full_name, role, pin_code } = req.body;
    if (!username || !pin_code || !full_name) {
      return res.status(400).json({ success: false, error: 'Username, Name, and PIN are required' });
    }
    const stmt = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, pin_code, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    const result = stmt.run(username, password || pin_code, full_name, role || 'staff', pin_code);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role, pin_code, active, password } = req.body;
    if (password) {
      db.prepare(`
        UPDATE users 
        SET full_name = ?, role = ?, pin_code = ?, active = ?, password_hash = ?
        WHERE id = ?
      `).run(full_name, role, pin_code, active ? 1 : 0, password, id);
    } else {
      db.prepare(`
        UPDATE users 
        SET full_name = ?, role = ?, pin_code = ?, active = ?
        WHERE id = ?
      `).run(full_name, role, pin_code, active ? 1 : 0, id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 3. PRODUCTS & INVENTORY
// -------------------------------------------------------------
app.get('/api/products', (req, res) => {
  try {
    const role = req.headers['x-user-role'] || req.query.role || 'staff';
    const search = req.query.q ? `%${req.query.q.trim()}%` : null;
    const category = req.query.category || null;

    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR barcode_qr LIKE ? OR brand LIKE ?)';
      params.push(search, search, search);
    }
    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY name ASC';

    const products = db.prepare(query).all(...params);

    // Filter cost_price if user is staff for security!
    const sanitized = products.map(p => {
      if (role !== 'owner') {
        const { cost_price, ...rest } = p;
        return rest;
      }
      return p;
    });

    res.json({ success: true, products: sanitized });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Instant Scan Lookup (Barcode or QR code)
app.get('/api/products/scan/:code', (req, res) => {
  try {
    let code = req.params.code.trim();
    if (code.includes('/')) {
      const parts = code.split('/');
      code = parts[parts.length - 1];
    }
    code = code.replace(/['"]/g, '').trim();
    const role = req.headers['x-user-role'] || 'staff';
    const product = db.prepare('SELECT * FROM products WHERE barcode_qr = ? COLLATE NOCASE OR id = ? OR name = ? COLLATE NOCASE').get(code, code, code);
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (role !== 'owner') {
      delete product.cost_price;
    }

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Categories list
app.get('/api/products/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT DISTINCT category FROM products WHERE category != "" ORDER BY category ASC').all();
    res.json({ success: true, categories: categories.map(c => c.category) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const {
      barcode_qr,
      name,
      category,
      brand,
      unit,
      retail_price,
      wholesale_price,
      cost_price,
      current_stock,
      min_stock_alert,
      location
    } = req.body;

    if (!name || retail_price === undefined) {
      return res.status(400).json({ success: false, error: 'Name and Retail Price are required' });
    }

    // Auto-generate barcode if blank
    const code = (barcode_qr && barcode_qr.trim()) ? barcode_qr.trim() : `NM-${Date.now().toString().slice(-6)}`;

    const stmt = db.prepare(`
      INSERT INTO products (
        barcode_qr, name, category, brand, unit,
        retail_price, wholesale_price, cost_price,
        current_stock, min_stock_alert, location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      code,
      name,
      category || 'General',
      brand || '',
      unit || 'pcs',
      Number(retail_price) || 0,
      Number(wholesale_price) || Number(retail_price) || 0,
      Number(cost_price) || 0,
      Number(current_stock) || 0,
      Number(min_stock_alert) || 5,
      location || ''
    );

    // Record initial inventory transaction if stock > 0
    if (Number(current_stock) > 0) {
      db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, quantity_change, previous_stock, new_stock, notes, created_by
        ) VALUES (?, 'purchase', ?, 0, ?, 'Initial inventory stock', 'Owner')
      `).run(result.lastInsertRowid, Number(current_stock), Number(current_stock));
    }

    res.json({ success: true, id: result.lastInsertRowid, barcode_qr: code });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      barcode_qr,
      name,
      category,
      brand,
      unit,
      retail_price,
      wholesale_price,
      cost_price,
      current_stock,
      min_stock_alert,
      location
    } = req.body;

    const oldProduct = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(id);
    if (!oldProduct) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    db.prepare(`
      UPDATE products SET
        barcode_qr = ?,
        name = ?,
        category = ?,
        brand = ?,
        unit = ?,
        retail_price = ?,
        wholesale_price = ?,
        cost_price = ?,
        current_stock = ?,
        min_stock_alert = ?,
        location = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      barcode_qr,
      name,
      category,
      brand || '',
      unit,
      Number(retail_price),
      Number(wholesale_price),
      Number(cost_price),
      Number(current_stock),
      Number(min_stock_alert),
      location || '',
      id
    );

    // If stock changed manually, record transaction
    const diff = Number(current_stock) - Number(oldProduct.current_stock);
    if (diff !== 0) {
      db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, quantity_change, previous_stock, new_stock, notes, created_by
        ) VALUES (?, 'adjustment', ?, ?, ?, 'Manual stock edit', 'Owner')
      `).run(id, diff, oldProduct.current_stock, Number(current_stock));
    }

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/wholesale/customers/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM wholesale_customers WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Quick Stock Inward / Adjustment
app.post('/api/products/adjust-stock', (req, res) => {
  try {
    const { product_id, change_quantity, transaction_type, notes, staff_name } = req.body;
    const qty = Number(change_quantity);
    if (!qty || !product_id) {
      return res.status(400).json({ success: false, error: 'Valid Product and Quantity required' });
    }

    const prod = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(product_id);
    if (!prod) return res.status(404).json({ success: false, error: 'Product not found' });

    const newStock = Math.max(0, prod.current_stock + qty);

    db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, product_id);

    db.prepare(`
      INSERT INTO inventory_transactions (
        product_id, transaction_type, quantity_change, previous_stock, new_stock, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(product_id, transaction_type || (qty > 0 ? 'purchase' : 'adjustment'), qty, prod.current_stock, newStock, notes || '', staff_name || 'Staff');

    res.json({ success: true, previous_stock: prod.current_stock, new_stock: newStock });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 4. WHOLESALE CUSTOMERS & LEDGER (KHATA)
// -------------------------------------------------------------
app.get('/api/wholesale/customers', (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM wholesale_customers ORDER BY business_name ASC').all();
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/wholesale/customers', (req, res) => {
  try {
    const { name, business_name, phone, gstin, address, credit_limit } = req.body;
    if (!name || !business_name || !phone) {
      return res.status(400).json({ success: false, error: 'Contact Name, Business Name, and Phone are required' });
    }

    const stmt = db.prepare(`
      INSERT INTO wholesale_customers (name, business_name, phone, gstin, address, credit_limit, outstanding_balance)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `);

    const result = stmt.run(
      name,
      business_name,
      phone,
      gstin || '',
      address || '',
      Number(credit_limit) || 50000
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/wholesale/customers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, business_name, phone, gstin, address, credit_limit } = req.body;

    db.prepare(`
      UPDATE wholesale_customers SET
        name = ?, business_name = ?, phone = ?, gstin = ?, address = ?, credit_limit = ?
      WHERE id = ?
    `).run(name, business_name, phone, gstin || '', address || '', Number(credit_limit) || 0, id);

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/wholesale/customers/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM wholesale_customers WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Record wholesale payment (reduces Khata balance)
app.post('/api/wholesale/payments', (req, res) => {
  try {
    const { customer_id, amount, payment_mode, notes, received_by } = req.body;
    const payment = Number(amount);
    if (!customer_id || payment <= 0) {
      return res.status(400).json({ success: false, error: 'Customer and valid payment amount required' });
    }

    const customer = db.prepare('SELECT * FROM wholesale_customers WHERE id = ?').get(customer_id);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const newBalance = Math.max(0, customer.outstanding_balance - payment);

    db.prepare('UPDATE wholesale_customers SET outstanding_balance = ? WHERE id = ?').run(newBalance, customer_id);

    db.prepare(`
      INSERT INTO customer_payments (wholesale_customer_id, amount, payment_mode, notes, received_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(customer_id, payment, payment_mode || 'cash', notes || 'Khata clearance payment', received_by || 'Staff');

    res.json({ success: true, previous_balance: customer.outstanding_balance, new_balance: newBalance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Customer Ledger statement
app.get('/api/wholesale/customers/:id/ledger', (req, res) => {
  try {
    const { id } = req.params;
    const customer = db.prepare('SELECT * FROM wholesale_customers WHERE id = ?').get(id);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const sales = db.prepare('SELECT id, invoice_number, total, paid_amount, balance_due, payment_mode, created_at FROM sales WHERE wholesale_customer_id = ? ORDER BY created_at DESC').all(id);
    const payments = db.prepare('SELECT id, amount, payment_mode, notes, received_by, created_at FROM customer_payments WHERE wholesale_customer_id = ? ORDER BY created_at DESC').all(id);

    res.json({ success: true, customer, sales, payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 5. SALES & BILLING (RETAIL & WHOLESALE)
// -------------------------------------------------------------
app.post('/api/sales', (req, res) => {
  try {
    const {
      sale_type,
      customer_name,
      customer_phone,
      wholesale_customer_id,
      staff_id,
      staff_name,
      items,
      subtotal,
      discount,
      tax_amount,
      tax_rate,
      total,
      paid_amount,
      change_amount,
      balance_due,
      payment_mode,
      notes
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    // Generate unique invoice number: NM-YYYYMMDD-SEQ
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = req.body.invoice_prefix || 'NM-';
    const countToday = db.prepare("SELECT COUNT(*) as count FROM sales WHERE invoice_number LIKE ?").get(`${prefix}${dateStr}%`);
    const seq = String(countToday.count + 1).padStart(4, '0');
    const invoiceNumber = `${prefix}${dateStr}-${seq}`;

    // Insert sale record
    const insertSale = db.prepare(`
      INSERT INTO sales (
        invoice_number, sale_type, customer_name, customer_phone,
        wholesale_customer_id, staff_id, staff_name,
        subtotal, discount, tax_amount, tax_rate, total,
        paid_amount, change_amount, balance_due,
        payment_mode, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `);

    const saleResult = insertSale.run(
      invoiceNumber,
      sale_type || 'retail',
      customer_name || 'Walk-in Customer',
      customer_phone || '',
      wholesale_customer_id || null,
      staff_id || null,
      staff_name || 'Counter Staff',
      Number(subtotal) || 0,
      Number(discount) || 0,
      Number(tax_amount) || 0,
      Number(tax_rate) || 0,
      Number(total) || 0,
      Number(paid_amount) || Number(total) || 0,
      Number(change_amount) || 0,
      Number(balance_due) || 0,
      payment_mode || 'cash',
      notes || ''
    );

    const saleId = saleResult.lastInsertRowid;

    // Insert sale items and atomically deduct stock
    const insertItem = db.prepare(`
      INSERT INTO sale_items (
        sale_id, product_id, product_name, barcode_qr,
        unit, unit_price, cost_price, quantity, total_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      UPDATE products 
      SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertInvTrans = db.prepare(`
      INSERT INTO inventory_transactions (
        product_id, transaction_type, quantity_change, previous_stock, new_stock, notes, created_by
      ) VALUES (?, 'sale', ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      let costPrice = 0;
      let prevStock = 0;
      let newStock = 0;

      if (item.product_id) {
        const prod = db.prepare('SELECT cost_price, current_stock FROM products WHERE id = ?').get(item.product_id);
        if (prod) {
          costPrice = prod.cost_price;
          prevStock = prod.current_stock;
          newStock = prod.current_stock - Number(item.quantity);
          updateStock.run(Number(item.quantity), item.product_id);
          insertInvTrans.run(item.product_id, -Number(item.quantity), prevStock, newStock, `Invoice #${invoiceNumber}`, staff_name || 'Staff');
        }
      }

      insertItem.run(
        saleId,
        item.product_id || null,
        item.product_name || item.name,
        item.barcode_qr || '',
        item.unit || 'pcs',
        Number(item.unit_price) || 0,
        costPrice,
        Number(item.quantity) || 1,
        Number(item.total_price) || (Number(item.unit_price) * Number(item.quantity))
      );
    }

    // If wholesale customer bought on credit or has balance due, update customer ledger
    if (wholesale_customer_id && Number(balance_due) > 0) {
      db.prepare(`
        UPDATE wholesale_customers 
        SET outstanding_balance = outstanding_balance + ?
        WHERE id = ?
      `).run(Number(balance_due), wholesale_customer_id);
    }

    const fullSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);

    res.json({
      success: true,
      sale: {
        ...fullSale,
        items: saleItems
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sales list with filters
app.get('/api/sales', (req, res) => {
  try {
    const { sale_type, date, start_date, end_date, search, limit } = req.query;
    let query = 'SELECT * FROM sales WHERE 1=1';
    const params = [];

    if (sale_type && sale_type !== 'all') {
      query += ' AND sale_type = ?';
      params.push(sale_type);
    }

    if (date) {
      query += ' AND date(created_at) = date(?)';
      params.push(date);
    } else if (start_date && end_date) {
      query += ' AND date(created_at) BETWEEN date(?) AND date(?)';
      params.push(start_date, end_date);
    }

    if (search) {
      query += ' AND (invoice_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY id DESC';
    query += ` LIMIT ${limit ? Number(limit) : 100}`;

    const sales = db.prepare(query).all(...params);
    res.json({ success: true, sales });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single invoice with items
app.get('/api/sales/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? OR invoice_number = ?').get(id, id);
    if (!sale) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
    res.json({ success: true, sale: { ...sale, items } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Void / Cancel sale (Owner only)
app.delete('/api/sales/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) return res.status(404).json({ success: false, error: 'Invoice not found' });

    // Restore stock for all items
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    for (const item of items) {
      if (item.product_id) {
        db.prepare('UPDATE products SET current_stock = current_stock + ? WHERE id = ?').run(item.quantity, item.product_id);
        db.prepare(`
          INSERT INTO inventory_transactions (
            product_id, transaction_type, quantity_change, previous_stock, new_stock, notes, created_by
          ) VALUES (?, 'return', ?, 0, 0, ?, 'Owner')
        `).run(item.product_id, item.quantity, `Voided Invoice #${sale.invoice_number}`);
      }
    }

    // Revert customer credit balance if applied
    if (sale.wholesale_customer_id && sale.balance_due > 0) {
      db.prepare('UPDATE wholesale_customers SET outstanding_balance = MAX(0, outstanding_balance - ?) WHERE id = ?')
        .run(sale.balance_due, sale.wholesale_customer_id);
    }

    db.prepare('DELETE FROM sales WHERE id = ?').run(id);

    res.json({ success: true, message: `Invoice #${sale.invoice_number} voided and stock restored` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 6. REPORTS & ANALYTICS (OWNER CONSOLE)
// -------------------------------------------------------------
app.get('/api/reports/dashboard', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Today's summary
    const todaySales = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN sale_type = 'retail' THEN total ELSE 0 END), 0) as retail_revenue,
        COALESCE(SUM(CASE WHEN sale_type = 'wholesale' THEN total ELSE 0 END), 0) as wholesale_revenue,
        COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN paid_amount ELSE 0 END), 0) as cash_collected,
        COALESCE(SUM(CASE WHEN payment_mode = 'upi' THEN paid_amount ELSE 0 END), 0) as upi_collected,
        COALESCE(SUM(CASE WHEN payment_mode = 'card' THEN paid_amount ELSE 0 END), 0) as card_collected,
        COALESCE(SUM(balance_due), 0) as credit_given_today
      FROM sales
      WHERE date(created_at) = date(?)
    `).get(today);

    // Today's profit calculation
    const todayProfit = db.prepare(`
      SELECT 
        COALESCE(SUM(si.total_price - (si.cost_price * si.quantity)), 0) as estimated_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE date(s.created_at) = date(?)
    `).get(today);

    // Month-to-date summary
    const mtdSales = db.prepare(`
      SELECT 
        COUNT(*) as mtd_orders,
        COALESCE(SUM(total), 0) as mtd_revenue
      FROM sales
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', ?)
    `).get(today);

    // Inventory status
    const inventoryStats = db.prepare(`
      SELECT 
        COUNT(*) as total_products,
        COALESCE(SUM(current_stock), 0) as total_units,
        COALESCE(SUM(current_stock * cost_price), 0) as total_cost_valuation,
        COALESCE(SUM(current_stock * retail_price), 0) as total_retail_valuation,
        COUNT(CASE WHEN current_stock <= min_stock_alert THEN 1 END) as low_stock_count
      FROM products
    `).get();

    // Low stock items preview
    const lowStockItems = db.prepare(`
      SELECT id, barcode_qr, name, category, current_stock, min_stock_alert, unit
      FROM products
      WHERE current_stock <= min_stock_alert
      ORDER BY current_stock ASC
      LIMIT 10
    `).all();

    // Wholesale outstanding khata receivables
    const wholesaleKhata = db.prepare(`
      SELECT 
        COALESCE(SUM(outstanding_balance), 0) as total_receivable,
        COUNT(CASE WHEN outstanding_balance > 0 THEN 1 END) as debtors_count
      FROM wholesale_customers
    `).get();

    // Recent 10 transactions
    const recentSales = db.prepare(`
      SELECT id, invoice_number, sale_type, customer_name, total, payment_mode, created_at, staff_name
      FROM sales
      ORDER BY id DESC
      LIMIT 10
    `).all();

    res.json({
      success: true,
      today: {
        ...todaySales,
        estimated_profit: todayProfit.estimated_profit
      },
      mtd: mtdSales,
      inventory: inventoryStats,
      lowStockItems,
      wholesaleKhata,
      recentSales
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 7. EXPENSES TRACKER
// -------------------------------------------------------------
app.get('/api/expenses', (req, res) => {
  try {
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC LIMIT 100').all();
    res.json({ success: true, expenses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/expenses', (req, res) => {
  try {
    const { title, category, amount, payment_mode, notes, date } = req.body;
    if (!title || !amount) {
      return res.status(400).json({ success: false, error: 'Title and Amount required' });
    }
    const stmt = db.prepare(`
      INSERT INTO expenses (title, category, amount, payment_mode, notes, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, category || 'Shop Maintenance', Number(amount), payment_mode || 'cash', notes || '', date || new Date().toISOString().slice(0, 10));
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/expenses/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 8. SETTINGS & CLOUD BACKUP
// -------------------------------------------------------------
app.get('/api/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const settings = req.body;
    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    for (const [k, v] of Object.entries(settings)) {
      upsert.run(k, String(v));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/backup/create', (req, res) => {
  try {
    const backupInfo = createBackup();
    res.json({ success: true, backup: backupInfo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/backup/list', (req, res) => {
  try {
    const backups = listBackups();
    res.json({ success: true, backups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/backup/download/:filename', (req, res) => {
  try {
    const filePath = getBackupFilePath(req.params.filename);
    if (!filePath) return res.status(404).json({ success: false, error: 'Backup not found' });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Production Client serving (if built)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, '0.0.0.0', () => {
  const net = getLocalNetworkInfo();
  console.log(`=================================================`);
  console.log(`   N MART POS & INVENTORY SERVER IS ONLINE`);
  console.log(`=================================================`);
  console.log(` Local Windows URL : http://localhost:${PORT}`);
  console.log(` Android Phone URL : http://${net.primaryIp}:${PORT}`);
  console.log(` Frontend Dev URL  : http://${net.primaryIp}:5173`);
  console.log(`=================================================`);
});
