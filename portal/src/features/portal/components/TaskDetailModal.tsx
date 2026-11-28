import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Pencil, X } from 'lucide-react';
import type {
  PortalCategory,
  PortalItem,
  PortalRepeatRule,
  PortalUserProfile,
} from '../types';
import { formatDateTimeJst } from '../dateJst';
import { sendLineNotification } from '../../../shared/utils/lineNotify';

interface TaskDetailModalProps {
  item: PortalItem | null;
  usersMap: Record<string, PortalUserProfile>;
  currentEmail: string;
  onUpdateItem: (
    itemId: string,
    params: {
      title: string;
      dueDate: string;
      category: PortalCategory;
      assignee: string;
      repeatRule?: PortalRepeatRule;
    }
  ) => Promise<void>;
  onClose: () => void;
  onBackToList?: () => void;
  backButtonLabel?: string;
}

const SHARED_ASSIGNEE_KEY = 'shared';

function getCategoryLabel(category: PortalCategory): string {
  switch (category) {
    case 'shopping':
      return 'お買い物';
    case 'dateideas':
      return 'デート・おでかけ';
    case 'shared':
    default:
      return '共有タスク・家事';
  }
}

function getRepeatLabel(rule: PortalRepeatRule | undefined): string {
  switch (rule) {
    case 'weekly':
      return '毎週（完了で次回自動作成）';
    case 'monthly':
      return '毎月（完了で次回自動作成）';
    case 'yearly':
      return '毎年（完了で来年分を自動作成）';
    case 'anniversary':
      return '記念日（毎年カレンダーのみ表示）';
    default:
      return 'なし';
  }
}

function getFallbackNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim();
  return local || 'メンバー';
}

function resolveMemberName(
  usersMap: Record<string, PortalUserProfile>,
  email: string | undefined,
  fallbackCurrentEmail: string
): string {
  if (email && usersMap[email]?.displayName?.trim()) {
    return usersMap[email].displayName.trim();
  }
  if (email && email.includes('@')) {
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

function normalizeAssigneeForSelect(
  assignee: string | undefined,
  createdBy: string,
  currentEmail: string
): string {
  if (!assignee || assignee === SHARED_ASSIGNEE_KEY || assignee === 'ふたり共有') {
    return SHARED_ASSIGNEE_KEY;
  }
  if (assignee === 'private') {
    return createdBy || currentEmail || SHARED_ASSIGNEE_KEY;
  }
  return assignee;
}

function formatAssigneeLabel(
  assignee: string | undefined,
  createdBy: string,
  usersMap: Record<string, PortalUserProfile>,
  currentEmail: string
): string {
  if (!assignee || assignee === SHARED_ASSIGNEE_KEY || assignee === 'ふたり共有') {
    return 'ふたりの共有';
  }
  if (assignee === 'private') {
    return resolveMemberName(usersMap, createdBy || currentEmail, currentEmail);
  }
  if (usersMap[assignee]) {
    return resolveMemberName(usersMap, assignee, currentEmail);
  }
  if (assignee.includes('@')) {
    return getFallbackNameFromEmail(assignee);
  }
  return assignee;
}

export function TaskDetailModal({
  item,
  usersMap,
  currentEmail,
  onUpdateItem,
  onClose,
  onBackToList,
  backButtonLabel = 'その日の一覧に戻る',
}: TaskDetailModalProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [category, setCategory] = useState<PortalCategory>('shared');
  const [assignee, setAssignee] = useState<string>(SHARED_ASSIGNEE_KEY);
  const [repeatRule, setRepeatRule] = useState<PortalRepeatRule>('none');
  const [notifyLine, setNotifyLine] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!item) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    setTitle(item.title);
    setDueDate(item.dueDate || '');
    setCategory(item.category);
    setAssignee(normalizeAssigneeForSelect(item.assignee, item.createdBy, currentEmail));
    setRepeatRule(item.repeatRule || 'none');
    setNotifyLine(false);
    setErrorMsg('');
  }, [item?.id, currentEmail]);

  if (!item) {
    return null;
  }

  const canEdit = item.status === 0;
  const creatorName = resolveMemberName(usersMap, item.createdBy, currentEmail);
  const senderName = resolveMemberName(usersMap, currentEmail, currentEmail);

  const memberEntries: Array<{ email: string; name: string }> = (() => {
    const emails: string[] = [];
    if (currentEmail) {
      emails.push(currentEmail);
    }
    Object.keys(usersMap).forEach((emailKey) => {
      if (emailKey && !emails.includes(emailKey)) {
        emails.push(emailKey);
      }
    });
    if (item.createdBy && item.createdBy.includes('@') && !emails.includes(item.createdBy)) {
      emails.push(item.createdBy);
    }
    if (item.assignee && item.assignee.includes('@') && !emails.includes(item.assignee)) {
      emails.push(item.assignee);
    }
    return emails.slice(0, 2).map((email) => ({
      email,
      name: resolveMemberName(usersMap, email, currentEmail),
    }));
  })();

  const handleStartEdit = () => {
    setTitle(item.title);
    setDueDate(item.dueDate || '');
    setCategory(item.category);
    setAssignee(normalizeAssigneeForSelect(item.assignee, item.createdBy, currentEmail));
    setRepeatRule(item.repeatRule || 'none');
    setNotifyLine(false);
    setErrorMsg('');
    setIsEditing(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg('内容を入力してください。');
      return;
    }
    if (repeatRule === 'anniversary' && !dueDate) {
      setErrorMsg('記念日は予定日時（日付）を設定してください。');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      await onUpdateItem(item.id, {
        title: trimmedTitle,
        dueDate,
        category,
        assignee,
        repeatRule,
      });

      if (notifyLine) {
        const dueText = dueDate ? `\n予定日時: ${formatDateTimeJst(dueDate)}` : '\n予定日時: 未設定';
        const assigneeText = formatAssigneeLabel(assignee, item.createdBy, usersMap, currentEmail);
        void sendLineNotification({
          trigger: 'required',
          appName: 'ふたりのポータル',
          senderName,
          title: `予定を更新（${getCategoryLabel(category)}）`,
          body: `${trimmedTitle}\n担当: ${assigneeText}${dueText}`,
          url: 'https://nakajim0720.github.io/portal/#/portal',
        });
      }

      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setErrorMsg('更新に失敗しました。通信状況をご確認ください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full min-w-0 overflow-hidden p-5 shadow-xl space-y-4 my-auto">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-pink-700">
              {isEditing ? '予定・タスクを編集' : getCategoryLabel(item.category)}
            </p>
            <h3 className="text-lg font-bold text-slate-900 break-words">
              {isEditing ? '内容の変更' : item.title}
            </h3>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-3.5 min-w-0">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-700">
                内容 <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="block box-border w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-700">
                予定日時 {repeatRule === 'anniversary' && <span className="text-rose-600">*</span>}
              </label>
              <div className="relative w-full min-w-0 max-w-full h-[46px] rounded-xl border border-slate-300 bg-white flex items-center overflow-hidden focus-within:ring-2 focus-within:ring-pink-500">
                {!dueDate && (
                  <span className="pointer-events-none absolute left-3 text-base text-slate-400">
                    予定日時（任意）
                  </span>
                )}
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`appearance-none block box-border w-full min-w-0 max-w-full h-full px-3 bg-transparent border-0 text-base text-left focus:outline-none ${
                    dueDate ? 'text-slate-900' : 'text-transparent'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700">カテゴリ</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PortalCategory)}
                  className="block box-border w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="shopping">お買い物</option>
                  <option value="dateideas">デート</option>
                  <option value="shared">共有・家事など</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700">担当・区分</label>
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="block box-border w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value={SHARED_ASSIGNEE_KEY}>ふたりの共有</option>
                  {memberEntries.map((member) => (
                    <option key={member.email} value={member.email}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-700">繰り返し・記念日</label>
              <select
                value={repeatRule}
                onChange={(e) => setRepeatRule(e.target.value as PortalRepeatRule)}
                className="block box-border w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="none">繰り返しなし</option>
                <option value="weekly">毎週（完了で次回を自動作成）</option>
                <option value="monthly">毎月（完了で次回を自動作成）</option>
                <option value="yearly">毎年（完了で来年分を自動作成）</option>
                <option value="anniversary">記念日（毎年カレンダーのみ表示）</option>
              </select>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyLine}
                onChange={(e) => setNotifyLine(e.target.checked)}
                className="w-5 h-5 rounded accent-pink-600 shrink-0"
              />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Bell className="w-4 h-4 text-pink-600 shrink-0" />
                <span>変更をLINEで通知する</span>
              </span>
            </label>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold text-base"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-semibold text-base"
              >
                {isSaving ? '保存中...' : '保存する'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">担当・区分</dt>
                <dd className="font-semibold text-slate-900 text-right">
                  {formatAssigneeLabel(item.assignee, item.createdBy, usersMap, currentEmail)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">予定日時</dt>
                <dd className="font-medium text-rose-700 text-right">
                  {item.dueDate ? formatDateTimeJst(item.dueDate) : '未設定'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">繰り返し</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {getRepeatLabel(item.repeatRule)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">作成者</dt>
                <dd className="font-medium text-slate-900 text-right">{creatorName}</dd>
              </div>
              {item.createdAt && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">作成日時</dt>
                  <dd className="font-medium text-slate-700 text-right">
                    {formatDateTimeJst(item.createdAt)}
                  </dd>
                </div>
              )}
            </dl>

            <div className="space-y-2 pt-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base"
                >
                  <Pencil className="w-4 h-4" />
                  <span>編集する</span>
                </button>
              )}
              <div className="flex flex-wrap gap-2">
                {onBackToList && (
                  <button
                    type="button"
                    onClick={onBackToList}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-base"
                  >
                    {backButtonLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold text-base"
                >
                  閉じる
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}