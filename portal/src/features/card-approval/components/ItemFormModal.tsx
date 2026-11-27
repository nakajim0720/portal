import { useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { X, Info, Zap } from 'lucide-react';
import {
  CARD_CATEGORIES,
  CARD_PRIORITIES,
  DESIRED_TIMINGS,
  PRIORITY_LABELS,
  type CardCategory,
  type CardPriority,
  type CardSettings,
  type DesiredTiming,
  type PrefillQueryData,
} from '../types';
import { resolveInitialStatus } from '../utils/approvalRules';
import { formatCurrency, getTodayJST } from '../utils/date';
import { createCardItem } from '../services/cardRepository';
import { sendLineNotification } from '../../../shared/utils/lineNotify';

interface ItemFormModalProps {
  user: User;
  displayName: string;
  settings: CardSettings;
  prefill?: PrefillQueryData | null;
  onClose: () => void;
  onCreated: (isImmediate: boolean) => void;
}

export function ItemFormModal({
  user,
  displayName,
  settings,
  prefill,
  onClose,
  onCreated,
}: ItemFormModalProps) {
  const [isOnsiteImmediate, setIsOnsiteImmediate] = useState<boolean>(false);
  const [name, setName] = useState<string>(prefill?.name ?? '');
  const [priceStr, setPriceStr] = useState<string>(prefill?.price ?? '');
  const [url, setUrl] = useState<string>(prefill?.url ?? '');
  const [category, setCategory] = useState<CardCategory>(
    prefill?.category ?? '日用品・消耗品'
  );
  const [priority, setPriority] = useState<CardPriority>('medium');
  const [desiredTiming, setDesiredTiming] = useState<DesiredTiming>('今月中');
  const [purpose, setPurpose] = useState<string>('');
  const [purchasedDate, setPurchasedDate] = useState<string>(getTodayJST());
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const numericPrice = Number(priceStr.replace(/[^0-9]/g, '')) || 0;
  const rulePreview = resolveInitialStatus(numericPrice, isOnsiteImmediate, settings);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('商品名を入力してください。');
      return;
    }
    if (numericPrice <= 0) {
      setErrorMsg('金額は1円以上で入力してください。');
      return;
    }
    if (!isOnsiteImmediate && !purpose.trim()) {
      setErrorMsg('目的・用途を入力してください。');
      return;
    }
    const trimmedUrl = url.trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      setErrorMsg('URLは http:// または https:// から始まる形式で入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetDate = isOnsiteImmediate ? purchasedDate || getTodayJST() : null;
      await createCardItem({
        name: trimmedName,
        price: numericPrice,
        url: trimmedUrl,
        category,
        priority: isOnsiteImmediate ? null : priority,
        desiredTiming: isOnsiteImmediate ? null : desiredTiming,
        purpose: purpose.trim(),
        status: rulePreview.status,
        approvalRoute: rulePreview.approvalRoute,
        proposerUid: user.uid,
        proposerEmail: user.email || '',
        proposerName: displayName,
        purchasedDate: targetDate,
        purchasedMonth: targetDate ? targetDate.slice(0, 7) : null,
      });

      // LINE通知（A-1: 承認待ちは必須 / A-4: 対面即購入は任意）
      if (isOnsiteImmediate) {
        void sendLineNotification({
          trigger: 'cardPurchased',
          appName: '共通カード承認',
          senderName: displayName,
          title: 'その場で合意・購入記録',
          body: `${trimmedName}（${formatCurrency(numericPrice)} / ${category}）を購入済みとして記録しました。`,
          url: 'https://nakajim0720.github.io/portal/#/card',
        });
      } else if (rulePreview.status === 'pending') {
        void sendLineNotification({
          trigger: 'required',
          appName: '共通カード承認',
          senderName: displayName,
          title: '購入承認リクエスト',
          body: `${trimmedName}（${formatCurrency(numericPrice)} / ${category}）の承認をお願いします。\n目的: ${purpose.trim()}`,
          url: 'https://nakajim0720.github.io/portal/#/card',
        });
      }

      onCreated(isOnsiteImmediate);
    } catch (err) {
      console.error(err);
      setErrorMsg('登録に失敗しました。通信状況をご確認ください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">共通カードの購入登録</h2>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          {/* 対面即購入モード切替 */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-amber-200 bg-amber-50/70 cursor-pointer">
            <input
              type="checkbox"
              checked={isOnsiteImmediate}
              onChange={(e) => setIsOnsiteImmediate(e.target.checked)}
              className="mt-1 w-5 h-5 rounded accent-amber-600 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-sm">
                <Zap className="w-4 h-4 shrink-0" />
                <span>その場で合意済み・今すぐ購入完了にする</span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                デート中や店頭で2人一緒に決めた買い物向け。承認待ちを飛ばして購入履歴へ記録します。
              </p>
            </div>
          </label>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700">
              商品名 <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：加湿器、日用品まとめ買い"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-700">
                金額（税込・円） <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="例：4980"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-700">カテゴリ</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CardCategory)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                {CARD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 金額連動ルールの事前プレビュー */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <Info className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
            <span>{rulePreview.description}</span>
          </div>

          {isOnsiteImmediate ? (
            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-700">購入日</label>
              <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl">
                <input
                  type="date"
                  value={purchasedDate}
                  onChange={(e) => setPurchasedDate(e.target.value)}
                  className="block box-border w-full min-w-0 max-w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700">優先度</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as CardPriority)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  {CARD_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700">購入希望時期</label>
                <select
                  value={desiredTiming}
                  onChange={(e) => setDesiredTiming(e.target.value as DesiredTiming)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  {DESIRED_TIMINGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700">
              {isOnsiteImmediate ? 'メモ（任意）' : '目的・用途'}{' '}
              {!isOnsiteImmediate && <span className="text-rose-600">*</span>}
            </label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              required={!isOnsiteImmediate}
              placeholder={
                isOnsiteImmediate
                  ? 'お店の名前や補足メモがあれば入力'
                  : 'なぜ欲しいか、どこで使うかなどを簡単に記入'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700">
              商品URL（任意）
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div className="flex gap-2 pt-2 pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold text-base"
            >
              {isSubmitting
                ? '登録中...'
                : isOnsiteImmediate
                ? '購入済みで記録'
                : '登録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}