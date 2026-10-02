// Interpret complete MM/DD/YYYY dates in local time; reject rollover dates such as 02/30.
export function localDate(value: string, endOfDay: boolean): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, monthText, dayText, yearText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);
  if (year < 1000) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}
