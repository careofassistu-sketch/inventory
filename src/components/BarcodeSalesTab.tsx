import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Product,
  ScanRecord,
  ReorderRequest,
} from '../core/types';
import { sound } from '../utils/audio';
import {
  Barcode,
  Camera,
  CameraOff,
  Zap,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Plus,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';

interface BarcodeSalesTabProps {
  products: Product[];
  onProcessScan: (barcode: string) => Promise<{
    scanRecord: ScanRecord;
    product?: Product;
    reorderCreated?: ReorderRequest;
    duplicatePrevented: boolean;
    status: 'success' | 'unknown_barcode' | 'out_of_stock';
  }>;
  onUndoScan?: (record: ScanRecord) => void;
  onAddNewProductWithBarcode: (barcode: string) => void;
  onNavigateToOrders: (productId?: string) => void;
  sessionScans: ScanRecord[];
}

export const BarcodeSalesTab: React.FC<BarcodeSalesTabProps> = ({
  products,
  onProcessScan,
  onUndoScan,
  onAddNewProductWithBarcode,
  onNavigateToOrders,
  sessionScans,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{
    record: ScanRecord;
    product?: Product;
    reorderCreated?: ReorderRequest;
    duplicatePrevented?: boolean;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanQueueRef = useRef<string[]>([]);
  const isWorkingRef = useRef<boolean>(false);

  // Auto-focus the barcode input on tab mount and after every scan
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sequential queue processor to guarantee zero dropped scans during rapid consecutive scanning
  const processNextInQueue = useCallback(async () => {
    if (isWorkingRef.current || scanQueueRef.current.length === 0) return;

    isWorkingRef.current = true;
    setIsProcessing(true);

    const nextBarcode = scanQueueRef.current.shift()!;
    try {
      const res = await onProcessScan(nextBarcode);

      if (res.status === 'success') {
        if (res.reorderCreated) {
          sound.playAlert();
        } else {
          sound.playSuccess();
        }
      } else {
        sound.playError();
      }

      setLastScanResult({
        record: res.scanRecord,
        product: res.product,
        reorderCreated: res.reorderCreated,
        duplicatePrevented: res.duplicatePrevented,
      });
    } catch (err) {
      console.error('Scan processing error:', err);
      sound.playError();
    } finally {
      isWorkingRef.current = false;
      setIsProcessing(false);
      // Auto refocus input for instant next scan
      setTimeout(() => inputRef.current?.focus(), 50);

      // Process any subsequent rapid scans
      if (scanQueueRef.current.length > 0) {
        processNextInQueue();
      }
    }
  }, [onProcessScan]);

  const enqueueScan = useCallback(
    (code: string) => {
      const clean = code.trim();
      if (!clean) return;
      scanQueueRef.current.push(clean);
      setBarcodeInput('');
      processNextInQueue();
    },
    [processNextInQueue]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enqueueScan(barcodeInput);
  };

  // Camera Barcode Scanning Handler
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (cameraActive) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }

          // Check if BarcodeDetector is natively supported
          if ('BarcodeDetector' in window) {
            const barcodeDetector = new (window as any).BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
            });

            interval = setInterval(async () => {
              if (videoRef.current && videoRef.current.readyState === 4 && !isProcessing) {
                try {
                  const barcodes = await barcodeDetector.detect(videoRef.current);
                  if (barcodes.length > 0) {
                    const rawValue = barcodes[0].rawValue;
                    if (rawValue) {
                      enqueueScan(rawValue);
                    }
                  }
                } catch {
                  // Frame capture error, ignore
                }
              }
            }, 500);
          }
        })
        .catch((err) => {
          console.warn('Camera access denied or unavailable:', err);
          setCameraActive(false);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (interval) clearInterval(interval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [cameraActive, enqueueScan, isProcessing]);

  return (
    <div className="space-y-8">
      {/* Top Banner & Scanner Station */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-800 rounded-md text-xs font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>High-Speed Barcode Terminal · Keyboard / USB Scanner &amp; Camera Ready</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Scan Product Barcode to Record Sale
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Each scan immediately subtracts 1 unit from stock. If available stock falls to or below
            its threshold, an owner approval reorder draft is generated.
          </p>

          {/* Barcode Input Form */}
          <form onSubmit={handleSubmit} className="pt-2">
            <div className="relative flex items-center">
              <Barcode className="absolute left-4 w-6 h-6 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan barcode with scanner or enter numbers here..."
                autoFocus
                className="w-full pl-13 pr-32 py-4 bg-slate-50 border-2 border-slate-300 rounded-xl text-lg font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all shadow-inner"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCameraActive(!cameraActive)}
                  title={cameraActive ? 'Turn off camera scanner' : 'Scan with device camera'}
                  className={`p-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    cameraActive
                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cameraActive ? (
                    <>
                      <CameraOff className="w-4 h-4" />
                      <span className="hidden sm:inline">Stop Cam</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span className="hidden sm:inline">Camera</span>
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={!barcodeInput.trim() || isProcessing}
                  className="px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0 shadow-xs"
                >
                  {isProcessing ? 'Processing...' : 'Record Sale'}
                </button>
              </div>
            </div>
          </form>

          {/* Camera Viewfinder Modal / Drawer */}
          {cameraActive && (
            <div className="relative rounded-xl overflow-hidden border-2 border-slate-900 bg-black aspect-video max-w-md mx-auto mt-4">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Laser scanning line overlay */}
              <div className="absolute inset-x-8 top-12 h-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-scan-laser pointer-events-none" />
              <div className="absolute bottom-3 inset-x-0 text-center">
                <span className="px-3 py-1 bg-black/75 text-white text-xs font-mono rounded-md">
                  Align product barcode inside viewfinder
                </span>
              </div>
            </div>
          )}

          {/* Quick-Scan Simulation Chips (Super helpful for testing without physical scanner) */}
          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500 font-medium mb-2.5 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              <span>Quick Test Barcodes (Click to simulate instant hardware scan):</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {products.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  onClick={() => enqueueScan(p.barcode)}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-mono border border-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <span className="font-sans font-medium text-slate-900 truncate max-w-[130px]">
                    {p.name.split(' ')[0]}
                  </span>
                  <span className="text-slate-400 text-[10px]">[{p.barcode.slice(-4)}]</span>
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                      p.availableStock <= p.minRequiredStock
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {p.availableStock} in stock
                  </span>
                </button>
              ))}
              <button
                onClick={() => enqueueScan('999000111222')}
                className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md font-mono border border-rose-200 transition-colors"
                title="Test how the system handles unknown codes gracefully"
              >
                Simulate Unknown Barcode
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNER: RESULT OF THE LAST SCAN */}
      {lastScanResult && (
        <div
          className={`rounded-xl p-5 border shadow-xs transition-all ${
            !lastScanResult.record.success
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : lastScanResult.reorderCreated
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {!lastScanResult.record.success ? (
                <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              ) : lastScanResult.reorderCreated ? (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              )}

              <div>
                <div className="text-base font-bold flex items-center gap-2">
                  <span>
                    {!lastScanResult.record.success
                      ? 'Barcode Not Recognized'
                      : lastScanResult.reorderCreated
                      ? 'Sale Recorded · Low Stock Threshold Breached!'
                      : 'Sale Recorded Successfully'}
                  </span>
                  <span className="font-mono text-xs opacity-75">
                    [{lastScanResult.record.barcode}]
                  </span>
                </div>

                <p className="text-sm mt-0.5">{lastScanResult.record.message}</p>

                {lastScanResult.reorderCreated && (
                  <div className="mt-2.5 p-3 bg-white/80 border border-amber-200 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-amber-900">
                      Draft Reorder Request Generated:
                    </div>
                    <div>
                      Product: <strong>{lastScanResult.reorderCreated.productName}</strong> · New
                      Stock: <strong>{lastScanResult.reorderCreated.currentStockAtTrigger}</strong> /
                      Min: {lastScanResult.reorderCreated.minThreshold}
                    </div>
                    <div>
                      Deficit:{' '}
                      <strong className="text-amber-800">
                        {lastScanResult.reorderCreated.deficitQuantity} units
                      </strong>{' '}
                      · Email draft sent to owner (
                      {lastScanResult.reorderCreated.ownerEmail}) for approval.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contextual Action Button */}
            <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
              {!lastScanResult.record.success && (
                <button
                  onClick={() => onAddNewProductWithBarcode(lastScanResult.record.barcode)}
                  className="px-4 py-2 bg-rose-900 text-white rounded-lg text-xs font-semibold hover:bg-rose-800 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product with Barcode</span>
                </button>
              )}

              {lastScanResult.reorderCreated && (
                <button
                  onClick={() => onNavigateToOrders(lastScanResult.product?.id)}
                  className="px-4 py-2 bg-amber-900 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span>Review Draft Reorder</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RUNNING LIST OF SESSION SCANS */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Session Scan Activity Log</h2>
            <span className="text-xs text-slate-500 font-mono">
              ({sessionScans.length} scans in current session)
            </span>
          </div>
          <div className="text-xs text-slate-400">
            Real-time feed with deduplication &amp; threshold tracking
          </div>
        </div>

        {sessionScans.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Barcode className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-800">No Scans Recorded in This Session</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Scan items using your hardware barcode scanner, device camera, or test buttons above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Barcode</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4 text-center">Stock Transition</th>
                  <th className="py-3 px-4">Result / Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessionScans.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {new Date(record.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800">
                      {record.barcode}
                    </td>
                    <td className="py-3 px-4">
                      {record.productName ? (
                        <span className="font-medium text-slate-900">{record.productName}</span>
                      ) : (
                        <span className="text-rose-600 italic text-xs">Unregistered product</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-xs">
                      {record.previousStock !== undefined && record.newStock !== undefined ? (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <span className="text-slate-400">{record.previousStock}</span>
                          <span className="text-slate-300">→</span>
                          <span className="font-bold text-slate-900">{record.newStock}</span>
                          <span className="text-[10px] text-rose-600 font-bold ml-0.5">(-1)</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {record.triggeredReorder ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Threshold Breached · Draft PO Sent
                        </span>
                      ) : !record.success ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Unknown Barcode
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Sale Recorded
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {record.success && onUndoScan ? (
                        <button
                          onClick={() => onUndoScan(record)}
                          title="Undo sale (return 1 item to stock)"
                          className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Undo</span>
                        </button>
                      ) : !record.success ? (
                        <button
                          onClick={() => onAddNewProductWithBarcode(record.barcode)}
                          className="px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 rounded border border-rose-200 transition-colors inline-flex items-center gap-1 font-medium"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add SKU</span>
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
