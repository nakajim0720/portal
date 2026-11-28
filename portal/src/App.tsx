import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, signInWithPopup, signOut } from './firebase';
import {
  featureToHash,
  parseFeatureFromHash,
  type FeatureId,
} from './shared/types/navigation';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { GlobalAppBar } from './shared/components/GlobalAppBar';
import { NotificationSettingsModal } from './shared/components/NotificationSettingsModal';
import { usePortalData } from './features/portal/usePortalData';
import { InstallGuideBanner } from './features/portal/components/InstallGuideBanner';
import { ProfileModal } from './features/portal/components/ProfileModal';
import { PortalFeatureApp } from './features/portal/PortalFeatureApp';
import { KaimonoCompareApp } from './features/kaimono-compare/KaimonoCompareApp';
import { CardApprovalApp } from './features/card-approval/CardApprovalApp';

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>('');
  const [activeFeature, setActiveFeature] = useState<FeatureId>(() =>
    parseFeatureFromHash(window.location.hash)
  );
  const [kaimonoSearchKeyword, setKaimonoSearchKeyword] = useState<string>('');
  const [cardPendingCount, setCardPendingCount] = useState<number>(0);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setAuthUser(user);
        setIsCheckingAuth(false);
      },
      (err) => {
        console.error(err);
        setAuthError('認証状態の確認中にエラーが発生しました。');
        setIsCheckingAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveFeature(parseFeatureFromHash(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectFeature = useCallback((nextFeature: FeatureId) => {
    setActiveFeature(nextFeature);
    const nextHash = featureToHash(nextFeature);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const handleConsultCardApproval = useCallback(
    (payload: { name: string; price?: string; url?: string }) => {
      const params = new URLSearchParams();
      if (payload.name.trim()) params.set('name', payload.name.trim());
      if (payload.price?.trim()) params.set('price', payload.price.trim());
      if (payload.url?.trim()) params.set('url', payload.url.trim());

      const nextHash = featureToHash('card');
      const queryStr = params.toString();
      const nextUrl = `${window.location.pathname}${queryStr ? `?${queryStr}` : ''}${nextHash}`;
      window.history.replaceState(null, '', nextUrl);
      setActiveFeature('card');
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    []
  );

  const handleSearchInKaimono = useCallback((keyword: string) => {
    setKaimonoSearchKeyword(keyword);
    setActiveFeature('kaimono');
    const nextHash = featureToHash('kaimono');
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const currentEmail = authUser?.email || '';
  const {
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
    emptyTrash,
    exportAllDataAsJson,
  } = usePortalData(authUser ? currentEmail : null);

  // 上部共通バー用のカード承認待ち件数を購読
  useEffect(() => {
    if (!authUser || !isAccessVerified || isAccessRejected) {
      setCardPendingCount(0);
      return;
    }
    const unsubCard = onSnapshot(
      collection(db, 'card_items'),
      (snap) => {
        let count = 0;
        snap.forEach((docSnap) => {
          const raw = docSnap.data() as { status?: string; proposerUid?: string };
          if (raw.status === 'pending' && raw.proposerUid !== authUser.uid) {
            count += 1;
          }
        });
        setCardPendingCount(count);
      },
      (err) => {
        console.warn('Card count subscription skipped:', err);
      }
    );
    return () => unsubCard();
  }, [authUser, isAccessVerified, isAccessRejected]);

  useEffect(() => {
    if (!authUser || !isAccessRejected) {
      return;
    }
    if (errorMessage) {
      setAuthError(errorMessage);
    } else {
      setAuthError(
        'このGoogleアカウントにはアクセス権限がありません。登録済みのアカウントでログインしてください。'
      );
    }
    setIsProfileModalOpen(false);
    setIsNotificationModalOpen(false);
    signOut(auth).catch((err) => console.error(err));
  }, [authUser, isAccessRejected, errorMessage]);

  const currentProfile = currentEmail ? usersMap[currentEmail] : undefined;
  const resolvedDisplayName =
    currentProfile?.displayName?.trim() ||
    authUser?.displayName?.trim() ||
    currentEmail.split('@')[0] ||
    'メンバー';

  const needsInitialProfile = Boolean(
    authUser &&
      isAccessVerified &&
      !isAccessRejected &&
      !isLoadingData &&
      (!currentProfile || !currentProfile.displayName)
  );

  useEffect(() => {
    if (needsInitialProfile) {
      setIsProfileModalOpen(true);
    }
  }, [needsInitialProfile]);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error(err);
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code === 'auth/popup-blocked') {
        setAuthError(
          'ポップアップがブロックされました。Safariのポップアップブロックを許可して再度お試しください。'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          'Firebaseの「承認済みドメイン」に nakajim0720.github.io が登録されていません。'
        );
      } else if (
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/popup-closed-by-user'
      ) {
        setAuthError('ログイン画面が閉じられました。');
      } else {
        setAuthError(`Googleログインに失敗しました（${code || '不明なエラー'}）。`);
      }
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      setIsProfileModalOpen(false);
      setIsNotificationModalOpen(false);
      await signOut(auth);
      handleSelectFeature('portal');
    } catch (err) {
      console.error(err);
    }
  }, [handleSelectFeature]);

  const handleUnauthorizedFromFeature = useCallback(() => {
    setAuthError(
      'データのアクセス権限がありません。登録済みのアカウントでログインし直してください。'
    );
    signOut(auth).catch((err) => console.error(err));
  }, []);

  if (isCheckingAuth) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
        <p className="text-slate-600 text-base font-medium">読み込み中...</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-dvh bg-slate-50 flex flex-col overflow-x-hidden">
        <InstallGuideBanner />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-sm text-center space-y-4">
            <h1 className="text-xl font-bold text-slate-900">ふたりのポータル</h1>
            <p className="text-sm text-slate-600">
              登録されたGoogleアカウントでログインしてください。
            </p>
            {authError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 break-words">
                {authError}
              </div>
            )}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold text-base shadow-sm"
            >
              Googleでログイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAccessVerified || isAccessRejected) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-sm text-center space-y-4">
          <p className="text-slate-700 text-base font-medium">
            {isAccessRejected ? 'アクセス権限がありません' : 'アクセス権限を確認中...'}
          </p>
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 break-words">
              {errorMessage}
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm"
          >
            ログイン画面へ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden">
      <InstallGuideBanner />

      <GlobalAppBar
        activeFeature={activeFeature}
        onSelectFeature={handleSelectFeature}
        currentProfile={currentProfile}
        cardPendingCount={cardPendingCount}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenNotificationSettings={() => setIsNotificationModalOpen(true)}
        onLogout={handleLogout}
      />

      {authError && (
        <div className="max-w-5xl w-full mx-auto px-4 pt-4">
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium break-words">
            {authError}
          </div>
        </div>
      )}

      {activeFeature === 'portal' && (
        <ErrorBoundary key="portal" featureName="ポータル">
          <PortalFeatureApp
            currentEmail={currentEmail}
            usersMap={usersMap}
            items={items}
            isAccessVerified={isAccessVerified}
            isAccessRejected={isAccessRejected}
            addItem={addItem}
            updateItem={updateItem}
            updateItemStatus={updateItemStatus}
            deleteItemPermanently={deleteItemPermanently}
            emptyTrash={emptyTrash}
            onSearchInKaimono={handleSearchInKaimono}
          />
        </ErrorBoundary>
      )}

      {activeFeature === 'kaimono' && (
        <ErrorBoundary key="kaimono" featureName="価格比較・買い物管理">
          <KaimonoCompareApp
            user={authUser}
            displayName={resolvedDisplayName}
            onUnauthorized={handleUnauthorizedFromFeature}
            onConsultCardApproval={handleConsultCardApproval}
            initialSearchQuery={kaimonoSearchKeyword}
          />
        </ErrorBoundary>
      )}

      {activeFeature === 'card' && (
        <ErrorBoundary key="card" featureName="共通カード承認">
          <CardApprovalApp
            user={authUser}
            displayName={resolvedDisplayName}
            onUnauthorized={handleUnauthorizedFromFeature}
          />
        </ErrorBoundary>
      )}

      <ProfileModal
        isOpen={isProfileModalOpen}
        canClose={!needsInitialProfile}
        currentEmail={currentEmail}
        profile={currentProfile}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={saveProfile}
        onExportJson={exportAllDataAsJson}
      />

      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        displayName={resolvedDisplayName}
        onClose={() => setIsNotificationModalOpen(false)}
      />
    </div>
  );
}