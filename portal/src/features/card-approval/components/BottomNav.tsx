import { ListChecks, ShoppingBag, PieChart, Settings } from 'lucide-react';
import type { NavTab } from '../types';

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  myApprovalCount: number;
  approvedReadyCount: number;
}

export function BottomNav({
  activeTab,
  onChangeTab,
  myApprovalCount,
  approvedReadyCount,
}: BottomNavProps) {
  const tabs: Array<{ id: NavTab; label: string; badge: number }> = [
    { id: 'list', label: '相談・一覧', badge: myApprovalCount },
    { id: 'approved', label: '購入OK', badge: approvedReadyCount },
    { id: 'dashboard', label: '予算・履歴', badge: 0 },
    { id: 'settings', label: 'ルール設定', badge: 0 },
  ];

  const renderIcon = (id: NavTab) => {
    switch (id) {
      case 'list':
        return <ListChecks className="w-5 h-5" />;
      case 'approved':
        return <ShoppingBag className="w-5 h-5" />;
      case 'dashboard':
        return <PieChart className="w-5 h-5" />;
      case 'settings':
        return <Settings className="w-5 h-5" />;
    }
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-5xl mx-auto grid grid-cols-4 px-1 py-1.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-semibold gap-0.5 transition ${
                isActive
                  ? 'text-pink-700 bg-pink-50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="relative">
                {renderIcon(tab.id)}
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </span>
              <span className="truncate max-w-full">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}