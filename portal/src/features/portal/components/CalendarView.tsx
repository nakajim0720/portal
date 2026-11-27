import { useState } from 'react';
import { ChevronLeft, ChevronRight, Cake, Calendar as CalendarIcon, X } from 'lucide-react';
import type { PortalItem, PortalUserProfile } from '../types';
import {
  formatDateTimeJst,
  getJstBirthdayMonthDay,
  getJstDateKey,
  getTodayJstDateKey,
} from '../dateJst';

interface CalendarViewProps {
  items: PortalItem[];
  usersMap: Record<string, PortalUserProfile>;
  currentEmail: string;
}

interface SelectedDayInfo {
  dateKey: string; // YYYY-MM-DD
  dayNumber: number;
  birthdays: PortalUserProfile[];
  dayItems: PortalItem[];
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function parseBirthdayParts(birthday: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

function formatBirthdayFullJst(birthday: string): string {
  const parts = parseBirthdayParts(birthday);
  if (!parts) {
    return birthday;
  }
  return `${parts.year}年${parts.month}月${parts.day}日`;
}

function calculateAgeJst(birthday: string, referenceDateKey?: string): number | null {
  const parts = parseBirthdayParts(birthday);
  if (!parts) {
    return null;
  }
  const refKey = referenceDateKey || getTodayJstDateKey();
  const refMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(refKey);
  if (!refMatch) {
    return null;
  }
  const refYear = Number(refMatch[1]);
  const refMonth = Number(refMatch[2]);
  const refDay = Number(refMatch[3]);

  let age = refYear - parts.year;
  const hasHadBirthdayThisYear =
    refMonth > parts.month || (refMonth === parts.month && refDay >= parts.day);
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function getCategoryLabel(category: PortalItem['category']): string {
  switch (category) {
    case 'shopping':
      return 'お買い物';
    case 'dateideas':
      return 'デート・おでかけ';
    case 'shared':
      return '共有タスク・家事';
  }
}

function getFallbackNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim();
  return local || 'メンバー';
}

export function CalendarView({
  items,
  usersMap,
  currentEmail,
}: CalendarViewProps) {
  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<SelectedDayInfo | null>(null);
  const [selectedBirthdayUser, setSelectedBirthdayUser] = useState<PortalUserProfile | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<PortalItem | null>(null);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = getTodayJstDateKey();

  const resolveUserDisplayName = (email: string | undefined): string => {
    if (email && usersMap[email]?.displayName?.trim()) {
      return usersMap[email].displayName.trim();
    }
    if (email && email.includes('@')) {
      return getFallbackNameFromEmail(email);
    }
    return 'メンバー';
  };

  const formatItemAssignee = (item: PortalItem): string => {
    if (!item.assignee || item.assignee === 'shared' || item.assignee === 'ふたり共有') {
      return 'ふたりの共有';
    }
    if (item.assignee === 'private') {
      return resolveUserDisplayName(item.createdBy || currentEmail);
    }
    return resolveUserDisplayName(item.assignee);
  };

  const visibleItems = items.filter((item) => {
    if (item.status === 2 || !item.dueDate) {
      return false;
    }
    if (item.displayScope === 'private' && item.createdBy && item.createdBy !== currentEmail) {
      return false;
    }
    return true;
  });

  const cells: Array<{ key: string; day: number | null }> = [];
  for (let i = 0; i < firstDayOfWeek; i += 1) {
    cells.push({ key: `pad-start-${i}`, day: null });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push({ key: `${year}-${mm}-${dd}`, day: d });
  }

  const closeAllModals = () => {
    setSelectedDay(null);
    setSelectedBirthdayUser(null);
    setSelectedDetailItem(null);
  };

  const backToDayList = () => {
    setSelectedBirthdayUser(null);
    setSelectedDetailItem(null);
  };

  const currentBirthdayProfile = selectedBirthdayUser
    ? usersMap[selectedBirthdayUser.email] || selectedBirthdayUser
    : null;

  const selectedBirthdayAge = currentBirthdayProfile?.birthday
    ? calculateAgeJst(currentBirthdayProfile.birthday)
    : null;

  const isDayListOpen = Boolean(
    selectedDay && !selectedBirthdayUser && !selectedDetailItem
  );

  return (
    <>
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {year}年 {month + 1}月
            </h2>
            <p className="text-xs text-slate-500">
              日付をタップすると、その日の予定一覧や誕生日詳細を確認できます。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
              前月
            </button>
            <button
              type="button"
              onClick={() => setMonthCursor(new Date())}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700"
            >
              今月
            </button>
            <button
              type="button"
              onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-700"
            >
              翌月
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((weekday, idx) => (
            <div
              key={weekday}
              className={`py-1.5 rounded-lg text-xs font-bold ${
                idx === 0
                  ? 'bg-rose-50 text-rose-700'
                  : idx === 6
                  ? 'bg-sky-50 text-sky-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {weekday}
            </div>
          ))}

          {cells.map((cell) => {
            if (cell.day === null) {
              return (
                <div
                  key={cell.key}
                  className="min-h-[84px] sm:min-h-[100px] rounded-lg bg-slate-50/50 border border-slate-100"
                />
              );
            }

            const cellMonthDay = cell.key.slice(5); // MM-DD
            const isToday = cell.key === todayKey;

            const birthdaysHere = Object.values(usersMap).filter((u) => {
              if (!u.birthday || !u.displayName) {
                return false;
              }
              return getJstBirthdayMonthDay(u.birthday) === cellMonthDay;
            });

            const dayItems = visibleItems.filter((item) => getJstDateKey(item.dueDate) === cell.key);

            return (
              <div
                key={cell.key}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedBirthdayUser(null);
                  setSelectedDetailItem(null);
                  setSelectedDay({
                    dateKey: cell.key,
                    dayNumber: cell.day!,
                    birthdays: birthdaysHere,
                    dayItems,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedBirthdayUser(null);
                    setSelectedDetailItem(null);
                    setSelectedDay({
                      dateKey: cell.key,
                      dayNumber: cell.day!,
                      birthdays: birthdaysHere,
                      dayItems,
                    });
                  }
                }}
                className={`min-h-[84px] sm:min-h-[100px] rounded-lg border p-1 text-left flex flex-col gap-1 overflow-hidden cursor-pointer transition ${
                  isToday
                    ? 'border-pink-500 bg-pink-50/50 hover:bg-pink-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1 px-0.5">
                  <span
                    className={`text-xs font-bold ${
                      isToday ? 'text-pink-700' : 'text-slate-700'
                    }`}
                  >
                    {cell.day}
                  </span>
                  {dayItems.length > 1 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-pink-100 text-pink-800 text-[10px] font-bold shrink-0">
                      {dayItems.length}件
                    </span>
                  )}
                </div>

                {birthdaysHere.map((u) => {
                  const age = calculateAgeJst(u.birthday);
                  const ageLabel = age !== null ? ` (${age}歳)` : '';
                  const displayName = resolveUserDisplayName(u.email);
                  return (
                    <span
                      key={`bday-${u.email}`}
                      className="w-full px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-semibold truncate block"
                      title={`${displayName}の誕生日${ageLabel}`}
                    >
                      🎂 {displayName}
                      {ageLabel}
                    </span>
                  );
                })}

                {dayItems.slice(0, 2).map((item) => {
                  const formatted = formatDateTimeJst(item.dueDate);
                  const timePart = formatted.length >= 16 ? `${formatted.slice(11, 16)} ` : '';
                  const assigneeLabel = formatItemAssignee(item);
                  return (
                    <span
                      key={item.id}
                      className="w-full px-1.5 py-0.5 rounded bg-pink-600 text-white text-[11px] font-medium truncate block"
                      title={`${timePart}[${assigneeLabel}] ${item.title}`}
                    >
                      {timePart}
                      {item.title}
                    </span>
                  );
                })}

                {dayItems.length > 2 && (
                  <span className="px-1 text-[10px] font-semibold text-pink-700 truncate">
                    他 {dayItems.length - 2}件
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 日付選択時の予定・誕生日一覧モーダル */}
      {isDayListOpen && selectedDay && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full min-w-0 overflow-hidden p-5 shadow-xl space-y-4 my-auto">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarIcon className="w-5 h-5 text-pink-600 shrink-0" />
                <h3 className="text-lg font-bold text-slate-900 truncate">
                  {year}年{month + 1}月{selectedDay.dayNumber}日の予定一覧
                </h3>
              </div>
              <button
                type="button"
                onClick={closeAllModals}
                aria-label="閉じる"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedDay.birthdays.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-amber-800">誕生日</p>
                <ul className="space-y-2">
                  {selectedDay.birthdays.map((bUser) => {
                    const liveProfile = usersMap[bUser.email] || bUser;
                    const age = calculateAgeJst(liveProfile.birthday);
                    const displayName = resolveUserDisplayName(liveProfile.email);
                    return (
                      <li key={liveProfile.email}>
                        <button
                          type="button"
                          onClick={() => setSelectedBirthdayUser(liveProfile)}
                          className="w-full p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-left flex items-center justify-between gap-3 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {liveProfile.icon ? (
                              <img
                                src={liveProfile.icon}
                                alt={displayName}
                                className="w-9 h-9 rounded-full object-cover border border-amber-300 shrink-0"
                              />
                            ) : (
                              <Cake className="w-5 h-5 text-amber-700 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-amber-950 text-sm truncate">
                                🎂 {displayName}の誕生日
                                {age !== null ? `（${age}歳）` : ''}
                              </p>
                              <p className="text-xs text-amber-800">タップして詳細を表示</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-amber-900 shrink-0">詳細</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600">
                予定（{selectedDay.dayItems.length}件）
              </p>
              {selectedDay.dayItems.length === 0 ? (
                <p className="text-sm text-slate-500 py-3">
                  {selectedDay.birthdays.length > 0
                    ? 'この日の登録予定はありません。'
                    : 'この日の予定はありません。'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedDay.dayItems.map((item) => {
                    const formatted = formatDateTimeJst(item.dueDate);
                    const timePart = formatted.length >= 16 ? formatted.slice(11, 16) : '';
                    const assigneeLabel = formatItemAssignee(item);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedDetailItem(item)}
                          className="w-full p-3 rounded-xl border border-slate-200 bg-white hover:bg-pink-50/60 text-left flex items-center justify-between gap-3 transition"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-semibold text-slate-900 text-sm break-words">
                              {item.title}
                            </p>
                            <p className="text-xs text-slate-600">担当: {assigneeLabel}</p>
                            {timePart && (
                              <p className="text-xs text-rose-700 font-medium">{timePart}</p>
                            )}
                            <p className="text-xs text-pink-700">タップして詳細を表示</p>
                          </div>
                          <span className="text-xs font-semibold text-pink-700 shrink-0">詳細</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={closeAllModals}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-base"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 予定詳細モーダル */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full min-w-0 overflow-hidden p-5 shadow-xl space-y-4 my-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-pink-700">
                  {getCategoryLabel(selectedDetailItem.category)}
                </p>
                <h3 className="text-lg font-bold text-slate-900 break-words">
                  {selectedDetailItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeAllModals}
                aria-label="閉じる"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">担当・区分</dt>
                <dd className="font-semibold text-slate-900 text-right">
                  {formatItemAssignee(selectedDetailItem)}
                </dd>
              </div>
              {selectedDetailItem.dueDate && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">予定日時</dt>
                  <dd className="font-medium text-rose-700 text-right">
                    {formatDateTimeJst(selectedDetailItem.dueDate)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">作成者</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {resolveUserDisplayName(selectedDetailItem.createdBy)}
                </dd>
              </div>
              {selectedDetailItem.createdAt && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">作成日時</dt>
                  <dd className="font-medium text-slate-900 text-right">
                    {formatDateTimeJst(selectedDetailItem.createdAt)}
                  </dd>
                </div>
              )}
            </dl>

            <div className="flex flex-wrap gap-2 pt-2">
              {selectedDay && (
                <button
                  type="button"
                  onClick={backToDayList}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-base"
                >
                  その日の一覧に戻る
                </button>
              )}
              <button
                type="button"
                onClick={closeAllModals}
                className="flex-1 py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold text-base"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 誕生日詳細モーダル */}
      {currentBirthdayProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full min-w-0 overflow-hidden p-5 shadow-xl space-y-4 my-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                {currentBirthdayProfile.icon ? (
                  <img
                    src={currentBirthdayProfile.icon}
                    alt={resolveUserDisplayName(currentBirthdayProfile.email)}
                    className="w-12 h-12 rounded-full object-cover border border-amber-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Cake className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 break-words">
                    🎂 {resolveUserDisplayName(currentBirthdayProfile.email)}の誕生日
                  </h3>
                  <p className="text-xs text-amber-800 font-semibold">毎年カレンダーに表示</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAllModals}
                aria-label="閉じる"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">お名前</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {resolveUserDisplayName(currentBirthdayProfile.email)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">生年月日</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {currentBirthdayProfile.birthday
                    ? formatBirthdayFullJst(currentBirthdayProfile.birthday)
                    : '未設定'}
                </dd>
              </div>
              {selectedBirthdayAge !== null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">年齢</dt>
                  <dd className="font-bold text-amber-900 text-right">
                    {selectedBirthdayAge}歳
                  </dd>
                </div>
              )}
            </dl>

            <div className="flex flex-wrap gap-2 pt-2">
              {selectedDay && (
                <button
                  type="button"
                  onClick={backToDayList}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-base"
                >
                  その日の一覧に戻る
                </button>
              )}
              <button
                type="button"
                onClick={closeAllModals}
                className="flex-1 py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold text-base"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}