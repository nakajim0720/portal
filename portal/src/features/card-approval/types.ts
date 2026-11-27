import type { Timestamp } from 'firebase/firestore';

export const CARD_CATEGORIES = [
  '日用品・消耗品',
  '家電・ガジェット',
  '家具・インテリア',
  'キッチン・食料品',
  'ペット用品',
  'お出かけ・デート',
  'その他',
] as const;

export type CardCategory = (typeof CARD_CATEGORIES)[number];

export const CARD_PRIORITIES = ['high', 'medium', 'low'] as const;
export type CardPriority = (typeof CARD_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<CardPriority, string> = {
  high: '高（急ぎ）',
  medium: '中（ふつう）',
  low: '低（いつでも）',
};

export const DESIRED_TIMINGS = [
  '今すぐ',
  '今月中',
  '次のセール時',
  '時期未定',
] as const;
export type DesiredTiming = (typeof DESIRED_TIMINGS)[number];

export const CARD_STATUSES = [
  'pending',
  'discussing',
  'approved',
  'purchased',
  'rejected',
] as const;
export type CardItemStatus = (typeof CARD_STATUSES)[number];

export const STATUS_LABELS: Record<CardItemStatus, string> = {
  pending: '承認待ち',
  discussing: '相談・保留中',
  approved: '購入OK',
  purchased: '購入済み',
  rejected: '見送り',
};

export type ApprovalRoute =
  | 'pending'
  | 'small_amount'
  | 'partner_approved'
  | 'onsite_agreed';

export const APPROVAL_ROUTE_LABELS: Record<ApprovalRoute, string> = {
  pending: '承認待ち',
  small_amount: '少額自動許可',
  partner_approved: 'パートナー承認',
  onsite_agreed: 'その場で合意・即購入',
};

export type CardCommentType =
  | 'comment'
  | 'approve'
  | 'discuss'
  | 'reject'
  | 'system';

export type NavTab = 'list' | 'approved' | 'dashboard' | 'settings';

export interface CardItem {
  id: string;
  name: string;
  price: number;
  finalPrice: number | null;
  url: string;
  category: CardCategory;
  priority: CardPriority | null;
  desiredTiming: DesiredTiming | null;
  purpose: string;
  status: CardItemStatus;
  approvalRoute: ApprovalRoute;
  proposerUid: string;
  proposerEmail: string;
  proposerName: string;
  approverUid: string | null;
  approverName: string | null;
  approvedAt: Timestamp | null;
  purchasedDate: string | null;
  purchasedMonth: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface CardComment {
  id: string;
  itemId: string;
  authorUid: string;
  authorName: string;
  text: string;
  type: CardCommentType;
  createdAt: Timestamp | null;
}

export interface CardSettings {
  monthlyBudget: number;
  smallAmountThreshold: number;
  highAmountThreshold: number;
  updatedAt?: Timestamp | null;
  updatedBy?: string;
}

export const DEFAULT_CARD_SETTINGS: CardSettings = {
  monthlyBudget: 100000,
  smallAmountThreshold: 3000,
  highAmountThreshold: 20000,
};

export interface PrefillQueryData {
  name?: string;
  price?: string;
  url?: string;
  category?: CardCategory;
}