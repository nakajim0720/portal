import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export interface NotificationTriggers {
  cardComment: boolean; // A-3: カード承認 - コメント投稿
  cardPurchased: boolean; // A-4: カード承認 - 対面即購入・購入完了報告
  portalItemAdded: boolean; // B-1: ポータル - 新規アイテム追加
  portalItemCompleted: boolean; // B-2: ポータル - タスク完了
  kaimonoListAdded: boolean; // C-1: 価格比較 - 共有買い物リスト追加
}

export interface NotificationSettings {
  enabled: boolean;
  webhookUrl: string;
  secretKey: string;
  triggers: NotificationTriggers;
  updatedAt?: string;
  updatedBy?: string;
}

export type NotificationTriggerKey = 'required' | keyof NotificationTriggers;

export interface SendLineNotificationParams {
  trigger: NotificationTriggerKey;
  appName: string;
  senderName: string;
  title: string;
  body: string;
  url?: string;
}

export const DEFAULT_NOTIFICATION_TRIGGERS: NotificationTriggers = {
  cardComment: true,
  cardPurchased: false,
  portalItemAdded: true,
  portalItemCompleted: false,
  kaimonoListAdded: false,
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  webhookUrl: '',
  secretKey: '',
  triggers: { ...DEFAULT_NOTIFICATION_TRIGGERS },
};

const SETTINGS_COL = 'shared_settings';
const NOTIFICATION_DOC_ID = 'notification';

function getNowJstIso(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+09:00`;
}

export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  const ref = doc(db, SETTINGS_COL, NOTIFICATION_DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      triggers: { ...DEFAULT_NOTIFICATION_TRIGGERS },
    };
  }
  const data = snap.data();
  const rawTriggers = (data.triggers ?? {}) as Partial<NotificationTriggers>;
  return {
    enabled: Boolean(data.enabled),
    webhookUrl: String(data.webhookUrl ?? ''),
    secretKey: String(data.secretKey ?? ''),
    triggers: {
      cardComment:
        typeof rawTriggers.cardComment === 'boolean'
          ? rawTriggers.cardComment
          : DEFAULT_NOTIFICATION_TRIGGERS.cardComment,
      cardPurchased:
        typeof rawTriggers.cardPurchased === 'boolean'
          ? rawTriggers.cardPurchased
          : DEFAULT_NOTIFICATION_TRIGGERS.cardPurchased,
      portalItemAdded:
        typeof rawTriggers.portalItemAdded === 'boolean'
          ? rawTriggers.portalItemAdded
          : DEFAULT_NOTIFICATION_TRIGGERS.portalItemAdded,
      portalItemCompleted:
        typeof rawTriggers.portalItemCompleted === 'boolean'
          ? rawTriggers.portalItemCompleted
          : DEFAULT_NOTIFICATION_TRIGGERS.portalItemCompleted,
      kaimonoListAdded:
        typeof rawTriggers.kaimonoListAdded === 'boolean'
          ? rawTriggers.kaimonoListAdded
          : DEFAULT_NOTIFICATION_TRIGGERS.kaimonoListAdded,
    },
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
  };
}

export async function saveNotificationSettings(
  settings: Omit<NotificationSettings, 'updatedAt'>,
  updatedBy: string
): Promise<void> {
  const ref = doc(db, SETTINGS_COL, NOTIFICATION_DOC_ID);
  await setDoc(
    ref,
    {
      enabled: settings.enabled,
      webhookUrl: settings.webhookUrl.trim(),
      secretKey: settings.secretKey.trim(),
      triggers: settings.triggers,
      updatedBy,
      updatedAt: getNowJstIso(),
    },
    { merge: true }
  );
}

async function postToGasWebhook(params: {
  webhookUrl: string;
  secretKey: string;
  appName: string;
  senderName: string;
  title: string;
  body: string;
  url: string;
}): Promise<void> {
  await fetch(params.webhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      secretKey: params.secretKey,
      appName: params.appName,
      senderName: params.senderName,
      title: params.title,
      body: params.body,
      url: params.url,
    }),
  });
}

export async function sendLineNotification(
  params: SendLineNotificationParams
): Promise<void> {
  try {
    const settings = await fetchNotificationSettings();
    if (!settings.enabled) {
      return;
    }
    const webhookUrl = settings.webhookUrl.trim();
    const secretKey = settings.secretKey.trim();
    if (!webhookUrl || !secretKey) {
      return;
    }

    if (params.trigger !== 'required' && !settings.triggers[params.trigger]) {
      return;
    }

    await postToGasWebhook({
      webhookUrl,
      secretKey,
      appName: params.appName,
      senderName: params.senderName,
      title: params.title,
      body: params.body,
      url: params.url ?? 'https://nakajim0720.github.io/portal/',
    });
  } catch (err) {
    // 通知失敗でアプリ本体の保存処理を止めない
    console.error('[lineNotify] 送信に失敗しました:', err);
  }
}

export async function sendTestLineNotification(params: {
  webhookUrl: string;
  secretKey: string;
  senderName: string;
}): Promise<void> {
  const webhookUrl = params.webhookUrl.trim();
  const secretKey = params.secretKey.trim();
  if (!webhookUrl || !secretKey) {
    throw new Error('GAS Webhook URL と Secret Key を入力してください。');
  }
  await postToGasWebhook({
    webhookUrl,
    secretKey,
    appName: 'ふたりのポータル',
    senderName: params.senderName,
    title: 'テスト通知',
    body: 'LINE通知の連携テストに成功しました。',
    url: 'https://nakajim0720.github.io/portal/',
  });
}