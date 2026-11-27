export type UnitType = 'g' | 'ml' | '個' | '枚' | '袋' | '本' | 'パック';

export const UNIT_OPTIONS: UnitType[] = ['g', 'ml', '個', '枚', '袋', '本', 'パック'];

export interface Store {
  id: string;
  name: string;
  memo: string;
  pointInfo: string;
  paymentInfo: string;
  createdAt: number;
}

export interface PriceRecord {
  id: string;
  janCode: string;
  productName: string;
  productUrl?: string;
  storeId: string;
  priceTaxIncluded: number;
  quantity: number;
  unit: UnitType;
  unitPrice: number;
  unitPriceBase: number;
  recordedDate: string; // YYYY-MM-DD (JST)
  isSale: boolean;
  memo: string;
  createdAt: number;
}

export interface ShoppingItem {
  id: string;
  productName: string;
  janCode: string;
  memo: string;
  completed: boolean;
  createdAt: number;
}

export const getTodayJST = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000);
  const year = jstTime.getFullYear();
  const month = String(jstTime.getMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculateUnitPrice = (
  priceTaxIncluded: number,
  quantity: number,
  unit: UnitType
): { unitPrice: number; unitPriceBase: number } => {
  const base = unit === 'g' || unit === 'ml' ? 100 : 1;
  if (!priceTaxIncluded || !quantity || quantity <= 0) {
    return { unitPrice: 0, unitPriceBase: base };
  }
  const raw = (priceTaxIncluded / quantity) * base;
  const unitPrice = Math.round(raw * 100) / 100;
  return { unitPrice, unitPriceBase: base };
};

export const exportToCSV = (records: PriceRecord[], stores: Store[]) => {
  const storeMap = new Map(stores.map((s) => [s.id, s]));

  const headers = [
    '記録日',
    'JAN/ASINコード',
    '商品名',
    'リンクURL',
    '店舗名',
    '税込価格(円)',
    '容量',
    '単位',
    '単価基準',
    '単価(円)',
    '区分',
    'メモ',
    '店舗ポイント情報',
    '店舗支払い情報',
  ];

  const escapeCSV = (val: string | number | boolean) => {
    const str = String(val ?? '');
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((r) => {
    const store = storeMap.get(r.storeId);
    return [
      r.recordedDate,
      r.janCode ? `="${r.janCode}"` : '',
      r.productName,
      r.productUrl || '',
      store?.name || '不明な店舗',
      r.priceTaxIncluded,
      r.quantity,
      r.unit,
      `${r.unitPriceBase}${r.unit}あたり`,
      r.unitPrice,
      r.isSale ? '特売' : '通常',
      r.memo,
      store?.pointInfo || '',
      store?.paymentInfo || '',
    ]
      .map(escapeCSV)
      .join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `kaimono_records_${getTodayJST()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};