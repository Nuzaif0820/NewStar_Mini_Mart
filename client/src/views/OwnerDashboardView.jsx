import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Boxes,
  AlertTriangle,
  Users,
  Banknote,
  QrCode,
  CreditCard,
  Plus,
  Trash2,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import { api } from '../utils/api';

export default function OwnerDashboardView({ user, settings, onNavigate }) {
  const [data, setData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick expense form
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Store Maintenance');

  const currency = settings?.currency_symbol || '₹';

  useEffect(() => {
    loadDashboard();
    loadExpenses();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/reports/dashboard');
      if (res.success) {
        setData(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async () => {
    try {
      const res = await api.get('/api/expenses');
      if (res.success) {
        setExpenses(res.expenses);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseTitle || !expenseAmount) return;

    try {
      const res = await api.post('/api/expenses', {
        title: expenseTitle,
        amount: Number(expenseAmount),
        category: expenseCategory,
        payment_mode: 'cash',
        date: new Date().toISOString().slice(0, 10)
      });
      if (res.success) {
        setExpenseTitle('');
        setExpenseAmount('');
        loadExpenses();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      await api.delete(`/api/expenses/${id}`);
      loadExpenses();
    } catch (e) {
      alert(e.message);
    }
  };

  const todayExpensesTotal = expenses
    .filter(exp => exp.date === new Date().toISOString().slice(0, 10))
    .reduce((sum, exp) => sum + Number(exp.amount), 0);

  const todayProfit = data?.today?.estimated_profit || 0;
  const netProfitToday = todayProfit - todayExpensesTotal;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-emerald-400" />
            Owner Executive Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time financial performance, margins, inventory asset valuation & expenses
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/90 px-4 py-2 rounded-2xl border border-slate-700 text-xs">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Total Sales */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Revenue</span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-white font-mono">
              {currency}{data?.today?.total_revenue?.toFixed(2) || '0.00'}
            </span>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
              <span>{data?.today?.total_orders || 0} orders</span>
              <span>•</span>
              <span className="text-emerald-400">Retail: {currency}{data?.today?.retail_revenue || 0}</span>
              <span>•</span>
              <span className="text-indigo-400">WS: {currency}{data?.today?.wholesale_revenue || 0}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Estimated Gross Margin & Net */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Gross Profit</span>
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {currency}{todayProfit.toFixed(2)}
            </span>
            <div className="text-[11px] text-slate-400 mt-1">
              Net after expenses: <strong className="text-white font-mono">{currency}{netProfitToday.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Inventory Valuation */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inventory Valuation</span>
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-white font-mono">
              {currency}{data?.inventory?.total_cost_valuation?.toFixed(0) || '0'}
            </span>
            <div className="text-[11px] text-slate-400 mt-1">
              Retail Potential: <strong className="text-emerald-400 font-mono">{currency}{data?.inventory?.total_retail_valuation?.toFixed(0) || '0'}</strong>
            </div>
          </div>
        </div>

        {/* Card 4: Wholesale Khata Receivables */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Khata Receivables</span>
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-rose-400 font-mono">
              {currency}{data?.wholesaleKhata?.total_receivable?.toFixed(2) || '0.00'}
            </span>
            <div className="text-[11px] text-slate-400 mt-1">
              From {data?.wholesaleKhata?.debtors_count || 0} wholesale clients
            </div>
          </div>
        </div>
      </div>

      {/* Cash Collection Breakdown Row */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl">
        <h3 className="font-bold text-white text-sm mb-4">Today's Payment Collections Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-700/70">
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-bold mb-1">
              <Banknote className="w-4 h-4" /> Cash in Counter
            </div>
            <span className="text-lg font-mono font-black text-white">
              {currency}{data?.today?.cash_collected?.toFixed(2) || '0.00'}
            </span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-700/70">
            <div className="flex items-center justify-center gap-1.5 text-xs text-teal-400 font-bold mb-1">
              <QrCode className="w-4 h-4" /> UPI Digital
            </div>
            <span className="text-lg font-mono font-black text-white">
              {currency}{data?.today?.upi_collected?.toFixed(2) || '0.00'}
            </span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-700/70">
            <div className="flex items-center justify-center gap-1.5 text-xs text-blue-400 font-bold mb-1">
              <CreditCard className="w-4 h-4" /> Card Machine
            </div>
            <span className="text-lg font-mono font-black text-white">
              {currency}{data?.today?.card_collected?.toFixed(2) || '0.00'}
            </span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-700/70">
            <div className="flex items-center justify-center gap-1.5 text-xs text-indigo-400 font-bold mb-1">
              <Users className="w-4 h-4" /> Credit Given
            </div>
            <span className="text-lg font-mono font-black text-white">
              {currency}{data?.today?.credit_given_today?.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>
      </div>

      {/* Dual Column: Low Stock Alerts & Daily Shop Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Low Stock Alerts */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Low Stock Critical Alerts
              </h3>
              <span className="text-xs text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-800">
                {data?.inventory?.low_stock_count || 0} items low
              </span>
            </div>

            <div className="divide-y divide-slate-700/50 mt-2 max-h-60 overflow-y-auto">
              {(!data?.lowStockItems || data.lowStockItems.length === 0) ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  All inventory stocks are above safety thresholds!
                </div>
              ) : (
                data.lowStockItems.map(item => (
                  <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-white leading-tight">{item.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.barcode_qr} • {item.category}</div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 font-bold font-mono text-[11px]">
                        {item.current_stock} / {item.min_stock_alert} {item.unit}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate && onNavigate('inventory')}
            className="w-full mt-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
          >
            Manage All Inventory
          </button>
        </div>

        {/* Right: Daily Shop Expenses Tracker */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="font-bold text-white text-sm">Store Daily Expenses</h3>
              <span className="text-xs font-mono font-bold text-rose-400">
                Today: {currency}{todayExpensesTotal.toFixed(2)}
              </span>
            </div>

            {/* Quick Add Expense Input */}
            <form onSubmit={handleAddExpense} className="flex gap-2 my-3">
              <input
                type="text"
                placeholder="Expense (e.g. Tea & snacks, Electricity)..."
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="number"
                placeholder="Amt"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {/* Expense entries list */}
            <div className="divide-y divide-slate-700/50 max-h-48 overflow-y-auto">
              {expenses.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  No expenses logged yet.
                </div>
              ) : (
                expenses.slice(0, 5).map(exp => (
                  <div key={exp.id} className="py-2 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{exp.title}</div>
                      <div className="text-[10px] text-slate-500">{exp.date} • {exp.category}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-rose-400">-{currency}{Number(exp.amount).toFixed(2)}</span>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
