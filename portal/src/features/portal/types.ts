export type PortalCategory = 'shopping' | 'dateideas' | 'shared';
export type PortalDisplayScope = 'shared' | 'private';
export type PortalItemStatus = 0 | 1 | 2; // 0: 未完了, 1: 実行済み, 2: ゴミ箱
export type PortalRepeatRule = 'none' | 'weekly' | 'monthly' | 'yearly' | 'anniversary';
export type PortalTabId =
  | 'home'
  | 'calendar'
  | 'shopping'
  | 'dateideas'
  | 'shared'
  | 'completed'
  | 'trash';

export interface PortalUserProfile {
  email: string;
  displayName: string;
  icon: string;
  birthday: string; // YYYY-MM-DD
  updatedAt: string;
}

export interface PortalItem {
  id: string;
  title: string;
  category: PortalCategory;
  assignee: string; // 'shared' | 'ふたり共有' | 'private' | 相手メールアドレス
  displayScope: PortalDisplayScope;
  dueDate: string;
  repeatRule?: PortalRepeatRule;
  status: PortalItemStatus;
  createdBy: string;
  createdAt: string; // JST ISO string
  trashedAt: string | null; // JST ISO string
}

export interface EcosystemAppLink {
  id: string;
  name: string;
  description: string;
  url: string;
  badgeText: string;
}