import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  APPROVAL_ROUTE_LABELS,
  type CardItem,
  type CardSettings,
} from '../types';
import {
  formatCurrency,
  formatMonthLabel,
  getCurrentMonthJST,
  shiftMonth,
} from '../utils/date';

interface DashboardViewProps {
  items: CardItem[];
  settings: CardSettings;
  onSelectItem: (item: CardItem) => void;
}

export function DashboardView({
  items,
  settings,
  onSelectItem,
}: DashboardViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    getCurrentMonthJST()
  );

  const monthPurchasedItems = useMemo(() => {
    return items
      .filter(
        (item) =>
          item.status === 'purchased' && item.purchasedMonth === selectedMonth
      )
      .sort((a, b) => (b.purchasedDate || '').localeCompare(a.purchasedDate || ''));
  }, [items, selectedMonth]);

  const totalSpent = useMemo(
    () =>
      monthPurchasedItems.reduce(
        (sum, item) => sum + (item.finalPrice ?? item.price),
        0
      ),
    [monthPurchasedItems]
  );

  const remaining = settings.monthlyBudget - totalSpent;
  const usageRate =
    settings.monthlyBudget > 0
      ? Math.min(100, Math.round((totalSpent / settings.monthlyBudget) * 100))
      : 0;
  const isOverBudget = remaining < 0;

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthPurchasedItems.forEach((item) => {
      const amount = item.finalPrice ?? item.price;
      map.set(item.category, (map.get(item.category) ?? 0) + amount);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [monthPurchasedItems]);

  return (
    <div className="space-y-5">
      {/* 年月切替 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-sm">
        <button
          type="button"
          onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
          aria-label="前の月"
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-slate-900">
          {formatMonthLabel(selectedMonth)}
        </h2>
        <button
          type="button"
          onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
          aria-label="次の月"
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-600"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 予算サマリー */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-500">今月の利用合計</p>
            <p className="text-2xl font-extrabold text-slate-900">
              {formatCurrency(totalSpent)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500">
              予算 {formatCurrency(settings.monthlyBudget)}
            </p>
            <p
              className={`text-sm font-bold ${
                isOverBudget ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {isOverBudget
                ? `${formatCurrency(Math.abs(remaining))} オーバー`
                : `残り ${formatCurrency(remaining)}`}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isOverBudget
                  ? 'bg-rose-600'
                  : usageRate >= 80
                  ? 'bg-amber-500'
                  : 'bg-pink-600'
              }`}
              style={{ width: `${usageRate}%` }}
            />
          </div>
          <p className="text-right text-xs font-semibold text-slate-500">
            消化率 {usageRate}%
          </p>
        </div>
      </section>

      {/* カテゴリ別内訳 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900">カテゴリ別内訳</h3>
        {categoryBreakdown.length === 0 ? (
          <p className="text-sm text-slate-500">この月の購入履歴はありません。</p>
        ) : (
          <ul className="space-y-2.5">
            {categoryBreakdown.map(([cat, amount]) => {
              const ratio =
                totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
              return (
                <li key={cat} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-800">{cat}</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(amount)}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ({ratio}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-pink-500"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 購入履歴一覧 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900">
          購入履歴（{monthPurchasedItems.length}件）
        </h3>
        {monthPurchasedItems.length === 0 ? (
          <p className="text-sm text-slate-500">履歴はありません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {monthPurchasedItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 rounded-xl px-2 -mx-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-bold text-sm text-slate-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.purchasedDate} ・ {item.category} ・{' '}
                      {APPROVAL_ROUTE_LABELS[item.approvalRoute]}
                    </p>
                  </div>
                  <span className="font-extrabold text-sm text-slate-900 shrink-0">
                    {formatCurrency(item.finalPrice ?? item.price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}