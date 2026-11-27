import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { CardSettings } from '../types';
import { saveCardSettings } from '../services/cardRepository';

interface SettingsViewProps {
  settings: CardSettings;
  displayName: string;
}

export function SettingsView({ settings, displayName }: SettingsViewProps) {
  const [monthlyBudget, setMonthlyBudget] = useState<string>(
    String(settings.monthlyBudget)
  );
  const [smallThreshold, setSmallThreshold] = useState<string>(
    String(settings.smallAmountThreshold)
  );
  const [highThreshold, setHighThreshold] = useState<string>(
    String(settings.highAmountThreshold)
  );
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    setMonthlyBudget(String(settings.monthlyBudget));
    setSmallThreshold(String(settings.smallAmountThreshold));
    setHighThreshold(String(settings.highAmountThreshold));
  }, [settings]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSavedNotice(false);

    const budgetNum = Number(monthlyBudget.replace(/[^0-9]/g, '')) || 0;
    const smallNum = Number(smallThreshold.replace(/[^0-9]/g, '')) || 0;
    const highNum = Number(highThreshold.replace(/[^0-9]/g, '')) || 0;

    if (budgetNum <= 0) {
      setErrorMsg('月間目標予算は1円以上で設定してください。');
      return;
    }
    if (smallNum >= highNum) {
      setErrorMsg('少額自動許可の上限は、高額しきい値より小さい金額にしてください。');
      return;
    }

    setIsSaving(true);
    try {
      await saveCardSettings({
        monthlyBudget: budgetNum,
        smallAmountThreshold: smallNum,
        highAmountThreshold: highNum,
        updatedBy: displayName,
      });
      setSavedNotice(true);
    } catch (err) {
      console.error(err);
      setErrorMsg('設定の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5"
    >
      <div>
        <h2 className="text-base font-bold text-slate-900">予算・承認ルール設定</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          変更は2人のアプリにリアルタイムで反映されます。
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {savedNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>設定を保存しました。</span>
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-bold text-slate-700">
          月間目標予算（円）
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={monthlyBudget}
          onChange={(e) => setMonthlyBudget(e.target.value.replace(/[^0-9]/g, ''))}
          required
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-bold text-slate-700">
          少額自動許可のしきい値（円未満）
        </label>
        <p className="text-xs text-slate-500">
          この金額未満の登録は承認待ちを飛ばして自動で「購入OK」になります。
        </p>
        <input
          type="text"
          inputMode="numeric"
          value={smallThreshold}
          onChange={(e) => setSmallThreshold(e.target.value.replace(/[^0-9]/g, ''))}
          required
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-bold text-slate-700">
          高額アイテムのしきい値（円以上）
        </label>
        <p className="text-xs text-slate-500">
          この金額以上の場合、パートナーが承認する際にコメント入力が必須になります。
        </p>
        <input
          type="text"
          inputMode="numeric"
          value={highThreshold}
          onChange={(e) => setHighThreshold(e.target.value.replace(/[^0-9]/g, ''))}
          required
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold text-base"
      >
        {isSaving ? '保存中...' : '設定を保存する'}
      </button>
    </form>
  );
}