import { useEffect, useMemo, useState } from 'react';
import {
  subscribeCardItems,
  subscribeCardSettings,
} from '../services/cardRepository';
import {
  DEFAULT_CARD_SETTINGS,
  type CardItem,
  type CardSettings,
} from '../types';

export function useCardApprovalData(currentUid: string, onUnauthorized?: () => void) {
  const [items, setItems] = useState<CardItem[]>([]);
  const [settings, setSettings] = useState<CardSettings>(DEFAULT_CARD_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let itemsLoaded = false;
    let settingsLoaded = false;

    const checkDone = () => {
      if (itemsLoaded && settingsLoaded) {
        setIsLoading(false);
      }
    };

    const handleError = (err: Error) => {
      console.error('card-approval Firestore error:', err);
      if (err.message.includes('permission-denied') || err.message.includes('Missing or insufficient permissions')) {
        onUnauthorized?.();
        return;
      }
      setError('データの読み込み中にエラーが発生しました。');
      setIsLoading(false);
    };

    const unsubItems = subscribeCardItems(
      (data) => {
        setItems(data);
        itemsLoaded = true;
        checkDone();
      },
      handleError
    );

    const unsubSettings = subscribeCardSettings(
      (data) => {
        setSettings(data);
        settingsLoaded = true;
        checkDone();
      },
      handleError
    );

    return () => {
      unsubItems();
      unsubSettings();
    };
  }, [onUnauthorized]);

  const myApprovalCount = useMemo(
    () =>
      items.filter(
        (item) => item.status === 'pending' && item.proposerUid !== currentUid
      ).length,
    [items, currentUid]
  );

  const approvedReadyCount = useMemo(
    () => items.filter((item) => item.status === 'approved').length,
    [items]
  );

  return {
    items,
    settings,
    isLoading,
    error,
    myApprovalCount,
    approvedReadyCount,
  };
}