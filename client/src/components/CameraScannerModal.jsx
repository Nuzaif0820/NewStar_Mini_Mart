import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  Flashlight,
  RefreshCw,
  Zap,
  AlertCircle,
  CheckCircle,
  FlipHorizontal,
  ShoppingCart
} from 'lucide-react';
import { playBeep } from '../utils/sound';

export default function CameraScannerModal({
  isOpen,
  onClose,
  onScan,
  onOpenCart,
  cartCount = 0,
  cartTotal = 0,
  currency = '₹'
}) {
  const [cameraError, setCameraError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanFeedback, setScanFeedback] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  const scannerRef = useRef(null);
  const isStartingRef = useRef(false);
  const lastScannedTimeRef = useRef(0);
  const lastScannedCodeRef = useRef('');

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn("Scanner stop issue:", e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  const handleDecoded = useCallback(async (decodedText) => {
    const cleanText = String(decodedText || '').trim();
    if (!cleanText) return;

    const now = Date.now();
    // Debounce duplicate scans of the SAME code within 1.2s to prevent unintentional double additions
    if (cleanText === lastScannedCodeRef.current && (now - lastScannedTimeRef.current < 1200)) {
      return;
    }
    lastScannedTimeRef.current = now;
    lastScannedCodeRef.current = cleanText;

    setScanFeedback({
      type: 'info',
      message: `Scanned: ${cleanText}...`,
      code: cleanText
    });

    if (onScan) {
      try {
        const result = await onScan(cleanText);
        if (result && result.success) {
          if (navigator.vibrate) {
            try { navigator.vibrate(60); } catch (_) {}
          }
          setScanFeedback({
            type: 'success',
            message: `${result.product?.name || cleanText} added!`,
            price: result.product?.retail_price,
            code: cleanText
          });
        } else {
          setScanFeedback({
            type: 'error',
            message: result?.message || `Product not found: ${cleanText}`,
            code: cleanText
          });
        }
      } catch (err) {
        setScanFeedback({
          type: 'error',
          message: `Scan failed for: ${cleanText}`,
          code: cleanText
        });
      }
    }
  }, [onScan]);

  const startScanner = useCallback(async (forcedCameraId = null) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setCameraError(null);

    try {
      // 1. Wait for container DOM element to be mounted
      let container = null;
      for (let i = 0; i < 25; i++) {
        container = document.getElementById("camera-scanner-view");
        if (container) break;
        await new Promise(r => setTimeout(r, 40));
      }

      if (!container) {
        setCameraError("Camera display element not ready. Please try again.");
        isStartingRef.current = false;
        return;
      }

      // 2. Clean up any existing scanner instance cleanly
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) {
          console.warn("Prior scanner cleanup:", e);
        }
        scannerRef.current = null;
      }

      // 3. Define formats (both 2D QR and 1D retail barcodes)
      const formats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.ITF
      ];

      const html5QrCode = new Html5Qrcode("camera-scanner-view", {
        formatsToSupport: formats,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        verbose: false
      });
      scannerRef.current = html5QrCode;

      // 4. Enumerate available cameras
      let cameras = [];
      try {
        cameras = await Html5Qrcode.getCameras();
        if (Array.isArray(cameras) && cameras.length > 0) {
          setAvailableCameras(cameras);
        }
      } catch (camErr) {
        console.warn("Could not enumerate camera devices:", camErr);
      }

      // 5. Select target camera
      let targetCamera = forcedCameraId;
      if (!targetCamera && cameras && cameras.length > 0) {
        // Look for rear/environment camera (often the last camera on Android)
        const rear = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1];
        targetCamera = rear?.id || cameras[0]?.id;
        const targetIndex = cameras.findIndex(c => c.id === targetCamera);
        if (targetIndex >= 0) setCurrentCameraIndex(targetIndex);
      }

      // Dynamic responsive qrbox prevents "qrbox width is greater than video width" crash
      const scanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.max(160, Math.floor(minEdge * 0.72));
          return {
            width: Math.min(boxSize, Math.max(160, viewfinderWidth - 20)),
            height: Math.min(boxSize, Math.max(160, viewfinderHeight - 20))
          };
        },
        aspectRatio: 1.0
      };

      // 6. Progressive start with fallbacks
      let started = false;
      const attempts = [];
      if (targetCamera) attempts.push(targetCamera);
      attempts.push({ facingMode: "environment" });
      attempts.push({ facingMode: "user" });

      for (const constraint of attempts) {
        try {
          await html5QrCode.start(
            constraint,
            scanConfig,
            handleDecoded,
            () => {} // Frame scan error callback (normal while seeking)
          );
          started = true;
          break;
        } catch (attemptErr) {
          console.warn("Camera start attempt failed with constraint", constraint, attemptErr);
        }
      }

      if (!started) {
        throw new Error("Could not access camera. Please make sure camera permissions are enabled in Android settings.");
      }

      setIsScanning(true);
      setCameraError(null);

      // Check torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        setHasTorch(Boolean(capabilities && capabilities.torch));
      } catch (_) {
        setHasTorch(false);
      }
    } catch (err) {
      console.error("Camera startup error:", err);
      setCameraError(err.message || "Could not start camera. Please verify camera permissions.");
      setIsScanning(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [handleDecoded]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScanFeedback(null);
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  const toggleTorch = async () => {
    if (scannerRef.current && isScanning) {
      try {
        const capabilities = scannerRef.current.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          await scannerRef.current.applyVideoConstraints({
            advanced: [{ torch: !torchOn }]
          });
          setTorchOn(!torchOn);
        } else {
          setScanFeedback({ type: 'info', message: 'Flashlight is not available on this camera.' });
          setTimeout(() => setScanFeedback(null), 2500);
        }
      } catch (e) {
        console.warn("Torch error:", e);
      }
    }
  };

  const switchCamera = async () => {
    if (availableCameras.length <= 1) return;
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(nextIndex);
    const nextCamera = availableCameras[nextIndex];
    await startScanner(nextCamera.id);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const code = manualCode.trim();
    setManualCode('');
    await handleDecoded(code);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
      {/* Responsive viewfinder styles */}
      <style>{`
        #camera-scanner-view {
          position: relative;
          overflow: hidden;
          width: 100% !important;
          height: 100% !important;
          border-radius: 1.25rem;
        }
        #camera-scanner-view video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1.25rem;
        }
      `}</style>

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-800/95 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">Camera Console</h3>
              <p className="text-xs text-slate-400">Aim at Product QR or Barcode</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cartCount > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-full text-xs font-bold font-mono">
                <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                <span>{cartCount} in cart</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Close Scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Viewport */}
        <div className="relative bg-black flex-1 min-h-[300px] max-h-[380px] flex items-center justify-center overflow-hidden">
          <div id="camera-scanner-view" className="w-full h-full min-h-[300px]" />

          {/* Aiming Reticle Overlay */}
          {isScanning && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative w-64 h-64 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_24px_rgba(16,185,129,0.35)]">
                {/* 4 Corner Markers */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {/* Animated Laser Scanning Line */}
                <div
                  className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#34d399]"
                  style={{
                    animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    top: '50%'
                  }}
                />
              </div>
            </div>
          )}

          {/* Camera Error Message with Retry */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
              <AlertCircle className="w-12 h-12 mb-3 text-rose-400 animate-bounce" />
              <p className="text-sm font-semibold text-rose-200 mb-2">Camera Access Error</p>
              <p className="text-xs text-slate-300 max-w-xs mb-4 leading-relaxed">{cameraError}</p>
              <button
                onClick={() => startScanner()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition"
              >
                <RefreshCw className="w-4 h-4" /> Retry Camera
              </button>
            </div>
          )}

          {/* Floating Controls Overlay (Flashlight, Switch Camera, Restart) */}
          <div className="absolute bottom-3 inset-x-0 flex justify-center items-center gap-3 px-4 z-10">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-3 rounded-full backdrop-blur-md transition shadow-lg ${
                  torchOn ? 'bg-amber-500 text-black shadow-amber-500/40' : 'bg-slate-800/85 text-white hover:bg-slate-700'
                }`}
                title="Toggle Torch / Flashlight"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}

            {availableCameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="p-3 rounded-full bg-slate-800/85 text-white hover:bg-slate-700 backdrop-blur-md shadow-lg transition"
                title={`Switch Lens (${currentCameraIndex + 1}/${availableCameras.length})`}
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => startScanner()}
              className="p-3 rounded-full bg-slate-800/85 text-white hover:bg-slate-700 backdrop-blur-md shadow-lg transition"
              title="Restart / Refocus Camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Scan Result Banner */}
        {scanFeedback ? (
          <div
            className={`px-4 py-2.5 border-t flex items-center justify-between text-xs transition-all ${
              scanFeedback.type === 'success'
                ? 'bg-emerald-950/85 border-emerald-700/60 text-emerald-200'
                : scanFeedback.type === 'error'
                ? 'bg-rose-950/85 border-rose-700/60 text-rose-200'
                : 'bg-slate-800/90 border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 font-medium truncate flex-1 pr-2">
              {scanFeedback.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
              {scanFeedback.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {scanFeedback.type === 'info' && <Zap className="w-4 h-4 text-amber-400 shrink-0" />}
              <span className="truncate">{scanFeedback.message}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {scanFeedback.price !== undefined && (
                <span className="font-mono font-black text-emerald-300 bg-emerald-900/50 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  {currency}{scanFeedback.price}
                </span>
              )}
              {scanFeedback.type === 'success' && (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenCart) onOpenCart();
                    else if (onClose) onClose();
                  }}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] rounded-lg shadow transition"
                >
                  Open Cart →
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="px-4 py-2 bg-slate-800/60 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" /> Scanner ready
            </span>
            <span className="font-mono text-[11px] text-slate-400">Point at label</span>
          </div>
        )}

        {/* Footer: Manual Code Input, Cart Action & Preferences */}
        <div className="p-3 bg-slate-800/95 border-t border-slate-700 space-y-2">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Or type barcode (e.g. NM-271118)..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0"
            >
              Add
            </button>
          </form>

          {/* Prominent Cart Action Button */}
          {cartCount > 0 && (
            <button
              type="button"
              onClick={() => {
                if (onOpenCart) onOpenCart();
                else if (onClose) onClose();
              }}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-98"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Open Cart ({cartCount} {cartCount === 1 ? 'item' : 'items'} • {currency}{cartTotal.toFixed(2)}) →</span>
            </button>
          )}

          {/* Close Scanner CTA */}
          <div className="flex items-center justify-between px-1 text-xs text-slate-400 pt-0.5">
            <span className="text-[11px] text-slate-400">Scan more items or tap Open Cart</span>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-300 hover:text-white font-semibold underline px-2 py-0.5"
            >
              Close Scanner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
