import { useEffect, useState, type FormEvent } from 'react';
import { Bell, CheckCircle2, Send, X } from 'lucide-react';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  fetchNotificationSettings,
  saveNotificationSettings,
  sendTestLineNotification,
  type NotificationSettings,
  type NotificationTriggers,
} from '../utils/lineNotify';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  displayName: string;
  onClose: () => void;
}

const OPTIONAL_TRIGGER_ITEMS: Array<{
  key: keyof NotificationTriggers;
  group: string;
  label: string;
  description: string;
}> = [
  {
    key: 'cardComment',
    group: 'カード承認',
    label: 'コメントが投稿されたとき',
    description: '相談中アイテムに新しいコメントが届いた際に通知',
  },
  {
    key: 'cardPurchased',
    group: 'カード承認',
    label: '対面即購入・購入完了報告がされたとき',
    description: '購入済みとして記録された際に通知',
  },
  {
    key: 'portalItemAdded',
    group: 'ポータル',
    label: '新しい予定・タスク・デート候補が追加されたとき',
    description: 'ポータルに新規アイテムが追加された際に通知',
  },
  {
    key: 'portalItemCompleted',
    group: 'ポータル',
    label: 'タスクが完了になったとき',
    description: 'ポータルのアイテムに完了チェックを入れた際に通知',
  },
  {
    key: 'kaimonoListAdded',
    group: '価格比較',
    label: '共有買い物リストにアイテムが追加されたとき',
    description: '価格比較アプリの買い物リストに追加された際に通知',
  },
];

export function NotificationSettingsModal({
  isOpen,
  displayName,
  onClose,
}: NotificationSettingsModalProps) {
  const [settings, setSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setFeedback(null);
    setIsLoading(true);
    fetchNotificationSettings()
      .then((loaded) => setSettings(loaded))
      .catch((err) => {
        console.error(err);
        setFeedback({
          type: 'error',
          text: '通知設定の読み込みに失敗しました。',
        });
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const toggleTrigger = (key: keyof NotificationTriggers) => {
    setSettings((prev) => ({
      ...prev,
      triggers: {
        ...prev.triggers,
        [key]: !prev.triggers[key],
      },
    }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (settings.enabled) {
      const url = settings.webhookUrl.trim();
      if (!url || !/^https:\/\/script\.google\.com\//i.test(url)) {
        setFeedback({
          type: 'error',
          text: '通知をONにする場合は、https://script.google.com/ で始まるGASウェブアプリURLを入力してください。',
        });
        return;
      }
      if (!settings.secretKey.trim()) {
        setFeedback({
          type: 'error',
          text: 'Secret Key（合言葉）を入力してください。',
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      await saveNotificationSettings(
        {
          enabled: settings.enabled,
          webhookUrl: settings.webhookUrl,
          secretKey: settings.secretKey,
          triggers: settings.triggers,
        },
        displayName
      );
      setFeedback({
        type: 'success',
        text: 'LINE通知設定を保存しました（2人の端末に即時反映されます）。',
      });
    } catch (err) {
      console.error(err);
      setFeedback({
        type: 'error',
        text: '設定の保存に失敗しました。',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSend = async () => {
    setFeedback(null);
    setIsTesting(true);
    try {
      await sendTestLineNotification({
        webhookUrl: settings.webhookUrl,
        secretKey: settings.secretKey,
        senderName: displayName,
      });
      setFeedback({
        type: 'success',
        text: 'テスト通知を送信しました。LINEグループに届いているか確認してください。',
      });
    } catch (err) {
      console.error(err);
      setFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'テスト送信に失敗しました。URLとSecret Keyを確認してください。',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-pink-600" />
            <h2 className="text-lg font-bold text-slate-900">LINE通知設定</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">読み込み中...</div>
        ) : (
          <form onSubmit={handleSave} className="overflow-y-auto p-5 space-y-5">
            {feedback && (
              <div
                className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {feedback.type === 'success' && (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            {/* 全体ON/OFF */}
            <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer">
              <div>
                <p className="text-sm font-bold text-slate-900">LINE通知を有効にする</p>
                <p className="text-xs text-slate-500">
                  OFFにするとすべての通知が一時停止されます
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="w-5 h-5 rounded accent-pink-600 shrink-0"
              />
            </label>

            {/* 接続先設定 */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700">
                  GAS ウェブアプリURL
                </label>
                <input
                  type="url"
                  value={settings.webhookUrl}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, webhookUrl: e.target.value }))
                  }
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700">
                  Secret Key（合言葉）
                </label>
                <input
                  type="password"
                  value={settings.secretKey}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, secretKey: e.target.value }))
                  }
                  placeholder="GAS側と一致させる任意の文字列"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>

            {/* 必須通知 */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                必須通知（通知ON時は常に送信）
              </h3>
              <ul className="p-3.5 rounded-2xl bg-pink-50/60 border border-pink-100 space-y-1.5 text-xs text-slate-700">
                <li className="flex items-center gap-2 font-semibold text-pink-900">
                  <span className="px-1.5 py-0.5 rounded bg-pink-200 text-pink-900 text-[10px] font-bold">
                    必須
                  </span>
                  <span>カード承認：新規申請（承認待ちになったとき）</span>
                </li>
                <li className="flex items-center gap-2 font-semibold text-pink-900">
                  <span className="px-1.5 py-0.5 rounded bg-pink-200 text-pink-900 text-[10px] font-bold">
                    必須
                  </span>
                  <span>カード承認：承認／相談・保留／見送りされたとき</span>
                </li>
              </ul>
            </div>

            {/* 任意通知チェックボックス */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                任意通知（チェックした項目のみ送信）
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {OPTIONAL_TRIGGER_ITEMS.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 p-3.5 bg-white hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={settings.triggers[item.key]}
                      onChange={() => toggleTrigger(item.key)}
                      className="mt-0.5 w-5 h-5 rounded accent-pink-600 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {item.group}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {item.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* アクションボタン */}
            <div className="space-y-2 pt-1 pb-[env(safe-area-inset-bottom)]">
              <button
                type="submit"
                disabled={isSaving || isTesting}
                className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold text-base"
              >
                {isSaving ? '保存中...' : '設定を保存する'}
              </button>
              <button
                type="button"
                disabled={isSaving || isTesting}
                onClick={handleTestSend}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-semibold text-sm inline-flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>{isTesting ? 'テスト送信中...' : 'テスト通知を送信'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}