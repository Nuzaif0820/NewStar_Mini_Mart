import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import {
  Camera,
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  CreditCard,
  Banknote,
  QrCode,
  Users,
  Percent,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Receipt
} from 'lucide-react';
import { api } from '../utils/api';
import { playBeep } from '../utils/sound';
import CameraScannerModal from '../components/CameraScannerModal';
import ReceiptPrintModal from '../components/ReceiptPrintModal';

export default function BillingView({ user, settings }) {
  // Sales mode: 'retail' | 'wholesale'
  const [saleType, setSaleType] = useState('retail');

  // Products catalog
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Cart state: Array of { product_id, name, barcode_qr, unit, unit_price, cost_price, quantity, total_price, current_stock }
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState('percent'); // 'percent' | 'amount'
  const [discountValue, setDiscountValue] = useState('');
  const [taxRate, setTaxRate] = useState(Number(settings?.default_tax_rate || 0));

  // Wholesale customer selection
  const [wholesaleCustomers, setWholesaleCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');

  // Modals
  const [scannerOpen, setScannerOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [mobileTab, setMobileTab] = useState('catalog'); // 'catalog' | 'cart'
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const cartSectionRef = useRef(null);

  const handleOpenCart = () => {
    setScannerOpen(false);
    setMobileTab('cart');
    setTimeout(() => {
      cartSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Payment inputs
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'upi' | 'card' | 'credit'
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  const searchInputRef = useRef(null);

  const currency = settings?.currency_symbol || '₹';
  const upiId = settings?.upi_id || 'nmart@upi';
  const shopName = settings?.shop_name || 'N Mart';

  useEffect(() => {
    loadProducts();
    loadWholesaleCustomers();
  }, [saleType]);

  const loadProducts = async () => {
    try {
      const res = await api.get('/api/products');
      if (res.success) {
        setProducts(res.products);
        const cats = Array.from(new Set(res.products.map(p => p.category))).filter(Boolean);
        setCategories(cats);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadWholesaleCustomers = async () => {
    try {
      const res = await api.get('/api/wholesale/customers');
      if (res.success) {
        setWholesaleCustomers(res.customers);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Adjust prices in existing cart when switching between Retail and Wholesale
  const handleSaleTypeChange = (newType) => {
    setSaleType(newType);
    setCart(prevCart =>
      prevCart.map(item => {
        const prod = products.find(p => p.id === item.product_id);
        const price = prod
          ? (newType === 'wholesale' ? prod.wholesale_price : prod.retail_price)
          : item.unit_price;
        return {
          ...item,
          unit_price: price,
          total_price: price * item.quantity
        };
      })
    );

    if (newType === 'retail') {
      setSelectedCustomerId('');
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
    }
  };

  const handleSelectCustomer = (e) => {
    const custId = e.target.value;
    setSelectedCustomerId(custId);
    if (custId) {
      const cust = wholesaleCustomers.find(c => c.id === Number(custId));
      if (cust) {
        setCustomerName(cust.business_name || cust.name);
        setCustomerPhone(cust.phone || '');
      }
    } else {
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
    }
  };

  // Add product to cart by object or barcode
  const addToCart = (product, quantityToAdd = 1) => {
    if (!product) return;

    playBeep('success');

    const effectivePrice = saleType === 'wholesale' ? product.wholesale_price : product.retail_price;

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.product_id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + quantityToAdd;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          total_price: effectivePrice * newQty
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            name: product.name,
            barcode_qr: product.barcode_qr,
            unit: product.unit || 'pcs',
            unit_price: effectivePrice,
            cost_price: product.cost_price || 0,
            quantity: quantityToAdd,
            total_price: effectivePrice * quantityToAdd,
            current_stock: product.current_stock
          }
        ];
      }
    });
  };

  // Barcode / QR scan handler
  const handleScanCode = async (code) => {
    if (!code) return { success: false, message: 'Empty scan code' };
    let clean = String(code).trim();
    if (clean.includes('/')) {
      const parts = clean.split('/');
      clean = parts[parts.length - 1];
    }
    clean = clean.replace(/['"]/g, '').trim();
    const cleanLower = clean.toLowerCase();

    // 1. Check local loaded products
    const foundLocal = products.find(p => {
      const pCode = (p.barcode_qr || '').trim().toLowerCase();
      const pId = String(p.id || '').trim().toLowerCase();
      const pName = (p.name || '').trim().toLowerCase();
      return pCode === cleanLower || pId === cleanLower || pName === cleanLower;
    });

    if (foundLocal) {
      addToCart(foundLocal, 1);
      return { success: true, product: foundLocal };
    }

    // 2. Fetch from server/Supabase in case newly created or not yet cached
    try {
      const res = await api.get(`/api/products/scan/${encodeURIComponent(clean)}`);
      if (res.success && res.product) {
        setProducts(prev => {
          if (prev.some(p => p.id === res.product.id)) return prev;
          return [...prev, res.product];
        });
        addToCart(res.product, 1);
        return { success: true, product: res.product };
      } else {
        playBeep('error');
        return { success: false, message: `Product not found: ${clean}` };
      }
    } catch (e) {
      playBeep('error');
      return { success: false, message: `Product not found: ${clean}` };
    }
  };

  const updateCartItemQuantity = (index, delta) => {
    setCart(prev => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index] = {
        ...item,
        quantity: newQty,
        total_price: item.unit_price * newQty
      };
      return updated;
    });
  };

  const removeCartItem = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear all items from current cart?')) {
      setCart([]);
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const discountVal = Math.max(0, Number(discountValue) || 0);
  const discountAmount = discountType === 'percent'
    ? (subtotal * Math.min(100, discountVal)) / 100
    : Math.min(subtotal, discountVal);
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableSubtotal * (Number(taxRate) || 0)) / 100;
  const grandTotal = Math.round(taxableSubtotal + taxAmount);

  // Cash return calculation
  const numTendered = Number(tenderedAmount) || 0;
  const changeDue = Math.max(0, numTendered - grandTotal);
  const balanceDue = paymentMode === 'credit' ? grandTotal : Math.max(0, grandTotal - numTendered);

  // Dynamic Bharat UPI URI
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=Invoice%20Checkout`;

  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    setTenderedAmount(String(grandTotal));
    setPaymentModalOpen(true);
  };

  const handleCheckoutSubmit = async () => {
    if (cart.length === 0 || isProcessingSale) return;

    if (paymentMode === 'credit' && saleType === 'retail' && !selectedCustomerId) {
      alert("Please select a registered wholesale customer for Khata / Credit billing.");
      return;
    }

    setIsProcessingSale(true);
    try {
      const payload = {
        sale_type: saleType,
        customer_name: customerName,
        customer_phone: customerPhone,
        wholesale_customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
        staff_id: user?.id || null,
        staff_name: user?.fullName || 'Cashier',
        items: cart.map(i => ({
          product_id: i.product_id,
          product_name: i.name,
          barcode_qr: i.barcode_qr,
          unit: i.unit,
          unit_price: i.unit_price,
          cost_price: i.cost_price,
          quantity: i.quantity,
          total_price: i.total_price
        })),
        subtotal,
        discount: discountAmount,
        tax_amount: taxAmount,
        tax_rate: taxRate,
        total: grandTotal,
        paid_amount: paymentMode === 'credit' ? 0 : (paymentMode === 'cash' ? Math.min(numTendered, grandTotal) : grandTotal),
        change_amount: paymentMode === 'cash' ? changeDue : 0,
        balance_due: paymentMode === 'credit' ? grandTotal : 0,
        payment_mode: paymentMode,
        notes: ''
      };

      const res = await api.post('/api/sales', payload);
      if (res.success && res.sale) {
        playBeep('cash');
        try {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.8 } });
        } catch (e) {}

        setPaymentModalOpen(false);
        setCompletedSale(res.sale);
        setReceiptModalOpen(true);
        setCart([]);
        setDiscountValue('');
        setTenderedAmount('');
        loadProducts(); // refresh local stock
      } else {
        alert(res.error || 'Failed to complete sale');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving bill: ' + err.message);
    } finally {
      setIsProcessingSale(false);
    }
  };

  const filteredCatalog = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.barcode_qr.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-130px)] relative pb-40 lg:pb-0">
      {/* Mobile Top Segmented Tab Switcher */}
      <div className="lg:hidden flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-700/80 shadow-lg gap-2">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            mobileTab === 'catalog'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Search className="w-4 h-4" /> Products Catalog
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 relative ${
            mobileTab === 'cart'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Active Cart</span>
          {cart.length > 0 && (
            <span className="px-2 py-0.5 bg-emerald-400 text-slate-950 text-[10px] font-black rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* LEFT COLUMN: Products Catalog & Scanner trigger */}
      <div className={`flex-1 flex-col gap-4 ${mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'}`}>
        {/* Sales Mode & Mobile Scanner Bar */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
          {/* Retail vs Wholesale Switch */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-700">
            <button
              onClick={() => handleSaleTypeChange('retail')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                saleType === 'retail'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Retail Sale
            </button>
            <button
              onClick={() => handleSaleTypeChange('wholesale')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                saleType === 'wholesale'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" /> Wholesale Sale
            </button>
          </div>

          {/* Mobile Camera Scan & Quick Cart Action */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition transform active:scale-95"
            >
              <Camera className="w-4 h-4 animate-pulse" />
              <span>Scan Camera (QR / Barcode)</span>
            </button>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleOpenCart}
                className="px-3.5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition transform active:scale-95 shrink-0"
                title="View Active Cart"
              >
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                <span>Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
              </button>
            )}
          </div>
        </div>

        {/* Wholesale Customer Banner if Wholesale mode active */}
        {saleType === 'wholesale' && (
          <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-3xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide block mb-1">
                Select Wholesale Client / Khata
              </label>
              <select
                value={selectedCustomerId}
                onChange={handleSelectCustomer}
                className="w-full bg-slate-900 border border-indigo-700/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
              >
                <option value="">-- Choose Registered Wholesale Buyer --</option>
                {wholesaleCustomers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.business_name} ({c.name}) - Khata: {currency}{c.outstanding_balance}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomerId && (
              <div className="flex items-center gap-4 text-xs text-indigo-200 bg-indigo-900/50 px-3 py-2 rounded-xl border border-indigo-700/50">
                <div>
                  <span className="text-[10px] text-indigo-400 block">Phone</span>
                  <span className="font-mono font-bold">{customerPhone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-400 block">Current Khata Due</span>
                  <span className="font-mono font-bold text-rose-300">
                    {currency}{wholesaleCustomers.find(c => c.id === Number(selectedCustomerId))?.outstanding_balance || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search & Category Filter */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-4 shadow-xl flex flex-col gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product by name or barcode (Press Enter to add)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredCatalog.length > 0) {
                    addToCart(filteredCatalog[0], 1);
                    setSearchQuery('');
                  } else if (searchQuery.trim()) {
                    await handleScanCode(searchQuery.trim());
                    setSearchQuery('');
                  }
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === 'All'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              All Items
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === c
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 bg-slate-800/60 border border-slate-700/80 rounded-3xl p-4 shadow-xl overflow-y-auto max-h-[500px]">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCatalog.map(p => {
              const displayPrice = saleType === 'wholesale' ? p.wholesale_price : p.retail_price;
              const isLowStock = p.current_stock <= p.min_stock_alert;
              const isOutOfStock = p.current_stock <= 0;

              return (
                <div
                  key={p.id}
                  onClick={() => !isOutOfStock && addToCart(p, 1)}
                  className={`relative p-3 rounded-2xl border transition flex flex-col justify-between cursor-pointer group select-none ${
                    isOutOfStock
                      ? 'bg-slate-900/40 border-slate-800 opacity-60 cursor-not-allowed'
                      : 'bg-slate-900/80 border-slate-700/70 hover:border-emerald-500/80 hover:bg-slate-850 hover:shadow-lg'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-mono text-emerald-400">{p.barcode_qr}</span>
                      <span className={`px-1.5 py-0.5 rounded-md font-semibold ${
                        isOutOfStock
                          ? 'bg-rose-500/20 text-rose-400'
                          : isLowStock
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {p.current_stock} {p.unit}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-emerald-300">
                      {p.name}
                    </h4>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800">
                    <div>
                      <div className="text-xs font-black text-white font-mono">
                        {currency}{displayPrice}
                      </div>
                      {saleType === 'wholesale' && (
                        <div className="text-[9px] text-slate-500 line-through">
                          MRP {currency}{p.retail_price}
                        </div>
                      )}
                    </div>
                    <button
                      disabled={isOutOfStock}
                      className="p-1.5 rounded-xl bg-emerald-600/20 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Active Cart & Checkout Panel */}
      <div
        ref={cartSectionRef}
        className={`w-full lg:w-[420px] bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 shadow-2xl flex-col justify-between ${
          mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <div>
          {/* Mobile Back Button to Catalog */}
          <div className="lg:hidden mb-3">
            <button
              type="button"
              onClick={() => setMobileTab('catalog')}
              className="w-full py-2.5 px-3 bg-slate-700/70 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-600/50 shadow-sm"
            >
              <span>← Back to Catalog / Add More Items</span>
            </button>
          </div>

          {/* Cart Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Active Cart</h3>
                <span className="text-[10px] text-slate-400">{cart.length} unique items</span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="divide-y divide-slate-800/80 max-h-[300px] overflow-y-auto pr-1 my-2">
            {cart.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-400" />
                <p>Your cart is empty.</p>
                <p className="text-[10px] text-slate-600 mt-1">Scan QR codes or select items from catalog</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <h5 className="text-xs font-semibold text-white leading-tight line-clamp-1">{item.name}</h5>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {currency}{item.unit_price} × {item.quantity} = <strong className="text-emerald-400">{currency}{item.total_price.toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
                    <button
                      onClick={() => updateCartItemQuantity(index, -1)}
                      className="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold text-xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-mono font-bold text-white px-1 min-w-[20px] text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartItemQuantity(index, 1)}
                      className="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold text-xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeCartItem(index)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Calculation & Checkout Trigger */}
        <div className="pt-3 border-t border-slate-700/80 space-y-3">
          {/* Quick Discount & Tax row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Discount with Type Toggle (% vs Currency Amount) */}
            <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1 font-semibold text-[11px]">
                  <Percent className="w-3.5 h-3.5 text-emerald-400" /> Discount
                </span>
                {/* Mode Selector Toggle: % vs Exact Amount */}
                <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-2 py-0.5 rounded-md transition ${
                      discountType === 'percent'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    % Percent
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('amount')}
                    className={`px-2 py-0.5 rounded-md transition ${
                      discountType === 'amount'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {currency} Exact
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono text-[11px]">
                    {discountType === 'percent' ? '%' : currency}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={discountType === 'percent' ? 100 : subtotal}
                    step="any"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-6 pr-2.5 py-1 text-right font-mono font-bold text-emerald-400 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Quick Presets based on mode */}
                <div className="flex gap-1">
                  {(discountType === 'percent' ? [5, 10, 20] : [20, 50, 100]).map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDiscountValue(String(val))}
                      className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-mono transition border border-slate-700"
                    >
                      {discountType === 'percent' ? `${val}%` : `${currency}${val}`}
                    </button>
                  ))}
                  {discountValue && (
                    <button
                      type="button"
                      onClick={() => setDiscountValue('')}
                      className="px-1.5 py-1 bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 rounded-lg text-[10px] font-bold"
                      title="Clear discount"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tax / GST Field */}
            <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-700 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">GST / Tax Rate</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {taxAmount > 0 ? `+${currency}${taxAmount.toFixed(2)}` : '0% (Exempt)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  type="number"
                  min="0"
                  max="28"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-right font-mono font-bold text-white text-xs focus:outline-none focus:border-emerald-500"
                />
                <span className="text-slate-400 text-xs font-mono">%</span>
                <div className="flex gap-1">
                  {[0, 5, 12, 18].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTaxRate(r)}
                      className={`px-1.5 py-1 rounded-lg text-[10px] font-mono transition border ${
                        Number(taxRate) === r
                          ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown summary */}
          <div className="space-y-1 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono">{currency}{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400 font-medium">
                <span>
                  Discount ({discountType === 'percent' ? `${discountValue}%` : `Flat ${currency}${discountValue}`}):
                </span>
                <span className="font-mono font-bold">-{currency}{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>GST / Tax ({taxRate}%):</span>
                <span className="font-mono">+{currency}{taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-black text-white pt-2 border-t border-slate-700">
              <span>Grand Total:</span>
              <span className="font-mono text-emerald-400">{currency}{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Checkout CTA */}
          <button
            onClick={handleOpenPayment}
            disabled={cart.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-900/40 transition transform active:scale-98 flex items-center justify-center gap-2"
          >
            <Banknote className="w-5 h-5" />
            <span>PAY {currency}{grandTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanCode}
        onOpenCart={handleOpenCart}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        cartTotal={grandTotal}
        currency={currency}
      />

      {/* Payment & Checkout Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-black text-white text-lg">Checkout & Payment</h3>
                <p className="text-xs text-slate-400">{saleType.toUpperCase()} BILL • {customerName}</p>
                {discountAmount > 0 && (
                  <p className="text-[10px] text-emerald-400 font-mono font-semibold mt-0.5">
                    Discount: -{currency}{discountAmount.toFixed(2)} ({discountType === 'percent' ? `${discountValue}%` : `Flat ${currency}${discountValue}`})
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Total Due</span>
                <span className="font-mono font-black text-xl text-emerald-400">{currency}{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('cash')}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  paymentMode === 'cash'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Banknote className="w-5 h-5" />
                <span className="text-xs font-bold">Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('upi')}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  paymentMode === 'upi'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-5 h-5" />
                <span className="text-xs font-bold">UPI QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('card')}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  paymentMode === 'card'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold">Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('credit')}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  paymentMode === 'credit'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-xs font-bold">Khata</span>
              </button>
            </div>

            {/* Mode-Specific Details */}
            {paymentMode === 'cash' && (
              <div className="space-y-3 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
                <label className="text-xs font-semibold text-slate-300 block">Cash Tendered by Customer</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">{currency}</span>
                  <input
                    type="number"
                    value={tenderedAmount}
                    onChange={(e) => setTenderedAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 font-mono font-bold text-white text-lg focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Quick denomination pills */}
                <div className="flex gap-2 text-xs">
                  {[100, 200, 500, 2000].map(den => (
                    <button
                      key={den}
                      type="button"
                      onClick={() => setTenderedAmount(String(den))}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-700 rounded-lg text-slate-300 font-mono"
                    >
                      +{den}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTenderedAmount(String(grandTotal))}
                    className="px-2.5 py-1 bg-emerald-950 text-emerald-300 hover:bg-emerald-900 rounded-lg font-bold text-xs"
                  >
                    Exact
                  </button>
                </div>

                {changeDue > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-700 text-sm font-bold text-emerald-400">
                    <span>Change to Return:</span>
                    <span className="font-mono text-base">{currency}{changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMode === 'upi' && (
              <div className="text-center bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80 space-y-2">
                <p className="text-xs font-bold text-slate-300">Customer Scans Screen to Pay</p>
                <div className="flex justify-center p-2 bg-white rounded-xl inline-block shadow-md">
                  <QRCodeSVG value={upiUri} size={130} level="M" />
                </div>
                <p className="text-[11px] font-mono text-emerald-400 font-bold">{upiId}</p>
                <p className="text-[10px] text-slate-400">Google Pay • PhonePe • Paytm • BHIM UPI</p>
              </div>
            )}

            {paymentMode === 'credit' && (
              <div className="bg-indigo-950/60 p-4 rounded-2xl border border-indigo-700/80 text-xs text-indigo-200 space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-indigo-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Khata / Credit Sale
                </p>
                <p>
                  This bill of <strong className="text-white">{currency}{grandTotal.toFixed(2)}</strong> will be added to <strong>{customerName}</strong>'s credit ledger balance.
                </p>
              </div>
            )}

            {/* Optional Customer Phone for SMS / WhatsApp Receipt */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Customer Phone (Optional for WhatsApp Bill)</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition"
              >
                Back to Cart
              </button>
              <button
                type="button"
                onClick={handleCheckoutSubmit}
                disabled={isProcessingSale}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-900/40 transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isProcessingSale ? 'Saving...' : 'Confirm & Bill'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Receipt Modal */}
      <ReceiptPrintModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        sale={completedSale}
        settings={settings}
      />

      {/* Floating Bottom Cart Action Bar on Mobile: positioned safely above the bottom nav bar (bottom-[72px]) to avoid any icon overlap */}
      {cart.length > 0 && mobileTab === 'catalog' && !isSearchFocused && (
        <div className="lg:hidden fixed bottom-[72px] inset-x-4 z-30 transition-all duration-300">
          <button
            type="button"
            onClick={handleOpenCart}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs rounded-2xl shadow-2xl shadow-emerald-950/80 flex items-center justify-between border border-emerald-400/40 active:scale-98 transition transform"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-black/25 rounded-xl">
                <ShoppingCart className="w-4 h-4 text-emerald-200" />
              </div>
              <div className="text-left">
                <span className="font-bold block leading-tight">
                  Open Cart ({cart.reduce((s, i) => s + i.quantity, 0)} {cart.length === 1 ? 'item' : 'items'})
                </span>
                <span className="text-[10px] text-emerald-200/90 font-normal">Tap to review & checkout</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-sm font-black">
              <span>{currency}{grandTotal.toFixed(2)}</span>
              <span className="text-base font-sans">→</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
