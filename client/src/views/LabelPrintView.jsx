import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  Tag,
  CheckSquare,
  Square,
  Eye,
  LayoutGrid,
  Image as ImageIcon,
  Calendar,
  Upload,
  Sliders,
  Maximize2,
  MoveHorizontal,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Layers,
  Sparkles,
  ShieldCheck,
  RotateCw
} from 'lucide-react';
import { api } from '../utils/api';

function formatDisplayDate(isoDateStr) {
  if (!isoDateStr) return '';
  try {
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch (e) {}
  return isoDateStr;
}

export default function LabelPrintView({ settings }) {
  const [products, setProducts] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [quantities, setQuantities] = useState({});
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active studio customizer tab: 'dimensions' | 'layout' | 'sizes' | 'dates' | 'branding'
  const [designTab, setDesignTab] = useState('dimensions');

  // ==========================================
  // 1. DIMENSIONS & HORIZONTAL ELONGATION
  // ==========================================
  const [dimensionPreset, setDimensionPreset] = useState('elongated-70x25');
  const [labelWidthMm, setLabelWidthMm] = useState(70); // 25mm to 120mm
  const [labelHeightMm, setLabelHeightMm] = useState(25); // 15mm to 80mm
  const [labelColumns, setLabelColumns] = useState(1); // 1 (Roll), 2, 3 (A4 24), 4 (A4 40)
  const [labelGapMm, setLabelGapMm] = useState(2); // Gap between stickers in mm
  const [stickerPaddingMm, setStickerPaddingMm] = useState(2); // Inner padding in mm
  const [sheetType, setSheetType] = useState('roll'); // 'roll' (Continuous thermal) | 'sheet' (A4 pages)
  const [borderStyle, setBorderStyle] = useState('dashed'); // 'dashed' | 'solid' | 'none'

  // ==========================================
  // 2. CONTENT PLACEMENT & LAYOUT MODE
  // ==========================================
  // 'horizontal-left' (QR Left, Info Right - Elongated Best)
  // 'horizontal-right' (Info Left, QR Right)
  // 'three-zone' (QR Left | Info Center | Price Box Right)
  // 'vertical-stacked' (Traditional Stacked)
  const [layoutMode, setLayoutMode] = useState('horizontal-left');
  const [textAlign, setTextAlign] = useState('left'); // 'left' | 'center' | 'right'
  const [priceStyle, setPriceStyle] = useState('boxed'); // 'boxed' | 'standard' | 'badge'

  // ==========================================
  // 3. GRANULAR CONTENT SIZES
  // ==========================================
  const [productNameSize, setProductNameSize] = useState('md'); // 'xs'(8px) | 'sm'(10px) | 'md'(12px) | 'lg'(14px) | 'xl'(16px)
  const [priceSize, setPriceSize] = useState('lg'); // 'sm'(11px) | 'md'(14px) | 'lg'(17px) | 'xl'(20px) | 'giant'(24px)
  const [qrPixelSize, setQrPixelSize] = useState(48); // 24 to 80px
  const [dateFontSize, setDateFontSize] = useState('sm'); // 'xs'(6.5px) | 'sm'(8px) | 'md'(9.5px)
  const [shopTitleSize, setShopTitleSize] = useState('sm'); // 'xs'(8px) | 'sm'(10px) | 'md'(12px)
  const [logoHeightPx, setLogoHeightPx] = useState(14); // 8px to 28px

  // ==========================================
  // 4. DISPLAY TOGGLES & BRANDING
  // ==========================================
  const [showShopName, setShowShopName] = useState(true);
  const [customShopName, setCustomShopName] = useState(settings?.shop_name || 'N Mart');
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [customSubtitle, setCustomSubtitle] = useState(settings?.tagline || 'Best Quality Guaranteed');
  const [showRetailPrice, setShowRetailPrice] = useState(true);
  const [showWholesalePrice, setShowWholesalePrice] = useState(false);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [currency] = useState(settings?.currency_symbol || '₹');

  // Logo on Label
  const [showLogo, setShowLogo] = useState(true);
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const logoInputRef = useRef(null);

  // Manufacture & Best Before Dates
  const [showMfgDate, setShowMfgDate] = useState(true);
  const [mfgDate, setMfgDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showExpDate, setShowExpDate] = useState(true);
  const [expDateMode, setExpDateMode] = useState('duration'); // 'duration' | 'date'
  const [expDurationText, setExpDurationText] = useState('Best Before 6 Months');
  const [expDate, setExpDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });

  // Additional Label Elements
  const [showNetQty, setShowNetQty] = useState(true);
  const [showBatchNo, setShowBatchNo] = useState(false);
  const [batchNo, setBatchNo] = useState('NM-B101');
  const [showFssai, setShowFssai] = useState(false);
  const [fssaiText, setFssaiText] = useState('FSSAI: 10024000000001');
  const [showOfferBadge, setShowOfferBadge] = useState(false);
  const [offerBadgeText, setOfferBadgeText] = useState('SPECIAL OFFER');

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogoUrl(ev.target.result);
        setShowLogo(true);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/products');
      if (res.success) {
        setProducts(res.products);
        const cats = Array.from(new Set(res.products.map(p => p.category))).filter(Boolean);
        setCategories(cats);

        // Pre-select first 4 products with 4 labels each
        const initialSelected = new Set();
        const initialQty = {};
        res.products.slice(0, 4).forEach(p => {
          initialSelected.add(p.id);
          initialQty[p.id] = 4;
        });
        setSelectedProductIds(initialSelected);
        setQuantities(initialQty);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyDimensionPreset = (presetKey) => {
    setDimensionPreset(presetKey);
    if (presetKey === 'elongated-70x25') {
      setLabelWidthMm(70);
      setLabelHeightMm(25);
      setLabelColumns(1);
      setSheetType('roll');
      setLayoutMode('horizontal-left');
      setQrPixelSize(46);
      setPriceSize('lg');
      setProductNameSize('md');
    } else if (presetKey === 'elongated-80x30') {
      setLabelWidthMm(80);
      setLabelHeightMm(30);
      setLabelColumns(1);
      setSheetType('roll');
      setLayoutMode('three-zone');
      setQrPixelSize(54);
      setPriceSize('xl');
      setProductNameSize('lg');
    } else if (presetKey === 'elongated-60x20') {
      setLabelWidthMm(60);
      setLabelHeightMm(20);
      setLabelColumns(1);
      setSheetType('roll');
      setLayoutMode('horizontal-left');
      setQrPixelSize(38);
      setPriceSize('md');
      setProductNameSize('sm');
    } else if (presetKey === 'barcode-50x25') {
      setLabelWidthMm(50);
      setLabelHeightMm(25);
      setLabelColumns(1);
      setSheetType('roll');
      setLayoutMode('horizontal-left');
      setQrPixelSize(42);
      setPriceSize('md');
      setProductNameSize('sm');
    } else if (presetKey === 'roll-50x30') {
      setLabelWidthMm(50);
      setLabelHeightMm(30);
      setLabelColumns(1);
      setSheetType('roll');
      setLayoutMode('horizontal-left');
      setQrPixelSize(46);
      setPriceSize('lg');
      setProductNameSize('md');
    } else if (presetKey === 'large-100x50') {
      setLabelWidthMm(100);
      setLabelHeightMm(50);
      setLabelColumns(1);
      setSheetType('roll');
      setLayoutMode('three-zone');
      setQrPixelSize(70);
      setPriceSize('giant');
      setProductNameSize('xl');
    } else if (presetKey === 'a4-24') {
      setLabelWidthMm(70);
      setLabelHeightMm(37);
      setLabelColumns(3);
      setSheetType('sheet');
      setLayoutMode('horizontal-left');
      setQrPixelSize(48);
      setPriceSize('lg');
      setProductNameSize('md');
    } else if (presetKey === 'a4-40') {
      setLabelWidthMm(48);
      setLabelHeightMm(25);
      setLabelColumns(4);
      setSheetType('sheet');
      setLayoutMode('horizontal-left');
      setQrPixelSize(36);
      setPriceSize('md');
      setProductNameSize('sm');
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (!quantities[id]) {
        setQuantities(prev => ({ ...prev, [id]: 1 }));
      }
    }
    setSelectedProductIds(next);
  };

  const selectAll = () => {
    const next = new Set(products.map(p => p.id));
    const nextQty = { ...quantities };
    products.forEach(p => {
      if (!nextQty[p.id]) nextQty[p.id] = 1;
    });
    setSelectedProductIds(next);
    setQuantities(nextQty);
  };

  const deselectAll = () => {
    setSelectedProductIds(new Set());
  };

  const updateQuantity = (id, delta) => {
    setQuantities(prev => {
      const current = prev[id] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const labelsToPrint = [];
  products.forEach(p => {
    if (selectedProductIds.has(p.id)) {
      const count = quantities[p.id] || 1;
      for (let i = 0; i < count; i++) {
        labelsToPrint.push(p);
      }
    }
  });

  const handlePrint = () => {
    window.print();
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.barcode_qr.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  // Font size mapping helper
  const getTitleClass = () => {
    switch (productNameSize) {
      case 'xs': return 'text-[8.5px] leading-tight';
      case 'sm': return 'text-[10px] leading-tight';
      case 'md': return 'text-[11.5px] leading-snug';
      case 'lg': return 'text-[13.5px] leading-snug';
      case 'xl': return 'text-[15.5px] leading-snug';
      default: return 'text-[11.5px] leading-snug';
    }
  };

  const getPriceClass = () => {
    switch (priceSize) {
      case 'sm': return 'text-[11px]';
      case 'md': return 'text-[13px]';
      case 'lg': return 'text-[16px]';
      case 'xl': return 'text-[19px]';
      case 'giant': return 'text-[24px]';
      default: return 'text-[16px]';
    }
  };

  const getDateClass = () => {
    switch (dateFontSize) {
      case 'xs': return 'text-[6.5px]';
      case 'sm': return 'text-[8px]';
      case 'md': return 'text-[9.5px]';
      default: return 'text-[8px]';
    }
  };

  const getShopTitleClass = () => {
    switch (shopTitleSize) {
      case 'xs': return 'text-[7.5px]';
      case 'sm': return 'text-[9px]';
      case 'md': return 'text-[11px]';
      default: return 'text-[9px]';
    }
  };

  // Dynamic Print CSS Injection
  const printStyles = `
    @media print {
      @page {
        size: ${sheetType === 'roll' ? `${labelWidthMm}mm ${labelHeightMm}mm` : 'A4'};
        margin: ${sheetType === 'roll' ? '0mm' : '4mm'};
      }
      #printable-label-sheet {
        ${sheetType === 'roll'
          ? `display: flex !important; flex-direction: column !important; width: ${labelWidthMm}mm !important; margin: 0 auto !important;`
          : `display: grid !important; grid-template-columns: repeat(${labelColumns}, ${labelWidthMm}mm) !important; gap: ${labelGapMm}mm !important; width: 100% !important; justify-content: center !important; margin: 0 auto !important;`
        }
      }
      .print-label-item {
        width: ${labelWidthMm}mm !important;
        height: ${labelHeightMm}mm !important;
        max-width: ${labelWidthMm}mm !important;
        max-height: ${labelHeightMm}mm !important;
        padding: ${stickerPaddingMm}mm !important;
        box-sizing: border-box !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  `;

  return (
    <div className="space-y-6">
      {/* Inject dynamic media print style */}
      <style>{printStyles}</style>

      {/* Screen-only Controls Header */}
      <div className="no-print bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
              <Tag className="w-7 h-7 text-emerald-400" />
              Advanced QR Label Studio
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Custom horizontal elongation, dimensions, layout placement, and font scalers for thermal roll stickers & A4 sheets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={labelsToPrint.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition active:scale-95"
            >
              <Printer className="w-5 h-5" />
              Print {labelsToPrint.length} Labels ({labelWidthMm}×{labelHeightMm}mm)
            </button>
          </div>
        </div>

        {/* Studio Tabs Navigation */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-slate-700/60 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setDesignTab('dimensions')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
              designTab === 'dimensions'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            <MoveHorizontal className="w-4 h-4" /> 1. Elongation & Dimensions ({labelWidthMm}×{labelHeightMm}mm)
          </button>
          <button
            type="button"
            onClick={() => setDesignTab('layout')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
              designTab === 'layout'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" /> 2. Content Placement & Layout
          </button>
          <button
            type="button"
            onClick={() => setDesignTab('sizes')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
              designTab === 'sizes'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            <Type className="w-4 h-4" /> 3. Adjust Content Sizes
          </button>
          <button
            type="button"
            onClick={() => setDesignTab('dates')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
              designTab === 'dates'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" /> 4. MFG, Expiry & Compliance
          </button>
          <button
            type="button"
            onClick={() => setDesignTab('branding')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
              designTab === 'branding'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            <ImageIcon className="w-4 h-4" /> 5. Logo & Shop Branding
          </button>
        </div>

        {/* TAB 1: DIMENSIONS & HORIZONTAL ELONGATION */}
        {designTab === 'dimensions' && (
          <div className="space-y-4 mt-4 text-xs">
            {/* Quick Presets Bar */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Popular Dimension Presets (Click to apply):
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'elongated-70x25', label: 'Wide Shelf Tag (70×25mm)', desc: 'Elongated' },
                  { id: 'elongated-80x30', label: 'Supermarket Tag (80×30mm)', desc: 'Extra Wide' },
                  { id: 'elongated-60x20', label: 'Compact Elongated (60×20mm)', desc: 'Slim' },
                  { id: 'barcode-50x25', label: 'Standard Barcode (50×25mm)', desc: 'FMCG' },
                  { id: 'roll-50x30', label: 'Thermal Roll (50×30mm)', desc: '1-Col Roll' },
                  { id: 'large-100x50', label: 'Shipping / Box (100×50mm)', desc: 'Large' },
                  { id: 'a4-24', label: 'A4 Sheet 24-Up (70×37mm)', desc: '3 Cols' },
                  { id: 'a4-40', label: 'A4 Sheet 40-Up (48×25mm)', desc: '4 Cols' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyDimensionPreset(p.id)}
                    className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                      dimensionPreset === p.id
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 ring-1 ring-emerald-400'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-700'
                    }`}
                  >
                    <span>{p.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">({p.desc})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Millimeter Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-700/60">
              {/* Width Slider (Horizontal Elongation) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center gap-1">
                    <MoveHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                    Width (Horizontal Elongation)
                  </span>
                  <span className="font-mono text-emerald-400 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {labelWidthMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="120"
                  step="1"
                  value={labelWidthMm}
                  onChange={(e) => {
                    setLabelWidthMm(Number(e.target.value));
                    setDimensionPreset('custom');
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block">Wide tags (70-90mm) fit more details side-by-side</span>
              </div>

              {/* Height Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">Height</span>
                  <span className="font-mono text-emerald-400 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {labelHeightMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="80"
                  step="1"
                  value={labelHeightMm}
                  onChange={(e) => {
                    setLabelHeightMm(Number(e.target.value));
                    setDimensionPreset('custom');
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block">Short height (20-30mm) saves sticker roll paper</span>
              </div>

              {/* Sheet vs Roll Format */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold block">Paper Format & Columns</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSheetType('roll');
                      setLabelColumns(1);
                    }}
                    className={`py-1.5 px-2 rounded-xl text-center font-bold text-[11px] transition ${
                      sheetType === 'roll'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    Thermal Roll (1 Col)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSheetType('sheet');
                      if (labelColumns === 1) setLabelColumns(3);
                    }}
                    className={`py-1.5 px-2 rounded-xl text-center font-bold text-[11px] transition ${
                      sheetType === 'sheet'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    A4 Sheet ({labelColumns} Cols)
                  </button>
                </div>
                {sheetType === 'sheet' && (
                  <div className="flex gap-1 pt-1">
                    {[2, 3, 4, 5].map(col => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setLabelColumns(col)}
                        className={`flex-1 py-1 rounded text-[10px] font-bold ${
                          labelColumns === col ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {col} Cols
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Border & Spacing */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold block">Border & Cutting Guide</label>
                <div className="flex gap-1.5">
                  {['dashed', 'solid', 'none'].map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBorderStyle(b)}
                      className={`flex-1 py-1.5 rounded-xl font-bold uppercase text-[10px] transition ${
                        borderStyle === b
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Inner Margin:</span>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="0.5"
                    value={stickerPaddingMm}
                    onChange={(e) => setStickerPaddingMm(Number(e.target.value))}
                    className="w-24 accent-emerald-500"
                  />
                  <span className="font-mono text-emerald-400">{stickerPaddingMm}mm</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONTENT PLACEMENT & LAYOUT MODE */}
        {designTab === 'layout' && (
          <div className="space-y-4 mt-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Mode 1: Horizontal Side-by-Side (QR Left) */}
              <div
                onClick={() => setLayoutMode('horizontal-left')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                  layoutMode === 'horizontal-left'
                    ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
                }`}
              >
                <div>
                  <span className="font-bold text-white text-xs block mb-1">
                    Horizontal (Side-by-Side)
                  </span>
                  <p className="text-[11px] text-slate-400 leading-normal mb-2">
                    QR code on Left, Product Name, Big MRP & Dates on Right. Best for elongated labels!
                  </p>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                    <div className="w-6 h-6 bg-white rounded flex items-center justify-center text-[7px] font-black text-black">
                      QR
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="h-1.5 bg-slate-600 rounded w-3/4" />
                      <div className="h-2 bg-emerald-500 rounded w-1/2" />
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold mt-2">Recommended for 70mm+</span>
              </div>

              {/* Mode 2: Three-Zone Elongated Tag */}
              <div
                onClick={() => setLayoutMode('three-zone')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                  layoutMode === 'three-zone'
                    ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
                }`}
              >
                <div>
                  <span className="font-bold text-white text-xs block mb-1">
                    Three-Zone (Shelf Tag)
                  </span>
                  <p className="text-[11px] text-slate-400 leading-normal mb-2">
                    QR on Left | Name & Dates in Center | Giant High-Contrast Price Box on Right.
                  </p>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center gap-1.5">
                    <div className="w-5 h-5 bg-white rounded flex items-center justify-center text-[6px] font-black text-black">
                      QR
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="h-1 bg-slate-600 rounded w-full" />
                      <div className="h-1 bg-slate-600 rounded w-2/3" />
                    </div>
                    <div className="w-7 h-5 bg-emerald-600 rounded flex items-center justify-center text-[6px] text-white font-black">
                      MRP
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold mt-2">Best for Supermarket Shelves</span>
              </div>

              {/* Mode 3: Inverted Horizontal (QR Right) */}
              <div
                onClick={() => setLayoutMode('horizontal-right')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                  layoutMode === 'horizontal-right'
                    ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
                }`}
              >
                <div>
                  <span className="font-bold text-white text-xs block mb-1">
                    Inverted (QR on Right)
                  </span>
                  <p className="text-[11px] text-slate-400 leading-normal mb-2">
                    Product Title & MRP on Left, QR Code on Right edge.
                  </p>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="h-1.5 bg-slate-600 rounded w-3/4" />
                      <div className="h-2 bg-emerald-500 rounded w-1/2" />
                    </div>
                    <div className="w-6 h-6 bg-white rounded flex items-center justify-center text-[7px] font-black text-black">
                      QR
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-bold mt-2">Clean Alternative</span>
              </div>

              {/* Mode 4: Vertical Stacked */}
              <div
                onClick={() => setLayoutMode('vertical-stacked')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                  layoutMode === 'vertical-stacked'
                    ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
                }`}
              >
                <div>
                  <span className="font-bold text-white text-xs block mb-1">
                    Vertical Stacked (Center)
                  </span>
                  <p className="text-[11px] text-slate-400 leading-normal mb-2">
                    Header &rarr; QR Code in middle &rarr; Title & Price stacked at bottom.
                  </p>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex flex-col items-center gap-1">
                    <div className="w-6 h-5 bg-white rounded flex items-center justify-center text-[6px] font-black text-black">
                      QR
                    </div>
                    <div className="h-1.5 bg-slate-600 rounded w-2/3" />
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-bold mt-2">Best for Square / Tall Tags</span>
              </div>
            </div>

            {/* Layout Alignment & Price Box Style */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/60">
                <label className="text-slate-300 font-bold block mb-1.5">Text Alignment</label>
                <div className="flex gap-2">
                  {[
                    { id: 'left', icon: AlignLeft, label: 'Left' },
                    { id: 'center', icon: AlignCenter, label: 'Center' },
                    { id: 'right', icon: AlignRight, label: 'Right' }
                  ].map(a => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setTextAlign(a.id)}
                        className={`flex-1 py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                          textAlign === a.id
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/60">
                <label className="text-slate-300 font-bold block mb-1.5">MRP Price Style</label>
                <div className="flex gap-2">
                  {[
                    { id: 'boxed', label: 'Bordered Box' },
                    { id: 'badge', label: 'Black Pill' },
                    { id: 'standard', label: 'Plain Text' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setPriceStyle(s.id)}
                      className={`flex-1 py-1.5 rounded-xl font-bold transition text-[11px] ${
                        priceStyle === s.id
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/60">
                <label className="text-slate-300 font-bold block mb-1.5">Elements Visibility</label>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRetailPrice}
                      onChange={(e) => setShowRetailPrice(e.target.checked)}
                      className="rounded text-emerald-600 w-3.5 h-3.5"
                    />
                    Retail MRP
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showWholesalePrice}
                      onChange={(e) => setShowWholesalePrice(e.target.checked)}
                      className="rounded text-emerald-600 w-3.5 h-3.5"
                    />
                    Wholesale Price
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBarcodeText}
                      onChange={(e) => setShowBarcodeText(e.target.checked)}
                      className="rounded text-emerald-600 w-3.5 h-3.5"
                    />
                    Code Text
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showNetQty}
                      onChange={(e) => setShowNetQty(e.target.checked)}
                      className="rounded text-emerald-600 w-3.5 h-3.5"
                    />
                    Net Qty
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ADJUST CONTENT SIZES */}
        {designTab === 'sizes' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-xs">
            {/* Product Title Size */}
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <label className="text-slate-300 font-bold block">Product Name Size</label>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { id: 'xs', label: 'XS' },
                  { id: 'sm', label: 'SM' },
                  { id: 'md', label: 'MD' },
                  { id: 'lg', label: 'LG' },
                  { id: 'xl', label: 'XL' }
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setProductNameSize(s.id)}
                    className={`py-1.5 rounded-lg font-bold text-center transition ${
                      productNameSize === s.id
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">Current: {productNameSize.toUpperCase()} font scaling</p>
            </div>

            {/* Price (MRP) Size */}
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <label className="text-slate-300 font-bold block">Price (MRP) Size</label>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { id: 'sm', label: 'SM' },
                  { id: 'md', label: 'MD' },
                  { id: 'lg', label: 'LG' },
                  { id: 'xl', label: 'XL' },
                  { id: 'giant', label: 'MAX' }
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPriceSize(s.id)}
                    className={`py-1.5 rounded-lg font-bold text-center transition ${
                      priceSize === s.id
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">High-contrast bold retail pricing</p>
            </div>

            {/* QR Scanner Pixel Size */}
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-bold">QR Scanner Size</span>
                <span className="font-mono text-emerald-400 font-bold">{qrPixelSize} px</span>
              </div>
              <input
                type="range"
                min="26"
                max="80"
                step="2"
                value={qrPixelSize}
                onChange={(e) => setQrPixelSize(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">Adjusts for instant mobile camera detection</p>
            </div>

            {/* Dates & Compliance Font Size */}
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <label className="text-slate-300 font-bold block">Dates & Compliance Text</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'xs', label: 'Compact' },
                  { id: 'sm', label: 'Standard' },
                  { id: 'md', label: 'Large' }
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDateFontSize(s.id)}
                    className={`py-1.5 rounded-lg font-bold text-center transition ${
                      dateFontSize === s.id
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Logo Height:</span>
                <input
                  type="range"
                  min="8"
                  max="28"
                  step="2"
                  value={logoHeightPx}
                  onChange={(e) => setLogoHeightPx(Number(e.target.value))}
                  className="w-20 accent-emerald-500"
                />
                <span className="font-mono text-emerald-400">{logoHeightPx}px</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DATES & COMPLIANCE */}
        {designTab === 'dates' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 text-xs">
            {/* Manufacture Date */}
            <div className="md:col-span-4 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <label className="flex items-center gap-2 font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMfgDate}
                  onChange={(e) => setShowMfgDate(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 bg-slate-900 border-slate-700"
                />
                Print Manufacture Date (MFG)
              </label>
              <input
                type="date"
                value={mfgDate}
                disabled={!showMfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 disabled:opacity-40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <span className="text-[10px] text-blue-400 block font-mono">
                Prints: MFG: {formatDisplayDate(mfgDate)}
              </span>
            </div>

            {/* Best Before / Expiry Date */}
            <div className="md:col-span-5 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 font-semibold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showExpDate}
                    onChange={(e) => setShowExpDate(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 bg-slate-900 border-slate-700"
                  />
                  Print Best Before / Expiry
                </label>
                <div className="flex gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setExpDateMode('duration')}
                    className={`px-2 py-0.5 rounded ${expDateMode === 'duration' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
                  >
                    Duration
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpDateMode('date')}
                    className={`px-2 py-0.5 rounded ${expDateMode === 'date' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
                  >
                    Exact Date
                  </button>
                </div>
              </div>

              {expDateMode === 'duration' ? (
                <select
                  value={expDurationText}
                  disabled={!showExpDate}
                  onChange={(e) => setExpDurationText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 disabled:opacity-40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Best Before 6 Months">Best Before 6 Months from Mfg</option>
                  <option value="Best Before 12 Months">Best Before 12 Months from Mfg</option>
                  <option value="Best Before 24 Months">Best Before 24 Months from Mfg</option>
                  <option value="Best Before 30 Days">Best Before 30 Days from Mfg</option>
                  <option value="Best Before 3 Months">Best Before 3 Months from Mfg</option>
                  <option value="Use within 7 Days">Use within 7 Days</option>
                </select>
              ) : (
                <input
                  type="date"
                  value={expDate}
                  disabled={!showExpDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 disabled:opacity-40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              )}

              <span className="text-[10px] text-emerald-400 block font-mono">
                Prints: {expDateMode === 'duration' ? expDurationText : `EXP: ${formatDisplayDate(expDate)}`}
              </span>
            </div>

            {/* Batch, Net Qty & Compliance */}
            <div className="md:col-span-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={showBatchNo}
                    onChange={(e) => setShowBatchNo(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 bg-slate-900 border-slate-700"
                  />
                  Batch / Lot No
                </label>
                <input
                  type="text"
                  disabled={!showBatchNo}
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  placeholder="e.g. BATCH: NM-B101"
                  className="w-full bg-slate-900 border border-slate-700 disabled:opacity-40 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={showFssai}
                    onChange={(e) => setShowFssai(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 bg-slate-900 border-slate-700"
                  />
                  FSSAI License
                </label>
                <input
                  type="text"
                  disabled={!showFssai}
                  value={fssaiText}
                  onChange={(e) => setFssaiText(e.target.value)}
                  placeholder="e.g. FSSAI: 10024000000001"
                  className="w-full bg-slate-900 border border-slate-700 disabled:opacity-40 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: LOGO & BRANDING */}
        {designTab === 'branding' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 text-xs">
            {/* Logo Customizer */}
            <div className="md:col-span-5 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 font-semibold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLogo}
                    onChange={(e) => setShowLogo(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 bg-slate-900 border-slate-700"
                  />
                  Print Logo on Sticker
                </label>
                {showLogo && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="w-12 h-12 bg-white rounded-xl p-1 shadow border border-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full py-1.5 px-3 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 border border-emerald-500/40"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Custom Logo
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoUrl('/logo.png')}
                    className="text-[10px] text-slate-400 hover:text-white underline block text-center"
                  >
                    Reset to Default N Mart Logo
                  </button>
                </div>
              </div>
            </div>

            {/* Store Title & Subtitle */}
            <div className="md:col-span-4 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Header Store Title</label>
                <div className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={showShopName}
                    onChange={(e) => setShowShopName(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 bg-slate-900 border-slate-700 mt-2"
                  />
                  <input
                    type="text"
                    value={customShopName}
                    onChange={(e) => setCustomShopName(e.target.value)}
                    placeholder="e.g. N Mart"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Tagline / Subtitle</label>
                <div className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={showSubtitle}
                    onChange={(e) => setShowSubtitle(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 bg-slate-900 border-slate-700 mt-2"
                  />
                  <input
                    type="text"
                    value={customSubtitle}
                    onChange={(e) => setCustomSubtitle(e.target.value)}
                    placeholder="e.g. Best Price Guaranteed"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Promotional Offer Badge */}
            <div className="md:col-span-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <label className="text-[11px] text-slate-400 block mb-1">Discount / Offer Badge</label>
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  checked={showOfferBadge}
                  onChange={(e) => setShowOfferBadge(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 bg-slate-900 border-slate-700"
                />
                <span className="text-xs text-slate-300">Show Offer Badge</span>
              </div>
              <input
                type="text"
                disabled={!showOfferBadge}
                value={offerBadgeText}
                onChange={(e) => setOfferBadgeText(e.target.value)}
                placeholder="e.g. SPECIAL OFFER"
                className="w-full bg-slate-900 border border-slate-700 disabled:opacity-40 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content: Dual Panel (Left: Product Selector, Right: Live Interactive Label Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Selector (no-print) */}
        <div className="no-print lg:col-span-5 bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-col max-h-[750px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-base">Select Products & Quantities</h2>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={selectAll} className="text-emerald-400 hover:underline">Select All</button>
              <span>•</span>
              <button onClick={deselectAll} className="text-slate-400 hover:underline">Clear</button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Product Items List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredProducts.map(p => {
              const isSelected = selectedProductIds.has(p.id);
              const qty = quantities[p.id] || 1;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-sm'
                      : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => toggleSelect(p.id)}>
                    <button className="text-slate-400 hover:text-white">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <h4 className="text-xs font-semibold text-white line-clamp-1">{p.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                        <span className="font-mono text-emerald-400">{p.barcode_qr}</span>
                        <span>•</span>
                        <span>MRP: {currency}{p.retail_price}</span>
                        <span>•</span>
                        <span>WS: {currency}{p.wholesale_price}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  {isSelected && (
                    <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
                      <button
                        onClick={() => updateQuantity(p.id, -1)}
                        className="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold text-xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-mono font-bold text-white px-1 min-w-[20px] text-center">{qty}</span>
                      <button
                        onClick={() => updateQuantity(p.id, 1)}
                        className="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Live Interactive Label Preview & Printable Output */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="no-print flex items-center justify-between w-full mb-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-white">
              <Eye className="w-4 h-4 text-emerald-400" /> Live Preview: {labelWidthMm}×{labelHeightMm}mm ({sheetType === 'roll' ? 'Continuous Roll' : `A4 Sheet ${labelColumns}-Cols`})
            </span>
            <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-emerald-400">
              {labelsToPrint.length} Stickers Queued
            </span>
          </div>

          {/* Printable Sheet Viewport */}
          <div className="w-full bg-slate-950/90 p-4 sm:p-6 rounded-3xl border border-slate-800 overflow-x-auto flex justify-center shadow-inner">
            <div
              id="printable-label-sheet"
              style={{
                width: sheetType === 'roll' ? `${labelWidthMm}mm` : '210mm',
                minHeight: sheetType === 'roll' ? `${labelHeightMm}mm` : '297mm',
                display: sheetType === 'roll' ? 'flex' : 'grid',
                flexDirection: sheetType === 'roll' ? 'column' : undefined,
                gridTemplateColumns: sheetType === 'sheet' ? `repeat(${labelColumns}, minmax(0, 1fr))` : undefined,
                gap: `${labelGapMm}mm`,
                padding: sheetType === 'sheet' ? '8mm' : '0mm'
              }}
              className="bg-white text-black font-sans shadow-2xl transition-all"
            >
              {labelsToPrint.length === 0 ? (
                <div className="col-span-full py-20 text-center text-gray-400 text-sm">
                  Select products from the left panel to preview and print labels
                </div>
              ) : (
                labelsToPrint.map((prod, index) => {
                  const borderClass = borderStyle === 'dashed'
                    ? 'border border-dashed border-gray-400'
                    : borderStyle === 'solid'
                    ? 'border border-gray-400'
                    : 'border border-transparent';

                  const alignClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

                  return (
                    <div
                      key={`${prod.id}-${index}`}
                      className={`print-label-item bg-white overflow-hidden flex flex-col justify-between ${borderClass} relative`}
                      style={{
                        width: `${labelWidthMm}mm`,
                        height: `${labelHeightMm}mm`,
                        padding: `${stickerPaddingMm}mm`
                      }}
                    >
                      {/* ============================================================== */}
                      {/* LAYOUT 1: HORIZONTAL SIDE-BY-SIDE (QR LEFT, DETAILS RIGHT)     */}
                      {/* ============================================================== */}
                      {layoutMode === 'horizontal-left' && (
                        <div className="w-full h-full flex items-center gap-2 overflow-hidden">
                          {/* Left: QR Code + Barcode text */}
                          <div className="flex flex-col items-center justify-center flex-shrink-0">
                            <div className="bg-white p-0.5">
                              <QRCodeSVG
                                value={prod.barcode_qr}
                                size={qrPixelSize}
                                level="M"
                              />
                            </div>
                            {showBarcodeText && (
                              <span className="text-[7px] font-mono font-bold text-gray-600 mt-0.5 leading-none">
                                {prod.barcode_qr}
                              </span>
                            )}
                          </div>

                          {/* Right: Store, Product Name, MRP, Dates */}
                          <div className={`flex-1 min-w-0 flex flex-col justify-between h-full ${alignClass}`}>
                            {/* Shop Title + Offer Badge */}
                            <div className="flex items-center justify-between gap-1 leading-none">
                              <div className="flex items-center gap-1 min-w-0">
                                {showLogo && logoUrl && (
                                  <img
                                    src={logoUrl}
                                    alt="Logo"
                                    style={{ height: `${logoHeightPx}px` }}
                                    className="object-contain flex-shrink-0"
                                  />
                                )}
                                {showShopName && (
                                  <span className={`${getShopTitleClass()} font-black uppercase text-gray-900 truncate tracking-tight`}>
                                    {customShopName}
                                  </span>
                                )}
                              </div>
                              {showOfferBadge && offerBadgeText && (
                                <span className="px-1 py-0.2 bg-red-600 text-white font-black text-[6.5px] rounded tracking-tight flex-shrink-0 leading-tight">
                                  {offerBadgeText}
                                </span>
                              )}
                            </div>

                            {/* Product Title */}
                            <div className="my-0.5">
                              <div className={`${getTitleClass()} font-black text-gray-900 line-clamp-1`}>
                                {prod.name}
                              </div>
                            </div>

                            {/* Price (MRP) & Wholesale */}
                            <div className="flex items-baseline gap-1.5 leading-none my-0.5">
                              {showRetailPrice && (
                                <div className={`font-black text-black ${getPriceClass()} leading-none ${
                                  priceStyle === 'boxed'
                                    ? 'border border-black px-1 py-0.5 rounded'
                                    : priceStyle === 'badge'
                                    ? 'bg-black text-white px-1 py-0.5 rounded'
                                    : ''
                                }`}>
                                  MRP: {currency}{prod.retail_price}
                                </div>
                              )}
                              {showWholesalePrice && (
                                <span className="text-[8px] font-bold text-gray-600">
                                  WS: {currency}{prod.wholesale_price}
                                </span>
                              )}
                            </div>

                            {/* Dates & Compliance Row */}
                            <div className={`${getDateClass()} text-gray-600 font-mono leading-none flex flex-wrap gap-x-2 gap-y-0.5`}>
                              {showNetQty && <span>Net: 1 {prod.unit || 'pcs'}</span>}
                              {showMfgDate && <span className="text-blue-900 font-bold">MFG: {formatDisplayDate(mfgDate)}</span>}
                              {showExpDate && (
                                <span className="text-emerald-800 font-bold truncate">
                                  {expDateMode === 'duration' ? expDurationText : `EXP: ${formatDisplayDate(expDate)}`}
                                </span>
                              )}
                              {showBatchNo && <span>{batchNo}</span>}
                              {showFssai && <span className="font-sans text-[6.5px]">{fssaiText}</span>}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ============================================================== */}
                      {/* LAYOUT 2: THREE-ZONE SHELF TAG (QR | NAME & DATES | GIANT PRICE) */}
                      {/* ============================================================== */}
                      {layoutMode === 'three-zone' && (
                        <div className="w-full h-full flex items-center justify-between gap-1.5 overflow-hidden">
                          {/* Zone 1 (Left): QR Code */}
                          <div className="flex flex-col items-center justify-center flex-shrink-0">
                            <QRCodeSVG
                              value={prod.barcode_qr}
                              size={qrPixelSize}
                              level="M"
                            />
                            {showBarcodeText && (
                              <span className="text-[7px] font-mono font-bold text-gray-600 mt-0.5 leading-none">
                                {prod.barcode_qr}
                              </span>
                            )}
                          </div>

                          {/* Zone 2 (Center): Store, Product Name & Compliance */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between h-full px-1">
                            <div className="flex items-center gap-1 leading-none">
                              {showLogo && logoUrl && (
                                <img
                                  src={logoUrl}
                                  alt="Logo"
                                  style={{ height: `${logoHeightPx}px` }}
                                  className="object-contain flex-shrink-0"
                                />
                              )}
                              {showShopName && (
                                <span className={`${getShopTitleClass()} font-black uppercase text-gray-900 truncate`}>
                                  {customShopName}
                                </span>
                              )}
                            </div>

                            <div className={`${getTitleClass()} font-black text-gray-900 line-clamp-2 my-0.5`}>
                              {prod.name}
                            </div>

                            <div className={`${getDateClass()} text-gray-600 font-mono leading-none flex flex-wrap gap-x-1.5`}>
                              {showNetQty && <span>1 {prod.unit || 'pcs'}</span>}
                              {showMfgDate && <span className="text-blue-900 font-bold">MFG: {formatDisplayDate(mfgDate)}</span>}
                              {showExpDate && (
                                <span className="text-emerald-800 font-bold truncate">
                                  {expDateMode === 'duration' ? expDurationText : `EXP: ${formatDisplayDate(expDate)}`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Zone 3 (Right): Giant Price Box */}
                          <div className="flex-shrink-0 flex flex-col items-center justify-center bg-gray-900 text-white rounded p-1.5 min-w-[50px] text-center">
                            <span className="text-[6.5px] uppercase font-bold tracking-wider text-gray-300">
                              RETAIL PRICE
                            </span>
                            <span className={`${getPriceClass()} font-black leading-none my-0.5 text-yellow-300`}>
                              {currency}{prod.retail_price}
                            </span>
                            {showWholesalePrice && (
                              <span className="text-[7px] text-gray-300 font-mono">
                                WS: {currency}{prod.wholesale_price}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ============================================================== */}
                      {/* LAYOUT 3: INVERTED HORIZONTAL (INFO LEFT, QR RIGHT)            */}
                      {/* ============================================================== */}
                      {layoutMode === 'horizontal-right' && (
                        <div className="w-full h-full flex items-center gap-2 overflow-hidden">
                          {/* Left: Product Info */}
                          <div className={`flex-1 min-w-0 flex flex-col justify-between h-full ${alignClass}`}>
                            <div className="flex items-center gap-1 leading-none">
                              {showLogo && logoUrl && (
                                <img
                                  src={logoUrl}
                                  alt="Logo"
                                  style={{ height: `${logoHeightPx}px` }}
                                  className="object-contain flex-shrink-0"
                                />
                              )}
                              {showShopName && (
                                <span className={`${getShopTitleClass()} font-black uppercase text-gray-900 truncate`}>
                                  {customShopName}
                                </span>
                              )}
                            </div>

                            <div className={`${getTitleClass()} font-black text-gray-900 line-clamp-1 my-0.5`}>
                              {prod.name}
                            </div>

                            <div className={`font-black text-black ${getPriceClass()} leading-none my-0.5`}>
                              MRP: {currency}{prod.retail_price}
                            </div>

                            <div className={`${getDateClass()} text-gray-600 font-mono leading-none flex flex-wrap gap-x-2`}>
                              {showMfgDate && <span className="text-blue-900 font-bold">MFG: {formatDisplayDate(mfgDate)}</span>}
                              {showExpDate && (
                                <span className="text-emerald-800 font-bold truncate">
                                  {expDateMode === 'duration' ? expDurationText : `EXP: ${formatDisplayDate(expDate)}`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: QR Code */}
                          <div className="flex flex-col items-center justify-center flex-shrink-0">
                            <QRCodeSVG
                              value={prod.barcode_qr}
                              size={qrPixelSize}
                              level="M"
                            />
                            {showBarcodeText && (
                              <span className="text-[7px] font-mono font-bold text-gray-600 mt-0.5 leading-none">
                                {prod.barcode_qr}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ============================================================== */}
                      {/* LAYOUT 4: VERTICAL STACKED (FOR SQUARE / TALL LABELS)          */}
                      {/* ============================================================== */}
                      {layoutMode === 'vertical-stacked' && (
                        <div className="w-full h-full flex flex-col justify-between items-center text-center overflow-hidden">
                          {/* Header */}
                          <div className="w-full flex items-center justify-center gap-1 leading-none">
                            {showLogo && logoUrl && (
                              <img
                                src={logoUrl}
                                alt="Logo"
                                style={{ height: `${logoHeightPx}px` }}
                                className="object-contain flex-shrink-0"
                              />
                            )}
                            {showShopName && (
                              <span className={`${getShopTitleClass()} font-black uppercase text-gray-900`}>
                                {customShopName}
                              </span>
                            )}
                          </div>

                          {/* Center QR */}
                          <div className="my-0.5 flex flex-col items-center">
                            <QRCodeSVG
                              value={prod.barcode_qr}
                              size={qrPixelSize}
                              level="M"
                            />
                            {showBarcodeText && (
                              <span className="text-[6.5px] font-mono text-gray-500 font-bold">
                                {prod.barcode_qr}
                              </span>
                            )}
                          </div>

                          {/* Product Title */}
                          <div className={`${getTitleClass()} font-black text-gray-900 line-clamp-1`}>
                            {prod.name}
                          </div>

                          {/* Price */}
                          <div className={`font-black text-black ${getPriceClass()} leading-none my-0.5`}>
                            MRP: {currency}{prod.retail_price}
                          </div>

                          {/* Dates */}
                          <div className={`${getDateClass()} text-gray-600 font-mono leading-none flex items-center justify-center gap-2`}>
                            {showMfgDate && <span>MFG: {formatDisplayDate(mfgDate)}</span>}
                            {showExpDate && <span>EXP: {formatDisplayDate(expDate)}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
