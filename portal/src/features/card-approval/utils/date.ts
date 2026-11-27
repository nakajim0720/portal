import type { Timestamp } from 'firebase/firestore';

function getJstParts(date: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
} {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

export function getTodayJST(): string {
  const { year, month, day } = getJstParts(new Date());
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthJST(): string {
  const { year, month } = getJstParts(new Date());
  return `${year}-${month}`;
}

export function shiftMonth(yyyyMm: string, diffMonths: number): string {
  const [yStr, mStr] = yyyyMm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    return getCurrentMonthJST();
  }
  const d = new Date(Date.UTC(y, m - 1 + diffMonths, 1));
  const nextY = d.getUTCFullYear();
  const nextM = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${nextY}-${nextM}`;
}

export function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-');
  if (!y || !m) return yyyyMm;
  return `${y}年${Number(m)}月`;
}

export function formatTimestampJST(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const { year, month, day, hour, minute } = getJstParts(ts.toDate());
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

export function formatCurrency(amount: number): string {
  return `¥${Math.round(amount).toLocaleString('ja-JP')}`;
}