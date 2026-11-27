import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  X,
  ExternalLink,
  CheckCircle2,
  MessageCircle,
  XCircle,
  Send,
  Trash2,
  ShoppingBag,
} from 'lucide-react';
import {
  APPROVAL_ROUTE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type CardComment,
  type CardItem,
  type CardSettings,
} from '../types';
import {
  addCardComment,
  deleteCardItem,
  markCardItemPurchased,
  subscribeItemComments,
  updateCardItemDecision,
} from '../services/cardRepository';
import { formatCurrency, formatTimestampJST, getTodayJST } from '../utils/date';
import { requiresApprovalComment } from '../utils/approvalRules';
import { sendLineNotification } from '../../../shared/utils/lineNotify';

interface ItemDetailModalProps {
  item: CardItem;
  user: User;
  displayName: string;
  settings: CardSettings;
  onClose: () => void;
}

export function ItemDetailModal({
  item,
  user,
  displayName,
  settings,
  onClose,
}: ItemDetailModalProps) {
  const [comments, setComments] = useState<CardComment[]>([]);
  const [decisionComment, setDecisionComment] = useState<string>('');
  const [chatText, setChatText] = useState<string>('');
  const [finalPriceStr, setFinalPriceStr] = useState<string>(String(item.price));
  const [purchasedDate, setPurchasedDate] = useState<string>(getTodayJST());
  const [actionError, setActionError] = useState<string>('');
  const [isBusy, setIsBusy] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeItemComments(
      item.id,
      (list) => setComments(list),
      (err) => console.error(err)
    );
    return () => unsub();
  }, [item.id]);

  const isPartner = item.proposerUid !== user.uid;
  const canDecide =
    isPartner && (item.status === 'pending' || item.status === 'discussing');
  const needsCommentOnApprove = requiresApprovalComment(item.price, settings);

  const handleDecision = async (status: 'approved' | 'discussing' | 'rejected') => {
    setActionError('');
    if (status === 'approved' && needsCommentOnApprove && !decisionComment.trim()) {
      setActionError(
        `${formatCurrency(settings.highAmountThreshold)}以上の高額アイテムのため、承認コメントの入力が必須です。`
      );
      return;
    }
    setIsBusy(true);
    try {
      const commentSnapshot = decisionComment.trim();
      await updateCardItemDecision({
        itemId: item.id,
        status,
        approverUid: user.uid,
        approverName: displayName,
        commentText: commentSnapshot,
      });

      // LINE通知（A-2: 承認/保留/見送りは必須）
      const actionLabel =
        status === 'approved'
          ? '購入を承認しました'
          : status === 'discussing'
          ? '相談・保留にしました'
          : '見送りにしました';

      void sendLineNotification({
        trigger: 'required',
        appName: '共通カード承認',
        senderName: displayName,
        title: `${actionLabel}：${item.name}`,
        body: commentSnapshot
          ? `金額: ${formatCurrency(item.price)}\nコメント: ${commentSnapshot}`
          : `金額: ${formatCurrency(item.price)}`,
        url: 'https://nakajim0720.github.io/portal/#/card',
      });

      setDecisionComment('');
    } catch (err) {
      console.error(err);
      setActionError('ステータスの更新に失敗しました。');
    } finally {
      setIsBusy(false);
    }
  };

  const handleMarkPurchased = async (e: FormEvent) => {
    e.preventDefault();
    setActionError('');
    const finalPrice = Number(finalPriceStr.replace(/[^0-9]/g, '')) || 0;
    if (finalPrice <= 0) {
      setActionError('最終購入金額は1円以上で入力してください。');
      return;
    }
    setIsBusy(true);
    try {
      const targetDate = purchasedDate || getTodayJST();
      await markCardItemPurchased({
        itemId: item.id,
        finalPrice,
        purchasedDate: targetDate,
        actorUid: user.uid,
        actorName: displayName,
      });

      // LINE通知（A-4: 購入完了報告は任意）
      void sendLineNotification({
        trigger: 'cardPurchased',
        appName: '共通カード承認',
        senderName: displayName,
        title: `購入完了報告：${item.name}`,
        body: `最終金額: ${formatCurrency(finalPrice)}（購入日: ${targetDate}）`,
        url: 'https://nakajim0720.github.io/portal/#/card',
      });
    } catch (err) {
      console.error(err);
      setActionError('購入完了の記録に失敗しました。');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendComment = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = chatText.trim();
    if (!trimmed || isBusy) return;
    setIsBusy(true);
    try {
      await addCardComment({
        itemId: item.id,
        authorUid: user.uid,
        authorName: displayName,
        text: trimmed,
      });

      // LINE通知（A-3: コメント投稿は任意）
      void sendLineNotification({
        trigger: 'cardComment',
        appName: '共通カード承認',
        senderName: displayName,
        title: `コメント：${item.name}`,
        body: trimmed,
        url: 'https://nakajim0720.github.io/portal/#/card',
      });

      setChatText('');
    } catch (err) {
      console.error(err);
      setActionError('コメントの送信に失敗しました。');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`「${item.name}」を削除してもよろしいですか？`)) {
      return;
    }
    setIsBusy(true);
    try {
      await deleteCardItem(item.id);
      onClose();
    } catch (err) {
      console.error(err);
      setActionError('削除に失敗しました。');
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[92dvh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-1">
              {STATUS_LABELS[item.status]} ・ {item.category}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 break-words">
              {item.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 本文エリア */}
        <div className="overflow-y-auto p-5 space-y-5">
          {actionError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {actionError}
            </div>
          )}

          {/* 基本情報 */}
          <dl className="grid grid-cols-2 gap-3 text-sm bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <dt className="text-xs text-slate-500">予定金額</dt>
              <dd className="font-bold text-slate-900 text-base">
                {formatCurrency(item.price)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">最終金額</dt>
              <dd className="font-bold text-slate-900 text-base">
                {item.finalPrice != null ? formatCurrency(item.finalPrice) : '未確定'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">提案者</dt>
              <dd className="font-semibold text-slate-800">{item.proposerName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">承認経路</dt>
              <dd className="font-semibold text-slate-800">
                {APPROVAL_ROUTE_LABELS[item.approvalRoute]}
              </dd>
            </div>
            {item.priority && (
              <div>
                <dt className="text-xs text-slate-500">優先度</dt>
                <dd className="font-medium text-slate-800">
                  {PRIORITY_LABELS[item.priority]}
                </dd>
              </div>
            )}
            {item.desiredTiming && (
              <div>
                <dt className="text-xs text-slate-500">購入希望時期</dt>
                <dd className="font-medium text-slate-800">{item.desiredTiming}</dd>
              </div>
            )}
            {item.purchasedDate && (
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">購入日</dt>
                <dd className="font-semibold text-emerald-700">{item.purchasedDate}</dd>
              </div>
            )}
          </dl>

          {item.purpose && (
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-500">目的・メモ</h3>
              <p className="text-sm text-slate-800 whitespace-pre-wrap break-words bg-white border border-slate-200 rounded-xl p-3">
                {item.purpose}
              </p>
            </div>
          )}

          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-pink-700 hover:underline break-all"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>商品ページを開く</span>
            </a>
          )}

          {/* パートナー承認アクション */}
          {canDecide && (
            <section className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 space-y-3">
              <h3 className="text-sm font-bold text-rose-900">
                パートナー承認アクション
              </h3>
              <textarea
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                rows={2}
                placeholder={
                  needsCommentOnApprove
                    ? '高額アイテムのため承認時はコメント必須です'
                    : 'コメント（任意）'
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDecision('approved')}
                  className="inline-flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>承認</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDecision('discussing')}
                  className="inline-flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>相談・保留</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDecision('rejected')}
                  className="inline-flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold"
                >
                  <XCircle className="w-4 h-4" />
                  <span>見送り</span>
                </button>
              </div>
            </section>
          )}

          {/* 購入完了報告フォーム（approved時） */}
          {item.status === 'approved' && (
            <form
              onSubmit={handleMarkPurchased}
              className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 space-y-3"
            >
              <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-900">
                <ShoppingBag className="w-4 h-4" />
                <span>購入完了を報告する</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    最終購入金額（税込）
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={finalPriceStr}
                    onChange={(e) =>
                      setFinalPriceStr(e.target.value.replace(/[^0-9]/g, ''))
                    }
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-base text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">購入日</label>
                  <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl">
                    <input
                      type="date"
                      value={purchasedDate}
                      onChange={(e) => setPurchasedDate(e.target.value)}
                      required
                      className="block box-border w-full min-w-0 max-w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-base text-slate-900"
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm"
              >
                購入済みとして記録する
              </button>
            </form>
          )}

          {/* コメントスレッド */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              コメント・履歴（{comments.length}）
            </h3>
            {comments.length === 0 ? (
              <p className="text-xs text-slate-500">まだコメントはありません。</p>
            ) : (
              <ul className="space-y-2">
                {comments.map((c) => {
                  const isMine = c.authorUid === user.uid;
                  return (
                    <li
                      key={c.id}
                      className={`p-3 rounded-2xl text-sm space-y-1 ${
                        c.type === 'system'
                          ? 'bg-slate-100 text-slate-600 text-xs'
                          : isMine
                          ? 'bg-pink-50 border border-pink-100'
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-bold text-slate-700">{c.authorName}</span>
                        <span>{formatTimestampJST(c.createdAt)}</span>
                      </div>
                      <p className="text-slate-800 whitespace-pre-wrap break-words">
                        {c.text}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}

            <form onSubmit={handleSendComment} className="flex gap-2">
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="コメントを入力..."
                className="flex-1 min-w-0 px-3.5 py-2 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <button
                type="submit"
                disabled={isBusy || !chatText.trim()}
                aria-label="送信"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </section>

          {/* 削除ボタン */}
          <div className="pt-2 border-t border-slate-100 flex justify-end pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleDelete}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>このアイテムを削除</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}