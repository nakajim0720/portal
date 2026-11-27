import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import {
  DEFAULT_CARD_SETTINGS,
  type ApprovalRoute,
  type CardCategory,
  type CardComment,
  type CardCommentType,
  type CardItem,
  type CardItemStatus,
  type CardPriority,
  type CardSettings,
  type DesiredTiming,
} from '../types';

const ITEMS_COL = 'card_items';
const COMMENTS_COL = 'card_comments';
const SETTINGS_COL = 'card_settings';
const SETTINGS_DOC_ID = 'global';

export function subscribeCardItems(
  onData: (items: CardItem[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, ITEMS_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CardItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name ?? ''),
          price: Number(data.price ?? 0),
          finalPrice: data.finalPrice != null ? Number(data.finalPrice) : null,
          url: String(data.url ?? ''),
          category: (data.category ?? 'その他') as CardCategory,
          priority: (data.priority ?? null) as CardPriority | null,
          desiredTiming: (data.desiredTiming ?? null) as DesiredTiming | null,
          purpose: String(data.purpose ?? ''),
          status: (data.status ?? 'pending') as CardItemStatus,
          approvalRoute: (data.approvalRoute ?? 'pending') as ApprovalRoute,
          proposerUid: String(data.proposerUid ?? ''),
          proposerEmail: String(data.proposerEmail ?? ''),
          proposerName: String(data.proposerName ?? ''),
          approverUid: data.approverUid ? String(data.approverUid) : null,
          approverName: data.approverName ? String(data.approverName) : null,
          approvedAt: data.approvedAt ?? null,
          purchasedDate: data.purchasedDate ? String(data.purchasedDate) : null,
          purchasedMonth: data.purchasedMonth ? String(data.purchasedMonth) : null,
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        };
      });
      onData(list);
    },
    (err) => onError(err)
  );
}

export function subscribeCardSettings(
  onData: (settings: CardSettings) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const ref = doc(db, SETTINGS_COL, SETTINGS_DOC_ID);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_CARD_SETTINGS);
        return;
      }
      const data = snap.data();
      onData({
        monthlyBudget: Number(data.monthlyBudget ?? DEFAULT_CARD_SETTINGS.monthlyBudget),
        smallAmountThreshold: Number(
          data.smallAmountThreshold ?? DEFAULT_CARD_SETTINGS.smallAmountThreshold
        ),
        highAmountThreshold: Number(
          data.highAmountThreshold ?? DEFAULT_CARD_SETTINGS.highAmountThreshold
        ),
        updatedAt: data.updatedAt ?? null,
        updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
      });
    },
    (err) => onError(err)
  );
}

export function subscribeItemComments(
  itemId: string,
  onData: (comments: CardComment[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  // 複合インデックス回避のため where のみで取得し、クライアント側で createdAt 昇順ソート
  const q = query(collection(db, COMMENTS_COL), where('itemId', '==', itemId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CardComment[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          itemId: String(data.itemId ?? ''),
          authorUid: String(data.authorUid ?? ''),
          authorName: String(data.authorName ?? ''),
          text: String(data.text ?? ''),
          type: (data.type ?? 'comment') as CardCommentType,
          createdAt: data.createdAt ?? null,
        };
      });
      list.sort((a, b) => {
        const ta = a.createdAt ? a.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
        const tb = b.createdAt ? b.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
      onData(list);
    },
    (err) => onError(err)
  );
}

export interface CreateCardItemInput {
  name: string;
  price: number;
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
  purchasedDate: string | null;
  purchasedMonth: string | null;
}

export async function createCardItem(input: CreateCardItemInput): Promise<string> {
  const isImmediate = input.status === 'purchased';
  const docRef = await addDoc(collection(db, ITEMS_COL), {
    name: input.name,
    price: input.price,
    finalPrice: isImmediate ? input.price : null,
    url: input.url,
    category: input.category,
    priority: input.priority,
    desiredTiming: input.desiredTiming,
    purpose: input.purpose,
    status: input.status,
    approvalRoute: input.approvalRoute,
    proposerUid: input.proposerUid,
    proposerEmail: input.proposerEmail,
    proposerName: input.proposerName,
    approverUid: null,
    approverName: null,
    approvedAt: null,
    purchasedDate: input.purchasedDate,
    purchasedMonth: input.purchasedMonth,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCardItemDecision(params: {
  itemId: string;
  status: 'approved' | 'discussing' | 'rejected';
  approverUid: string;
  approverName: string;
  commentText: string;
}): Promise<void> {
  const itemRef = doc(db, ITEMS_COL, params.itemId);
  const updatePayload: Record<string, unknown> = {
    status: params.status,
    updatedAt: serverTimestamp(),
  };

  if (params.status === 'approved') {
    updatePayload.approvalRoute = 'partner_approved';
    updatePayload.approverUid = params.approverUid;
    updatePayload.approverName = params.approverName;
    updatePayload.approvedAt = serverTimestamp();
  }

  await updateDoc(itemRef, updatePayload);

  const commentType: CardCommentType =
    params.status === 'approved'
      ? 'approve'
      : params.status === 'discussing'
      ? 'discuss'
      : 'reject';

  const defaultText =
    params.status === 'approved'
      ? '購入を承認しました。'
      : params.status === 'discussing'
      ? '相談・保留にしました。'
      : '今回は見送りにしました。';

  await addDoc(collection(db, COMMENTS_COL), {
    itemId: params.itemId,
    authorUid: params.approverUid,
    authorName: params.approverName,
    text: params.commentText.trim() || defaultText,
    type: commentType,
    createdAt: serverTimestamp(),
  });
}

export async function markCardItemPurchased(params: {
  itemId: string;
  finalPrice: number;
  purchasedDate: string;
  actorUid: string;
  actorName: string;
}): Promise<void> {
  const purchasedMonth = params.purchasedDate.slice(0, 7);
  const itemRef = doc(db, ITEMS_COL, params.itemId);
  await updateDoc(itemRef, {
    status: 'purchased',
    finalPrice: params.finalPrice,
    purchasedDate: params.purchasedDate,
    purchasedMonth,
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, COMMENTS_COL), {
    itemId: params.itemId,
    authorUid: params.actorUid,
    authorName: params.actorName,
    text: `購入完了を報告しました（最終金額: ¥${params.finalPrice.toLocaleString('ja-JP')} / 購入日: ${params.purchasedDate}）`,
    type: 'system',
    createdAt: serverTimestamp(),
  });
}

export async function addCardComment(params: {
  itemId: string;
  authorUid: string;
  authorName: string;
  text: string;
  type?: CardCommentType;
}): Promise<void> {
  await addDoc(collection(db, COMMENTS_COL), {
    itemId: params.itemId,
    authorUid: params.authorUid,
    authorName: params.authorName,
    text: params.text.trim(),
    type: params.type ?? 'comment',
    createdAt: serverTimestamp(),
  });
}

export async function deleteCardItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, ITEMS_COL, itemId));
}

export async function saveCardSettings(params: {
  monthlyBudget: number;
  smallAmountThreshold: number;
  highAmountThreshold: number;
  updatedBy: string;
}): Promise<void> {
  const ref = doc(db, SETTINGS_COL, SETTINGS_DOC_ID);
  await setDoc(
    ref,
    {
      monthlyBudget: params.monthlyBudget,
      smallAmountThreshold: params.smallAmountThreshold,
      highAmountThreshold: params.highAmountThreshold,
      updatedBy: params.updatedBy,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}