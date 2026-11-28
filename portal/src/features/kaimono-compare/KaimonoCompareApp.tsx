import React, { useState, useEffect, useMemo } from 'react';
import { type User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  type FirestoreError,
} from 'firebase/firestore';
import {
  Search,
  PlusCircle,
  ShoppingCart,
  Store as StoreIcon,
  Camera,
  Tag,
  Award,
  CreditCard,
  Coins,
  Trash2,
  Edit3,
  Check,
  Download,
  ChevronRight,
  Calculator,
  History,
  Info,
  X,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { db } from '../../firebase';
import { sendLineNotification } from '../../shared/utils/lineNotify';
import { getNowJstIso } from '../portal/dateJst';
import {
  type Store,
  type PriceRecord,
  type UnitType,
  UNIT_OPTIONS,
  getTodayJST,
  calculateUnitPrice,
  exportToCSV,
} from './types';
import { BarcodeScanner } from './components/BarcodeScanner';

type TabType = 'compare' | 'register' | 'list' | 'stores';

interface SyncedShoppingItem {
  id: string;
  title: string;
  productName: string;
  janCode: string;
  memo: string;
  completed: boolean;
  createdAt: string;
}

interface KaimonoCompareAppProps {
  user: User;
  displayName?: string;
  onUnauthorized: () => void;
  onConsultCardApproval?: (payload: {
    name: string;
    price?: string;
    url?: string;
  }) => void;
  initialSearchQuery?: string;
}

const MIGRATION_DONE_KEY = 'kaimono_migrated_to_price_prefix_v1';
const SHOPPING_PORTAL_MIGRATION_KEY = 'kaimono_shopping_migrated_to_portal_v1';

const normalizeCode = (raw: string): string => raw.trim().toUpperCase();

const sanitizeUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const isSafeHttpUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

export const KaimonoCompareApp: React.FC<KaimonoCompareAppProps> = ({
  user,
  displayName,
  onUnauthorized,
  onConsultCardApproval,
  initialSearchQuery = '',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('compare');
  const [scannerTarget, setScannerTarget] = useState<'search' | 'form' | null>(null);
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<Store | null>(null);
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [shoppingList, setShoppingList] = useState<SyncedShoppingItem[]>([]);
  const [migrationMessage, setMigrationMessage] = useState<string>('');

  // 価格登録フォームステート
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [janCode, setJanCode] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [productUrl, setProductUrl] = useState<string>('');
  const [storeId, setStoreId] = useState<string>('');
  const [priceInput, setPriceInput] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [unit, setUnit] = useState<UnitType>('個');
  const [recordedDate, setRecordedDate] = useState<string>(getTodayJST());
  const [isSale, setIsSale] = useState<boolean>(false);
  const [memo, setMemo] = useState<string>('');
  const [formFeedback, setFormFeedback] = useState<string>('');
  const [isSavingRecord, setIsSavingRecord] = useState<boolean>(false);

  // 検索ステート
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);

  // 店舗管理フォームステート
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [storeMemo, setStoreMemo] = useState<string>('');
  const [pointInfo, setPointInfo] = useState<string>('');
  const [paymentInfo, setPaymentInfo] = useState<string>('');

  // 買い物リスト入力ステート
  const [newListItemName, setNewListItemName] = useState<string>('');
  const [newListItemMemo, setNewListItemMemo] = useState<string>('');

  const senderName =
    displayName?.trim() ||
    user.displayName?.trim() ||
    user.email?.split('@')[0] ||
    'メンバー';

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
      setActiveTab('compare');
    }
  }, [initialSearchQuery]);

  // URLクエリパラメータ連携
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qName = params.get('name');
    const qPrice = params.get('price');
    const qJan = params.get('jan');
    const qUrl = params.get('url');
    const qMemo = params.get('memo');

    if (qName || qPrice || qJan || qUrl || qMemo) {
      if (qJan) setJanCode(normalizeCode(qJan));
      if (qName) setProductName(qName);
      if (qUrl) setProductUrl(qUrl);
      if (qPrice) setPriceInput(qPrice);
      if (qMemo) setMemo(qMemo);
      setActiveTab('register');
    }
  }, []);

  // 旧コレクション移行（エラー時は強制ログアウトせずスキップ）
  useEffect(() => {
    let cancelled = false;

    const migrateLegacyData = async () => {
      try {
        let migratedCount = 0;

        if (localStorage.getItem(MIGRATION_DONE_KEY) !== 'true') {
          const [oldStoresSnap, newStoresSnap] = await Promise.all([
            getDocs(collection(db, 'stores')),
            getDocs(collection(db, 'price_stores')),
          ]);
          const [oldRecordsSnap, newRecordsSnap] = await Promise.all([
            getDocs(collection(db, 'priceRecords')),
            getDocs(collection(db, 'price_records')),
          ]);

          const storeIdMapping = new Map<string, string>();

          if (newStoresSnap.empty && !oldStoresSnap.empty) {
            for (const d of oldStoresSnap.docs) {
              const data = d.data();
              const newDocRef = doc(collection(db, 'price_stores'));
              await setDoc(newDocRef, data);
              storeIdMapping.set(d.id, newDocRef.id);
              migratedCount += 1;
            }
          } else {
            for (const d of newStoresSnap.docs) {
              storeIdMapping.set(d.id, d.id);
            }
            for (const d of oldStoresSnap.docs) {
              const oldName = String(d.data().name ?? '');
              const matchedNew = newStoresSnap.docs.find(
                (nd) => String(nd.data().name ?? '') === oldName
              );
              if (matchedNew) {
                storeIdMapping.set(d.id, matchedNew.id);
              }
            }
          }

          if (newRecordsSnap.empty && !oldRecordsSnap.empty) {
            for (const d of oldRecordsSnap.docs) {
              const raw = d.data();
              const mappedStoreId =
                storeIdMapping.get(String(raw.storeId ?? '')) ?? String(raw.storeId ?? '');
              await setDoc(doc(collection(db, 'price_records')), {
                ...raw,
                storeId: mappedStoreId,
              });
              migratedCount += 1;
            }
          }

          localStorage.setItem(MIGRATION_DONE_KEY, 'true');
        }

        if (localStorage.getItem(SHOPPING_PORTAL_MIGRATION_KEY) !== 'true') {
          const oldListSnap = await getDocs(collection(db, 'price_shopping_list'));
          const portalSnap = await getDocs(collection(db, 'portal_items'));
          const existingTitles = new Set<string>();
          portalSnap.forEach((d) => {
            const raw = d.data();
            if (raw.category === 'shopping' && raw.status !== 2) {
              existingTitles.add(String(raw.title ?? '').trim());
            }
          });

          for (const d of oldListSnap.docs) {
            const raw = d.data();
            const pName = String(raw.productName ?? '').trim();
            const pMemo = String(raw.memo ?? '').trim();
            const isCompleted = Boolean(raw.completed);
            if (!pName || isCompleted) continue;

            const displayTitle = pMemo ? `${pName}（${pMemo}）` : pName;
            if (existingTitles.has(displayTitle) || existingTitles.has(pName)) {
              continue;
            }

            await addDoc(collection(db, 'portal_items'), {
              title: displayTitle,
              productName: pName,
              janCode: String(raw.janCode ?? ''),
              memo: pMemo,
              category: 'shopping',
              assignee: 'shared',
              displayScope: 'shared',
              dueDate: '',
              status: 0,
              createdBy: user.email || '',
              createdAt: getNowJstIso(),
              trashedAt: null,
            });
            existingTitles.add(displayTitle);
            migratedCount += 1;
          }

          localStorage.setItem(SHOPPING_PORTAL_MIGRATION_KEY, 'true');
        }

        if (!cancelled && migratedCount > 0) {
          setMigrationMessage(`既存データ ${migratedCount} 件を統合・移行しました`);
          setTimeout(() => setMigrationMessage(''), 5000);
        }
      } catch (err) {
        console.warn('Migration check skipped:', err);
      }
    };

    migrateLegacyData();
    return () => {
      cancelled = true;
    };
  }, [user.email]);

  useEffect(() => {
    const handleSnapshotError = (error: FirestoreError) => {
      if (error.code === 'permission-denied') {
        onUnauthorized();
      } else {
        console.error('Firestore error:', error);
      }
    };

    const qStores = query(collection(db, 'price_stores'), orderBy('createdAt', 'asc'));
    const unsubStores = onSnapshot(
      qStores,
      (snapshot) => {
        const data: Store[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Store, 'id'>),
        }));
        setStores(data);
      },
      handleSnapshotError
    );

    const qRecords = query(collection(db, 'price_records'), orderBy('recordedDate', 'desc'));
    const unsubRecords = onSnapshot(
      qRecords,
      (snapshot) => {
        const data: PriceRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PriceRecord, 'id'>),
        }));
        setRecords(data);
      },
      handleSnapshotError
    );

    const unsubPortalShopping = onSnapshot(
      collection(db, 'portal_items'),
      (snapshot) => {
        const list: SyncedShoppingItem[] = [];
        snapshot.forEach((docSnap) => {
          const raw = docSnap.data();
          if (raw.category !== 'shopping') return;
          if (raw.status === 2) return;
          if (raw.displayScope === 'private' && raw.createdBy && raw.createdBy !== user.email) {
            return;
          }
          const rawTitle = String(raw.title ?? '').trim();
          const rawProductName = String(raw.productName ?? '').trim() || rawTitle;
          list.push({
            id: docSnap.id,
            title: rawTitle,
            productName: rawProductName,
            janCode: String(raw.janCode ?? ''),
            memo: String(raw.memo ?? ''),
            completed: raw.status === 1,
            createdAt: String(raw.createdAt ?? ''),
          });
        });

        list.sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });

        setShoppingList(list);
      },
      handleSnapshotError
    );

    return () => {
      unsubStores();
      unsubRecords();
      unsubPortalShopping();
    };
  }, [onUnauthorized, user.email]);

  const handleCopyText = async (text: string, key: string) => {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1800);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const storeMap = useMemo(() => {
    return new Map(stores.map((s) => [s.id, s]));
  }, [stores]);

  const existingProductNames = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.productName) set.add(r.productName);
    });
    return Array.from(set);
  }, [records]);

  const resetRegisterForm = (keepStore = false) => {
    setEditingRecordId(null);
    setJanCode('');
    setProductName('');
    setProductUrl('');
    if (!keepStore) {
      setStoreId('');
    }
    setPriceInput('');
    setQuantityInput('1');
    setIsSale(false);
    setMemo('');
  };

  const handleCodeChange = (rawCode: string) => {
    const normalized = normalizeCode(rawCode);
    setJanCode(normalized);
    if (normalized.length >= 6) {
      const matched = records.find(
        (r) => r.janCode && normalizeCode(r.janCode) === normalized
      );
      if (matched) {
        setProductName(matched.productName);
        if (matched.productUrl) setProductUrl(matched.productUrl);
        setQuantityInput(String(matched.quantity));
        setUnit(matched.unit);
        setFormFeedback(`登録済みの「${matched.productName}」を自動補完しました`);
        setTimeout(() => setFormFeedback(''), 3500);
      }
    }
  };

  const applyTaxCalculation = (taxRate: 1.08 | 1.1) => {
    const num = parseFloat(priceInput);
    if (isNaN(num) || num <= 0) return;
    const taxIncluded = Math.floor(num * taxRate);
    setPriceInput(String(taxIncluded));
  };

  const currentUnitPricePreview = useMemo(() => {
    const p = parseFloat(priceInput) || 0;
    const q = parseFloat(quantityInput) || 0;
    return calculateUnitPrice(p, q, unit);
  }, [priceInput, quantityInput, unit]);

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingRecord || !productName.trim() || !storeId || !priceInput) return;

    setIsSavingRecord(true);
    try {
      const priceNum = Math.round(parseFloat(priceInput));
      const quantityNum = parseFloat(quantityInput) || 1;
      const { unitPrice, unitPriceBase } = calculateUnitPrice(priceNum, quantityNum, unit);
      const cleanedCode = normalizeCode(janCode);
      const normalizedUrl = sanitizeUrl(productUrl);
      const validUrl = normalizedUrl && isSafeHttpUrl(normalizedUrl) ? normalizedUrl : '';

      const payload = {
        janCode: cleanedCode,
        productName: productName.trim(),
        productUrl: validUrl,
        storeId,
        priceTaxIncluded: priceNum,
        quantity: quantityNum,
        unit,
        unitPrice,
        unitPriceBase,
        recordedDate,
        isSale,
        memo: memo.trim(),
        createdAt: Date.now(),
      };

      if (editingRecordId) {
        await updateDoc(doc(db, 'price_records', editingRecordId), payload);
        setFormFeedback('価格データを更新しました');
        resetRegisterForm(false);
      } else {
        await addDoc(collection(db, 'price_records'), payload);
        setFormFeedback('価格データを登録しました');
        resetRegisterForm(true);
      }

      setTimeout(() => setFormFeedback(''), 3000);
    } catch (err) {
      console.error('Failed to save record:', err);
      setFormFeedback('登録に失敗しました。通信状況を確認してください');
    } finally {
      setIsSavingRecord(false);
    }
  };

  const startEditRecord = (rec: PriceRecord) => {
    setEditingRecordId(rec.id);
    setJanCode(rec.janCode);
    setProductName(rec.productName);
    setProductUrl(rec.productUrl || '');
    setStoreId(rec.storeId);
    setPriceInput(String(rec.priceTaxIncluded));
    setQuantityInput(String(rec.quantity));
    setUnit(rec.unit);
    setRecordedDate(rec.recordedDate);
    setIsSale(rec.isSale);
    setMemo(rec.memo);
    setActiveTab('register');
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('この価格記録を削除しますか？')) return;
    await deleteDoc(doc(db, 'price_records', id));
  };

  const groupedProducts = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        productName: string;
        janCode: string;
        productUrl: string;
        allRecords: PriceRecord[];
        latestByStore: PriceRecord[];
        minTotalPrice: number;
        minUnitPrice: number;
      }
    >();

    const sorted = [...records].sort((a, b) => {
      if (b.recordedDate !== a.recordedDate) {
        return b.recordedDate.localeCompare(a.recordedDate);
      }
      return b.createdAt - a.createdAt;
    });

    for (const r of sorted) {
      const key = r.productName.trim();
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          productName: r.productName,
          janCode: r.janCode,
          productUrl: r.productUrl || '',
          allRecords: [],
          latestByStore: [],
          minTotalPrice: Infinity,
          minUnitPrice: Infinity,
        });
      }
      const g = groups.get(key)!;
      if (!g.janCode && r.janCode) g.janCode = r.janCode;
      if (!g.productUrl && r.productUrl) g.productUrl = r.productUrl;
      g.allRecords.push(r);
    }

    groups.forEach((g) => {
      const seenStores = new Set<string>();
      for (const r of g.allRecords) {
        if (!seenStores.has(r.storeId)) {
          seenStores.add(r.storeId);
          g.latestByStore.push(r);
          if (r.priceTaxIncluded < g.minTotalPrice) {
            g.minTotalPrice = r.priceTaxIncluded;
          }
          if (r.unitPrice > 0 && r.unitPrice < g.minUnitPrice) {
            g.minUnitPrice = r.unitPrice;
          }
        }
      }
      g.latestByStore.sort((a, b) => a.unitPrice - b.unitPrice);
    });

    const list = Array.from(groups.values());
    if (!searchQuery.trim()) return list;

    const q = searchQuery.trim().toLowerCase();
    return list.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        item.janCode.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const addShoppingItem = async (name: string, jan = '', itemMemo = '') => {
    const trimmedName = name.trim();
    const trimmedMemo = itemMemo.trim();
    if (!trimmedName) return;

    const displayTitle = trimmedMemo ? `${trimmedName}（${trimmedMemo}）` : trimmedName;

    await addDoc(collection(db, 'portal_items'), {
      title: displayTitle,
      productName: trimmedName,
      janCode: jan,
      memo: trimmedMemo,
      category: 'shopping',
      assignee: 'shared',
      displayScope: 'shared',
      dueDate: '',
      status: 0,
      createdBy: user.email || '',
      createdAt: getNowJstIso(),
      trashedAt: null,
    });

    void sendLineNotification({
      trigger: 'kaimonoListAdded',
      appName: '価格比較・買い物管理',
      senderName,
      title: '買い物リストに追加',
      body: trimmedMemo ? `${trimmedName}\nメモ: ${trimmedMemo}` : trimmedName,
      url: 'https://nakajim0720.github.io/portal/#/kaimono',
    });
  };

  const toggleShoppingItem = async (item: SyncedShoppingItem) => {
    await updateDoc(doc(db, 'portal_items', item.id), {
      status: item.completed ? 0 : 1,
      trashedAt: null,
    });
  };

  const deleteShoppingItem = async (id: string) => {
    await updateDoc(doc(db, 'portal_items', id), {
      status: 2,
      trashedAt: getNowJstIso(),
    });
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    const payload = {
      name: storeName.trim(),
      memo: storeMemo.trim(),
      pointInfo: pointInfo.trim(),
      paymentInfo: paymentInfo.trim(),
      createdAt: Date.now(),
    };
    if (editingStoreId) {
      await updateDoc(doc(db, 'price_stores', editingStoreId), payload);
    } else {
      await addDoc(collection(db, 'price_stores'), payload);
    }
    setEditingStoreId(null);
    setStoreName('');
    setStoreMemo('');
    setPointInfo('');
    setPaymentInfo('');
  };

  const handleDeleteStore = async (id: string) => {
    if (!window.confirm('この店舗を削除しますか？')) return;
    await deleteDoc(doc(db, 'price_stores', id));
  };

  const uncompletedListCount = shoppingList.filter((i) => !i.completed).length;

  return (
    <div className="min-h-dvh bg-slate-50 pb-28">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-emerald-600 text-white p-1.5 rounded-lg shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </span>
            <h1 className="font-bold text-base text-slate-900 truncate">価格比較・買い物管理</h1>
          </div>
          <button
            type="button"
            onClick={() => exportToCSV(records, stores)}
            className="flex items-center gap-1.5 text-base font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {migrationMessage && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-base font-medium">
            {migrationMessage}
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="商品名・JAN・ASINで検索..."
                  className="w-full pl-10 pr-9 py-3 bg-white border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    aria-label="検索クリア"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setScannerTarget('search')}
                className="w-full sm:w-auto px-4 py-3 bg-slate-900 text-white rounded-xl flex items-center justify-center gap-1.5 font-bold text-base shrink-0"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>コード読取</span>
              </button>
            </div>

            {groupedProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-3">
                <p className="text-base text-slate-500">該当する商品データがありません</p>
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = searchQuery.trim();
                    if (/^[A-Z0-9]{6,13}$/i.test(trimmed)) {
                      setJanCode(normalizeCode(trimmed));
                    } else {
                      setProductName(trimmed);
                    }
                    setActiveTab('register');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white text-base font-bold rounded-xl"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>この商品を登録する</span>
                </button>
              </div>
            ) : (
              groupedProducts.map((group) => {
                const nameCopyKey = `name-${group.key}`;
                const codeCopyKey = `code-${group.key}`;
                const hasValidLink = Boolean(group.productUrl && isSafeHttpUrl(group.productUrl));

                return (
                  <div
                    key={group.key}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                  >
                    <div className="p-4 bg-slate-50/70 border-b border-slate-100 space-y-3">
                      <div className="w-full space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="font-bold text-slate-900 text-base leading-snug break-words min-w-0 flex-1">
                            {group.productName}
                          </h2>
                          <button
                            type="button"
                            onClick={() => handleCopyText(group.productName, nameCopyKey)}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 text-base font-bold flex items-center gap-1 shrink-0 transition-colors"
                            aria-label="商品名をコピー"
                            title="商品名をコピー"
                          >
                            {copiedKey === nameCopyKey ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span className="text-emerald-700">済</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 shrink-0" />
                                <span>コピー</span>
                              </>
                            )}
                          </button>
                        </div>

                        {group.janCode && (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-base text-slate-600 font-mono break-all min-w-0 flex-1">
                              コード: {group.janCode}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleCopyText(group.janCode, codeCopyKey)}
                              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 text-base font-bold flex items-center gap-1 shrink-0 transition-colors"
                              aria-label="コードをコピー"
                              title="コードをコピー"
                            >
                              {copiedKey === codeCopyKey ? (
                                <>
                                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span className="text-emerald-700">済</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 shrink-0" />
                                  <span>コピー</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {hasValidLink && (
                          <div className="pt-0.5">
                            <a
                              href={group.productUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-base font-bold text-blue-700 hover:text-blue-800 underline underline-offset-4 break-all"
                            >
                              <ExternalLink className="w-4 h-4 shrink-0" />
                              <span>商品ページを開く</span>
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void addShoppingItem(group.productName, group.janCode);
                            alert(`「${group.productName}」を買い物リストに追加しました`);
                          }}
                          className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border border-emerald-200/70 rounded-xl text-base font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ShoppingCart className="w-4 h-4 shrink-0" />
                          <span>リスト追加</span>
                        </button>
                        {onConsultCardApproval && (
                          <button
                            type="button"
                            onClick={() =>
                              onConsultCardApproval({
                                name: group.productName,
                                price:
                                  group.minTotalPrice !== Infinity
                                    ? String(group.minTotalPrice)
                                    : '',
                                url: hasValidLink ? group.productUrl : '',
                              })
                            }
                            className="flex-1 sm:flex-none px-3.5 py-2 bg-pink-50 hover:bg-pink-100 active:bg-pink-200 text-pink-700 border border-pink-200/70 rounded-xl text-base font-bold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <CreditCard className="w-4 h-4 shrink-0" />
                            <span>カード相談</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedProductKey(
                              selectedProductKey === group.key ? null : group.key
                            )
                          }
                          className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-base font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <History className="w-4 h-4 shrink-0" />
                          <span>履歴</span>
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {group.latestByStore.map((rec) => {
                        const store = storeMap.get(rec.storeId);
                        const isCheapestTotal = rec.priceTaxIncluded === group.minTotalPrice;
                        const isCheapestUnit = rec.unitPrice === group.minUnitPrice;
                        const recHasLink = Boolean(rec.productUrl && isSafeHttpUrl(rec.productUrl));

                        return (
                          <div
                            key={rec.id}
                            className={`p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                              isCheapestUnit ? 'bg-emerald-50/40' : ''
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => store && setSelectedStoreDetail(store)}
                                  className="font-bold text-base text-slate-900 hover:text-emerald-600 underline decoration-slate-300 underline-offset-4 flex items-center gap-1 text-left"
                                >
                                  <span>{store?.name || '不明な店舗'}</span>
                                  <Info className="w-4 h-4 text-slate-400 shrink-0" />
                                </button>

                                {isCheapestUnit && (
                                  <span className="px-2.5 py-0.5 bg-emerald-600 text-white text-base font-bold rounded-full flex items-center gap-1">
                                    <Award className="w-4 h-4" />
                                    単価最安
                                  </span>
                                )}
                                {isCheapestTotal && (
                                  <span className="px-2.5 py-0.5 bg-amber-500 text-white text-base font-bold rounded-full">
                                    総額最安
                                  </span>
                                )}
                                {rec.isSale && (
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-base font-bold rounded">
                                    特売
                                  </span>
                                )}
                              </div>

                              <div className="text-base text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                                <span>
                                  容量: {rec.quantity}
                                  {rec.unit}
                                </span>
                                <span>•</span>
                                <span>記録: {rec.recordedDate}</span>
                                {recHasLink && (
                                  <a
                                    href={rec.productUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 underline font-medium"
                                  >
                                    <ExternalLink className="w-4 h-4 shrink-0" />
                                    <span>リンク</span>
                                  </a>
                                )}
                                {rec.memo && (
                                  <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                    {rec.memo}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-base font-extrabold text-slate-900">
                                {rec.priceTaxIncluded.toLocaleString()}円(税込)
                              </div>
                              <div
                                className={`text-base font-bold mt-0.5 ${
                                  isCheapestUnit ? 'text-emerald-700' : 'text-slate-600'
                                }`}
                              >
                                {rec.unitPrice}円 / {rec.unitPriceBase}
                                {rec.unit}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedProductKey === group.key && (
                      <div className="bg-slate-900 text-white p-4 space-y-3">
                        <h3 className="text-base font-bold text-slate-200 flex items-center gap-1.5">
                          <History className="w-4 h-4 text-emerald-400" />
                          <span>価格推移・履歴（全{group.allRecords.length}件）</span>
                        </h3>
                        <div className="space-y-2 pt-1">
                          {group.allRecords.slice(0, 10).map((r) => {
                            const store = storeMap.get(r.storeId);
                            const maxPrice = Math.max(
                              ...group.allRecords.map((x) => x.priceTaxIncluded),
                              1
                            );
                            const widthPercent = Math.max(
                              20,
                              Math.round((r.priceTaxIncluded / maxPrice) * 100)
                            );

                            return (
                              <div
                                key={r.id}
                                className="bg-slate-800 rounded-xl p-3 text-base space-y-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-slate-300 font-mono">
                                      {r.recordedDate}
                                    </span>
                                    <span className="font-bold text-white">
                                      {store?.name || '不明'}
                                    </span>
                                    {r.isSale && (
                                      <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded">
                                        特売
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-emerald-400">
                                      {r.priceTaxIncluded}円
                                    </span>
                                    <span className="text-slate-300">
                                      ({r.unitPrice}円/{r.unitPriceBase}
                                      {r.unit})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => startEditRecord(r)}
                                      className="p-1.5 text-slate-300 hover:text-white"
                                      aria-label="編集"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRecord(r.id)}
                                      className="p-1.5 text-slate-300 hover:text-rose-400"
                                      aria-label="削除"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-full rounded-full"
                                    style={{ width: `${widthPercent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'register' && (
          <form
            onSubmit={handleSaveRecord}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-base text-slate-900">
                {editingRecordId ? '価格記録の編集' : '新規価格の登録'}
              </h2>
              {editingRecordId && (
                <button
                  type="button"
                  onClick={() => resetRegisterForm(false)}
                  className="text-base text-slate-600 underline"
                >
                  新規登録に戻す
                </button>
              )}
            </div>

            {formFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-base font-bold">
                {formFeedback}
              </div>
            )}

            <div>
              <label className="block text-base font-bold text-slate-700 mb-1">
                JAN / ASIN コード（スキャンで自動補完）
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={janCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="4901234567890 または B0..."
                  className="flex-1 min-w-[200px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono uppercase"
                />
                <button
                  type="button"
                  onClick={() => setScannerTarget('form')}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-base flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>カメラ読取</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-base font-bold text-slate-700 mb-1">
                商品名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                list="product-name-suggestions"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="例: 明治 おいしい牛乳"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
              />
              <datalist id="product-name-suggestions">
                {existingProductNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-base font-bold text-slate-700 mb-1">
                リンク（任意・商品ページやECサイトのURL）
              </label>
              <input
                type="url"
                inputMode="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://example.com/item/..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-slate-700 mb-1">
                店舗 <span className="text-rose-500">*</span>
              </label>
              {stores.length === 0 ? (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-base flex flex-wrap items-center justify-between gap-2">
                  <span>先に店舗マスタを登録してください</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('stores')}
                    className="font-bold underline"
                  >
                    店舗管理へ
                  </button>
                </div>
              ) : (
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  required
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium ${
                    storeId === '' ? 'text-slate-400' : 'text-slate-900'
                  }`}
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id} className="text-slate-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-base font-bold text-slate-700 mb-1">
                価格（税込・円） <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                required
                min="1"
                step="1"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="税抜または税込の金額を入力"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => applyTaxCalculation(1.08)}
                  className="flex-1 min-w-[140px] py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 border border-emerald-200 rounded-xl text-base font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Calculator className="w-4 h-4 shrink-0" />
                  <span>+8%税込</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTaxCalculation(1.1)}
                  className="flex-1 min-w-[140px] py-2.5 px-3 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 border border-blue-200 rounded-xl text-base font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Calculator className="w-4 h-4 shrink-0" />
                  <span>+10%税込</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-base font-bold text-slate-700 mb-1">
                  容量（数値） <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  min="0.1"
                  step="any"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold"
                />
              </div>
              <div className="w-32 shrink-0">
                <label className="block text-base font-bold text-slate-700 mb-1">
                  単位
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as UnitType)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="text-slate-300">自動算出単価（税込）:</span>
              <span className="font-extrabold text-emerald-400">
                {currentUnitPricePreview.unitPrice} 円 / {currentUnitPricePreview.unitPriceBase}
                {unit}あたり
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-base font-bold text-slate-700 mb-1">
                  記録日（JST）
                </label>
                <div className="w-full h-12 px-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center overflow-hidden">
                  <input
                    type="date"
                    value={recordedDate}
                    onChange={(e) => setRecordedDate(e.target.value)}
                    className="appearance-none bg-transparent border-0 w-full min-w-0 text-base font-mono text-slate-900 focus:outline-none p-0 m-0"
                  />
                </div>
              </div>

              <label className="w-full min-h-12 px-3.5 py-2.5 cursor-pointer select-none rounded-xl border border-slate-200 bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-2.5 transition-colors">
                <input
                  type="checkbox"
                  checked={isSale}
                  onChange={(e) => setIsSale(e.target.checked)}
                  className="w-5 h-5 accent-rose-600 rounded shrink-0"
                />
                <span className="text-base font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>特売・セール価格として記録する</span>
                </span>
              </label>
            </div>

            <div>
              <label className="block text-base font-bold text-slate-700 mb-1">
                メモ（任意）
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例: 火曜市、クーポン適用後"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingRecord || stores.length === 0 || !storeId}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow text-base transition-colors"
            >
              {isSavingRecord
                ? '保存中...'
                : editingRecordId
                ? '更新を保存する'
                : 'この価格を登録する'}
            </button>
          </form>
        )}

        {activeTab === 'list' && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void addShoppingItem(newListItemName, '', newListItemMemo);
                setNewListItemName('');
                setNewListItemMemo('');
              }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3"
            >
              <div>
                <h2 className="text-base font-bold text-slate-700">
                  買うものを追加（ポータルと双方向同期）
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ポータルの「お買い物」タブとリアルタイムに同期されます。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  list="product-name-suggestions"
                  value={newListItemName}
                  onChange={(e) => setNewListItemName(e.target.value)}
                  placeholder="商品名を入力..."
                  className="flex-1 min-w-[200px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-base shrink-0"
                >
                  追加
                </button>
              </div>
              <input
                type="text"
                value={newListItemMemo}
                onChange={(e) => setNewListItemMemo(e.target.value)}
                placeholder="補足メモ（例: 2パック）"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
              />
            </form>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {shoppingList.length === 0 ? (
                <p className="p-8 text-center text-base text-slate-400">
                  買い物リストは空です
                </p>
              ) : (
                shoppingList.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 flex items-center justify-between gap-3 ${
                      item.completed ? 'bg-slate-50 opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleShoppingItem(item)}
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                          item.completed
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                        aria-label="購入済み切替"
                      >
                        {item.completed && <Check className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery(item.productName);
                          setActiveTab('compare');
                        }}
                        className="text-left min-w-0 flex-1 group"
                      >
                        <div
                          className={`font-bold text-base flex items-center gap-1 ${
                            item.completed
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 group-hover:text-emerald-600'
                          }`}
                        >
                          <span className="truncate">{item.productName}</span>
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>
                        {item.memo && (
                          <p className="text-base text-slate-600 mt-0.5 break-words">{item.memo}</p>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteShoppingItem(item.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 shrink-0"
                      aria-label="ゴミ箱へ移動"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'stores' && (
          <div className="space-y-4">
            <form
              onSubmit={handleSaveStore}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3"
            >
              <h2 className="font-bold text-base text-slate-900">
                {editingStoreId ? '店舗情報の編集' : '新規店舗の登録'}
              </h2>
              <div>
                <label className="block text-base font-bold text-slate-700 mb-1">
                  店舗名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="例: オーケー 〇〇店"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-slate-700 mb-1">
                  ポイント情報
                </label>
                <input
                  type="text"
                  value={pointInfo}
                  onChange={(e) => setPointInfo(e.target.value)}
                  placeholder="例: 毎週水曜ポイント3倍"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-slate-700 mb-1">
                  お得な支払い方法・決済情報
                </label>
                <input
                  type="text"
                  value={paymentInfo}
                  onChange={(e) => setPaymentInfo(e.target.value)}
                  placeholder="例: 会員カード+現金で3%割引、PayPay可"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-slate-700 mb-1">
                  店舗メモ（営業時間・定休日など）
                </label>
                <input
                  type="text"
                  value={storeMemo}
                  onChange={(e) => setStoreMemo(e.target.value)}
                  placeholder="例: 9:00〜21:30"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="flex-1 min-w-[160px] py-3 bg-slate-900 text-white font-bold rounded-xl text-base"
                >
                  {editingStoreId ? '店舗を更新する' : '店舗を追加する'}
                </button>
                {editingStoreId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStoreId(null);
                      setStoreName('');
                      setPointInfo('');
                      setPaymentInfo('');
                      setStoreMemo('');
                    }}
                    className="px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl text-base"
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-2.5">
              {stores.map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-base text-slate-900 break-words">{s.name}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStoreId(s.id);
                          setStoreName(s.name);
                          setPointInfo(s.pointInfo);
                          setPaymentInfo(s.paymentInfo);
                          setStoreMemo(s.memo);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900"
                        aria-label="店舗編集"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStore(s.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                        aria-label="店舗削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {s.pointInfo && (
                    <div className="flex items-start gap-2 text-base text-amber-800 bg-amber-50 px-3 py-2 rounded-xl">
                      <Coins className="w-4 h-4 shrink-0 mt-1 text-amber-600" />
                      <span className="break-words">{s.pointInfo}</span>
                    </div>
                  )}
                  {s.paymentInfo && (
                    <div className="flex items-start gap-2 text-base text-blue-800 bg-blue-50 px-3 py-2 rounded-xl">
                      <CreditCard className="w-4 h-4 shrink-0 mt-1 text-blue-600" />
                      <span className="break-words">{s.paymentInfo}</span>
                    </div>
                  )}
                  {s.memo && <p className="text-base text-slate-600 break-words">{s.memo}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {selectedStoreDetail && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setSelectedStoreDetail(null)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-base text-slate-900">
                {selectedStoreDetail.name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedStoreDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5 text-base">
              <div className="p-3 bg-amber-50 text-amber-900 rounded-xl space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-700">
                  <Coins className="w-4 h-4" />
                  <span>ポイント情報</span>
                </div>
                <p className="break-words">{selectedStoreDetail.pointInfo || '未登録'}</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-900 rounded-xl space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-700">
                  <CreditCard className="w-4 h-4" />
                  <span>お得な支払い方法</span>
                </div>
                <p className="break-words">{selectedStoreDetail.paymentInfo || '未登録'}</p>
              </div>
              {selectedStoreDetail.memo && (
                <div className="p-3 bg-slate-50 text-slate-700 rounded-xl">
                  <p className="font-bold mb-0.5 text-slate-600">店舗メモ</p>
                  <p className="break-words">{selectedStoreDetail.memo}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {scannerTarget && (
        <BarcodeScanner
          onScanSuccess={(code) => {
            if (scannerTarget === 'search') {
              setSearchQuery(code);
            } else if (scannerTarget === 'form') {
              handleCodeChange(code);
            }
            setScannerTarget(null);
          }}
          onClose={() => setScannerTarget(null)}
        />
      )}

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-2xl mx-auto grid grid-cols-4 min-h-16">
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`flex flex-col items-center justify-center gap-1 py-2 text-base font-bold ${
              activeTab === 'compare' ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            <Search className="w-5 h-5" />
            <span>比較</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex flex-col items-center justify-center gap-1 py-2 text-base font-bold ${
              activeTab === 'register' ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span>登録</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`relative flex flex-col items-center justify-center gap-1 py-2 text-base font-bold ${
              activeTab === 'list' ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            <span>リスト</span>
            {uncompletedListCount > 0 && (
              <span className="absolute top-1 right-3 bg-rose-500 text-white text-base font-bold px-2 rounded-full leading-tight">
                {uncompletedListCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stores')}
            className={`flex flex-col items-center justify-center gap-1 py-2 text-base font-bold ${
              activeTab === 'stores' ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            <StoreIcon className="w-5 h-5" />
            <span>店舗</span>
          </button>
        </div>
      </nav>
    </div>
  );
};