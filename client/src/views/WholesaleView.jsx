import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  CreditCard,
  Phone,
  FileText,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  CheckCircle2,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { api } from '../utils/api';

export default function WholesaleView({ settings, user }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerToEdit, setCustomerToEdit] = useState(null);
  const [ledgerData, setLedgerData] = useState({ sales: [], payments: [] });

  // Add customer form
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    business_name: '',
    phone: '',
    gstin: '',
    address: '',
    credit_limit: '50000'
  });

  // Record payment form
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_mode: 'cash',
    notes: 'Khata clearance payment'
  });

  const currency = settings?.currency_symbol || '₹';

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/wholesale/customers');
      if (res.success) {
        setCustomers(res.customers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.business_name || !newCustomer.phone) {
      alert("Name, Business Name, and Phone are required.");
      return;
    }
    try {
      const res = await api.post('/api/wholesale/customers', newCustomer);
      if (res.success) {
        setAddCustomerModalOpen(false);
        setNewCustomer({
          name: '',
          business_name: '',
          phone: '',
          gstin: '',
          address: '',
          credit_limit: '50000'
        });
        loadCustomers();
      } else {
        alert(res.error || 'Failed to add customer');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEdit = (customer) => {
    setCustomerToEdit({
      id: customer.id,
      name: customer.name || '',
      business_name: customer.business_name || '',
      phone: customer.phone || '',
      gstin: customer.gstin || '',
      address: customer.address || '',
      credit_limit: String(customer.credit_limit || '50000'),
      outstanding_balance: String(customer.outstanding_balance || '0')
    });
    setEditCustomerModalOpen(true);
  };

  const handleSaveEditCustomer = async (e) => {
    e.preventDefault();
    if (!customerToEdit.name || !customerToEdit.business_name || !customerToEdit.phone) {
      alert("Name, Business Name, and Phone are required.");
      return;
    }
    try {
      const payload = {
        name: customerToEdit.name,
        business_name: customerToEdit.business_name,
        phone: customerToEdit.phone,
        gstin: customerToEdit.gstin,
        address: customerToEdit.address,
        credit_limit: Number(customerToEdit.credit_limit) || 0
      };
      if (user?.role === 'owner') {
        payload.outstanding_balance = Number(customerToEdit.outstanding_balance) || 0;
      }
      const res = await api.put(`/api/wholesale/customers/${customerToEdit.id}`, payload);
      if (res.success) {
        setEditCustomerModalOpen(false);
        setCustomerToEdit(null);
        loadCustomers();
      } else {
        alert(res.error || 'Failed to update customer');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCustomer = async (customer) => {
    if (customer.outstanding_balance > 0) {
      if (!window.confirm(`Warning: ${customer.business_name} has an outstanding balance of ${currency}${customer.outstanding_balance.toFixed(2)}. Deleting will remove their profile and Khata. Continue?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to delete ${customer.business_name} (${customer.name})?`)) {
        return;
      }
    }
    try {
      const res = await api.delete(`/api/wholesale/customers/${customer.id}`);
      if (res.success) {
        loadCustomers();
      } else {
        alert(res.error || 'Failed to delete customer');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenPayment = (customer) => {
    setSelectedCustomer(customer);
    setPaymentData({
      amount: String(customer.outstanding_balance > 0 ? customer.outstanding_balance : ''),
      payment_mode: 'cash',
      notes: 'Khata clearance payment'
    });
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    const amt = Number(paymentData.amount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      const res = await api.post('/api/wholesale/payments', {
        customer_id: selectedCustomer.id,
        amount: amt,
        payment_mode: paymentData.payment_mode,
        notes: paymentData.notes,
        received_by: user?.fullName || 'Staff'
      });

      if (res.success) {
        setPaymentModalOpen(false);
        loadCustomers();
      } else {
        alert(res.error || 'Failed to record payment');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenLedger = async (customer) => {
    setSelectedCustomer(customer);
    try {
      const res = await api.get(`/api/wholesale/customers/${customer.id}/ledger`);
      if (res.success) {
        setLedgerData({
          sales: res.sales || [],
          payments: res.payments || []
        });
        setLedgerModalOpen(true);
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const totalReceivables = customers.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0);

  const filteredCustomers = customers.filter(c =>
    c.business_name.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-400" />
            Wholesale Customer Ledger & Khata
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage trade clients, track credit limits, and record payments
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-900/90 px-4 py-2 rounded-2xl border border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Outstanding Khata</span>
            <span className="font-mono font-black text-lg text-rose-400">{currency}{totalReceivables.toFixed(2)}</span>
          </div>

          <button
            onClick={() => setAddCustomerModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-900/40 transition"
          >
            <Plus className="w-4 h-4" /> Add Wholesale Client
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-4 shadow-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search wholesale clients by shop name, contact or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(c => {
          const hasDue = c.outstanding_balance > 0;
          return (
            <div
              key={c.id}
              className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col justify-between hover:border-indigo-500/50 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">{c.business_name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{c.name}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    hasDue ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {hasDue ? 'DUE' : 'CLEAR'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">{c.phone}</span>
                  </div>
                  {c.gstin && (
                    <div className="text-[11px] text-slate-400">
                      GSTIN: <span className="font-mono font-bold text-slate-300">{c.gstin}</span>
                    </div>
                  )}
                  {c.address && (
                    <p className="text-[11px] text-slate-400 line-clamp-1">{c.address}</p>
                  )}
                </div>
              </div>

              {/* Balances & Actions */}
              <div className="mt-4 pt-3 border-t border-slate-700/60">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Credit Limit</span>
                    <span className="text-xs font-mono font-bold text-slate-300">{currency}{c.credit_limit}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Khata Balance</span>
                    <span className={`text-base font-mono font-black ${hasDue ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {currency}{c.outstanding_balance.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenPayment(c)}
                    className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Collect Payment
                  </button>
                  <button
                    onClick={() => handleOpenLedger(c)}
                    className="p-2 bg-slate-700/60 hover:bg-slate-700 text-slate-200 rounded-xl transition"
                    title="View Statement / Ledger"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="p-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-xl transition"
                    title="Edit Customer Details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {user?.role === 'owner' && (
                    <button
                      onClick={() => handleDeleteCustomer(c)}
                      className="p-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-xl transition"
                      title="Delete Wholesale Client"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Wholesale Customer Modal */}
      {addCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Register Wholesale Client</h3>
              <button
                onClick={() => setAddCustomerModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Business / Store Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahman General Stores"
                  value={newCustomer.business_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, business_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abdul Rahman"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98450 12345"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 32BAPPR8921M1ZC"
                    value={newCustomer.gstin}
                    onChange={(e) => setNewCustomer({ ...newCustomer, gstin: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Credit Limit ({currency})</label>
                  <input
                    type="number"
                    value={newCustomer.credit_limit}
                    onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Business Address</label>
                <input
                  type="text"
                  placeholder="e.g. Shop 14, Main Wholesale Market"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddCustomerModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/40"
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Wholesale Customer Modal */}
      {editCustomerModalOpen && customerToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                Edit Wholesale Customer Details
              </h3>
              <button
                onClick={() => setEditCustomerModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Business / Store Name *</label>
                <input
                  type="text"
                  required
                  value={customerToEdit.business_name}
                  onChange={(e) => setCustomerToEdit({ ...customerToEdit, business_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={customerToEdit.name}
                    onChange={(e) => setCustomerToEdit({ ...customerToEdit, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={customerToEdit.phone}
                    onChange={(e) => setCustomerToEdit({ ...customerToEdit, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={customerToEdit.gstin}
                    onChange={(e) => setCustomerToEdit({ ...customerToEdit, gstin: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Credit Limit ({currency})</label>
                  <input
                    type="number"
                    value={customerToEdit.credit_limit}
                    onChange={(e) => setCustomerToEdit({ ...customerToEdit, credit_limit: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Business Address</label>
                <input
                  type="text"
                  value={customerToEdit.address}
                  onChange={(e) => setCustomerToEdit({ ...customerToEdit, address: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {user?.role === 'owner' && (
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                  <label className="text-rose-400 font-semibold block mb-1">Khata Outstanding Balance ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    value={customerToEdit.outstanding_balance}
                    onChange={(e) => setCustomerToEdit({ ...customerToEdit, outstanding_balance: e.target.value })}
                    className="w-full bg-slate-900 border border-rose-500/40 rounded-xl px-3 py-2 text-rose-300 font-mono font-bold focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Owner only: adjust if clearing manually or resolving discrepancy</span>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditCustomerModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/40"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {paymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">Collect Khata Payment</h3>
                <p className="text-xs text-slate-400">{selectedCustomer.business_name}</p>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              <div className="bg-slate-800/80 p-3 rounded-xl flex justify-between items-center text-slate-300">
                <span>Current Outstanding Due:</span>
                <span className="font-mono font-bold text-rose-400 text-base">
                  {currency}{selectedCustomer.outstanding_balance.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Amount Received ({currency}) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Payment Mode</label>
                <select
                  value={paymentData.payment_mode}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_mode: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / Online</option>
                  <option value="bank">Bank Transfer / NEFT</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Notes / Reference No.</label>
                <input
                  type="text"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/40"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger Statement Modal */}
      {ledgerModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">Client Khata Statement</h3>
                <p className="text-xs text-slate-400">{selectedCustomer.business_name} ({selectedCustomer.phone})</p>
              </div>
              <button
                onClick={() => setLedgerModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 text-xs">
              <div>
                <span className="text-slate-400 block">Total Credit Bills:</span>
                <span className="font-bold text-white text-sm">{ledgerData.sales.length} invoices</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block">Current Outstanding Balance:</span>
                <span className="font-mono font-bold text-rose-400 text-base">
                  {currency}{selectedCustomer.outstanding_balance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Invoices List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300">Sales Invoices</h4>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-800 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs">
                {ledgerData.sales.length === 0 ? (
                  <p className="py-4 text-center text-slate-500">No invoices recorded yet.</p>
                ) : (
                  ledgerData.sales.map(s => (
                    <div key={s.id} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-mono font-bold text-white">{s.invoice_number}</span>
                        <span className="text-[10px] text-slate-500 block">{new Date(s.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-white block">{currency}{s.total.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 uppercase">{s.payment_mode}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payments List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300">Payments Received</h4>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-800 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs">
                {ledgerData.payments.length === 0 ? (
                  <p className="py-4 text-center text-slate-500">No payments received yet.</p>
                ) : (
                  ledgerData.payments.map(p => (
                    <div key={p.id} className="py-2 flex justify-between items-center text-emerald-400">
                      <div>
                        <span className="font-bold text-white block">{p.notes || 'Payment'}</span>
                        <span className="text-[10px] text-slate-500 block">{new Date(p.created_at).toLocaleString()} by {p.received_by}</span>
                      </div>
                      <div className="text-right font-mono font-bold">
                        -{currency}{p.amount.toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
