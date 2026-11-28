import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Calendar, RefreshCw, X } from 'lucide-react';
import type { PortalUserProfile } from '../types';
import { compressImageToBase64 } from '../imageUtils';

const APP_VERSION = 'v1.0.0';

interface ProfileModalProps {
  isOpen: boolean;
  canClose: boolean;
  currentEmail: string;
  profile: PortalUserProfile | undefined;
  onClose: () => void;
  onSave: (params: { displayName: string; icon: string; birthday: string }) => Promise<void>;
}

function formatBirthdayDisplay(raw: string): string {
  if (!raw) return '';
  return raw.replace(/-/g, '/');
}

export function ProfileModal({
  isOpen,
  canClose,
  currentEmail,
  profile,
  onClose,
  onSave,
}: ProfileModalProps) {
  const [displayName, setDisplayName] = useState<string>('');
  const [birthday, setBirthday] = useState<string>('');
  const [iconBase64, setIconBase64] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile?.displayName || '');
      setBirthday(profile?.birthday || '');
      setIconBase64(profile?.icon || '');
      setErrorText('');
    }
  }, [isOpen, profile]);

  if (!isOpen) {
    return null;
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setErrorText('');
    try {
      const compressed = await compressImageToBase64(file, 800, 0.75);
      setIconBase64(compressed);
    } catch (err) {
      console.error(err);
      setErrorText('画像の圧縮・読み込みに失敗しました。別の画像をお試しください。');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorText('表示名を入力してください。');
      return;
    }
    setIsSaving(true);
    setErrorText('');
    try {
      await onSave({
        displayName: displayName.trim(),
        icon: iconBase64,
        birthday,
      });
      onClose();
    } catch (err) {
      console.error(err);
      setErrorText('プロフィールの保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleForceReload = async () => {
    if (isReloading) return;
    setIsReloading(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
    } catch (err) {
      console.warn('Cache clear skipped:', err);
    } finally {
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full min-w-0 overflow-hidden p-5 shadow-xl space-y-4 my-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900">プロフィール設定</h2>
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500 break-all">アカウント: {currentEmail}</p>

        {errorText && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 break-words">
            {errorText}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          <div className="min-w-0">
            <label className="block text-sm font-medium text-slate-700 mb-1">表示名</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例: なつき"
              required
              className="block box-border w-full min-w-0 max-w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div className="min-w-0">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              アイコン画像（自動圧縮して保存）
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full min-w-0 max-w-full text-base text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
            />
            {iconBase64 && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={iconBase64}
                  alt="アイコンプレビュー"
                  className="w-14 h-14 rounded-full object-cover border border-slate-200 shrink-0"
                />
                <span className="text-xs text-slate-500">プレビュー</span>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              誕生日（毎年カレンダーに表示）
            </label>
            <div className="relative w-full min-w-0 max-w-full h-[46px] px-3 rounded-xl border border-slate-300 bg-white flex items-center justify-between gap-2 overflow-hidden focus-within:ring-2 focus-within:ring-pink-500">
              <span
                className={`text-base truncate ${
                  birthday ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {birthday ? formatBirthdayDisplay(birthday) : '生年月日を選択（任意）'}
              </span>
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                aria-label="誕生日"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 min-w-[120px] py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-semibold text-base"
            >
              {isSaving ? '保存中...' : '保存する'}
            </button>
            {canClose && (
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-base"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span>アプリバージョン: {APP_VERSION}</span>
          <button
            type="button"
            disabled={isReloading}
            onClick={handleForceReload}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
            <span>{isReloading ? '更新中...' : '最新を読み込む'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}