import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Tag,
  Boxes,
  Users,
  Receipt,
  TrendingUp,
  Settings,
  LogOut,
  Camera,
  ShieldCheck,
  User,
  Menu,
  X,
  Wifi,
  Sparkles,
  Palette,
  Printer
} from 'lucide-react';
import { api } from './utils/api';
import { getPrinterConfig } from './utils/printerService';

export const THEMES = [
  { id: 'dark', name: 'Dark Slate', icon: '🌙', desc: 'Modern High-Tech' },
  { id: 'light', name: 'Supermarket Day', icon: '☀️', desc: 'Crisp Light Mode' },
  { id: 'oled', name: 'Midnight OLED', icon: '🖤', desc: 'Battery-Saving Black' },
  { id: 'emerald', name: 'Royal Emerald', icon: '🌲', desc: 'Grocery Retail' },
  { id: 'ocean', name: 'Ocean Blue', icon: '🌊', desc: 'Professional POS' }
];

import BillingView from './views/BillingView';
import LabelPrintView from './views/LabelPrintView';
import InventoryView from './views/InventoryView';
import WholesaleView from './views/WholesaleView';
import SalesHistoryView from './views/SalesHistoryView';
import OwnerDashboardView from './views/OwnerDashboardView';
import SettingsView from './views/SettingsView';
import LoginModal from './components/LoginModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('billing'); // 'billing', 'labels', 'inventory', 'wholesale', 'history', 'dashboard', 'settings'
  const [settings, setSettings] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('nmart_theme') || 'dark');
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [printerConfig, setPrinterConfig] = useState(() => getPrinterConfig());

  useEffect(() => {
    // Check local session
    const saved = localStorage.getItem('nmart_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {}
    }
    loadSettings();
  }, []);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('nmart_theme', newTheme);
    setThemePickerOpen(false);
  };

  const loadSettings = async () => {
    try {
      const res = await api.get('/api/settings');
      if (res.success) {
        setSettings(res.settings);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nmart_user');
    setUser(null);
    setActiveTab('billing');
  };

  if (!user) {
    return <LoginModal onLoginSuccess={(u) => setUser(u)} />;
  }

  const isOwner = user.role === 'owner';

  const navItems = [
    { id: 'billing', label: 'POS Billing', icon: ShoppingCart, role: 'all' },
    { id: 'labels', label: 'QR Label Studio', icon: Tag, role: 'all' },
    { id: 'inventory', label: 'Inventory Catalog', icon: Boxes, role: 'all' },
    { id: 'wholesale', label: 'Wholesale Khata', icon: Users, role: 'all' },
    { id: 'history', label: 'Invoices History', icon: Receipt, role: 'all' },
    { id: 'dashboard', label: 'Owner Analytics', icon: TrendingUp, role: 'owner' },
    { id: 'settings', label: 'Settings & Backup', icon: Settings, role: 'owner' }
  ];

  const visibleNavItems = navItems.filter(item => item.role === 'all' || isOwner);

  return (
    <div className={`min-h-screen theme-${theme} bg-slate-950 flex flex-col font-sans transition-colors duration-200`}>
      {/* Top Header Navigation (With Safe-Area Margin for Phone Notch & Status Bar) */}
      <header className="no-print sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 header-safe-top shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white p-1 shadow-md border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="N Mart" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-black text-white text-sm sm:text-base tracking-tight truncate">
                  {settings?.shop_name || 'N MART'}
                </span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex-shrink-0 ${
                  isOwner
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isOwner ? 'Owner' : 'Staff'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block truncate">
                Logged in as: <strong className="text-slate-200">{user.fullName}</strong>
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden xl:flex items-center gap-1 bg-slate-950/70 p-1 rounded-2xl border border-slate-800">
            {visibleNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right User & Lock Action */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Theme Picker Dropdown */}
            <div className="relative">
              <button
                onClick={() => setThemePickerOpen(!themePickerOpen)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] sm:w-auto sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700 shadow-sm"
                title="Change UI Theme"
              >
                <Palette className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span className="hidden sm:inline">{THEMES.find(t => t.id === theme)?.icon}</span>
              </button>

              {themePickerOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Display Theme
                  </div>
                  {THEMES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleThemeChange(t.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition ${
                        theme === t.id
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{t.icon}</span>
                        <span>{t.name}</span>
                      </span>
                      {theme === t.id && <span className="text-white text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Printer Shortcut */}
            <button
              onClick={() => {
                if (isOwner) setActiveTab('settings');
                else alert(`Active Printer: ${printerConfig.deviceName || 'System Print Dialog'} (${printerConfig.paperWidth})`);
              }}
              className="w-11 h-11 min-w-[44px] min-h-[44px] sm:w-auto sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded-2xl text-xs font-medium transition flex items-center justify-center gap-1.5 border border-slate-700 shadow-sm"
              title={`Printer: ${printerConfig.deviceName || printerConfig.type.toUpperCase()} (${printerConfig.paperWidth})`}
            >
              <Printer className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="hidden lg:inline text-[11px] font-mono">
                {printerConfig.deviceName ? printerConfig.deviceName.slice(0, 8) : printerConfig.paperWidth}
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="w-11 h-11 min-w-[44px] min-h-[44px] sm:w-auto sm:px-3.5 sm:py-2 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 text-slate-300 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700/80 shadow-sm"
              title="Lock / Logout Terminal"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className="hidden sm:inline">Lock</span>
            </button>

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden w-11 h-11 min-w-[44px] min-h-[44px] p-2 rounded-2xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700/80 shadow-sm"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu for XL screens */}
        {mobileMenuOpen && (
          <div className="xl:hidden mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {visibleNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 text-emerald-400" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main View Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-20 xl:pb-6">
        {activeTab === 'billing' && (
          <BillingView user={user} settings={settings} />
        )}
        {activeTab === 'labels' && (
          <LabelPrintView settings={settings} />
        )}
        {activeTab === 'inventory' && (
          <InventoryView
            user={user}
            settings={settings}
            onPrintProductLabel={() => setActiveTab('labels')}
          />
        )}
        {activeTab === 'wholesale' && (
          <WholesaleView settings={settings} user={user} />
        )}
        {activeTab === 'history' && (
          <SalesHistoryView user={user} settings={settings} />
        )}
        {activeTab === 'dashboard' && isOwner && (
          <OwnerDashboardView
            user={user}
            settings={settings}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}
        {activeTab === 'settings' && isOwner && (
          <SettingsView
            settings={settings}
            onSettingsUpdated={loadSettings}
            user={user}
            theme={theme}
            onThemeChange={handleThemeChange}
            printerConfig={printerConfig}
            onPrinterConfigChange={setPrinterConfig}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Handheld Phone App Experience) */}
      <div className="no-print xl:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 py-1.5 px-3 z-40 flex justify-around items-center">
        <button
          onClick={() => setActiveTab('billing')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === 'billing' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Billing</span>
        </button>

        <button
          onClick={() => setActiveTab('labels')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === 'labels' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Tag className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">QR Labels</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === 'inventory' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Boxes className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Stock</span>
        </button>

        <button
          onClick={() => setActiveTab('wholesale')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === 'wholesale' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Wholesale</span>
        </button>

        {isOwner ? (
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
              activeTab === 'dashboard' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Owner</span>
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
              activeTab === 'history' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">History</span>
          </button>
        )}
      </div>
    </div>
  );
}
