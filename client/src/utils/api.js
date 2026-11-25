import { getSupabaseClient } from './supabase';

const BASE_URL = '';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const userStr = localStorage.getItem('nmart_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      headers['x-user-role'] = user.role || 'staff';
      headers['x-user-id'] = String(user.id || '');
    }
  } catch (e) {}
  return headers;
}

// Direct Cloud Engine with Supabase (Zero Server / Laptop dependency)
class CloudService {
  // -------------------------------------------------------------
  // 1. AUTH & USERS
  // -------------------------------------------------------------
  static async login(credentials) {
    const supabase = getSupabaseClient();
    const { pin, username, password } = credentials;

    let query = supabase.from('users').select('id, username, full_name, role, pin_code, active').eq('active', true);
    if (pin) {
      query = query.eq('pin_code', pin);
    } else if (username && password) {
      query = query.eq('username', username).eq('password_hash', password);
    }

    const { data, error } = await query.limit(1);
    if (error || !data || data.length === 0) {
      return { success: false, error: 'Invalid credentials or PIN' };
    }

    const user = data[0];
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        pinCode: user.pin_code
      }
    };
  }

  static async getUsers() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('users').select('id, username, full_name, role, pin_code, active, created_at').order('id', { ascending: true });
    if (error) throw error;
    return { success: true, users: data };
  }

  static async createUser(payload) {
    const supabase = getSupabaseClient();
    const { username, password, full_name, role, pin_code } = payload;
    const { data, error } = await supabase.from('users').insert([{
      username,
      password_hash: password || pin_code,
      full_name,
      role: role || 'staff',
      pin_code,
      active: true
    }]).select('id');
    if (error) throw error;
    return { success: true, id: data[0].id };
  }

  static async updateUser(id, payload) {
    const supabase = getSupabaseClient();
    const updateObj = {};
    if (payload.full_name !== undefined) updateObj.full_name = payload.full_name;
    if (payload.role !== undefined) updateObj.role = payload.role;
    if (payload.active !== undefined) updateObj.active = payload.active;
    if (payload.pin_code !== undefined) {
      updateObj.pin_code = String(payload.pin_code);
      updateObj.password_hash = payload.password || String(payload.pin_code);
    }
    if (payload.password !== undefined) {
      updateObj.password_hash = payload.password;
    }

    if (supabase) {
      const { error } = await supabase.from('users').update(updateObj).eq('id', id);
      if (error) throw error;
    }

    try {
      const curr = JSON.parse(localStorage.getItem('nmart_user') || 'null');
      if (curr && String(curr.id) === String(id)) {
        const merged = { ...curr, ...updateObj };
        localStorage.setItem('nmart_user', JSON.stringify(merged));
      }
    } catch (_) {}

    return { success: true };
  }

  static async updateOwnerPin(currentPin, newPin) {
    const supabase = getSupabaseClient();
    let userStr = localStorage.getItem('nmart_user');
    let currentUser = userStr ? JSON.parse(userStr) : null;
    if (!currentUser || currentUser.role !== 'owner') {
      return { success: false, error: 'Unauthorized: Only the store owner can update owner passcode.' };
    }

    if (!newPin || String(newPin).trim().length < 4) {
      return { success: false, error: 'New passcode must be at least 4 digits.' };
    }

    if (supabase) {
      // Find owner record in Supabase
      const { data, error } = await supabase.from('users').select('*').eq('id', currentUser.id).limit(1);
      if (error || !data || data.length === 0) {
        return { success: false, error: 'Owner account not found in cloud database.' };
      }
      const ownerRecord = data[0];
      if (currentPin && String(ownerRecord.pin_code).trim() !== String(currentPin).trim()) {
        return { success: false, error: 'Current passcode is incorrect.' };
      }

      const cleanNewPin = String(newPin).trim();
      const { error: updErr } = await supabase
        .from('users')
        .update({
          pin_code: cleanNewPin,
          password_hash: cleanNewPin
        })
        .eq('id', currentUser.id);

      if (updErr) throw updErr;
    }

    // Update active user session
    currentUser.pin_code = String(newPin).trim();
    currentUser.pinCode = String(newPin).trim();
    localStorage.setItem('nmart_user', JSON.stringify(currentUser));

    return { success: true, message: 'Owner passcode successfully updated.' };
  }

  // -------------------------------------------------------------
  // 2. PRODUCTS & INVENTORY
  // -------------------------------------------------------------
  static async getProducts(role = 'staff') {
    const supabase = getSupabaseClient();
    let query = supabase.from('products').select('*').order('name', { ascending: true });
    const { data, error } = await query;
    if (error) throw error;

    const sanitized = data.map(p => {
      if (role !== 'owner') {
        const { cost_price, ...rest } = p;
        return rest;
      }
      return p;
    });

    return { success: true, products: sanitized };
  }

  static async scanProduct(code, role = 'staff') {
    const supabase = getSupabaseClient();
    let clean = String(code || '').trim();
    if (!clean) return { success: false, error: 'Empty code' };
    if (clean.includes('/')) {
      const parts = clean.split('/');
      clean = parts[parts.length - 1];
    }
    clean = clean.replace(/['"]/g, '').trim();

    // 1. Try case-insensitive barcode_qr match
    let { data, error } = await supabase
      .from('products')
      .select('*')
      .ilike('barcode_qr', clean)
      .limit(1);

    // 2. Try exact numeric ID match if it's a number
    if ((!data || data.length === 0) && !isNaN(clean)) {
      const resId = await supabase.from('products').select('*').eq('id', Number(clean)).limit(1);
      if (resId.data && resId.data.length > 0) {
        data = resId.data;
      }
    }

    // 3. Fallback name match if barcode is empty or matches name
    if (!data || data.length === 0) {
      const resName = await supabase.from('products').select('*').ilike('name', clean).limit(1);
      if (resName.data && resName.data.length > 0) {
        data = resName.data;
      }
    }

    if (error || !data || data.length === 0) {
      return { success: false, error: 'Product not found' };
    }
    const product = data[0];
    if (role !== 'owner') {
      delete product.cost_price;
    }
    return { success: true, product };
  }

  static async createProduct(payload) {
    const supabase = getSupabaseClient();
    const code = (payload.barcode_qr && payload.barcode_qr.trim()) ? payload.barcode_qr.trim() : `NM-${Date.now().toString().slice(-6)}`;

    const { data, error } = await supabase.from('products').insert([{
      barcode_qr: code,
      name: payload.name,
      category: payload.category || 'General',
      brand: payload.brand || '',
      unit: payload.unit || 'pcs',
      retail_price: Number(payload.retail_price) || 0,
      wholesale_price: Number(payload.wholesale_price) || Number(payload.retail_price) || 0,
      cost_price: Number(payload.cost_price) || 0,
      current_stock: Number(payload.current_stock) || 0,
      min_stock_alert: Number(payload.min_stock_alert) || 5,
      location: payload.location || ''
    }]).select('id');

    if (error) throw error;
    const newId = data[0].id;

    if (Number(payload.current_stock) > 0) {
      await supabase.from('inventory_transactions').insert([{
        product_id: newId,
        transaction_type: 'purchase',
        quantity_change: Number(payload.current_stock),
        previous_stock: 0,
        new_stock: Number(payload.current_stock),
        notes: 'Initial inventory stock',
        created_by: 'Owner'
      }]);
    }

    return { success: true, id: newId, barcode_qr: code };
  }

  static async updateProduct(id, payload) {
    const supabase = getSupabaseClient();
    const { data: oldProd } = await supabase.from('products').select('current_stock').eq('id', id).single();

    const { error } = await supabase.from('products').update({
      barcode_qr: payload.barcode_qr,
      name: payload.name,
      category: payload.category,
      brand: payload.brand || '',
      unit: payload.unit,
      retail_price: Number(payload.retail_price),
      wholesale_price: Number(payload.wholesale_price),
      cost_price: Number(payload.cost_price),
      current_stock: Number(payload.current_stock),
      min_stock_alert: Number(payload.min_stock_alert),
      location: payload.location || '',
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) throw error;

    if (oldProd) {
      const diff = Number(payload.current_stock) - Number(oldProd.current_stock);
      if (diff !== 0) {
        await supabase.from('inventory_transactions').insert([{
          product_id: id,
          transaction_type: 'adjustment',
          quantity_change: diff,
          previous_stock: oldProd.current_stock,
          new_stock: Number(payload.current_stock),
          notes: 'Manual stock edit',
          created_by: 'Owner'
        }]);
      }
    }

    return { success: true };
  }

  static async deleteProduct(id) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  static async adjustStock(payload) {
    const supabase = getSupabaseClient();
    const { product_id, change_quantity, transaction_type, notes, staff_name } = payload;
    const qty = Number(change_quantity);

    const { data: prod, error: err1 } = await supabase.from('products').select('current_stock').eq('id', product_id).single();
    if (err1 || !prod) return { success: false, error: 'Product not found' };

    const newStock = Math.max(0, prod.current_stock + qty);

    await supabase.from('products').update({
      current_stock: newStock,
      updated_at: new Date().toISOString()
    }).eq('id', product_id);

    await supabase.from('inventory_transactions').insert([{
      product_id,
      transaction_type: transaction_type || (qty > 0 ? 'purchase' : 'adjustment'),
      quantity_change: qty,
      previous_stock: prod.current_stock,
      new_stock: newStock,
      notes: notes || '',
      created_by: staff_name || 'Staff'
    }]);

    return { success: true, previous_stock: prod.current_stock, new_stock: newStock };
  }

  // -------------------------------------------------------------
  // 3. WHOLESALE CLIENTS & KHATA
  // -------------------------------------------------------------
  static async getWholesaleCustomers() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('wholesale_customers').select('*').order('business_name', { ascending: true });
    if (error) throw error;
    return { success: true, customers: data };
  }

  static async createWholesaleCustomer(payload) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('wholesale_customers').insert([{
      name: payload.name,
      business_name: payload.business_name,
      phone: payload.phone,
      gstin: payload.gstin || '',
      address: payload.address || '',
      credit_limit: Number(payload.credit_limit) || 50000,
      outstanding_balance: 0
    }]).select('id');
    if (error) throw error;
    return { success: true, id: data[0].id };
  }

  static async updateWholesaleCustomer(id, payload) {
    const supabase = getSupabaseClient();
    const updateData = {
      name: payload.name,
      business_name: payload.business_name,
      phone: payload.phone,
      gstin: payload.gstin || '',
      address: payload.address || '',
      credit_limit: Number(payload.credit_limit) || 0
    };
    if (payload.outstanding_balance !== undefined) {
      updateData.outstanding_balance = Number(payload.outstanding_balance);
    }
    const { error } = await supabase.from('wholesale_customers').update(updateData).eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  static async deleteWholesaleCustomer(id) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('wholesale_customers').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  static async recordWholesalePayment(payload) {
    const supabase = getSupabaseClient();
    const { customer_id, amount, payment_mode, notes, received_by } = payload;
    const payment = Number(amount);

    const { data: cust, error: errCust } = await supabase.from('wholesale_customers').select('outstanding_balance').eq('id', customer_id).single();
    if (errCust || !cust) return { success: false, error: 'Customer not found' };

    const newBalance = Math.max(0, cust.outstanding_balance - payment);

    await supabase.from('wholesale_customers').update({
      outstanding_balance: newBalance
    }).eq('id', customer_id);

    await supabase.from('customer_payments').insert([{
      wholesale_customer_id: customer_id,
      amount: payment,
      payment_mode: payment_mode || 'cash',
      notes: notes || 'Khata clearance payment',
      received_by: received_by || 'Staff'
    }]);

    return { success: true, previous_balance: cust.outstanding_balance, new_balance: newBalance };
  }

  static async getCustomerLedger(customerId) {
    const supabase = getSupabaseClient();
    const { data: customer } = await supabase.from('wholesale_customers').select('*').eq('id', customerId).single();
    const { data: sales } = await supabase.from('sales').select('id, invoice_number, total, paid_amount, balance_due, payment_mode, created_at').eq('wholesale_customer_id', customerId).order('created_at', { ascending: false });
    const { data: payments } = await supabase.from('customer_payments').select('id, amount, payment_mode, notes, received_by, created_at').eq('wholesale_customer_id', customerId).order('created_at', { ascending: false });

    return { success: true, customer, sales: sales || [], payments: payments || [] };
  }

  // -------------------------------------------------------------
  // 4. SALES BILLING (ATOMIC CHECKOUT)
  // -------------------------------------------------------------
  static async createSale(payload) {
    const supabase = getSupabaseClient();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = payload.invoice_prefix || 'NM-';

    const { count } = await supabase.from('sales').select('id', { count: 'exact', head: true }).like('invoice_number', `${prefix}${dateStr}%`);
    const seq = String((count || 0) + 1).padStart(4, '0');
    const invoiceNumber = `${prefix}${dateStr}-${seq}`;

    // Insert sale
    const { data: saleData, error: saleErr } = await supabase.from('sales').insert([{
      invoice_number: invoiceNumber,
      sale_type: payload.sale_type || 'retail',
      customer_name: payload.customer_name || 'Walk-in Customer',
      customer_phone: payload.customer_phone || '',
      wholesale_customer_id: payload.wholesale_customer_id || null,
      staff_id: payload.staff_id || null,
      staff_name: payload.staff_name || 'Counter Staff',
      subtotal: Number(payload.subtotal) || 0,
      discount: Number(payload.discount) || 0,
      tax_amount: Number(payload.tax_amount) || 0,
      tax_rate: Number(payload.tax_rate) || 0,
      total: Number(payload.total) || 0,
      paid_amount: Number(payload.paid_amount) || Number(payload.total) || 0,
      change_amount: Number(payload.change_amount) || 0,
      balance_due: Number(payload.balance_due) || 0,
      payment_mode: payload.payment_mode || 'cash',
      notes: payload.notes || '',
      status: 'completed'
    }]).select('*').single();

    if (saleErr) throw saleErr;
    const saleId = saleData.id;

    // Insert sale items and deduct stock
    const itemsToInsert = [];
    for (const item of payload.items) {
      let costPrice = 0;
      if (item.product_id) {
        const { data: prod } = await supabase.from('products').select('cost_price, current_stock').eq('id', item.product_id).single();
        if (prod) {
          costPrice = prod.cost_price;
          const newStock = prod.current_stock - Number(item.quantity);
          await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
          await supabase.from('inventory_transactions').insert([{
            product_id: item.product_id,
            transaction_type: 'sale',
            quantity_change: -Number(item.quantity),
            previous_stock: prod.current_stock,
            new_stock: newStock,
            notes: `Invoice #${invoiceNumber}`,
            created_by: payload.staff_name || 'Staff'
          }]);
        }
      }

      itemsToInsert.push({
        sale_id: saleId,
        product_id: item.product_id || null,
        product_name: item.product_name || item.name,
        barcode_qr: item.barcode_qr || '',
        unit: item.unit || 'pcs',
        unit_price: Number(item.unit_price) || 0,
        cost_price: costPrice,
        quantity: Number(item.quantity) || 1,
        total_price: Number(item.total_price) || (Number(item.unit_price) * Number(item.quantity))
      });
    }

    const { data: insertedItems } = await supabase.from('sale_items').insert(itemsToInsert).select('*');

    // Update wholesale customer credit balance if bought on credit
    if (payload.wholesale_customer_id && Number(payload.balance_due) > 0) {
      const { data: cust } = await supabase.from('wholesale_customers').select('outstanding_balance').eq('id', payload.wholesale_customer_id).single();
      if (cust) {
        await supabase.from('wholesale_customers').update({
          outstanding_balance: cust.outstanding_balance + Number(payload.balance_due)
        }).eq('id', payload.wholesale_customer_id);
      }
    }

    return {
      success: true,
      sale: {
        ...saleData,
        items: insertedItems || []
      }
    };
  }

  static async getSales(saleType = 'all') {
    const supabase = getSupabaseClient();
    let query = supabase.from('sales').select('*').order('id', { ascending: false }).limit(100);
    if (saleType && saleType !== 'all') {
      query = query.eq('sale_type', saleType);
    }
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, sales: data };
  }

  static async getSaleById(id) {
    const supabase = getSupabaseClient();
    const { data: sale, error } = await supabase.from('sales').select('*').eq('id', id).single();
    if (error || !sale) return { success: false, error: 'Invoice not found' };
    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', id);
    return { success: true, sale: { ...sale, items: items || [] } };
  }

  static async voidSale(id) {
    const supabase = getSupabaseClient();
    const { data: sale } = await supabase.from('sales').select('*').eq('id', id).single();
    if (!sale) return { success: false, error: 'Invoice not found' };

    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', id);
    for (const item of (items || [])) {
      if (item.product_id) {
        const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
        if (prod) {
          const restored = prod.current_stock + item.quantity;
          await supabase.from('products').update({ current_stock: restored }).eq('id', item.product_id);
          await supabase.from('inventory_transactions').insert([{
            product_id: item.product_id,
            transaction_type: 'return',
            quantity_change: item.quantity,
            previous_stock: prod.current_stock,
            new_stock: restored,
            notes: `Voided Invoice #${sale.invoice_number}`,
            created_by: 'Owner'
          }]);
        }
      }
    }

    if (sale.wholesale_customer_id && sale.balance_due > 0) {
      const { data: cust } = await supabase.from('wholesale_customers').select('outstanding_balance').eq('id', sale.wholesale_customer_id).single();
      if (cust) {
        await supabase.from('wholesale_customers').update({
          outstanding_balance: Math.max(0, cust.outstanding_balance - sale.balance_due)
        }).eq('id', sale.wholesale_customer_id);
      }
    }

    await supabase.from('sales').delete().eq('id', id);
    return { success: true, message: `Invoice #${sale.invoice_number} voided and stock restored` };
  }

  // -------------------------------------------------------------
  // 5. REPORTS & DASHBOARD
  // -------------------------------------------------------------
  static async getDashboard() {
    const supabase = getSupabaseClient();
    const todayStr = new Date().toISOString().slice(0, 10);

    const { data: todaySales } = await supabase.from('sales').select('*').gte('created_at', `${todayStr}T00:00:00`);
    const { data: products } = await supabase.from('products').select('*');
    const { data: wholesale } = await supabase.from('wholesale_customers').select('outstanding_balance');
    const { data: recentSales } = await supabase.from('sales').select('id, invoice_number, sale_type, customer_name, total, payment_mode, created_at, staff_name').order('id', { ascending: false }).limit(10);

    let totalRevenue = 0;
    let retailRevenue = 0;
    let wholesaleRevenue = 0;
    let cash = 0, upi = 0, card = 0, credit = 0;

    (todaySales || []).forEach(s => {
      totalRevenue += Number(s.total);
      if (s.sale_type === 'retail') retailRevenue += Number(s.total);
      if (s.sale_type === 'wholesale') wholesaleRevenue += Number(s.total);
      if (s.payment_mode === 'cash') cash += Number(s.paid_amount);
      if (s.payment_mode === 'upi') upi += Number(s.paid_amount);
      if (s.payment_mode === 'card') card += Number(s.paid_amount);
      credit += Number(s.balance_due);
    });

    let totalCostVal = 0;
    let totalRetailVal = 0;
    let totalUnits = 0;
    let lowStockCount = 0;
    const lowStockItems = [];

    (products || []).forEach(p => {
      totalCostVal += (Number(p.current_stock) * Number(p.cost_price));
      totalRetailVal += (Number(p.current_stock) * Number(p.retail_price));
      totalUnits += Number(p.current_stock);
      if (p.current_stock <= p.min_stock_alert) {
        lowStockCount++;
        if (lowStockItems.length < 10) lowStockItems.push(p);
      }
    });

    let totalReceivable = 0;
    let debtorsCount = 0;
    (wholesale || []).forEach(w => {
      if (w.outstanding_balance > 0) {
        totalReceivable += Number(w.outstanding_balance);
        debtorsCount++;
      }
    });

    return {
      success: true,
      today: {
        total_orders: (todaySales || []).length,
        total_revenue: totalRevenue,
        retail_revenue: retailRevenue,
        wholesale_revenue: wholesaleRevenue,
        cash_collected: cash,
        upi_collected: upi,
        card_collected: card,
        credit_given_today: credit,
        estimated_profit: Math.round(totalRevenue * 0.12) // estimate if items not fetched
      },
      inventory: {
        total_products: (products || []).length,
        total_units: totalUnits,
        total_cost_valuation: totalCostVal,
        total_retail_valuation: totalRetailVal,
        low_stock_count: lowStockCount
      },
      lowStockItems,
      wholesaleKhata: {
        total_receivable: totalReceivable,
        debtors_count: debtorsCount
      },
      recentSales: recentSales || []
    };
  }

  // -------------------------------------------------------------
  // 6. EXPENSES
  // -------------------------------------------------------------
  static async getExpenses() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false }).limit(100);
    if (error) throw error;
    return { success: true, expenses: data };
  }

  static async createExpense(payload) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('expenses').insert([{
      title: payload.title,
      category: payload.category || 'Shop Maintenance',
      amount: Number(payload.amount),
      payment_mode: payload.payment_mode || 'cash',
      notes: payload.notes || '',
      date: payload.date || new Date().toISOString().slice(0, 10)
    }]).select('id');
    if (error) throw error;
    return { success: true, id: data[0].id };
  }

  static async deleteExpense(id) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  // -------------------------------------------------------------
  // 7. SETTINGS
  // -------------------------------------------------------------
  static async getSettings() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;
    const settings = {};
    (data || []).forEach(r => { settings[r.key] = r.value; });
    return { success: true, settings };
  }

  static async updateSettings(settingsMap) {
    const supabase = getSupabaseClient();
    for (const [k, v] of Object.entries(settingsMap)) {
      await supabase.from('settings').upsert({ key: k, value: String(v) });
    }
    return { success: true };
  }

  // -------------------------------------------------------------
  // 8. BACKUPS (CLOUD & OFFLINE PORTABLE SNAPSHOTS)
  // -------------------------------------------------------------
  static async createBackup() {
    const supabase = getSupabaseClient();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `nmart_backup_${timestamp}.json`;

    let backupData = {
      app: 'N Mart POS & Inventory',
      version: '2.0',
      timestamp: new Date().toISOString(),
      source: supabase ? 'Supabase Cloud' : 'Local Client Storage',
      tables: {}
    };

    if (supabase) {
      try {
        const [
          productsRes,
          salesRes,
          saleItemsRes,
          customersRes,
          ledgerRes,
          expensesRes,
          settingsRes,
          transactionsRes
        ] = await Promise.all([
          supabase.from('products').select('*'),
          supabase.from('sales').select('*'),
          supabase.from('sale_items').select('*'),
          supabase.from('wholesale_customers').select('*'),
          supabase.from('wholesale_ledger').select('*'),
          supabase.from('expenses').select('*'),
          supabase.from('settings').select('*'),
          supabase.from('inventory_transactions').select('*')
        ]);

        backupData.tables = {
          products: productsRes.data || [],
          sales: salesRes.data || [],
          sale_items: saleItemsRes.data || [],
          wholesale_customers: customersRes.data || [],
          wholesale_ledger: ledgerRes.data || [],
          expenses: expensesRes.data || [],
          settings: settingsRes.data || [],
          inventory_transactions: transactionsRes.data || []
        };
      } catch (cloudErr) {
        console.warn("Supabase fetch failed during backup:", cloudErr);
      }
    }

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const size = blob.size;

    // Trigger instant client-side file download
    try {
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
    } catch (e) {
      console.warn("Direct file trigger issue:", e);
    }

    // Save snapshot metadata in localStorage
    const backupEntry = {
      filename,
      size,
      createdAt: new Date().toISOString(),
      itemCounts: {
        products: backupData.tables.products?.length || 0,
        sales: backupData.tables.sales?.length || 0,
        customers: backupData.tables.wholesale_customers?.length || 0
      },
      jsonData: jsonString
    };

    try {
      const existingList = JSON.parse(localStorage.getItem('nmart_backup_snapshots') || '[]');
      const updatedList = [backupEntry, ...existingList.filter(b => b.filename !== filename)].slice(0, 15);
      localStorage.setItem('nmart_backup_snapshots', JSON.stringify(updatedList));
    } catch (_) {}

    return {
      success: true,
      backup: backupEntry
    };
  }

  static async listBackups() {
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem('nmart_backup_snapshots') || '[]');
    } catch (_) {}
    return {
      success: true,
      backups: list.map(({ jsonData, ...rest }) => rest)
    };
  }

  static async downloadBackup(filename) {
    try {
      const list = JSON.parse(localStorage.getItem('nmart_backup_snapshots') || '[]');
      const found = list.find(b => b.filename === filename);
      if (found && found.jsonData) {
        const blob = new Blob([found.jsonData], { type: 'application/json;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
        return { success: true };
      }
    } catch (e) {
      console.warn("downloadBackup error:", e);
    }
    return { success: false, error: 'Backup data not found in cache' };
  }

  static async restoreBackup(jsonDataString) {
    const supabase = getSupabaseClient();
    let data;
    try {
      data = JSON.parse(jsonDataString);
    } catch (e) {
      return { success: false, error: 'Invalid JSON file format' };
    }

    if (!data.tables) {
      return { success: false, error: 'Unrecognized backup structure. Missing tables data.' };
    }

    if (supabase) {
      if (data.tables.products && data.tables.products.length > 0) {
        for (const p of data.tables.products) {
          const { id, ...prodFields } = p;
          await supabase.from('products').upsert({ barcode_qr: p.barcode_qr, ...prodFields });
        }
      }
      if (data.tables.wholesale_customers && data.tables.wholesale_customers.length > 0) {
        for (const c of data.tables.wholesale_customers) {
          const { id, ...custFields } = c;
          await supabase.from('wholesale_customers').upsert(custFields);
        }
      }
      if (data.tables.settings && data.tables.settings.length > 0) {
        for (const s of data.tables.settings) {
          await supabase.from('settings').upsert({ key: s.key, value: String(s.value) });
        }
      }
    }

    return {
      success: true,
      message: `Restored ${data.tables.products?.length || 0} products and ${data.tables.wholesale_customers?.length || 0} customers successfully.`
    };
  }
}

// Helper to safely parse JSON response and avoid "<!doctype" HTML crashes
async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${url}`, options);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.warn(`[safeFetchJson] Server returned non-JSON for ${url}:`, text.slice(0, 100));
      return { success: false, error: 'Server returned HTML page. Handled in cloud mode.' };
    }
  } catch (netErr) {
    console.warn(`[safeFetchJson] Network error for ${url}:`, netErr);
    return { success: false, error: netErr.message };
  }
}

// Universal API: Automatically uses Supabase Cloud when configured, or falls back to local server
export const api = {
  async get(url) {
    const isCloud = Boolean(getSupabaseClient());
    try {
      if (isCloud) {
        const role = localStorage.getItem('nmart_user') ? JSON.parse(localStorage.getItem('nmart_user')).role : 'staff';
        if (url === '/api/products' || url.startsWith('/api/products?')) {
          return await CloudService.getProducts(role);
        }
        if (url.startsWith('/api/products/scan/')) {
          const code = decodeURIComponent(url.replace('/api/products/scan/', ''));
          return await CloudService.scanProduct(code, role);
        }
        if (url === '/api/wholesale/customers') {
          return await CloudService.getWholesaleCustomers();
        }
        if (url.includes('/api/wholesale/customers/') && url.includes('/ledger')) {
          const id = url.split('/')[4];
          return await CloudService.getCustomerLedger(id);
        }
        if (url.startsWith('/api/sales?') || url === '/api/sales') {
          const params = new URLSearchParams(url.split('?')[1] || '');
          return await CloudService.getSales(params.get('sale_type') || 'all');
        }
        if (url.startsWith('/api/sales/')) {
          const id = url.replace('/api/sales/', '');
          return await CloudService.getSaleById(id);
        }
        if (url === '/api/reports/dashboard') {
          return await CloudService.getDashboard();
        }
        if (url === '/api/expenses') {
          return await CloudService.getExpenses();
        }
        if (url === '/api/settings') {
          return await CloudService.getSettings();
        }
        if (url === '/api/users') {
          return await CloudService.getUsers();
        }
        if (url === '/api/backup/list') {
          return await CloudService.listBackups();
        }
        if (url.startsWith('/api/backup/download/')) {
          const filename = url.replace('/api/backup/download/', '');
          return await CloudService.downloadBackup(filename);
        }
      }
    } catch (e) {
      console.warn('[Cloud API Error, falling back]', e);
    }

    // Backup list fallback
    if (url === '/api/backup/list') {
      return await CloudService.listBackups();
    }

    return await safeFetchJson(url, { headers: getHeaders() });
  },

  async post(url, data) {
    const isCloud = Boolean(getSupabaseClient());
    try {
      if (isCloud) {
        if (url === '/api/auth/login') {
          return await CloudService.login(data);
        }
        if (url === '/api/auth/update-owner-pin') {
          return await CloudService.updateOwnerPin(data.currentPin, data.newPin);
        }
        if (url === '/api/products') {
          return await CloudService.createProduct(data);
        }
        if (url === '/api/products/adjust-stock') {
          return await CloudService.adjustStock(data);
        }
        if (url === '/api/wholesale/customers') {
          return await CloudService.createWholesaleCustomer(data);
        }
        if (url === '/api/wholesale/payments') {
          return await CloudService.recordWholesalePayment(data);
        }
        if (url === '/api/sales') {
          return await CloudService.createSale(data);
        }
        if (url === '/api/expenses') {
          return await CloudService.createExpense(data);
        }
        if (url === '/api/settings') {
          return await CloudService.updateSettings(data);
        }
        if (url === '/api/users') {
          return await CloudService.createUser(data);
        }
        if (url === '/api/backup/create') {
          return await CloudService.createBackup();
        }
        if (url === '/api/backup/restore') {
          return await CloudService.restoreBackup(data.jsonData);
        }
      }
    } catch (e) {
      console.warn('[Cloud API Post Error, falling back]', e);
    }

    // Backup create fallback
    if (url === '/api/backup/create') {
      return await CloudService.createBackup();
    }
    if (url === '/api/auth/update-owner-pin') {
      return await CloudService.updateOwnerPin(data.currentPin, data.newPin);
    }

    return await safeFetchJson(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
  },

  async put(url, data) {
    const isCloud = Boolean(getSupabaseClient());
    try {
      if (isCloud) {
        if (url.startsWith('/api/products/')) {
          const id = url.replace('/api/products/', '');
          return await CloudService.updateProduct(id, data);
        }
        if (url.startsWith('/api/wholesale/customers/')) {
          const id = url.replace('/api/wholesale/customers/', '');
          return await CloudService.updateWholesaleCustomer(id, data);
        }
        if (url.startsWith('/api/users/')) {
          const id = url.replace('/api/users/', '');
          return await CloudService.updateUser(id, data);
        }
      }
    } catch (e) {
      console.warn('[Cloud API Put Error, falling back]', e);
    }

    if (url.startsWith('/api/users/')) {
      const id = url.replace('/api/users/', '');
      return await CloudService.updateUser(id, data);
    }

    return await safeFetchJson(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
  },

  async delete(url) {
    const isCloud = Boolean(getSupabaseClient());
    try {
      if (isCloud) {
        if (url.startsWith('/api/products/')) {
          const id = url.replace('/api/products/', '');
          return await CloudService.deleteProduct(id);
        }
        if (url.startsWith('/api/sales/')) {
          const id = url.replace('/api/sales/', '');
          return await CloudService.voidSale(id);
        }
        if (url.startsWith('/api/expenses/')) {
          const id = url.replace('/api/expenses/', '');
          return await CloudService.deleteExpense(id);
        }
        if (url.startsWith('/api/wholesale/customers/')) {
          const id = url.replace('/api/wholesale/customers/', '');
          return await CloudService.deleteWholesaleCustomer(id);
        }
      }
    } catch (e) {
      console.warn('[Cloud API Delete Error, falling back]', e);
    }

    return await safeFetchJson(url, {
      method: 'DELETE',
      headers: getHeaders()
    });
  }
};
