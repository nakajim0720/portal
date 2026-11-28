import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { Plus } from 'lucide-react';
import type { CardItem, NavTab, PrefillQueryData } from './types';
import { useCardApprovalData } from './hooks/useCardApprovalData';
import { readAndClearPrefillQuery } from './utils/queryParams';
import { BottomNav } from './components/BottomNav';
import { ItemCard } from './components/ItemCard';
import { ItemFormModal } from './components/ItemFormModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';

interface CardApprovalAppProps {
  user: User;
  displayName: string;
  onUnauthorized?: () => void;
}

export function CardApprovalApp({
  user,
  displayName,
  onUnauthorized,
}: CardApprovalAppProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('list');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [prefillData, setPrefillData] = useState<PrefillQueryData | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const {
    items,
    settings,
    isLoading,
    error,
    myApprovalCount,
    approvedReadyCount,
  } = useCardApprovalData(user.uid, onUnauthorized);

  // 他アプリからのURLクエリ連携
  useEffect(() => {
    const prefill = readAndClearPrefillQuery();
    if (prefill) {
      setPrefillData(prefill);
      setIsFormOpen(true);
    }
  }, []);

  const selectedItem: CardItem | null = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  // 相談・一覧タブ（承認待ち・相談中・見送り。自分の承認待ちを最上位に）
  const listItems = useMemo(() => {
    const filtered = items.filter(
      (i) =>
        i.status === 'pending' ||
        i.status === 'discussing' ||
        i.status === 'rejected'
    );
    return filtered.sort((a, b) => {
      const aNeedsMe = a.status === 'pending' && a.proposerUid !== user.uid ? 1 : 0;
      const bNeedsMe = b.status === 'pending' && b.proposerUid !== user.uid ? 1 : 0;
      return bNeedsMe - aNeedsMe;
    });
  }, [items, user.uid]);

  // 購入OKタブ
  const approvedItems = useMemo(
    () => items.filter((i) => i.status === 'approved'),
    [items]
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <main className="flex-1 max-w-5xl w-full min-w-0 mx-auto px-4 py-5 pb-[calc(8rem+env(safe-area-inset-bottom))] space-y-4">
        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm font-medium">
            データを読み込み中...
          </div>
        ) : (
          <>
            {activeTab === 'list' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    承認待ち・相談一覧（{listItems.length}）
                  </h2>
                </div>
                {listItems.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                    現在、承認待ちや相談中のアイテムはありません。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {listItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        currentUid={user.uid}
                        settings={settings}
                        onSelect={(target) => setSelectedItemId(target.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'approved' && (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-slate-900">
                  購入OK・購入待ち（{approvedItems.length}）
                </h2>
                {approvedItems.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                    購入OKのアイテムはありません。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {approvedItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        currentUid={user.uid}
                        settings={settings}
                        onSelect={(target) => setSelectedItemId(target.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'dashboard' && (
              <DashboardView
                items={items}
                settings={settings}
                onSelectItem={(target) => setSelectedItemId(target.id)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView settings={settings} displayName={displayName} />
            )}
          </>
        )}
      </main>

      {/* フローティング新規登録ボタン */}
      <button
        type="button"
        onClick={() => {
          setPrefillData(null);
          setIsFormOpen(true);
        }}
        aria-label="新規購入登録"
        className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 inline-flex items-center gap-1.5 px-4 py-3 rounded-full bg-pink-600 hover:bg-pink-700 text-white font-bold text-sm shadow-lg"
      >
        <Plus className="w-5 h-5" />
        <span>登録</span>
      </button>

      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        myApprovalCount={myApprovalCount}
        approvedReadyCount={approvedReadyCount}
      />

      {isFormOpen && (
        <ItemFormModal
          user={user}
          displayName={displayName}
          settings={settings}
          prefill={prefillData}
          onClose={() => {
            setIsFormOpen(false);
            setPrefillData(null);
          }}
          onCreated={(isImmediate) => {
            setIsFormOpen(false);
            setPrefillData(null);
            if (isImmediate) {
              setActiveTab('dashboard');
            }
          }}
        />
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          user={user}
          displayName={displayName}
          settings={settings}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </div>
  );
}