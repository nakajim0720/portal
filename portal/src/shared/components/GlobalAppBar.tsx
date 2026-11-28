import { Home, ShoppingBag, CreditCard, UserCog, LogOut, Bell } from 'lucide-react';
import type { FeatureId } from '../types/navigation';
import type { PortalUserProfile } from '../../features/portal/types';

interface GlobalAppBarProps {
  activeFeature: FeatureId;
  onSelectFeature: (feature: FeatureId) => void;
  currentProfile: PortalUserProfile | undefined;
  cardPendingCount?: number;
  onOpenProfile: () => void;
  onOpenNotificationSettings: () => void;
  onLogout: () => void;
}

const FEATURE_TABS: Array<{ id: FeatureId; label: string }> = [
  { id: 'portal', label: 'ポータル' },
  { id: 'kaimono', label: '価格比較' },
  { id: 'card', label: 'カード承認' },
];

function getFeatureIcon(id: FeatureId) {
  switch (id) {
    case 'portal':
      return <Home className="w-4 h-4 shrink-0" />;
    case 'kaimono':
      return <ShoppingBag className="w-4 h-4 shrink-0" />;
    case 'card':
      return <CreditCard className="w-4 h-4 shrink-0" />;
  }
}

export function GlobalAppBar({
  activeFeature,
  onSelectFeature,
  currentProfile,
  cardPendingCount = 0,
  onOpenProfile,
  onOpenNotificationSettings,
  onLogout,
}: GlobalAppBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 pt-[env(safe-area-inset-top)]">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 pt-2.5 pb-2 space-y-2">
        {/* 上段：アプリタイトル・通知設定・プロフィール・ログアウト */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelectFeature('portal')}
            className="flex items-center gap-2 min-w-0 text-left"
          >
            <span className="w-8 h-8 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 flex items-center justify-center shrink-0">
              <Home className="w-4 h-4" />
            </span>
            <span className="text-base font-bold text-slate-900 truncate">
              ふたりのポータル
            </span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenNotificationSettings}
              aria-label="LINE通知設定"
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-pink-50 hover:border-pink-200 text-slate-600 hover:text-pink-700"
            >
              <Bell className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenProfile}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold"
            >
              {currentProfile?.icon ? (
                <img
                  src={currentProfile.icon}
                  alt={currentProfile.displayName}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <UserCog className="w-4 h-4 text-pink-600" />
              )}
              <span className="max-w-[84px] sm:max-w-[120px] truncate">
                {currentProfile?.displayName || 'プロフィール'}
              </span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              aria-label="ログアウト"
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 下段：3機能スイッチャー（常に1タップで切替可能） */}
        <nav
          aria-label="機能切替"
          className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100"
        >
          {FEATURE_TABS.map((tab) => {
            const isActive = activeFeature === tab.id;
            const showCardBadge = tab.id === 'card' && cardPendingCount > 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectFeature(tab.id)}
                className={`inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm font-bold transition min-w-0 ${
                  isActive
                    ? 'bg-white text-pink-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {getFeatureIcon(tab.id)}
                <span className="truncate">{tab.label}</span>
                {showCardBadge && (
                  <span className="px-1.5 py-0.5 rounded-full bg-pink-600 text-white text-[10px] leading-none font-bold shrink-0">
                    {cardPendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}