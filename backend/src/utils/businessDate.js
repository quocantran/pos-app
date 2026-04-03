const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const BUSINESS_OFFSET_HOURS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const pad = (value) => String(value).padStart(2, '0');

const formatDateParts = ({ year, month, day }) => `${year}-${pad(month)}-${pad(day)}`;

const parseDateString = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Reject invalid calendar dates like 2026-02-30.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
};

const getDatePartsInBusinessTz = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const mapped = {};

  for (const part of parts) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      mapped[part.type] = Number(part.value);
    }
  }

  return {
    year: mapped.year,
    month: mapped.month,
    day: mapped.day
  };
};

const addDays = (dateParts, days) => {
  const utc = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day) + (days * MS_PER_DAY);
  const d = new Date(utc);

  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate()
  };
};

const toBusinessStartUtc = (dateStr) => {
  const parts = parseDateString(dateStr);
  if (!parts) return null;

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, -BUSINESS_OFFSET_HOURS, 0, 0, 0));
};

const toBusinessEndUtc = (dateStr) => {
  const parts = parseDateString(dateStr);
  if (!parts) return null;

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 23 - BUSINESS_OFFSET_HOURS, 59, 59, 999));
};

const resolveBusinessDateRange = ({ start_date, end_date, defaultDays = 30 } = {}) => {
  const todayParts = getDatePartsInBusinessTz();

  const endParts = parseDateString(end_date) || todayParts;
  const startParts = parseDateString(start_date) || addDays(endParts, -(defaultDays - 1));

  return {
    startDate: toBusinessStartUtc(formatDateParts(startParts)),
    endDate: toBusinessEndUtc(formatDateParts(endParts)),
    startDateKey: formatDateParts(startParts),
    endDateKey: formatDateParts(endParts),
    startParts,
    endParts
  };
};

const getBusinessTodayRange = () => {
  const todayParts = getDatePartsInBusinessTz();
  const todayKey = formatDateParts(todayParts);

  return {
    todayStart: toBusinessStartUtc(todayKey),
    todayEnd: toBusinessEndUtc(todayKey),
    todayKey,
    todayParts
  };
};

const getBusinessMonthStartUtc = () => {
  const todayParts = getDatePartsInBusinessTz();
  const monthStartKey = formatDateParts({
    year: todayParts.year,
    month: todayParts.month,
    day: 1
  });

  return toBusinessStartUtc(monthStartKey);
};

module.exports = {
  parseDateString,
  formatDateParts,
  getDatePartsInBusinessTz,
  toBusinessStartUtc,
  toBusinessEndUtc,
  resolveBusinessDateRange,
  getBusinessTodayRange,
  getBusinessMonthStartUtc
};