const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getNowJstIso(): string {
  const jstDate = new Date(Date.now() + JST_OFFSET_MS);
  return jstDate.toISOString();
}

export function toJstDate(value: string): Date | null {
  if (!value) {
    return null;
  }
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(Date.UTC(year, month, day, 0, 0, 0));
  }

  const localDatetimeMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value.trim()
  );
  if (localDatetimeMatch) {
    const year = Number(localDatetimeMatch[1]);
    const month = Number(localDatetimeMatch[2]) - 1;
    const day = Number(localDatetimeMatch[3]);
    const hour = Number(localDatetimeMatch[4]);
    const minute = Number(localDatetimeMatch[5]);
    const second = Number(localDatetimeMatch[6] || '0');
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(parsed.getTime() + JST_OFFSET_MS);
}

export function formatDateTimeJst(value: string): string {
  if (!value) {
    return '';
  }
  const jst = toJstDate(value);
  if (!jst) {
    return value;
  }
  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jst.getUTCDate()).padStart(2, '0');
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const min = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

export function getJstDateKey(value: string): string {
  const jst = toJstDate(value);
  if (!jst) {
    return '';
  }
  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getJstBirthdayMonthDay(birthday: string): string {
  if (!birthday) {
    return '';
  }
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday.trim());
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  }
  const jst = toJstDate(birthday);
  if (!jst) {
    return '';
  }
  const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jst.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

export function getTodayJstDateKey(): string {
  return getJstDateKey(new Date().toISOString());
}