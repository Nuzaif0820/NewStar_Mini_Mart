// N Mart POS - Printer Connection & ESC/POS Hardware Service
// Supports:
// 1. Browser System Print (Default & Recommended - Works with Windows & Android System Print Spooler)
// 2. Android RawBT Direct Bluetooth (Instant 1-tap wireless ESC/POS printing via RawBT driver)
// 3. Web Bluetooth ESC/POS (Direct BLE on Chrome/Edge)
// 4. WebUSB Thermal POS (Direct USB on Chrome/Edge)

const PRINTER_STORAGE_KEY = 'nmart_printer_config';

export function getPrinterConfig() {
  try {
    const saved = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {}
  return {
    type: 'browser', // 'browser' | 'rawbt' | 'bluetooth' | 'usb'
    paperWidth: '80mm', // '80mm' | '58mm'
    autoCut: true,
    cashDrawerKick: false,
    copies: 1,
    deviceName: '',
    networkIp: ''
  };
}

export function savePrinterConfig(config) {
  try {
    localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save printer config', e);
  }
}

// Active connection handles
let activeBluetoothDevice = null;
let activeBluetoothServer = null;
let activeBluetoothCharacteristic = null;

let activeUsbDevice = null;

/**
 * Check browser capability for direct hardware printing
 */
export function getPrinterCapabilities() {
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const hasBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const hasUsb = typeof navigator !== 'undefined' && 'usb' in navigator;
  const hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

  return {
    isAndroid,
    hasBluetooth,
    hasUsb,
    hasSerial,
    supportsRawBT: isAndroid
  };
}

export function isWebBluetoothSupported() {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Scan and connect to Bluetooth ESC/POS Thermal Printer (Web Bluetooth)
 */
export async function connectBluetoothPrinter() {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('WEB_BLUETOOTH_UNAVAILABLE');
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Common Chinese POS service
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
        '0000ff00-0000-1000-8000-00805f9b34fb', // Custom
        '0000fee7-0000-1000-8000-00805f9b34fb'
      ]
    });

    activeBluetoothDevice = device;
    const server = await device.gatt.connect();
    activeBluetoothServer = server;

    // Search for a writable characteristic
    let foundChar = null;
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            foundChar = char;
            break;
          }
        }
      } catch (e) {}
      if (foundChar) break;
    }

    if (!foundChar) {
      throw new Error(`Connected to ${device.name || 'printer'}, but found no writable print service.`);
    }

    activeBluetoothCharacteristic = foundChar;

    const currentConfig = getPrinterConfig();
    savePrinterConfig({
      ...currentConfig,
      type: 'bluetooth',
      deviceName: device.name || 'Bluetooth POS Printer'
    });

    return {
      success: true,
      deviceName: device.name || 'Bluetooth POS Printer'
    };
  } catch (err) {
    console.error('Bluetooth connection error:', err);
    throw err;
  }
}

/**
 * Connect to USB Thermal Printer via WebUSB
 */
export async function connectUsbPrinter() {
  if (typeof navigator === 'undefined' || !navigator.usb) {
    throw new Error('WebUSB is not supported in this browser. Use System Print.');
  }

  try {
    const device = await navigator.usb.requestDevice({
      filters: [{ classCode: 7 }] // 7 is standard Printer class code
    });

    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);

    activeUsbDevice = device;

    const currentConfig = getPrinterConfig();
    savePrinterConfig({
      ...currentConfig,
      type: 'usb',
      deviceName: device.productName || 'USB Thermal Printer'
    });

    return {
      success: true,
      deviceName: device.productName || 'USB Thermal Printer'
    };
  } catch (err) {
    console.error('USB connection error:', err);
    throw err;
  }
}

/**
 * Send raw ESC/POS bytes via Android RawBT intent
 */
export function printViaRawBT(bytes) {
  try {
    // Convert Uint8Array to binary base64
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = window.btoa(binary);
    const rawbtUri = `rawbt:data:application/octet-stream;base64,${base64Data}`;

    // Trigger URL scheme
    const link = document.createElement('a');
    link.href = rawbtUri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return { success: true, message: 'Sent directly to RawBT Bluetooth Print Service' };
  } catch (err) {
    console.error('RawBT print error:', err);
    // Fallback to system print
    window.print();
    return { success: false, message: 'Opening system print fallback...' };
  }
}

/**
 * Send raw binary bytes in chunks to Bluetooth or USB printer
 */
async function sendRawBytes(bytes) {
  const config = getPrinterConfig();

  if (config.type === 'rawbt') {
    return printViaRawBT(bytes);
  }

  if (config.type === 'bluetooth') {
    if (!activeBluetoothCharacteristic) {
      throw new Error('No active Bluetooth printer connection. Please pair or use System Print.');
    }
    // Send in chunks of 100 bytes to prevent BLE buffer overflow
    const chunkSize = 100;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      if (activeBluetoothCharacteristic.writeValueWithoutResponse) {
        await activeBluetoothCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await activeBluetoothCharacteristic.writeValue(chunk);
      }
      await new Promise(r => setTimeout(r, 20));
    }
    return { success: true, message: 'Sent to Bluetooth printer' };
  } else if (config.type === 'usb') {
    if (!activeUsbDevice) {
      throw new Error('No active USB printer connection.');
    }
    await activeUsbDevice.transferOut(1, bytes);
    return { success: true, message: 'Sent to USB printer' };
  } else {
    // Browser print fallback
    window.print();
    return { success: true, message: 'System print dialog opened' };
  }
}

/**
 * Build ESC/POS byte commands for a test receipt
 */
export function buildTestReceiptEscPos(config, settings) {
  const encoder = new TextEncoder();
  const bytes = [];

  const pushText = (str) => {
    const encoded = encoder.encode(str);
    for (let b of encoded) bytes.push(b);
  };

  const is58mm = config.paperWidth === '58mm';
  const lineWidth = is58mm ? 32 : 48;
  const divider = '-'.repeat(lineWidth) + '\n';

  // 1. Initialize printer: ESC @
  bytes.push(0x1B, 0x40);

  // 2. Cash Drawer Kick (if configured): ESC p 0 25 250
  if (config.cashDrawerKick) {
    bytes.push(0x1B, 0x70, 0x00, 0x19, 0xFA);
  }

  // 3. Align Center: ESC a 1
  bytes.push(0x1B, 0x61, 0x01);

  // Bold on, Double height/width for Store Name: ESC E 1, GS ! 0x11
  bytes.push(0x1B, 0x45, 0x01, 0x1D, 0x21, 0x11);
  pushText(`${settings?.shop_name || 'N MART'}\n`);

  // Normal text: GS ! 0x00, Bold off: ESC E 0
  bytes.push(0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00);
  pushText(`${settings?.tagline || 'Supermarket & Wholesale'}\n`);
  pushText(`${settings?.address || 'Main Market Road'}\n`);
  pushText(`Ph: ${settings?.phone || '+91 98765 43210'}\n`);
  if (settings?.gstin) {
    pushText(`GSTIN: ${settings.gstin}\n`);
  }

  // Divider
  pushText(divider);

  // Bill header
  bytes.push(0x1B, 0x45, 0x01);
  pushText(`*** HARDWARE TEST RECEIPT ***\n`);
  pushText(`BILL NO: TEST-0001\n`);
  bytes.push(0x1B, 0x45, 0x00);
  pushText(`Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`);
  pushText(`Mode: ${(config.type || 'BROWSER').toUpperCase()}\n`);
  pushText(`Format: ${config.paperWidth} (${lineWidth} cols)\n`);

  pushText(divider);

  // Align Left: ESC a 0
  bytes.push(0x1B, 0x61, 0x00);
  pushText(`Sample Item 1        x1  Rs.120.00\n`);
  pushText(`Sample Item 2        x2  Rs.180.00\n`);

  pushText(divider);

  // Align Right: ESC a 2
  bytes.push(0x1B, 0x61, 0x02);
  bytes.push(0x1B, 0x45, 0x01, 0x1D, 0x21, 0x01);
  pushText(`TOTAL: Rs.300.00\n`);
  bytes.push(0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00);

  // Center: ESC a 1
  bytes.push(0x1B, 0x61, 0x01);
  pushText(divider);
  pushText(`${settings?.receipt_footer || 'Thank you for shopping with us!'}\n\n`);
  pushText(`Hardware Test OK\n\n\n\n`);

  // Auto-cut paper (if configured): GS V 0
  if (config.autoCut) {
    bytes.push(0x1D, 0x56, 0x00);
  }

  return new Uint8Array(bytes);
}

/**
 * Build ESC/POS byte commands for a real sales invoice
 */
export function buildSaleReceiptEscPos(config, settings, sale) {
  const encoder = new TextEncoder();
  const bytes = [];

  const pushText = (str) => {
    const encoded = encoder.encode(str);
    for (let b of encoded) bytes.push(b);
  };

  const is58mm = config.paperWidth === '58mm';
  const lineWidth = is58mm ? 32 : 48;
  const divider = '-'.repeat(lineWidth) + '\n';
  const currency = settings?.currency_symbol || 'Rs.';

  // 1. Initialize printer: ESC @
  bytes.push(0x1B, 0x40);

  if (config.cashDrawerKick) {
    bytes.push(0x1B, 0x70, 0x00, 0x19, 0xFA);
  }

  // 2. Header Center: ESC a 1
  bytes.push(0x1B, 0x61, 0x01);
  bytes.push(0x1B, 0x45, 0x01, 0x1D, 0x21, 0x11); // Double size bold
  pushText(`${settings?.shop_name || 'N MART'}\n`);
  bytes.push(0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00); // Normal

  if (settings?.tagline) pushText(`${settings.tagline}\n`);
  if (settings?.address) pushText(`${settings.address}\n`);
  if (settings?.phone) pushText(`Ph: ${settings.phone}\n`);
  if (settings?.gstin) pushText(`GSTIN: ${settings.gstin}\n`);

  pushText(divider);

  // Invoice / Bill Number Header
  bytes.push(0x1B, 0x61, 0x01); // Center
  bytes.push(0x1B, 0x45, 0x01, 0x1D, 0x21, 0x01); // Double height bold
  pushText(`BILL NO: ${sale.invoice_number}\n`);
  bytes.push(0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00);
  pushText(`TAX INVOICE (${(sale.sale_type || 'RETAIL').toUpperCase()})\n`);
  if (sale.id) {
    pushText(`Token Slip #${sale.id}\n`);
  }
  pushText(`Date: ${new Date(sale.created_at || Date.now()).toLocaleString()}\n`);
  if (sale.customer_name && sale.customer_name !== 'Walk-in Customer') {
    pushText(`Customer: ${sale.customer_name}\n`);
  }
  if (sale.customer_phone) {
    pushText(`Phone: ${sale.customer_phone}\n`);
  }
  pushText(`Payment: ${sale.payment_mode?.toUpperCase() || 'CASH'}\n`);

  pushText(divider);

  // Line items
  bytes.push(0x1B, 0x61, 0x00); // Left align
  const items = sale.items || [];
  items.forEach(item => {
    const name = (item.product_name || 'Item').slice(0, is58mm ? 16 : 24);
    const qtyPrice = `x${item.quantity} ${Number(item.unit_price).toFixed(2)}`;
    const lineTotal = Number(item.total_price).toFixed(2);
    
    // Line 1: Item Name
    pushText(`${name}\n`);
    // Line 2: Qty @ Price ... Total
    const leftPart = `  ${qtyPrice}`;
    const spacesNeeded = Math.max(1, lineWidth - leftPart.length - lineTotal.length);
    pushText(`${leftPart}${' '.repeat(spacesNeeded)}${lineTotal}\n`);
  });

  pushText(divider);

  // Summary (Align right)
  bytes.push(0x1B, 0x61, 0x02);
  pushText(`Subtotal: ${currency}${Number(sale.subtotal || sale.total).toFixed(2)}\n`);
  if (Number(sale.discount) > 0) {
    pushText(`Discount: -${currency}${Number(sale.discount).toFixed(2)}\n`);
  }
  if (Number(sale.tax_amount) > 0) {
    pushText(`Tax: +${currency}${Number(sale.tax_amount).toFixed(2)}\n`);
  }

  // Grand Total Bold Double Height
  bytes.push(0x1B, 0x45, 0x01, 0x1D, 0x21, 0x01);
  pushText(`TOTAL: ${currency}${Number(sale.total).toFixed(2)}\n`);
  bytes.push(0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00);

  if (Number(sale.paid_amount) > 0) {
    pushText(`Paid: ${currency}${Number(sale.paid_amount).toFixed(2)}\n`);
  }
  if (Number(sale.change_amount) > 0) {
    pushText(`Change: ${currency}${Number(sale.change_amount).toFixed(2)}\n`);
  }

  // Footer Center
  bytes.push(0x1B, 0x61, 0x01);
  pushText(divider);
  pushText(`${settings?.receipt_footer || 'Thank you for shopping with us!'}\n\n\n\n`);

  if (config.autoCut) {
    bytes.push(0x1D, 0x56, 0x00);
  }

  return new Uint8Array(bytes);
}

/**
 * Execute a test receipt print
 */
export async function printTestReceipt(settings) {
  const config = getPrinterConfig();
  if (config.type === 'browser') {
    window.print();
    return { success: true, message: 'Print dialog opened' };
  }

  const bytes = buildTestReceiptEscPos(config, settings);
  return await sendRawBytes(bytes);
}

/**
 * Execute a real sale receipt print
 */
export async function printSaleReceipt(sale, settings) {
  const config = getPrinterConfig();
  if (config.type === 'browser') {
    window.print();
    return { success: true, message: 'Print dialog opened' };
  }

  const bytes = buildSaleReceiptEscPos(config, settings, sale);
  return await sendRawBytes(bytes);
}
