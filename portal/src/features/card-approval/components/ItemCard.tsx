import { ExternalLink, AlertCircle, Clock } from 'lucide-react';
import {
  APPROVAL_ROUTE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type CardItem,
  type CardSettings,
} from '../types';
import { formatCurrency } from '../utils/date';
import { requiresApprovalComment } from '../utils/approvalRules';

interface ItemCardProps {
  item: CardItem;
  currentUid: string;
  settings: CardSettings;
  onSelect: (item: CardItem) => void;
}

function getStatusBadgeClass(status: CardItem['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'discussing':
      return 'bg-sky-100 text-sky-800';
    case 'approved':
      return 'bg-emerald-100 text-emerald-800';
    case 'purchased':
      return 'bg-slate-200 text-slate-700';
    case 'rejected':
      return 'bg-rose-100 text-rose-700';
  }
}

export function ItemCard({ item, currentUid, settings, onSelect }: ItemCardProps) {
  const needsMyApproval =
    item.status === 'pending' && item.proposerUid !== currentUid;
  const isHighAmount = requiresApprovalComment(item.price, settings);
  const displayPrice =
    item.status === 'purchased' && item.finalPrice != null
      ? item.finalPrice
      : item.price;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm transition space-y-2.5 border ${
        needsMyApproval
          ? 'border-rose-400 ring-2 ring-rose-100 hover:bg-rose-50/30'
          : 'border-slate-200 hover:border-pink-300'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {needsMyApproval && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              あなたの承認待ち
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusBadgeClass(
              item.status
            )}`}
          >
            {STATUS_LABELS[item.status]}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
            {item.category}
          </span>
          {isHighAmount && item.status === 'pending' && (
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">
              高額
            </span>
          )}
        </div>

        <span className="text-base font-extrabold text-slate-900">
          {formatCurrency(displayPrice)}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base break-words">
            {item.name}
          </h3>
          {item.url && (
            <ExternalLink className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          )}
        </div>
        {item.purpose && (
          <p className="text-xs text-slate-600 line-clamp-2 break-words">
            {item.purpose}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-2">
          <span>提案: {item.proposerName}</span>
          {item.priority && <span>優先度: {PRIORITY_LABELS[item.priority]}</span>}
          {item.desiredTiming && (
            <span className="inline-flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {item.desiredTiming}
            </span>
          )}
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          {item.status === 'purchased' && item.purchasedDate
            ? `${item.purchasedDate} 購入`
            : APPROVAL_ROUTE_LABELS[item.approvalRoute]}
        </span>
      </div>
    </button>
  );
}