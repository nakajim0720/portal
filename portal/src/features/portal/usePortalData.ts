import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase';
import type {
  PortalCategory,
  PortalItem,
  PortalItemStatus,
  PortalRepeatRule,
  PortalUserProfile,
} from './types';
import { getNowJstIso, getTodayJstDateKey } from './dateJst';

const USERS_COLLECTION = 'portal_users';
const ITEMS_COLLECTION = 'portal_items';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeRepeatRule(raw: unknown): PortalRepeatRule {
  if (
    raw === 'weekly' ||
    raw === 'monthly' ||
    raw === 'yearly' ||
    raw === 'anniversary'
  ) {
    return raw;
  }
  return 'none';
}

function calculateNextDueDate(currentDueDate: string, rule: PortalRepeatRule): string {
  if (rule === 'none' || rule === 'anniversary') return '';

  let year: number;
  let month: number;
  let day: number;
  let timeSuffix = '';

  const match = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2})?/.exec(currentDueDate.trim());
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]) - 1;
    day = Number(match[3]);
    timeSuffix = match[4] || '';
  } else {
    const todayKey = getTodayJstDateKey();
    const [y, m, d] = todayKey.split('-').map(Number);
    year = y;
    month = m - 1;
    day = d;
    timeSuffix = '';
  }

  const baseDate = new Date(year, month, day);
  if (rule === 'weekly') {
    baseDate.setDate(baseDate.getDate() + 7);
  } else if (rule === 'monthly') {
    baseDate.setMonth(baseDate.getMonth() + 1);
  } else if (rule === 'yearly') {
    baseDate.setFullYear(baseDate.getFullYear() + 1);
  }

  const nextY = baseDate.getFullYear();
  const nextM = String(baseDate.getMonth() + 1).padStart(2, '0');
  const nextD = String(baseDate.getDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}${timeSuffix}`;
}

export function usePortalData(userEmail: string | null | undefined) {
  const [usersMap, setUsersMap] = useState<Record<string, PortalUserProfile>>({});
  const [items, setItems] = useState<PortalItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isAccessVerified, setIsAccessVerified] = useState<boolean>(false);
  const [isAccessRejected, setIsAccessRejected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!userEmail) {
      setUsersMap({});
      setItems([]);
      setIsLoadingData(false);
      setIsAccessVerified(false);
      setIsAccessRejected(false);
      setErrorMessage('');
      return;
    }

    setIsLoadingData(true);
    setIsAccessVerified(false);
    setIsAccessRejected(false);
    setErrorMessage('');

    let usersReady = false;
    let itemsReady = false;
    let rejected = false;

    const checkVerified = () => {
      if (!rejected && usersReady && itemsReady) {
        setIsAccessVerified(true);
        setIsLoadingData(false);
      }
    };

    const rejectAccess = (err: unknown, message: string) => {
      if (rejected) {
        return;
      }
      rejected = true;
      console.error(err);
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      setIsAccessVerified(false);
      setIsLoadingData(false);
      setIsAccessRejected(true);
      if (code === 'permission-denied') {
        setErrorMessage(
          'このGoogleアカウントにはアクセス権限がありません。登録済みのアカウントでログインしてください。'
        );
      } else {
        setErrorMessage(message);
      }
    };

    const unsubUsers = onSnapshot(
      collection(db, USERS_COLLECTION),
      (snapshot) => {
        if (rejected) {
          return;
        }
        const nextMap: Record<string, PortalUserProfile> = {};
        snapshot.forEach((docSnap) => {
          const raw = docSnap.data() as Partial<PortalUserProfile>;
          nextMap[docSnap.id] = {
            email: raw.email || docSnap.id,
            displayName: raw.displayName || '',
            icon: raw.icon || '',
            birthday: raw.birthday || '',
            updatedAt: raw.updatedAt || '',
          };
        });
        setUsersMap(nextMap);
        usersReady = true;
        checkVerified();
      },
      (err) => {
        rejectAccess(
          err,
          'ユーザー情報の取得に失敗しました（アクセス権限またはDB設定をご確認ください）。'
        );
      }
    );

    const unsubItems = onSnapshot(
      collection(db, ITEMS_COLLECTION),
      (snapshot) => {
        if (rejected) {
          return;
        }
        const nextItems: PortalItem[] = [];
        snapshot.forEach((docSnap) => {
          const raw = docSnap.data() as Partial<PortalItem>;
          nextItems.push({
            id: docSnap.id,
            title: raw.title || '',
            category: (raw.category as PortalCategory) || 'shared',
            assignee: raw.assignee || 'ふたり共有',
            displayScope: raw.displayScope === 'private' ? 'private' : 'shared',
            dueDate: raw.dueDate || '',
            repeatRule: normalizeRepeatRule(raw.repeatRule),
            status: (raw.status === 1 || raw.status === 2 ? raw.status : 0) as PortalItemStatus,
            createdBy: raw.createdBy || '',
            createdAt: raw.createdAt || '',
            trashedAt: raw.trashedAt || null,
          });
        });
        nextItems.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setItems(nextItems);
        itemsReady = true;
        checkVerified();
      },
      (err) => {
        rejectAccess(
          err,
          'アイテム一覧の取得に失敗しました（アクセス権限またはDB設定をご確認ください）。'
        );
      }
    );

    return () => {
      unsubUsers();
      unsubItems();
    };
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail || !isAccessVerified || isAccessRejected || items.length === 0) {
      return;
    }
    const nowMs = Date.now();
    items.forEach((item) => {
      if (item.status === 2 && item.trashedAt) {
        const trashedMs = new Date(item.trashedAt).getTime();
        if (!Number.isNaN(trashedMs) && nowMs - trashedMs > SEVEN_DAYS_MS) {
          deleteDoc(doc(db, ITEMS_COLLECTION, item.id)).catch((err) => {
            console.error(err);
          });
        }
      }
    });
  }, [items, userEmail, isAccessVerified, isAccessRejected]);

  const saveProfile = useCallback(
    async (params: { displayName: string; icon: string; birthday: string }) => {
      if (!userEmail || !isAccessVerified || isAccessRejected) {
        return;
      }
      const existing = usersMap[userEmail];
      const payload: PortalUserProfile = {
        email: userEmail,
        displayName: params.displayName.trim(),
        icon: params.icon || existing?.icon || '',
        birthday: params.birthday,
        updatedAt: getNowJstIso(),
      };
      await setDoc(doc(db, USERS_COLLECTION, userEmail), payload, { merge: true });
    },
    [userEmail, usersMap, isAccessVerified, isAccessRejected]
  );

  const addItem = useCallback(
    async (params: {
      title: string;
      dueDate: string;
      category: PortalCategory;
      assignee: string;
      repeatRule?: PortalRepeatRule;
    }) => {
      if (!userEmail || !isAccessVerified || isAccessRejected) {
        return;
      }
      const displayScope = params.assignee === 'private' ? 'private' : 'shared';
      await addDoc(collection(db, ITEMS_COLLECTION), {
        title: params.title.trim(),
        category: params.category,
        assignee: params.assignee,
        displayScope,
        dueDate: params.dueDate,
        repeatRule: normalizeRepeatRule(params.repeatRule),
        status: 0,
        createdBy: userEmail,
        createdAt: getNowJstIso(),
        trashedAt: null,
      });
    },
    [userEmail, isAccessVerified, isAccessRejected]
  );

  const updateItem = useCallback(
    async (
      itemId: string,
      params: {
        title: string;
        dueDate: string;
        category: PortalCategory;
        assignee: string;
        repeatRule?: PortalRepeatRule;
      }
    ) => {
      if (!isAccessVerified || isAccessRejected) {
        return;
      }
      const displayScope = params.assignee === 'private' ? 'private' : 'shared';
      await updateDoc(doc(db, ITEMS_COLLECTION, itemId), {
        title: params.title.trim(),
        dueDate: params.dueDate,
        category: params.category,
        assignee: params.assignee,
        displayScope,
        repeatRule: normalizeRepeatRule(params.repeatRule),
      });
    },
    [isAccessVerified, isAccessRejected]
  );

  const updateItemStatus = useCallback(
    async (itemId: string, nextStatus: PortalItemStatus) => {
      if (!isAccessVerified || isAccessRejected) {
        return;
      }
      const targetItem = items.find((i) => i.id === itemId);

      const updatePayload: { status: PortalItemStatus; trashedAt: string | null } = {
        status: nextStatus,
        trashedAt: nextStatus === 2 ? getNowJstIso() : null,
      };
      await updateDoc(doc(db, ITEMS_COLLECTION, itemId), updatePayload);

      // 毎週・毎月・毎年の繰り返しタスクを完了にした場合、次回分を自動生成
      if (
        nextStatus === 1 &&
        targetItem &&
        targetItem.status === 0 &&
        (targetItem.repeatRule === 'weekly' ||
          targetItem.repeatRule === 'monthly' ||
          targetItem.repeatRule === 'yearly')
      ) {
        const nextDueDate = calculateNextDueDate(targetItem.dueDate, targetItem.repeatRule);
        await addDoc(collection(db, ITEMS_COLLECTION), {
          title: targetItem.title,
          category: targetItem.category,
          assignee: targetItem.assignee,
          displayScope: targetItem.displayScope,
          dueDate: nextDueDate,
          repeatRule: targetItem.repeatRule,
          status: 0,
          createdBy: userEmail || targetItem.createdBy,
          createdAt: getNowJstIso(),
          trashedAt: null,
        });
      }
    },
    [isAccessVerified, isAccessRejected, items, userEmail]
  );

  const deleteItemPermanently = useCallback(
    async (itemId: string) => {
      if (!isAccessVerified || isAccessRejected) {
        return;
      }
      await deleteDoc(doc(db, ITEMS_COLLECTION, itemId));
    },
    [isAccessVerified, isAccessRejected]
  );

  return {
    usersMap,
    items,
    isLoadingData,
    isAccessVerified,
    isAccessRejected,
    errorMessage,
    saveProfile,
    addItem,
    updateItem,
    updateItemStatus,
    deleteItemPermanently,
  };
}