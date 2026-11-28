import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import {
  Home,
  Calendar,
  ShoppingCart,
  PartyPopper,
  Users,
  CheckCircle2,
  Trash2,
  Plus,
  RotateCcw,
  Search,
  ExternalLink,
  X,
} from 'lucide-react';
import type {
  PortalCategory,
  PortalItem,
  PortalItemStatus,
  PortalRepeatRule,
  PortalTabId,
  PortalUserProfile,
} from './types';
import { formatDateTimeJst, getTodayJstDateKey, getJstDateKey } from './dateJst';
import { TaskDetailModal } from './components/TaskDetailModal';
import { CalendarView } from './components/CalendarView';
import { sendLineNotification } from '../../shared/utils/lineNotify';

interface PendingAddDraft {
  title: string;
  dueDate: string;
  category: PortalCategory;
  assignee: string;
  repeatRule: PortalRepeatRule;
}

interface PortalFeatureAppProps {
  currentEmail: string;
  usersMap: Record<string, PortalUserProfile>;
  items: PortalItem[];
  isAccessVerified: boolean;
  isAccessRejected: boolean;
  addItem: (params: {
    title: string;
    dueDate: string;
    category: PortalCategory;
    assignee: string;
    repeatRule?: PortalRepeatRule;
  }) => Promise<void>;
  updateItem: (
    itemId: string,
    params: {
      title: string;
      dueDate: string;
      category: PortalCategory;
      assignee: string;
      repeatRule?: PortalRepeatRule;
    }
  ) => Promise<void>;
  updateItemStatus: (itemId: string, nextStatus: PortalItemStatus) => Promise<void>;
  deleteItemPermanently: (itemId: string) => Promise<void>;
  emptyTrash?: (targetItems: PortalItem[]) => Promise<void>;
  onSearchInKaimono?: (keyword: string) => void;
}

const SHARED_ASSIGNEE_KEY = 'shared';
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const NAV_TABS: Array<{ id: PortalTabId; label: string; shortLabel: string }> = [
  { id: 'home', label: 'ホーム', shortLabel: 'ホーム' },
  { id: 'calendar', label: 'カレンダー', shortLabel: '予定' },
  { id: 'shopping', label: 'お買い物', shortLabel: '買い物' },
  { id: 'dateideas', label: 'デート', shortLabel: 'デート' },
  { id: 'shared', label: '共有', shortLabel: '共有' },
  { id: 'completed', label: '実行済み', shortLabel: '完了' },
  { id: 'trash', label: 'ゴミ箱', shortLabel: 'ゴミ箱' },
];

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function renderTextWithAutoLinks(text: string): ReactNode {
  const parts = text.split(URL_REGEX);
  return parts.map((part, idx) => {
    if (/^https?:\/\/[^\s]+$/.test(part) && isSafeHttpUrl(part)) {
      return (
        <a
          key={`${idx}-${part}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 text-blue-700 hover:text-blue-800 underline underline-offset-2 break-all font-medium"
        >
          <span>{part}</span>
          <ExternalLink className="w-3.5 h-3.5 inline shrink-0" />
        </a>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function getTabIcon(tabId: PortalTabId) {
  switch (tabId) {
    case 'home':
      return <Home className="w-4 h-4 shrink-0" />;
    case 'calendar':
      return <Calendar className="w-4 h-4 shrink-0" />;
    case 'shopping':
      return <ShoppingCart className="w-4 h-4 shrink-0" />;
    case 'dateideas':
      return <PartyPopper className="w-4 h-4 shrink-0" />;
    case 'shared':
      return <Users className="w-4 h-4 shrink-0" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 shrink-0" />;
    case 'trash':
      return <Trash2 className="w-4 h-4 shrink-0" />;
  }
}

function getCategoryLabel(category: PortalCategory): string {
  switch (category) {
    case 'shopping':
      return 'お買い物';
    case 'dateideas':
      return 'デート・おでかけ';
    case 'shared':
      return '共有タスク・家事';
  }
}

function getRepeatBadgeLabel(rule: PortalRepeatRule | undefined): string {
  switch (rule) {
    case 'weekly':
      return '🔁 毎週';
    case 'monthly':
      return '🔁 毎月';
    case 'yearly':
      return '🔁 毎年';
    case 'anniversary':
      return '🎉 記念日';
    default:
      return '';
  }
}

function getFallbackNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim();
  return local || 'メンバー';
}

function resolveMemberName(
  usersMap: Record<string, PortalUserProfile>,
  email: string,
  fallbackCurrentEmail?: string
): string {
  if (email && usersMap[email]?.displayName?.trim()) {
    return usersMap[email].displayName.trim();
  }
  if (email) {
    return getFallbackNameFromEmail(email);
  }
  if (fallbackCurrentEmail) {
    return (
      usersMap[fallbackCurrentEmail]?.displayName?.trim() ||
      getFallbackNameFromEmail(fallbackCurrentEmail)
    );
  }
  return 'メンバー';
}

function isSharedAssigneeValue(assignee: string | undefined): boolean {
  return !assignee || assignee === SHARED_ASSIGNEE_KEY || assignee === 'ふたり共有';
}

export function PortalFeatureApp({
  currentEmail,
  usersMap,
  items,
  isAccessVerified,
  isAccessRejected,
  addItem,
  updateItem,
  updateItemStatus,
  deleteItemPermanently,
  emptyTrash,
  onSearchInKaimono,
}: PortalFeatureAppProps) {
  const [activeTab, setActiveTab] = useState<PortalTabId>('home');
  const [selectedDetailItemId, setSelectedDetailItemId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isEmptyingTrash, setIsEmptyingTrash] = useState<boolean>(false);

  // 新規追加フォーム状態
  const [title, setTitle] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [category, setCategory] = useState<PortalCategory>('shared');
  const [assignee, setAssignee] = useState<string>(SHARED_ASSIGNEE_KEY);
  const [repeatRule, setRepeatRule] = useState<PortalRepeatRule>('none');
  const [pendingDraft, setPendingDraft] = useState<PendingAddDraft | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // URLクエリパラメータからの初期値セット（?title=...&dueDate=...&category=...）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qTitle = params.get('title') || params.get('name');
    const qDueDate = params.get('dueDate') || params.get('date');
    const qCategory = params.get('category');

    if (qTitle) {
      setTitle(qTitle);
    }
    if (qDueDate) {
      setDueDate(qDueDate);
    }
    if (qCategory === 'shopping' || qCategory === 'dateideas' || qCategory === 'shared') {
      setCategory(qCategory);
    }
  }, []);

  const selectedDetailItem = selectedDetailItemId
    ? items.find((i) => i.id === selectedDetailItemId) ?? null
    : null;

  const memberEntries: Array<{ key: string; email: string; name: string }> = (() => {
    const emails: string[] = [];
    if (currentEmail) {
      emails.push(currentEmail);
    }
    Object.keys(usersMap).forEach((emailKey) => {
      if (emailKey && !emails.includes(emailKey)) {
        emails.push(emailKey);
      }
    });
    items.forEach((item) => {
      if (item.createdBy && item.createdBy.includes('@') && !emails.includes(item.createdBy)) {
        emails.push(item.createdBy);
      }
      if (item.assignee && item.assignee.includes('@') && !emails.includes(item.assignee)) {
        emails.push(item.assignee);
      }
    });

    return emails.slice(0, 2).map((email) => ({
      key: email,
      email,
      name: resolveMemberName(usersMap, email, currentEmail),
    }));
  })();

  const formatAssigneeLabel = (
    rawAssignee: string | undefined,
    itemCreatedBy?: string
  ): string => {
    if (isSharedAssigneeValue(rawAssignee)) {
      return 'ふたりの共有';
    }
    if (rawAssignee === 'private') {
      const targetEmail = itemCreatedBy || currentEmail;
      return resolveMemberName(usersMap, targetEmail, currentEmail);
    }
    if (rawAssignee && usersMap[rawAssignee]) {
      return resolveMemberName(usersMap, rawAssignee, currentEmail);
    }
    if (rawAssignee && rawAssignee.includes('@')) {
      return getFallbackNameFromEmail(rawAssignee);
    }
    return rawAssignee || 'ふたりの共有';
  };

  const currentSenderName = resolveMemberName(usersMap, currentEmail, currentEmail);

  const handleOpenConfirm = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !isAccessVerified || isAccessRejected) {
      return;
    }
    if (repeatRule === 'anniversary' && !dueDate) {
      setFormError('記念日は予定日時（日付）を設定してください。');
      return;
    }
    setFormError('');
    setPendingDraft({
      title: trimmed,
      dueDate,
      category,
      assignee,
      repeatRule,
    });
  };

  const handleConfirmAdd = async () => {
    if (!pendingDraft || !isAccessVerified || isAccessRejected || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      const draft = pendingDraft;
      await addItem({
        title: draft.title,
        dueDate: draft.dueDate,
        category: draft.category,
        assignee: draft.assignee,
        repeatRule: draft.repeatRule,
      });

      const dueText = draft.dueDate ? `\n予定日時: ${formatDateTimeJst(draft.dueDate)}` : '';
      void sendLineNotification({
        trigger: 'portalItemAdded',
        appName: 'ふたりのポータル',
        senderName: currentSenderName,
        title: `新規追加（${getCategoryLabel(draft.category)}）`,
        body: `${draft.title}\n担当: ${formatAssigneeLabel(draft.assignee, currentEmail)}${dueText}`,
        url: 'https://nakajim0720.github.io/portal/#/portal',
      });

      setTitle('');
      setDueDate('');
      setRepeatRule('none');
      setPendingDraft(null);
    } catch (err) {
      console.error(err);
      setFormError('アイテムの追加に失敗しました。アクセス権限をご確認ください。');
      setPendingDraft(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteItem = async (item: PortalItem) => {
    await updateItemStatus(item.id, 1);

    void sendLineNotification({
      trigger: 'portalItemCompleted',
      appName: 'ふたりのポータル',
      senderName: currentSenderName,
      title: `完了（${getCategoryLabel(item.category)}）`,
      body: `「${item.title}」を完了にしました。`,
      url: 'https://nakajim0720.github.io/portal/#/portal',
    });
  };

  const handleMoveToTrash = async (itemId: string) => {
    await updateItemStatus(itemId, 2);
  };

  const normalizedQuery = searchKeyword.trim().toLowerCase();
  const matchesKeyword = (item: PortalItem): boolean => {
    if (!normalizedQuery) return true;
    return item.title.toLowerCase().includes(normalizedQuery);
  };

  const visibleActiveItems = items.filter((item) => {
    if (item.status !== 0) {
      return false;
    }
    if (item.displayScope === 'private' && item.createdBy && item.createdBy !== currentEmail) {
      return false;
    }
    if (item.repeatRule === 'anniversary' && !normalizedQuery) {
      return false;
    }
    return matchesKeyword(item);
  });

  const trashItems = items.filter(
    (item) =>
      item.status === 2 &&
      (item.displayScope !== 'private' || item.createdBy === currentEmail) &&
      matchesKeyword(item)
  );

  const handleEmptyTrash = async () => {
    if (!emptyTrash || trashItems.length === 0 || isEmptyingTrash) return;
    if (!window.confirm(`ゴミ箱の${trashItems.length}件をすべて完全に削除しますか？`)) {
      return;
    }
    setIsEmptyingTrash(true);
    try {
      await emptyTrash(trashItems);
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  const todayKey = getTodayJstDateKey();
  const todayTasks = visibleActiveItems.filter(
    (item) =>
      item.repeatRule !== 'anniversary' &&
      item.category === 'shared' &&
      (!item.dueDate || getJstDateKey(item.dueDate) <= todayKey)
  );
  const upcomingEvents = visibleActiveItems.filter(
    (item) =>
      item.repeatRule !== 'anniversary' &&
      (item.category === 'dateideas' || Boolean(item.dueDate))
  );

  const renderItemRow = (item: PortalItem, mode: 'active' | 'completed' | 'trash') => {
    const creatorName = resolveMemberName(usersMap, item.createdBy, currentEmail);
    const assigneeText = formatAssigneeLabel(item.assignee, item.createdBy);
    const isShared = isSharedAssigneeValue(item.assignee);
    const repeatBadge = getRepeatBadgeLabel(item.repeatRule);
    const cleanSearchName = item.title.replace(/（[^）]*）$/, '').trim() || item.title;

    return (
      <li
        key={item.id}
        className="py-3 border-b border-slate-100 last:border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {mode === 'active' && item.repeatRule !== 'anniversary' && (
              <button
                type="button"
                onClick={() => handleCompleteItem(item)}
                aria-label="完了にする"
                className="w-6 h-6 rounded-md border border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center shrink-0"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-300 hover:text-emerald-600" />
              </button>
            )}
            <div
              onClick={() => setSelectedDetailItemId(item.id)}
              className={`text-left font-medium break-words cursor-pointer ${
                mode === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'
              }`}
            >
              {renderTextWithAutoLinks(item.title)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span
              className={`px-2 py-0.5 rounded-full font-semibold ${
                isShared ? 'bg-pink-50 text-pink-800' : 'bg-sky-50 text-sky-800'
              }`}
            >
              担当: {assigneeText}
            </span>
            {repeatBadge && (
              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 font-semibold">
                {repeatBadge}
              </span>
            )}
            {item.dueDate && (
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold">
                {formatDateTimeJst(item.dueDate)}
              </span>
            )}
            <span>作成: {creatorName}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {mode === 'active' && item.category === 'shopping' && onSearchInKaimono && (
            <button
              type="button"
              onClick={() => onSearchInKaimono(cleanSearchName)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold"
            >
              <Search className="w-3.5 h-3.5" />
              <span>価格比較</span>
            </button>
          )}

          {mode === 'active' && (
            <button
              type="button"
              onClick={() => updateItemStatus(item.id, 2)}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold"
            >
              ゴミ箱
            </button>
          )}

          {mode === 'completed' && (
            <>
              <button
                type="button"
                onClick={() => updateItemStatus(item.id, 0)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                未完了に戻す
              </button>
              <button
                type="button"
                onClick={() => updateItemStatus(item.id, 2)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold"
              >
                ゴミ箱
              </button>
            </>
          )}

          {mode === 'trash' && (
            <>
              <button
                type="button"
                onClick={() => updateItemStatus(item.id, 0)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                復元
              </button>
              <button
                type="button"
                onClick={() => deleteItemPermanently(item.id)}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                完全削除
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  const pendingAssigneeLabel = pendingDraft
    ? formatAssigneeLabel(pendingDraft.assignee, currentEmail)
    : '';

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* PC・タブレット向けポータル内タブ */}
      <div className="hidden md:block bg-white border-b border-slate-200">
        <nav className="max-w-5xl mx-auto px-4 py-2 flex gap-1 overflow-x-auto">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${
                  isActive
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {getTabIcon(tab.id)}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* メインエリア */}
      <main className="flex-1 max-w-5xl w-full min-w-0 mx-auto px-4 py-5 pb-24 md:pb-8 space-y-5 overflow-x-hidden">
        {formError && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium break-words">
            {formError}
          </div>
        )}

        {/* カレンダー以外のタブでキーワード検索バーを表示 */}
        {activeTab !== 'calendar' && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="キーワードで予定・メモ・記念日を検索..."
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                aria-label="検索をクリア"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {activeTab === 'home' && (
          <div className="space-y-5 min-w-0">
            {/* 新規アイテム追加カード */}
            <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 min-w-0 overflow-hidden">
              <h2 className="text-base font-bold text-slate-900">新規アイテムを追加</h2>
              <form
                onSubmit={handleOpenConfirm}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 min-w-0"
              >
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="予定・家事・メモ・URLを入力"
                  required
                  className="lg:col-span-2 block box-border w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <div className="relative w-full min-w-0 max-w-full h-[46px] rounded-xl border border-slate-300 bg-white flex items-center overflow-hidden focus-within:ring-2 focus-within:ring-pink-500">
                  {!dueDate && (
                    <span className="pointer-events-none absolute left-3 text-base text-slate-400">
                      {repeatRule === 'anniversary' ? '記念日の日付（必須）' : '予定日時（任意）'}
                    </span>
                  )}
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    aria-label="予定日時"
                    className={`appearance-none block box-border w-full min-w-0 max-w-full h-full px-3 bg-transparent border-0 text-base text-left focus:outline-none ${
                      dueDate ? 'text-slate-900' : 'text-transparent'
                    }`}
                  />
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PortalCategory)}
                  className="block box-border w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="shopping">お買い物</option>
                  <option value="dateideas">デート</option>
                  <option value="shared">共有・家事など</option>
                </select>
                <select
                  value={repeatRule}
                  onChange={(e) => setRepeatRule(e.target.value as PortalRepeatRule)}
                  aria-label="繰り返し・記念日"
                  className="block box-border w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="none">繰り返しなし</option>
                  <option value="weekly">毎週</option>
                  <option value="monthly">毎月</option>
                  <option value="yearly">毎年（予定）</option>
                  <option value="anniversary">記念日（カレンダーのみ）</option>
                </select>
                <div className="flex flex-col sm:flex-row gap-2 min-w-0 lg:col-span-1">
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    aria-label="担当・区分"
                    className="flex-1 block box-border w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value={SHARED_ASSIGNEE_KEY}>ふたりの共有</option>
                    {memberEntries.map((member) => (
                      <option key={member.key} value={member.email}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold text-base shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>確認</span>
                  </button>
                </div>
              </form>
            </section>

            {/* 今日のタスク・今度の予定 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 min-w-0">
              <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm min-w-0 overflow-hidden">
                <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2.5 mb-2">
                  今日の共有・家事タスク
                </h2>
                {todayTasks.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">表示するタスクはありません。</p>
                ) : (
                  <ul>{todayTasks.map((item) => renderItemRow(item, 'active'))}</ul>
                )}
              </section>

              <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm min-w-0 overflow-hidden">
                <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2.5 mb-2">
                  今度のデート・期日あり予定
                </h2>
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">予定はありません。</p>
                ) : (
                  <ul>{upcomingEvents.map((item) => renderItemRow(item, 'active'))}</ul>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            items={items}
            usersMap={usersMap}
            currentEmail={currentEmail}
            onUpdateItem={updateItem}
            onMoveToTrash={handleMoveToTrash}
          />
        )}

        {(activeTab === 'shopping' || activeTab === 'dateideas' || activeTab === 'shared') && (
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm min-w-0 overflow-hidden">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2.5 mb-2">
              {activeTab === 'shopping' && 'お買い物リスト'}
              {activeTab === 'dateideas' && 'デート・おでかけ候補'}
              {activeTab === 'shared' && '共有タスク・家事'}
            </h2>
            {visibleActiveItems.filter((item) => item.category === activeTab).length === 0 ? (
              <p className="text-sm text-slate-500 py-4">アイテムはありません。</p>
            ) : (
              <ul>
                {visibleActiveItems
                  .filter((item) => item.category === activeTab)
                  .map((item) => renderItemRow(item, 'active'))}
              </ul>
            )}
          </section>
        )}

        {activeTab === 'completed' && (
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm min-w-0 overflow-hidden">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2.5 mb-2">
              実行済み一覧
            </h2>
            {items.filter(
              (item) =>
                item.status === 1 &&
                (item.displayScope !== 'private' || item.createdBy === currentEmail) &&
                matchesKeyword(item)
            ).length === 0 ? (
              <p className="text-sm text-slate-500 py-4">完了したアイテムはありません。</p>
            ) : (
              <ul>
                {items
                  .filter(
                    (item) =>
                      item.status === 1 &&
                      (item.displayScope !== 'private' || item.createdBy === currentEmail) &&
                      matchesKeyword(item)
                  )
                  .map((item) => renderItemRow(item, 'completed'))}
              </ul>
            )}
          </section>
        )}

        {activeTab === 'trash' && (
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">ゴミ箱</h2>
              {trashItems.length > 0 && emptyTrash && (
                <button
                  type="button"
                  disabled={isEmptyingTrash}
                  onClick={handleEmptyTrash}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold shrink-0"
                >
                  {isEmptyingTrash ? '削除中...' : '空にする'}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 border-b border-slate-100 pb-2.5">
              ゴミ箱に入れたアイテムは7日経過すると自動で削除されます。
            </p>
            {trashItems.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">ゴミ箱は空です。</p>
            ) : (
              <ul>{trashItems.map((item) => renderItemRow(item, 'trash'))}</ul>
            )}
          </section>
        )}
      </main>

      {/* スマホ片手操作向け下部固定ナビゲーション */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-7 px-1 py-1">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-semibold gap-0.5 ${
                  isActive ? 'text-pink-700 bg-pink-50' : 'text-slate-500'
                }`}
              >
                {getTabIcon(tab.id)}
                <span className="truncate max-w-full">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 入力内容の確認モーダル */}
      {pendingDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full min-w-0 overflow-hidden p-5 shadow-xl space-y-4 my-auto">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">入力内容の確認</h3>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setPendingDraft(null)}
                aria-label="閉じる"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 shrink-0">内容</dt>
                <dd className="font-semibold text-slate-900 text-right break-words">
                  {pendingDraft.title}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 shrink-0">予定日時</dt>
                <dd className="font-medium text-rose-700 text-right">
                  {pendingDraft.dueDate ? formatDateTimeJst(pendingDraft.dueDate) : '未設定'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 shrink-0">カテゴリ</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {getCategoryLabel(pendingDraft.category)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 shrink-0">繰り返し</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {getRepeatBadgeLabel(pendingDraft.repeatRule) || 'なし'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 shrink-0">担当・区分</dt>
                <dd className="font-semibold text-slate-900 text-right">
                  {pendingAssigneeLabel}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setPendingDraft(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold text-base"
              >
                修正する
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAdd}
                className="flex-1 py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-semibold text-base"
              >
                {isSubmitting ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskDetailModal
        item={selectedDetailItem}
        usersMap={usersMap}
        currentEmail={currentEmail}
        onUpdateItem={updateItem}
        onMoveToTrash={handleMoveToTrash}
        onClose={() => setSelectedDetailItemId(null)}
      />
    </div>
  );
}