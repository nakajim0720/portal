import type { ApprovalRoute, CardItemStatus, CardSettings } from '../types';

export interface InitialStatusResult {
  status: CardItemStatus;
  approvalRoute: ApprovalRoute;
  description: string;
}

export function resolveInitialStatus(
  price: number,
  isOnsiteImmediate: boolean,
  settings: CardSettings
): InitialStatusResult {
  if (isOnsiteImmediate) {
    return {
      status: 'purchased',
      approvalRoute: 'onsite_agreed',
      description: 'その場で合意済みのため、即「購入済み」として記録されます。',
    };
  }

  if (price > 0 && price < settings.smallAmountThreshold) {
    return {
      status: 'approved',
      approvalRoute: 'small_amount',
      description: `少額ルール（${settings.smallAmountThreshold.toLocaleString('ja-JP')}円未満）により、自動で「購入OK」になります。`,
    };
  }

  if (price >= settings.highAmountThreshold) {
    return {
      status: 'pending',
      approvalRoute: 'pending',
      description: `高額ルール（${settings.highAmountThreshold.toLocaleString('ja-JP')}円以上）により、パートナーのコメント付き承認が必要です。`,
    };
  }

  return {
    status: 'pending',
    approvalRoute: 'pending',
    description: 'パートナーの承認待ちになります。',
  };
}

export function requiresApprovalComment(price: number, settings: CardSettings): boolean {
  return price >= settings.highAmountThreshold;
}