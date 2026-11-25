import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  Filter,
  Check,
  X,
  PackagePlus,
  Tag,
  FolderPlus,
  Folder,
  Tags,
  Sparkles
} from 'lucide-react';
import { api } from '../utils/api';

const DEFAULT_CATEGORIES = [
  'Groceries',
  'Snacks & Confectionery',
  'Beverages & Soft Drinks',
  'Dairy & Eggs',
  'Household & Cleaning',
  'Personal Care & Hygiene',
  'Spices, Masalas & Oils',
  'Grains, Rice & Pulses',
  'Bakery & Bread',
  'Packaged Foods',
  'Stationery & General'
];

export default function InventoryView({ user, settings, onPrintProductLabel }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'low', 'out'
  const [loading, setLoading] = useState(true);

  // Modals
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [inlineNewCategoryOpen, setInlineNewCategoryOpen] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    barcode_qr: '',
    name: '',
    category: '',
    brand: '',
    unit: 'pcs',
    retail_price: '',
    wholesale_price: '',
    cost_price: '',
    current_stock: '',
    min_stock_alert: '5',
    location: ''
  });

  // Adjust Form State
  const [adjustData, setAdjustData] = useState({
    change_quantity: '',
    transaction_type: 'purchase', // 'purchase' | 'adjustment' | 'return'
    notes: ''
  });

  const currency = settings?.currency_symbol || '₹';
  const isOwner = user?.role === 'owner';

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const [resProd, resSettings] = await Promise.all([
        api.get('/api/products'),
        api.get('/api/settings').catch(() => ({ settings: {} }))
      ]);

      let savedCats = [];
      if (resSettings?.settings?.inventory_categories) {
        try {
          savedCats = JSON.parse(resSettings.settings.inventory_categories);
        } catch (e) {}
      }

      if (resProd.success) {
        setProducts(resProd.products);
        const prodCats = resProd.products.map(p => p.category).filter(Boolean);
        const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...savedCats, ...prodCats]));
        setCategories(combined);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (catName) => {
    const trimmed = (catName || '').trim();
    if (!trimmed) return null;
    const exists = categories.some(c => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert(`Category "${trimmed}" already exists.`);
      return trimmed;
    }

    const updated = [...categories, trimmed];
    setCategories(updated);
    setNewCategoryName('');

    try {
      await api.post('/api/settings', {
        inventory_categories: JSON.stringify(updated)
      });
    } catch (err) {
      console.warn('Failed to save category to settings', err);
    }
    return trimmed;
  };

  const handleDeleteCategory = async (catToDelete) => {
    const inUseCount = products.filter(p => p.category === catToDelete).length;
    if (inUseCount > 0) {
      alert(`Cannot delete "${catToDelete}" because ${inUseCount} item(s) are currently categorized under it. Reassign or delete those items first.`);
      return;
    }

    if (!window.confirm(`Delete unused category "${catToDelete}"?`)) return;

    const updated = categories.filter(c => c !== catToDelete);
    setCategories(updated);
    if (categoryFilter === catToDelete) setCategoryFilter('All');

    try {
      await api.post('/api/settings', {
        inventory_categories: JSON.stringify(updated)
      });
    } catch (err) {
      console.warn('Failed to delete category', err);
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setInlineNewCategoryOpen(false);
    setInlineCategoryName('');
    setFormData({
      barcode_qr: `NM-${Date.now().toString().slice(-6)}`,
      name: '',
      category: categories[0] || 'Groceries',
      brand: '',
      unit: 'pcs',
      retail_price: '',
      wholesale_price: '',
      cost_price: '',
      current_stock: '10',
      min_stock_alert: '5',
      location: ''
    });
    setAddEditModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setInlineNewCategoryOpen(false);
    setInlineCategoryName('');
    setFormData({
      barcode_qr: p.barcode_qr,
      name: p.name,
      category: p.category,
      brand: p.brand || '',
      unit: p.unit || 'pcs',
      retail_price: p.retail_price,
      wholesale_price: p.wholesale_price,
      cost_price: p.cost_price !== undefined ? p.cost_price : '',
      current_stock: p.current_stock,
      min_stock_alert: p.min_stock_alert,
      location: p.location || ''
    });
    setAddEditModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.retail_price) {
      alert("Name and Retail Price are required.");
      return;
    }

    try {
      if (editingProduct) {
        const res = await api.put(`/api/products/${editingProduct.id}`, formData);
        if (res.success) {
          setAddEditModalOpen(false);
          loadProducts();
        } else {
          alert(res.error || 'Failed to update product');
        }
      } else {
        const res = await api.post('/api/products', formData);
        if (res.success) {
          setAddEditModalOpen(false);
          loadProducts();
        } else {
          alert(res.error || 'Failed to create product');
        }
      }
    } catch (err) {
      alert('Error saving product: ' + err.message);
    }
  };

  const handleDeleteProduct = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const res = await api.delete(`/api/products/${id}`);
      if (res.success) {
        loadProducts();
      } else {
        alert(res.error || 'Failed to delete product');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleOpenAdjust = (p) => {
    setAdjustingProduct(p);
    setAdjustData({
      change_quantity: '',
      transaction_type: 'purchase',
      notes: ''
    });
    setAdjustModalOpen(true);
  };

  const handleSaveAdjust = async (e) => {
    e.preventDefault();
    const qty = Number(adjustData.change_quantity);
    if (!qty) {
      alert("Please enter a valid quantity.");
      return;
    }

    try {
      const finalChange = adjustData.transaction_type === 'adjustment' && qty > 0 && adjustData.notes.includes('damage')
        ? -Math.abs(qty)
        : qty;

      const res = await api.post('/api/products/adjust-stock', {
        product_id: adjustingProduct.id,
        change_quantity: finalChange,
        transaction_type: adjustData.transaction_type,
        notes: adjustData.notes,
        staff_name: user?.fullName || 'Staff'
      });

      if (res.success) {
        setAdjustModalOpen(false);
        loadProducts();
      } else {
        alert(res.error || 'Failed to adjust stock');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.barcode_qr.toLowerCase().includes(search.toLowerCase()) ||
                          (p.brand && p.brand.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
    let matchesStock = true;
    if (stockFilter === 'low') matchesStock = p.current_stock <= p.min_stock_alert && p.current_stock > 0;
    if (stockFilter === 'out') matchesStock = p.current_stock <= 0;

    return matchesSearch && matchesCat && matchesStock;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Boxes className="w-7 h-7 text-emerald-400" />
            Inventory & Catalog Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {products.length} products tracked • Real-time stock alerts & barcodes
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setCategoryManagerOpen(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 font-bold rounded-2xl text-xs flex items-center gap-2 shadow-sm transition"
            title="Manage and create categories"
          >
            <FolderPlus className="w-4 h-4 text-emerald-400" />
            <span>Categories ({categories.length})</span>
          </button>

          {isOwner && (
            <button
              onClick={handleOpenAdd}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition"
            >
              <Plus className="w-4 h-4" /> Add New Item
            </button>
          )}
        </div>
      </div>

      {/* Category Quick Filter & Management Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          type="button"
          onClick={() => setCategoryFilter('All')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
            categoryFilter === 'All'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700'
          }`}
        >
          <span>All</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${categoryFilter === 'All' ? 'bg-emerald-700 text-white' : 'bg-slate-900 text-slate-400'}`}>
            {products.length}
          </span>
        </button>

        {categories.map(cat => {
          const count = products.filter(p => p.category === cat).length;
          const isActive = categoryFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 flex-shrink-0 ${
                isActive
                  ? 'bg-emerald-600 text-white font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              <span>{cat}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-emerald-700 text-white' : 'bg-slate-900 text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setCategoryManagerOpen(true)}
          className="px-3 py-1.5 rounded-xl font-bold text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/40 flex items-center gap-1 flex-shrink-0 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Category
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-4 shadow-xl flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, barcode or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Category dropdown */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
        >
          <option value="All">All Categories ({products.length})</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Stock Filter Pills */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs">
          <button
            onClick={() => setStockFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition ${stockFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            All Stock
          </button>
          <button
            onClick={() => setStockFilter('low')}
            className={`px-3 py-1 rounded-lg font-medium transition ${stockFilter === 'low' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setStockFilter('out')}
            className={`px-3 py-1 rounded-lg font-medium transition ${stockFilter === 'out' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">BARCODE / SKU</th>
                <th className="py-3 px-4">ITEM NAME</th>
                <th className="py-3 px-4">CATEGORY</th>
                <th className="py-3 px-4 text-center">STOCK</th>
                <th className="py-3 px-4 text-right">RETAIL PRICE</th>
                <th className="py-3 px-4 text-right">WHOLESALE PRICE</th>
                {isOwner && <th className="py-3 px-4 text-right">COST PRICE</th>}
                {isOwner && <th className="py-3 px-4 text-center">PROFIT MARGIN</th>}
                <th className="py-3 px-4 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-slate-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 9 : 7} className="py-12 text-center text-slate-500">
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isLow = p.current_stock <= p.min_stock_alert && p.current_stock > 0;
                  const isOut = p.current_stock <= 0;
                  const marginPct = isOwner && p.cost_price > 0
                    ? (((p.retail_price - p.cost_price) / p.retail_price) * 100).toFixed(1)
                    : null;

                  return (
                    <tr key={p.id} className="hover:bg-slate-750 transition">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {p.barcode_qr}
                      </td>
                      <td className="py-3 px-4 font-medium text-white max-w-xs">
                        <div>{p.name}</div>
                        {p.location && (
                          <span className="text-[10px] text-slate-500 font-normal">Loc: {p.location}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {p.category}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full font-bold text-[11px] ${
                          isOut
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : isLow
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}>
                          {p.current_stock} {p.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {currency}{p.retail_price}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-300 font-semibold">
                        {currency}{p.wholesale_price}
                      </td>
                      {isOwner && (
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          {currency}{p.cost_price}
                        </td>
                      )}
                      {isOwner && (
                        <td className="py-3 px-4 text-center">
                          {marginPct !== null ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 font-bold text-[10px]">
                              +{marginPct}%
                            </span>
                          ) : '-'}
                        </td>
                      )}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenAdjust(p)}
                            className="p-1.5 rounded-lg bg-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                            title="Stock In / Adjust"
                          >
                            <PackagePlus className="w-4 h-4 text-emerald-400" />
                          </button>
                          {isOwner && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(p)}
                                className="p-1.5 rounded-lg bg-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                                title="Edit Product"
                              >
                                <Edit2 className="w-4 h-4 text-indigo-400" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="p-1.5 rounded-lg bg-slate-700/60 text-slate-300 hover:text-rose-400 hover:bg-slate-700 transition"
                                title="Delete Product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
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

      {/* Add / Edit Product Modal */}
      {addEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">
                {editingProduct ? 'Edit Product Catalog Entry' : 'Add New Inventory Item'}
              </h3>
              <button
                onClick={() => setAddEditModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Barcode / SKU *</label>
                  <input
                    type="text"
                    required
                    value={formData.barcode_qr}
                    onChange={(e) => setFormData({ ...formData, barcode_qr: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-medium block">Category *</label>
                    <button
                      type="button"
                      onClick={() => setInlineNewCategoryOpen(!inlineNewCategoryOpen)}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold"
                    >
                      <Plus className="w-3 h-3" /> New
                    </button>
                  </div>

                  {!inlineNewCategoryOpen ? (
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                          setInlineNewCategoryOpen(true);
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-emerald-500"
                    >
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__add_new__">+ Add New Category...</option>
                    </select>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Type new category..."
                        value={inlineCategoryName}
                        onChange={(e) => setInlineCategoryName(e.target.value)}
                        className="flex-1 bg-slate-800 border border-emerald-500 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none font-medium"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (inlineCategoryName.trim()) {
                            const created = await handleAddCategory(inlineCategoryName);
                            if (created) {
                              setFormData({ ...formData, category: created });
                              setInlineCategoryName('');
                              setInlineNewCategoryOpen(false);
                            }
                          }
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineNewCategoryOpen(false)}
                        className="px-2 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Product Title / Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Retail MRP ({currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.retail_price}
                    onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-indigo-300 font-medium block mb-1">Wholesale Rate ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.wholesale_price}
                    onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                    className="w-full bg-slate-800 border border-indigo-700/60 rounded-xl px-3 py-2 text-indigo-300 font-mono font-bold focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Cost Price ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Current Stock</label>
                  <input
                    type="number"
                    value={formData.current_stock}
                    onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="packet">Packet</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="ltr">Litre (ltr)</option>
                    <option value="box">Box / Carton</option>
                    <option value="pack">Pack / Bundle</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Min Stock Alert</label>
                  <input
                    type="number"
                    value={formData.min_stock_alert}
                    onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg shadow-emerald-900/40"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Stock Adjustment Modal */}
      {adjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-sm">Stock In / Adjustment</h3>
                <p className="text-xs text-slate-400 line-clamp-1">{adjustingProduct.name}</p>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-3 text-xs">
              <div className="bg-slate-800/80 p-3 rounded-xl flex justify-between items-center text-slate-300">
                <span>Current Stock on Hand:</span>
                <span className="font-mono font-bold text-white text-sm">
                  {adjustingProduct.current_stock} {adjustingProduct.unit}
                </span>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Adjustment Type</label>
                <select
                  value={adjustData.transaction_type}
                  onChange={(e) => setAdjustData({ ...adjustData, transaction_type: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="purchase">Stock Inward / Purchase (Add Stock)</option>
                  <option value="adjustment">Stock Adjustment (Audit / Correction)</option>
                  <option value="return">Customer Return</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Quantity ({adjustData.transaction_type === 'purchase' ? 'Add' : '+ or -'})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 50"
                  value={adjustData.change_quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, change_quantity: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Reason / Supplier Invoice Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Batch purchase from Metro Cash & Carry"
                  value={adjustData.notes}
                  onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/40"
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Category Manager Modal                                         */}
      {/* ============================================================== */}
      {categoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Category Management</h3>
                  <p className="text-xs text-slate-400">Add, organize and customize stock product categories</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCategoryManagerOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add New Category Input */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newCategoryName.trim()) return;
                await handleAddCategory(newCategoryName);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Type new category name (e.g. Frozen Foods, Pet Care)..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                autoFocus
              />
              <button
                type="submit"
                disabled={!newCategoryName.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </form>

            {/* Quick Suggestions */}
            <div>
              <span className="text-[11px] text-slate-400 font-semibold block mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Quick Suggestions (Click to Add):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Frozen Foods',
                  'Dry Fruits & Nuts',
                  'Baby Care',
                  'Pet Supplies',
                  'Organic & Diet',
                  'Kitchen & Hardware',
                  'Pooja & Festive Items',
                  'Ice Creams & Desserts'
                ]
                  .filter(s => !categories.includes(s))
                  .map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleAddCategory(s)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] border border-slate-700 transition flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-emerald-400" /> {s}
                    </button>
                  ))}
              </div>
            </div>

            {/* Categories List */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-semibold text-slate-300">Active Categories ({categories.length})</span>
                <span>Items in Stock</span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {categories.map(cat => {
                  const count = products.filter(p => p.category === cat).length;
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="font-bold text-white">{cat}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          count > 0 ? 'bg-slate-700 text-emerald-300 font-bold' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {count} item{count === 1 ? '' : 's'}
                        </span>
                        {count === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                            title="Delete unused category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic pr-1">In use</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setCategoryManagerOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
