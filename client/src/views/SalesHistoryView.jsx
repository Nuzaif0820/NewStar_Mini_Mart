import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Printer,
  Trash2,
  Calendar,
  Filter,
  Eye,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { api } from '../utils/api';
import ReceiptPrintModal from '../components/ReceiptPrintModal';

export default function SalesHistoryView({ user, settings }) {
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState('all');
  const [selectedSale, setSelectedSale] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const currency = settings?.currency_symbol || '₹';
  const isOwner = user?.role === 'owner';

  useEffect(() => {
    loadSales();
  }, [saleTypeFilter]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/sales?sale_type=${saleTypeFilter}`);
      if (res.success) {
        setSales(res.sales);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReceipt = async (saleSummary) => {
    try {
      const res = await api.get(`/api/sales/${saleSummary.id}`);
      if (res.success && res.sale) {
        setSelectedSale(res.sale);
        setReceiptModalOpen(true);
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleVoidSale = async (sale) => {
    if (!window.confirm(`Are you sure you want to VOID and cancel Invoice #${sale.invoice_number}? This will restore all items back to stock.`)) {
      return;
    }

    try {
      const res = await api.delete(`/api/sales/${sale.id}`);
      if (res.success) {
        alert(res.message || 'Invoice voided successfully');
        loadSales();
      } else {
        alert(res.error || 'Failed to void invoice');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const filteredSales = sales.filter(s =>
    s.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (s.customer_name && s.customer_name.toLowerCase().includes(search.toLowerCase())) ||
    (s.customer_phone && s.customer_phone.includes(search))
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-emerald-400" />
            Billing & Invoices History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse completed transactions, reprint receipts, and track payment modes
          </p>
        </div>

        {/* Sale Type Filter Pills */}
        <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-700 text-xs">
          <button
            onClick={() => setSaleTypeFilter('all')}
            className={`px-4 py-1.5 rounded-xl font-bold transition ${saleTypeFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            All Sales
          </button>
          <button
            onClick={() => setSaleTypeFilter('retail')}
            className={`px-4 py-1.5 rounded-xl font-bold transition ${saleTypeFilter === 'retail' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Retail
          </button>
          <button
            onClick={() => setSaleTypeFilter('wholesale')}
            className={`px-4 py-1.5 rounded-xl font-bold transition ${saleTypeFilter === 'wholesale' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Wholesale
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-4 shadow-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by invoice number, customer name, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">INVOICE NO</th>
                <th className="py-3 px-4">DATE & TIME</th>
                <th className="py-3 px-4">TYPE</th>
                <th className="py-3 px-4">CUSTOMER</th>
                <th className="py-3 px-4">PAYMENT MODE</th>
                <th className="py-3 px-4 text-right">TOTAL AMOUNT</th>
                <th className="py-3 px-4">STAFF</th>
                <th className="py-3 px-4 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-slate-200">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredSales.map(s => {
                  const isWs = s.sale_type === 'wholesale';
                  return (
                    <tr key={s.id} className="hover:bg-slate-750 transition">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {s.invoice_number}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <div>{new Date(s.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                          isWs ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {s.sale_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{s.customer_name}</div>
                        {s.customer_phone && (
                          <div className="text-[10px] text-slate-400 font-mono">{s.customer_phone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold uppercase text-[11px]">
                        <span className={`inline-flex items-center gap-1 ${
                          s.payment_mode === 'cash' ? 'text-emerald-400' :
                          s.payment_mode === 'upi' ? 'text-teal-400' :
                          s.payment_mode === 'credit' ? 'text-rose-400' : 'text-blue-400'
                        }`}>
                          {s.payment_mode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-white text-sm">
                        {currency}{s.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {s.staff_name}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenReceipt(s)}
                            className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 transition"
                            title="View & Reprint Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {isOwner && (
                            <button
                              onClick={() => handleVoidSale(s)}
                              className="p-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition"
                              title="Void Bill & Restore Stock"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reprint Receipt Modal */}
      <ReceiptPrintModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        sale={selectedSale}
        settings={settings}
      />
    </div>
  );
}
