import { X } from 'lucide-react';
import type { PortalItem, PortalUserProfile } from '../types';
import { formatDateTimeJst } from '../dateJst';

interface TaskDetailModalProps {
  item: PortalItem | null;
  usersMap: Record<string, PortalUserProfile>;
  onClose: () => void;
}

function getCategoryLabel(category: PortalItem['category']): string {
  switch (category) {
    case 'shopping':
      return 'お買い物';
    case 'dateideas':
      return 'デート';
    case 'shared':
    default:
      return '共有・家事など';
  }
}

function getAssigneeLabel(assignee: string, usersMap: Record<string, PortalUserProfile>): string {
  if (assignee === 'private') {
    return '自分だけ';
  }
  if (!assignee || assignee === 'ふたり共有') {
    return 'ふたり共有';
  }
  return usersMap[assignee]?.displayName || assignee;
}

export function TaskDetailModal({ item, usersMap, onClose }: TaskDetailModalProps) {
  if (!item) {
    return null;
  }

  const creatorName = usersMap[item.createdBy]?.displayName || item.createdBy || '不明';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="text-lg font-bold text-slate-900 break-words">{item.title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">期日</dt>
            <dd className="font-medium text-slate-900 text-right">
              {item.dueDate ? formatDateTimeJst(item.dueDate) : '未設定'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">カテゴリー</dt>
            <dd className="font-medium text-pink-700 text-right">
              {getCategoryLabel(item.category)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">担当者</dt>
            <dd className="font-medium text-slate-900 text-right">
              {getAssigneeLabel(item.assignee, usersMap)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">作成者・日時</dt>
            <dd className="font-medium text-slate-700 text-right">
              {creatorName}
              {item.createdAt ? ` (${formatDateTimeJst(item.createdAt)})` : ''}
            </dd>
          </div>
        </dl>

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold text-base"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}