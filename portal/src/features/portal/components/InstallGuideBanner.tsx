import { useState, useEffect } from 'react';
import { Share, X } from 'lucide-react';

const DISMISSED_KEY = 'portal_ios_install_banner_dismissed';

function isIosSafariBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const isWebkit = /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  return isIos && isWebkit && !isStandalone;
}

export function InstallGuideBanner() {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
    if (!dismissed && isIosSafariBrowser()) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="bg-pink-50 border-b border-pink-200 px-4 py-3 text-sm text-slate-800 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Share className="w-4 h-4 text-pink-600 shrink-0" />
        <p className="leading-snug">
          共有ボタン → <span className="font-semibold">「ホーム画面に追加」</span> でアプリとして使えます。
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="ガイドを閉じる"
        className="p-1.5 rounded-lg text-slate-500 hover:bg-pink-100 hover:text-slate-800 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}