import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Database,
  Download,
  Smartphone,
  QrCode,
  Shield,
  KeyRound,
  CheckCircle2,
  HardDrive,
  Cloud,
  RefreshCw,
  Copy,
  ExternalLink,
  Wifi,
  Globe,
  Radio,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Receipt,
  Printer,
  Bluetooth,
  Usb,
  Palette,
  Sliders,
  Upload,
  Lock,
  Edit3
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../utils/api';
import { getSupabaseConfig, setSupabaseConfig, testSupabaseConnection } from '../utils/supabase';
import {
  getPrinterConfig,
  savePrinterConfig,
  connectBluetoothPrinter,
  connectUsbPrinter,
  printTestReceipt,
  getPrinterCapabilities,
  isWebBluetoothSupported,
  printViaRawBT
} from '../utils/printerService';
import { THEMES } from '../App';

export default function SettingsView({
  settings,
  onSettingsUpdated,
  user,
  theme = 'dark',
  onThemeChange,
  printerConfig: initialPrinterConfig,
  onPrinterConfigChange
}) {
  const [formData, setFormData] = useState({});
  const [networkInfo, setNetworkInfo] = useState(null);
  const [backups, setBackups] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null);

  // Printer Hardware state
  const [printerConfig, setLocalPrinterConfig] = useState(() => initialPrinterConfig || getPrinterConfig());
  const [printerStatus, setPrinterStatus] = useState(null);
  const [printerConnecting, setPrinterConnecting] = useState(false);
  const printerCaps = getPrinterCapabilities();

  // Cloud Database state (Supabase)
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudKey, setCloudKey] = useState('');
  const [isCloudActive, setIsCloudActive] = useState(false);
  const [cloudTesting, setCloudTesting] = useState(false);
  const [cloudTestResult, setCloudTestResult] = useState(null);
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Owner Passcode Update state
  const [ownerPinData, setOwnerPinData] = useState({
    currentPin: '',
    newPin: '',
    confirmPin: ''
  });
  const [ownerPinMsg, setOwnerPinMsg] = useState(null);
  const [showOwnerPin, setShowOwnerPin] = useState(false);
  const [editingUserPin, setEditingUserPin] = useState(null); // { id, full_name, pin_code }
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  // Staff creation form
  const [newStaff, setNewStaff] = useState({
    username: '',
    full_name: '',
    pin_code: '',
    role: 'staff'
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
    loadNetworkInfo();
    loadBackups();
    loadUsers();
    loadCloudSettings();
  }, [settings]);

  const loadCloudSettings = () => {
    const config = getSupabaseConfig();
    setCloudUrl(config.url || '');
    setCloudKey(config.key || '');
    setIsCloudActive(config.isConfigured);
  };

  const loadNetworkInfo = async () => {
    try {
      const res = await api.get('/api/network-info');
      if (res.success) {
        setNetworkInfo(res);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadBackups = async () => {
    try {
      const res = await api.get('/api/backup/list');
      if (res.success) {
        setBackups(res.backups);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get('/api/users');
      if (res.success) {
        setUsersList(res.users);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.post('/api/settings', formData);
      if (res.success) {
        alert("Settings successfully saved!");
        if (onSettingsUpdated) onSettingsUpdated();
      } else {
        alert(res.error || 'Failed to save settings');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // CLOUD DATABASE ACTIONS
  // -------------------------------------------------------------
  const handleTestCloud = async () => {
    if (!cloudUrl || !cloudKey) {
      alert("Please enter both Supabase URL and Anon Key.");
      return;
    }
    setCloudTesting(true);
    setCloudTestResult(null);
    try {
      const res = await testSupabaseConnection(cloudUrl.trim(), cloudKey.trim());
      setCloudTestResult(res);
    } catch (e) {
      setCloudTestResult({ success: false, error: e.message });
    } finally {
      setCloudTesting(false);
    }
  };

  const handleSaveCloud = () => {
    if (!cloudUrl || !cloudKey) {
      alert("Please enter both Supabase Project URL and Public Anon Key.");
      return;
    }
    setSupabaseConfig(cloudUrl.trim(), cloudKey.trim());
    setIsCloudActive(true);
    alert("Supabase Cloud Connected! Your app is now 100% online with zero laptop dependency.");
    window.location.reload();
  };

  const handleDisconnectCloud = () => {
    if (window.confirm("Disconnect from Supabase Cloud and revert to local mode?")) {
      setSupabaseConfig('', '');
      setCloudUrl('');
      setCloudKey('');
      setIsCloudActive(false);
      window.location.reload();
    }
  };

  const handleCopySchema = async () => {
    try {
      const sqlText = `-- N MART POS SUPABASE SCHEMA\n-- Run this in Supabase SQL Editor\n\n` +
        `CREATE TABLE IF NOT EXISTS public.wholesale_customers (\n  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\n  name TEXT NOT NULL,\n  business_name TEXT NOT NULL,\n  phone TEXT NOT NULL,\n  gstin TEXT DEFAULT '',\n  address TEXT DEFAULT '',\n  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 50000,\n  outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n` +
        `CREATE TABLE IF NOT EXISTS public.products (\n  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\n  barcode_qr TEXT UNIQUE NOT NULL,\n  name TEXT NOT NULL,\n  category TEXT NOT NULL,\n  brand TEXT DEFAULT '',\n  unit TEXT DEFAULT 'pcs',\n  retail_price NUMERIC(10,2) NOT NULL DEFAULT 0,\n  wholesale_price NUMERIC(10,2) NOT NULL DEFAULT 0,\n  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,\n  current_stock NUMERIC(10,2) NOT NULL DEFAULT 0,\n  min_stock_alert NUMERIC(10,2) NOT NULL DEFAULT 5,\n  location TEXT DEFAULT '',\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n` +
        `CREATE TABLE IF NOT EXISTS public.sales (\n  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\n  invoice_number TEXT UNIQUE NOT NULL,\n  sale_type TEXT NOT NULL,\n  customer_name TEXT DEFAULT 'Walk-in Customer',\n  customer_phone TEXT DEFAULT '',\n  wholesale_customer_id BIGINT REFERENCES public.wholesale_customers(id) ON DELETE SET NULL,\n  staff_id BIGINT,\n  staff_name TEXT NOT NULL DEFAULT 'Counter Staff',\n  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,\n  discount NUMERIC(10,2) NOT NULL DEFAULT 0,\n  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,\n  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,\n  total NUMERIC(10,2) NOT NULL DEFAULT 0,\n  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,\n  change_amount NUMERIC(10,2) NOT NULL DEFAULT 0,\n  balance_due NUMERIC(10,2) NOT NULL DEFAULT 0,\n  payment_mode TEXT NOT NULL,\n  notes TEXT DEFAULT '',\n  status TEXT DEFAULT 'completed',\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n` +
        `CREATE TABLE IF NOT EXISTS public.sale_items (\n  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\n  sale_id BIGINT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,\n  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,\n  product_name TEXT NOT NULL,\n  barcode_qr TEXT NOT NULL,\n  unit TEXT DEFAULT 'pcs',\n  unit_price NUMERIC(10,2) NOT NULL,\n  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,\n  quantity NUMERIC(10,2) NOT NULL,\n  total_price NUMERIC(10,2) NOT NULL\n);\n\n` +
        `CREATE TABLE IF NOT EXISTS public.customer_payments (\n  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\n  wholesale_customer_id BIGINT NOT NULL REFERENCES public.wholesale_customers(id) ON DELETE CASCADE,\n  amount NUMERIC(10,2) NOT NULL,\n  payment_mode TEXT NOT NULL DEFAULT 'cash',\n  notes TEXT DEFAULT '',\n  received_by TEXT NOT NULL DEFAULT 'Staff',\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n` +
        `CREATE TABLE IF NOT EXISTS public.inventory_transactions (\n  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\n  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,\n  transaction_type TEXT NOT NULL,\n  quantity_change NUMERIC(10,2) NOT NULL,\n  previous_stock NUMERIC(10,2) NOT NULL,\n  new_stock NUMERIC(10,2) NOT NULL,\n  notes TEXT DEFAULT '',\n  created_by TEXT NOT NULL DEFAULT 'Staff',\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n` +
        `CREATE TABLE IF NOT EXISTS public.expenses (\n  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\n  title TEXT NOT NULL,\n  category TEXT NOT NULL DEFAULT 'General',\n  amount NUMERIC(10,2) NOT NULL,\n  payment_mode TEXT DEFAULT 'cash',\n  notes TEXT DEFAULT '',\n  date DATE NOT NULL DEFAULT CURRENT_DATE,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n` +
        `CREATE TABLE IF NOT EXISTS public.users (\n  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\n  username TEXT UNIQUE NOT NULL,\n  password_hash TEXT NOT NULL,\n  full_name TEXT NOT NULL,\n  role TEXT NOT NULL,\n  pin_code TEXT NOT NULL,\n  active BOOLEAN NOT NULL DEFAULT TRUE,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n` +
        `CREATE TABLE IF NOT EXISTS public.settings (\n  key TEXT PRIMARY KEY,\n  value TEXT NOT NULL\n);\n\n` +
        `ALTER TABLE public.wholesale_customers ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.products ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.users ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;\n\n` +
        `DROP POLICY IF EXISTS \"Allow all wholesale\" ON public.wholesale_customers;\nDROP POLICY IF EXISTS \"Allow all products\" ON public.products;\nDROP POLICY IF EXISTS \"Allow all sales\" ON public.sales;\nDROP POLICY IF EXISTS \"Allow all sale_items\" ON public.sale_items;\nDROP POLICY IF EXISTS \"Allow all payments\" ON public.customer_payments;\nDROP POLICY IF EXISTS \"Allow all inventory\" ON public.inventory_transactions;\nDROP POLICY IF EXISTS \"Allow all expenses\" ON public.expenses;\nDROP POLICY IF EXISTS \"Allow all users\" ON public.users;\nDROP POLICY IF EXISTS \"Allow all settings\" ON public.settings;\n\n` +
        `CREATE POLICY \"Allow all wholesale\" ON public.wholesale_customers FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY \"Allow all products\" ON public.products FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY \"Allow all sales\" ON public.sales FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY \"Allow all sale_items\" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY \"Allow all payments\" ON public.customer_payments FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY \"Allow all inventory\" ON public.inventory_transactions FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY \"Allow all expenses\" ON public.expenses FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY \"Allow all users\" ON public.users FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY \"Allow all settings\" ON public.settings FOR ALL USING (true) WITH CHECK (true);\n`;

      await navigator.clipboard.writeText(sqlText);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 4000);
    } catch (e) {
      alert("Failed to copy automatically. You can copy the code from supabase_schema.sql file in the project directory.");
    }
  };

  const handleCreateBackup = async () => {
    try {
      setBackupMsg({ type: 'info', text: 'Generating full store backup snapshot...' });
      const res = await api.post('/api/backup/create');
      if (res.success) {
        setBackupMsg({
          type: 'success',
          text: `Backup created & downloaded: ${res.backup?.filename || 'Backup File'}`
        });
        loadBackups();
        setTimeout(() => setBackupMsg(null), 8000);
      } else {
        setBackupMsg({ type: 'error', text: res.error || 'Failed to create backup.' });
      }
    } catch (err) {
      setBackupMsg({ type: 'error', text: 'Backup error: ' + err.message });
    }
  };

  const handleDownloadBackupFile = async (filename) => {
    try {
      const res = await api.get(`/api/backup/download/${filename}`);
      if (!res?.success && res?.error) {
        alert(res.error);
      }
    } catch (e) {
      console.warn("Download issue:", e);
    }
  };

  const handleRestoreBackupFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(`Are you sure you want to restore data from "${file.name}"? This will sync items into your database.`)) {
      e.target.value = '';
      return;
    }
    try {
      setBackupMsg({ type: 'info', text: 'Reading and restoring database file...' });
      const text = await file.text();
      const res = await api.post('/api/backup/restore', { jsonData: text });
      if (res.success) {
        setBackupMsg({ type: 'success', text: res.message || 'Database restored successfully!' });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setBackupMsg({ type: 'error', text: res.error || 'Failed to restore backup.' });
      }
    } catch (err) {
      setBackupMsg({ type: 'error', text: 'Failed to read backup file: ' + err.message });
    } finally {
      e.target.value = '';
    }
  };

  const handleUpdateOwnerPin = async (e) => {
    e.preventDefault();
    setOwnerPinMsg(null);
    if (!ownerPinData.newPin || ownerPinData.newPin.trim().length < 4) {
      setOwnerPinMsg({ type: 'error', text: 'New passcode must be at least 4 digits.' });
      return;
    }
    if (ownerPinData.newPin.trim() !== ownerPinData.confirmPin.trim()) {
      setOwnerPinMsg({ type: 'error', text: 'New passcode and confirm passcode do not match.' });
      return;
    }

    setIsUpdatingPin(true);
    try {
      const res = await api.post('/api/auth/update-owner-pin', {
        currentPin: ownerPinData.currentPin.trim(),
        newPin: ownerPinData.newPin.trim()
      });

      if (res.success) {
        setOwnerPinMsg({ type: 'success', text: 'Owner passcode successfully updated! Use this new PIN for terminal unlock.' });
        setOwnerPinData({ currentPin: '', newPin: '', confirmPin: '' });
        loadUsers();
        setTimeout(() => setOwnerPinMsg(null), 6000);
      } else {
        setOwnerPinMsg({ type: 'error', text: res.error || 'Could not update owner passcode.' });
      }
    } catch (err) {
      setOwnerPinMsg({ type: 'error', text: err.message || 'Passcode update error.' });
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handleQuickUpdateUserPin = async (userId, newPin) => {
    const cleanPin = String(newPin || '').trim();
    if (!cleanPin || cleanPin.length < 4) {
      alert('PIN must be at least 4 digits.');
      return;
    }
    try {
      const res = await api.put(`/api/users/${userId}`, { pin_code: cleanPin });
      if (res.success) {
        alert('PIN code updated successfully.');
        setEditingUserPin(null);
        loadUsers();
      } else {
        alert(res.error || 'Failed to update PIN.');
      }
    } catch (e) {
      alert('Error updating PIN: ' + e.message);
    }
  };

  const handleUpdatePrinterConfig = (partial) => {
    const updated = { ...printerConfig, ...partial };
    setLocalPrinterConfig(updated);
    savePrinterConfig(updated);
    if (onPrinterConfigChange) {
      onPrinterConfigChange(updated);
    }
  };

  const [showAndroidBtGuide, setShowAndroidBtGuide] = useState(false);

  const handleConnectBluetooth = async () => {
    setPrinterConnecting(true);
    setPrinterStatus(null);
    try {
      const res = await connectBluetoothPrinter();
      setPrinterStatus({ type: 'success', message: `Connected to ${res.deviceName}!` });
      handleUpdatePrinterConfig({
        type: 'bluetooth',
        deviceName: res.deviceName
      });
    } catch (err) {
      if (err.message === 'WEB_BLUETOOTH_UNAVAILABLE' || err.message?.includes('Web Bluetooth')) {
        setShowAndroidBtGuide(true);
        setPrinterStatus({
          type: 'info',
          message: 'Android Bluetooth Notice: Mobile apps use Android System Print or RawBT Direct Driver for Bluetooth thermal printers.'
        });
      } else {
        setPrinterStatus({ type: 'error', message: err.message });
      }
    } finally {
      setPrinterConnecting(false);
    }
  };

  const handleConnectUsb = async () => {
    setPrinterConnecting(true);
    setPrinterStatus(null);
    try {
      const res = await connectUsbPrinter();
      setPrinterStatus({ type: 'success', message: `Connected to ${res.deviceName}!` });
      handleUpdatePrinterConfig({
        type: 'usb',
        deviceName: res.deviceName
      });
    } catch (err) {
      setPrinterStatus({ type: 'error', message: err.message });
    } finally {
      setPrinterConnecting(false);
    }
  };

  const handlePrintTest = async () => {
    setPrinterStatus({ type: 'info', message: 'Sending test receipt...' });
    try {
      const res = await printTestReceipt(formData);
      setPrinterStatus({ type: 'success', message: res.message || 'Receipt dispatched successfully!' });
    } catch (err) {
      setPrinterStatus({ type: 'error', message: 'Test print failed: ' + err.message });
    }
  };

  const handleSetRawBT = () => {
    handleUpdatePrinterConfig({
      type: 'rawbt',
      deviceName: 'Android RawBT Direct'
    });
    setPrinterStatus({
      type: 'success',
      message: 'Active mode set to RawBT Direct! Tapping Print will now send receipts directly to your paired Bluetooth printer via RawBT.'
    });
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.username || !newStaff.full_name || !newStaff.pin_code) {
      alert("All fields are required");
      return;
    }
    try {
      const res = await api.post('/api/users', newStaff);
      if (res.success) {
        alert("Staff user created!");
        setNewStaff({ username: '', full_name: '', pin_code: '', role: 'staff' });
        loadUsers();
      } else {
        alert(res.error || 'Failed to add user');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-emerald-400" />
            System Configuration & Cloud Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Online Cloud Database (No Laptop Dependency), store identity, and printer formats
          </p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. ONLINE CLOUD DATABASE SECTION (ZERO LAPTOP DEPENDENCY)       */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 border-2 border-indigo-500/50 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-500/30">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/30 text-indigo-400 rounded-2xl border border-indigo-500/40">
              <Globe className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Online Cloud Database (Supabase PostgreSQL)
              </h2>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Enables 24/7 access on all Android phones & Windows with <strong className="text-white">NO LAPTOP TURNED ON</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isCloudActive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              <Radio className="w-3.5 h-3.5" />
              {isCloudActive ? 'Online Cloud Active' : 'Local Mode'}
            </span>
          </div>
        </div>

        {/* Cloud Setup Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-indigo-200 font-bold block mb-1">
              Supabase Project URL
            </label>
            <input
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={cloudUrl}
              onChange={(e) => setCloudUrl(e.target.value)}
              className="w-full bg-slate-950 border border-indigo-700/60 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-400"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">From your Supabase Project Settings &rarr; API</span>
          </div>

          <div>
            <label className="text-indigo-200 font-bold block mb-1">
              Supabase Public Anon Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={cloudKey}
              onChange={(e) => setCloudKey(e.target.value)}
              className="w-full bg-slate-950 border border-indigo-700/60 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-400"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Public API key (Safe for mobile & browser use)</span>
          </div>
        </div>

        {/* Connection Test Banner */}
        {cloudTestResult && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            cloudTestResult.success
              ? 'bg-emerald-950/70 border border-emerald-700 text-emerald-300'
              : 'bg-rose-950/70 border border-rose-700 text-rose-300'
          }`}>
            {cloudTestResult.success ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Supabase Cloud Connection Successful! Ready to activate.</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Connection failed: {cloudTestResult.error}. Make sure you ran the SQL schema in Supabase!</span>
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySchema}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            >
              {copiedSchema ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSchema ? 'SQL Schema Copied!' : 'Copy SQL Schema for Supabase'}</span>
            </button>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Open Supabase Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestCloud}
              disabled={cloudTesting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-indigo-700/50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cloudTesting ? 'animate-spin' : ''}`} />
              <span>{cloudTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveCloud}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-black transition shadow-lg shadow-emerald-900/40"
            >
              Activate Online Cloud
            </button>

            {isCloudActive && (
              <button
                type="button"
                onClick={handleDisconnectCloud}
                className="px-3 py-2 text-rose-400 hover:text-rose-300 text-xs font-semibold"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. THEME & VISUAL APPEARANCE                                   */}
      {/* ============================================================== */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">POS Theme & Visual Mode</h2>
              <p className="text-xs text-slate-400">Choose your preferred appearance for counter or mobile use</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Active: {THEMES.find(t => t.id === theme)?.name}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {THEMES.map(t => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onThemeChange && onThemeChange(t.id)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between h-28 relative overflow-hidden group ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-900/30 ring-2 ring-emerald-500/50'
                    : 'border-slate-700/80 bg-slate-900/70 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <h4 className="font-bold text-xs text-white leading-tight">{t.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                </div>
                {isSelected && (
                  <span className="absolute top-2 right-2 p-1 bg-emerald-500 text-white rounded-full">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. THERMAL PRINTER CONNECTION & HARDWARE                       */}
      {/* ============================================================== */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Receipt Printer Connection & Hardware</h2>
              <p className="text-xs text-slate-400">Configure Bluetooth, USB, or System thermal receipt printers</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintTest}
              className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold rounded-xl text-xs transition flex items-center gap-1.5 border border-emerald-500/30 shadow"
            >
              <Printer className="w-3.5 h-3.5" /> Print Test Receipt
            </button>
          </div>
        </div>

        {/* Status Alert Banner */}
        {printerStatus && (
          <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
            printerStatus.type === 'success'
              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-600'
              : printerStatus.type === 'error'
              ? 'bg-rose-950/70 text-rose-300 border border-rose-600'
              : 'bg-indigo-950/70 text-indigo-300 border border-indigo-600'
          }`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{printerStatus.message}</span>
          </div>
        )}

        {/* Android Bluetooth Helper Guide */}
        <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-3.5 text-xs text-indigo-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5 text-indigo-300">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              Android Mobile Bluetooth Printing Guide
            </span>
            <button
              type="button"
              onClick={() => setShowAndroidBtGuide(!showAndroidBtGuide)}
              className="text-[11px] text-indigo-300 hover:text-white underline font-semibold"
            >
              {showAndroidBtGuide ? 'Hide Guide' : 'Show Instructions'}
            </button>
          </div>
          {showAndroidBtGuide && (
            <div className="pt-2 border-t border-indigo-500/20 space-y-1.5 text-[11px] leading-relaxed text-slate-300">
              <p>
                <strong>Step 1:</strong> Turn on your thermal printer and open your phone&apos;s <strong>Settings &gt; Bluetooth</strong>. Pair your printer (PIN is usually <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-300">0000</code> or <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-300">1234</code>).
              </p>
              <p>
                <strong>Step 2 (Recommended):</strong> Leave the mode set to <strong>System Print</strong> below. When printing a bill or label, the Android Print dialog will pop up where you can pick your paired Bluetooth printer!
              </p>
              <p>
                <strong>Step 3 (Optional 1-Tap Fast Print):</strong> For direct printing without the print preview dialog, install the free <strong>RawBT Print Service</strong> from Google Play Store and select <em>RawBT Direct</em> below.
              </p>
            </div>
          )}
        </div>

        {/* Printer Mode Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Mode 1: System Print Dialog */}
          <div
            onClick={() => handleUpdatePrinterConfig({ type: 'browser', deviceName: 'System Print Spooler' })}
            className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
              printerConfig.type === 'browser'
                ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500 shadow-lg'
                : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-emerald-400" /> System Print
                </span>
                {printerConfig.type === 'browser' && <Check className="w-4 h-4 text-emerald-400" />}
              </div>
              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase mb-1 border border-emerald-500/30">
                Recommended for Mobile
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Standard Android & Windows print dialog. Works with all paired Bluetooth, Wi-Fi, and USB printers.
              </p>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold mt-2">Plug & Play • Ready</span>
          </div>

          {/* Mode 2: Android RawBT Direct Bluetooth */}
          <div
            onClick={handleSetRawBT}
            className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
              printerConfig.type === 'rawbt'
                ? 'border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500 shadow-lg'
                : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Bluetooth className="w-4 h-4 text-indigo-400" /> RawBT Direct (1-Tap)
                </span>
                {printerConfig.type === 'rawbt' && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
              <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase mb-1 border border-indigo-500/30">
                Fast Android ESC/POS
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Direct wireless printing to 58mm/80mm Bluetooth printers without print preview dialog via RawBT driver.
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
              <span className="text-[10px] text-slate-400 truncate">
                {printerConfig.type === 'rawbt' ? 'Active' : 'Click to activate'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetRawBT();
                  handlePrintTest();
                }}
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1"
              >
                Test RawBT
              </button>
            </div>
          </div>

          {/* Mode 3: Web Bluetooth ESC/POS */}
          <div
            className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
              printerConfig.type === 'bluetooth'
                ? 'border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500'
                : 'border-slate-700 bg-slate-900/60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Bluetooth className="w-4 h-4 text-indigo-400" /> Web Bluetooth
                </span>
                {printerConfig.type === 'bluetooth' && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Direct BLE pairing for Chrome / Edge desktop browsers.
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                {printerConfig.deviceName || 'Desktop BLE'}
              </span>
              <button
                type="button"
                disabled={printerConnecting}
                onClick={handleConnectBluetooth}
                className="px-2 py-1 bg-indigo-600/40 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"
              >
                <Bluetooth className="w-3 h-3" />
                <span>{printerConnecting ? 'Scanning...' : 'Pair / Scan'}</span>
              </button>
            </div>
          </div>

          {/* Mode 4: USB ESC/POS Direct */}
          <div
            className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
              printerConfig.type === 'usb'
                ? 'border-cyan-500 bg-cyan-950/20 ring-1 ring-cyan-500'
                : 'border-slate-700 bg-slate-900/60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Usb className="w-4 h-4 text-cyan-400" /> USB Direct ESC/POS
                </span>
                {printerConfig.type === 'usb' && <Check className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Direct high-speed thermal printing over USB OTG / desktop USB cable.
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                {printerConfig.deviceName || 'No USB'}
              </span>
              <button
                type="button"
                disabled={printerConnecting}
                onClick={handleConnectUsb}
                className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"
              >
                <Usb className="w-3 h-3" />
                <span>{printerConnecting ? '...' : 'Connect USB'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hardware Features Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Paper Roll Width</label>
            <select
              value={printerConfig.paperWidth}
              onChange={(e) => {
                handleUpdatePrinterConfig({ paperWidth: e.target.value });
                setFormData({ ...formData, thermal_printer_width: e.target.value });
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
            >
              <option value="80mm">80mm (3-Inch Standard POS)</option>
              <option value="58mm">58mm (2-Inch Mini Portable)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Auto Paper Cut</label>
            <select
              value={printerConfig.autoCut ? 'true' : 'false'}
              onChange={(e) => handleUpdatePrinterConfig({ autoCut: e.target.value === 'true' })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
            >
              <option value="true">Enabled (Cut Paper)</option>
              <option value="false">Disabled (Tear Bar)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Cash Drawer Kick Pulse</label>
            <select
              value={printerConfig.cashDrawerKick ? 'true' : 'false'}
              onChange={(e) => handleUpdatePrinterConfig({ cashDrawerKick: e.target.value === 'true' })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
            >
              <option value="false">Disabled</option>
              <option value="true">Open on Cash Checkout</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Bill Copies</label>
            <select
              value={printerConfig.copies || 1}
              onChange={(e) => handleUpdatePrinterConfig({ copies: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
            >
              <option value={1}>1 Copy (Customer)</option>
              <option value={2}>2 Copies (Customer + Shop)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. STORE PROFILE & INVOICE DETAILS                             */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Store Profile & Settings Form */}
        <div className="lg:col-span-7 bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-700">
            Store Profile & Invoice Details
          </h2>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Store / Shop Name</label>
                <input
                  type="text"
                  value={formData.shop_name || ''}
                  onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Tagline</label>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Shop Phone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={formData.gstin || ''}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Physical Store Address</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-emerald-400 font-semibold block mb-1">Bharat UPI VPA ID</label>
                <input
                  type="text"
                  placeholder="e.g. nmart@upi"
                  value={formData.upi_id || ''}
                  onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={formData.currency_symbol || '₹'}
                  onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-center focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Thermal Slip Width</label>
                <select
                  value={formData.thermal_printer_width || '80mm'}
                  onChange={(e) => setFormData({ ...formData, thermal_printer_width: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="80mm">80mm (Standard POS)</option>
                  <option value="58mm">58mm (Mini Portable)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Receipt Footer Terms & Return Policy</label>
              <textarea
                rows={2}
                value={formData.receipt_footer || ''}
                placeholder="Thank you for shopping with us! Goods once sold can be exchanged within 7 days with original bill."
                onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition"
            >
              <Save className="w-4 h-4" /> Save Configuration
            </button>
          </form>
        </div>

        {/* Right Column: Live Receipt Preview & Mobile Connect */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: Live Thermal Receipt Designer Preview */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Receipt className="w-4 h-4 text-emerald-400" /> Live Receipt Preview
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {formData.thermal_printer_width || '80mm'} Slip
              </span>
            </div>

            {/* Paper rendering */}
            <div className="w-full flex justify-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div
                className={`bg-white text-black p-3.5 font-mono text-[10px] leading-tight shadow-lg rounded-sm ${
                  (formData.thermal_printer_width || '80mm') === '58mm' ? 'w-[230px]' : 'w-[280px]'
                }`}
              >
                {/* Store Header */}
                <div className="text-center pb-2 border-b border-dashed border-gray-400">
                  <h4 className="text-sm font-black uppercase tracking-tight">{formData.shop_name || 'N Mart'}</h4>
                  <p className="text-[8px] text-gray-700">{formData.tagline || 'Supermarket & Wholesale'}</p>
                  <p className="text-[8px] text-gray-600">{formData.address || 'Market Road'}</p>
                  <p className="text-[8px] text-gray-600">Ph: {formData.phone || '+91 98765 43210'}</p>
                  {formData.gstin && <p className="text-[8px] font-bold text-gray-800">GSTIN: {formData.gstin}</p>}
                </div>

                {/* Bill Meta */}
                <div className="py-1.5 border-b border-dashed border-gray-400 text-[9px] text-gray-600 space-y-0.5">
                  <div className="flex justify-between font-bold text-black">
                    <span>INV: NM-10042</span>
                    <span className="bg-gray-200 px-1 rounded text-[8px]">RETAIL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date: 21/10/2026</span>
                    <span>Time: 03:30 PM</span>
                  </div>
                </div>

                {/* Items */}
                <div className="py-1.5 border-b border-dashed border-gray-400">
                  <div className="flex justify-between font-bold text-[8.5px] border-b border-gray-200 pb-0.5">
                    <span>ITEM</span>
                    <span>TOTAL</span>
                  </div>
                  <div className="space-y-1 pt-1 text-[8.5px]">
                    <div className="flex justify-between">
                      <span>Aashirvaad Atta 5kg (x1)</span>
                      <span>{formData.currency_symbol || '₹'}245.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tata Salt 1kg (x2)</span>
                      <span>{formData.currency_symbol || '₹'}56.00</span>
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="py-1.5 border-b border-dashed border-gray-400 font-bold flex justify-between text-xs">
                  <span>TOTAL:</span>
                  <span>{formData.currency_symbol || '₹'}301.00</span>
                </div>

                {/* UPI QR */}
                <div className="py-2 text-center border-b border-dashed border-gray-400">
                  <p className="text-[8px] font-bold text-gray-800 mb-1">SCAN WITH ANY UPI APP</p>
                  <div className="flex justify-center p-1 bg-white inline-block border border-gray-300 rounded">
                    <QRCodeSVG
                      value={`upi://pay?pa=${encodeURIComponent(formData.upi_id || 'nmart@upi')}&pn=${encodeURIComponent(formData.shop_name || 'N Mart')}&am=301.00&cu=INR`}
                      size={75}
                      level="M"
                    />
                  </div>
                  <p className="text-[7.5px] text-gray-500 mt-0.5 font-mono">{formData.upi_id || 'nmart@upi'}</p>
                </div>

                {/* Footer Message */}
                <div className="text-center pt-1.5 text-[8px] text-gray-600 whitespace-pre-line">
                  {formData.receipt_footer || 'Thank you for shopping with us!\nGoods once sold can be exchanged within 7 days with bill.'}
                </div>
              </div>
            </div>
          </div>
          {/* Card 1: Android Mobile Scanner Link */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl text-center flex flex-col items-center">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
              <Smartphone className="w-5 h-5" /> Connect Mobile Phones
            </div>
            <p className="text-xs text-slate-400 mb-3 max-w-xs">
              Install the N Mart APK or scan this QR code on any phone!
            </p>

            {networkInfo?.qrDataUrl ? (
              <div className="p-3 bg-white rounded-2xl shadow-xl border border-gray-200 inline-block mb-3">
                <img src={networkInfo.qrDataUrl} alt="Connect Mobile" className="w-44 h-44" />
              </div>
            ) : (
              <div className="w-44 h-44 bg-slate-900 rounded-2xl flex items-center justify-center text-slate-600 mb-3">
                Loading QR...
              </div>
            )}

            <div className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-mono text-emerald-400">
              {networkInfo?.clientUrl || 'http://localhost:5173'}
            </div>
          </div>

          {/* Card 2: Backups */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                Database Snapshots & Exports
              </h3>
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm">
                  <Upload className="w-3.5 h-3.5 text-indigo-400" /> Restore
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleRestoreBackupFile}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleCreateBackup}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
                >
                  <Database className="w-3.5 h-3.5" /> Backup Now
                </button>
              </div>
            </div>

            {backupMsg && (
              <div className={`p-2.5 border text-xs rounded-xl flex items-center gap-2 ${
                backupMsg.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                  : backupMsg.type === 'error'
                  ? 'bg-rose-950/70 border-rose-700 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}>
                {backupMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {backupMsg.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                {backupMsg.type === 'info' && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />}
                <span>{backupMsg.text}</span>
              </div>
            )}

            <div className="divide-y divide-slate-800 max-h-40 overflow-y-auto pr-1 text-xs">
              {backups.length === 0 ? (
                <div className="py-4 text-center text-slate-500 text-xs">
                  No snapshots recorded yet. Tap "Backup Now" to download a full store export.
                </div>
              ) : (
                backups.map(b => (
                  <div key={b.filename} className="py-2.5 flex justify-between items-center">
                    <div>
                      <span className="font-mono text-white block text-[11px] font-semibold">{b.filename}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(b.createdAt).toLocaleString()} • {b.size ? `${(b.size / 1024).toFixed(1)} KB` : 'Snapshot'}
                        {b.itemCounts ? ` • ${b.itemCounts.products || 0} prods, ${b.itemCounts.sales || 0} bills` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadBackupFile(b.filename)}
                      className="p-2 bg-slate-700/60 hover:bg-slate-700 text-emerald-400 hover:text-white rounded-lg transition"
                      title="Download this backup file (.json)"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Owner Security & Master Passcode Management (Owner Only) */}
      {user?.role === 'owner' && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Owner Passcode & Terminal Security</h2>
                <p className="text-xs text-slate-400">Only the owner can view and update the terminal master passcode</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Owner Restricted
            </span>
          </div>

          {ownerPinMsg && (
            <div className={`p-3 border text-xs rounded-xl flex items-center gap-2 ${
              ownerPinMsg.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                : 'bg-rose-950/70 border-rose-700 text-rose-300'
            }`}>
              {ownerPinMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{ownerPinMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdateOwnerPin} className="bg-slate-900/60 p-5 rounded-2xl border border-slate-700/60 space-y-4 max-w-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Logged in as: <strong className="text-white">{user?.fullName || 'Store Owner'}</strong> (@{user?.username || 'owner'})</span>
              <button
                type="button"
                onClick={() => setShowOwnerPin(!showOwnerPin)}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
              >
                {showOwnerPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showOwnerPin ? 'Hide PINs' : 'Show PINs'}</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Current Owner Passcode / PIN
              </label>
              <input
                type={showOwnerPin ? 'text' : 'password'}
                maxLength="6"
                placeholder="Enter current PIN (e.g. 1234)"
                value={ownerPinData.currentPin}
                onChange={(e) => setOwnerPinData({ ...ownerPinData, currentPin: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  New Owner Passcode (4-6 Digits)
                </label>
                <input
                  type={showOwnerPin ? 'text' : 'password'}
                  maxLength="6"
                  placeholder="e.g. 9876"
                  value={ownerPinData.newPin}
                  onChange={(e) => setOwnerPinData({ ...ownerPinData, newPin: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Confirm New Passcode
                </label>
                <input
                  type={showOwnerPin ? 'text' : 'password'}
                  maxLength="6"
                  placeholder="Re-type new PIN"
                  value={ownerPinData.confirmPin}
                  onChange={(e) => setOwnerPinData({ ...ownerPinData, confirmPin: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingPin}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isUpdatingPin ? 'Updating Passcode...' : 'Save & Update Owner Passcode'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Staff & Cashier PIN Access Management Section */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-700">
          <KeyRound className="w-5 h-5 text-indigo-400" />
          Staff & Cashier PIN Access Management
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User List */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Registered Accounts</h4>
            <div className="divide-y divide-slate-800 bg-slate-900/60 rounded-2xl border border-slate-700/60 p-2">
              {usersList.map(u => (
                <div key={u.id} className="py-2.5 px-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{u.full_name}</span>
                      {u.role === 'owner' && <span className="text-[10px] text-amber-400 font-normal">(Owner)</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      @{u.username} • PIN: <strong className="text-emerald-400">{u.pin_code}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      u.role === 'owner' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {u.role}
                    </span>

                    {/* Quick Edit PIN button for owner */}
                    {user?.role === 'owner' && (
                      <button
                        type="button"
                        onClick={() => {
                          const newPin = window.prompt(`Enter new 4-digit PIN for ${u.full_name} (@${u.username}):`, u.pin_code);
                          if (newPin && newPin.trim()) {
                            handleQuickUpdateUserPin(u.id, newPin.trim());
                          }
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition border border-slate-700"
                        title="Change PIN for this account"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Staff Member Form */}
          <form onSubmit={handleAddStaff} className="space-y-3 text-xs bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60">
            <h4 className="text-xs font-bold text-white">Create New Staff User</h4>
            <div>
              <label className="text-slate-300 block mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Cashier Counter 2"
                value={newStaff.full_name}
                onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 block mb-1">Login Username</label>
                <input
                  type="text"
                  placeholder="e.g. staff2"
                  value={newStaff.username}
                  onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">4-Digit PIN Code</label>
                <input
                  type="text"
                  placeholder="e.g. 1122"
                  maxLength="6"
                  value={newStaff.pin_code}
                  onChange={(e) => setNewStaff({ ...newStaff, pin_code: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition"
            >
              Add Staff Cashier
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
