import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, Download, Share2, CheckCircle2, Bluetooth, Usb } from 'lucide-react';
import { getPrinterConfig, printSaleReceipt } from '../utils/printerService';

export default function ReceiptPrintModal({ isOpen, onClose, sale, settings }) {
  const printRef = useRef(null);
  const [printingStatus, setPrintingStatus] = useState(null);
  const printerConfig = getPrinterConfig();

  if (!isOpen || !sale) return null;

  const shopName = settings?.shop_name || 'N Mart';
  const tagline = settings?.tagline || 'Quality & Wholesale Superstore';
  const phone = settings?.phone || '+91 98765 43210';
  const address = settings?.address || 'Main Market Road, Commercial Complex';
  const gstin = settings?.gstin || '';
  const upiId = settings?.upi_id || 'nmart@upi';
  const currency = settings?.currency_symbol || '₹';
  const receiptFooter = settings?.receipt_footer || 'Thank you for shopping with us!\nGoods once sold can be exchanged within 7 days with original bill.';
  const printerWidth = printerConfig?.paperWidth || settings?.thermal_printer_width || '80mm';
  const isWholesale = sale.sale_type === 'wholesale';

  // Construct UPI payment URI: upi://pay?pa=...&pn=...&am=...&cu=INR
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${sale.total.toFixed(2)}&cu=INR&tn=Invoice%20${sale.invoice_number}`;

  const handlePrint = async () => {
    if (printerConfig.type === 'bluetooth' || printerConfig.type === 'usb' || printerConfig.type === 'rawbt') {
      try {
        setPrintingStatus('Sending to ' + (printerConfig.deviceName || printerConfig.type.toUpperCase()) + '...');
        const res = await printSaleReceipt(sale, settings);
        setPrintingStatus(res?.message || 'Printed successfully!');
        setTimeout(() => setPrintingStatus(null), 3000);
      } catch (err) {
        console.warn('Direct print failed, using system dialog', err);
        setPrintingStatus('Direct failed, opening system print...');
        setTimeout(() => {
          setPrintingStatus(null);
          window.print();
        }, 800);
      }
    } else {
      window.print();
    }
  };

  const handleWhatsAppShare = () => {
    if (!sale.customer_phone) {
      alert("No customer phone number specified for this bill.");
      return;
    }
    const cleanPhone = sale.customer_phone.replace(/[^0-9]/g, '');
    const text = `*Invoice from ${shopName}*\nInvoice: ${sale.invoice_number}\nDate: ${new Date(sale.created_at).toLocaleDateString()}\nTotal Amount: ${currency}${sale.total.toFixed(2)}\nPayment Mode: ${sale.payment_mode.toUpperCase()}\n\nThank you for shopping at ${shopName}!`;
    window.open(`https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Container - on print, only printRef is printed */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl my-auto">
        {/* Modal Controls Header */}
        <div className="no-print flex items-center justify-between p-4 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Invoice Generated</h3>
              <p className="text-xs text-emerald-400 font-mono font-bold">BILL NO: {sale.invoice_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {printingStatus && (
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 animate-pulse">
                {printingStatus}
              </span>
            )}
            {sale.customer_phone && (
              <button
                onClick={handleWhatsAppShare}
                className="p-2 rounded-xl bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50 transition text-xs font-medium flex items-center gap-1"
                title="Share on WhatsApp"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-900/30"
              title={`Print via ${printerConfig.deviceName || printerConfig.type.toUpperCase()}`}
            >
              <Printer className="w-4 h-4" />
              <span>Print ({printerWidth})</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-4 sm:p-6 bg-slate-950 flex justify-center max-h-[75vh] overflow-y-auto">
          <div
            ref={printRef}
            id="printable-receipt"
            className={`w-full ${printerWidth === '58mm' ? 'max-w-[270px]' : 'max-w-[340px]'} bg-white text-black p-4 font-mono text-xs shadow-xl rounded-sm print:max-w-none print:shadow-none print:p-0`}
          >
            {/* Store Header */}
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <h1 className="text-xl font-black tracking-tight">{shopName}</h1>
              <p className="text-[10px] text-gray-700">{tagline}</p>
              <p className="text-[10px] text-gray-600">{address}</p>
              <p className="text-[10px] text-gray-600">Ph: {phone}</p>
              {gstin && <p className="text-[10px] font-bold text-gray-800">GSTIN: {gstin}</p>}
            </div>

            {/* Prominent Bill Number Box */}
            <div className="my-2 py-1.5 px-2 border-2 border-black rounded text-center bg-gray-50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                TAX INVOICE / CASH BILL
              </div>
              <div className="text-sm font-black tracking-tight text-black flex items-center justify-center gap-1.5 font-mono">
                <span>BILL NO:</span>
                <span className="text-base">{sale.invoice_number}</span>
              </div>
              {sale.id && (
                <div className="text-[9px] text-gray-500 font-mono mt-0.5">
                  Token Slip #{sale.id}
                </div>
              )}
            </div>

            {/* Bill Meta */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[11px] leading-tight">
              <div className="flex justify-between items-center mb-1">
                <span>BILL NO: <strong className="font-mono font-bold text-black">{sale.invoice_number}</strong></span>
                <span className="font-bold uppercase bg-black text-white px-1.5 py-0.5 rounded text-[9px]">
                  {isWholesale ? 'WHOLESALE' : 'RETAIL'}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Date: {new Date(sale.created_at || Date.now()).toLocaleDateString()}</span>
                <span>Time: {new Date(sale.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Staff: {sale.staff_name || 'Counter'}</span>
                <span>Pay: <strong className="uppercase">{sale.payment_mode}</strong></span>
              </div>
              {sale.customer_name && sale.customer_name !== 'Walk-in Customer' && (
                <div className="mt-1 pt-1 border-t border-gray-200">
                  <p>Customer: <strong>{sale.customer_name}</strong></p>
                  {sale.customer_phone && <p className="text-gray-600">Phone: {sale.customer_phone}</p>}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-dashed border-gray-400">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-gray-300 text-left">
                    <th className="py-1">ITEM</th>
                    <th className="py-1 text-center">QTY</th>
                    <th className="py-1 text-right">RATE</th>
                    <th className="py-1 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items && sale.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-1 pr-1">
                        <div className="font-bold leading-tight">{item.product_name}</div>
                        <div className="text-[9px] text-gray-500">{item.barcode_qr}</div>
                      </td>
                      <td className="py-1 text-center align-top">{item.quantity} {item.unit || ''}</td>
                      <td className="py-1 text-right align-top">{currency}{Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-1 text-right font-bold align-top">{currency}{Number(item.total_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{currency}{Number(sale.subtotal).toFixed(2)}</span>
              </div>
              {Number(sale.discount) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>-{currency}{Number(sale.discount).toFixed(2)}</span>
                </div>
              )}
              {Number(sale.tax_amount) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({sale.tax_rate}%):</span>
                  <span>{currency}{Number(sale.tax_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm pt-1 border-t border-gray-300">
                <span>GRAND TOTAL:</span>
                <span>{currency}{Number(sale.total).toFixed(2)}</span>
              </div>

              {/* Payment Details */}
              <div className="pt-1 text-[10px] space-y-0.5 text-gray-700 border-t border-gray-200">
                <div className="flex justify-between">
                  <span>Amount Paid ({sale.payment_mode}):</span>
                  <span className="font-bold">{currency}{Number(sale.paid_amount).toFixed(2)}</span>
                </div>
                {Number(sale.change_amount) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Change Returned:</span>
                    <span>{currency}{Number(sale.change_amount).toFixed(2)}</span>
                  </div>
                )}
                {Number(sale.balance_due) > 0 && (
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Credit / Balance Due:</span>
                    <span>{currency}{Number(sale.balance_due).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Bharat UPI QR Code for instant scanning */}
            <div className="py-3 text-center border-b border-dashed border-gray-400">
              <p className="text-[10px] font-bold text-gray-800 mb-1">SCAN WITH ANY UPI APP TO PAY</p>
              <div className="flex justify-center p-1 bg-white inline-block border border-gray-300 rounded">
                <QRCodeSVG
                  value={upiUri}
                  size={100}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="text-[9px] text-gray-500 mt-1 font-mono">{upiId}</p>
              <p className="text-[9px] text-gray-700 font-semibold">GPay • PhonePe • Paytm • BHIM</p>
            </div>

            {/* Footer message */}
            <div className="text-center pt-2 text-[10px] text-gray-600 whitespace-pre-line leading-tight">
              {receiptFooter}
              <p className="text-[8px] text-gray-400 mt-1">Generated by N Mart POS & Inventory Pro</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
