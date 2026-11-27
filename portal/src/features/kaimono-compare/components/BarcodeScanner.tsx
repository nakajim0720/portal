import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (code: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onClose }) => {
  const [errorMsg, setErrorMsg] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'kaimono-barcode-scanner-view';

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(readerElementId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
      ],
      verbose: false,
    });
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 120 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
            const cleaned = decodedText.trim().toUpperCase();
            html5QrCode
              .stop()
              .then(() => onScanSuccess(cleaned))
              .catch(() => onScanSuccess(cleaned));
          },
          () => {
            // フレームごとの未検出は無視
          }
        );
      } catch (err) {
        console.error('Camera start error:', err);
        setErrorMsg('カメラを起動できませんでした。ブラウザのカメラ権限を確認してください。');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((e) => console.error(e));
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
          <div className="flex items-center gap-2 font-bold text-base">
            <Camera className="w-5 h-5 text-emerald-400" />
            <span>バーコード読取（ASIN / JAN）</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center">
          {errorMsg ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-base">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <>
              <div
                id={readerElementId}
                className="w-full overflow-hidden rounded-xl bg-black min-h-[240px]"
              />
              <p className="text-base text-slate-600 mt-3 text-center">
                ASIN（CODE128/39）またはJAN/UPCバーコードを横向きに枠内へ合わせてください
              </p>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-base transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};