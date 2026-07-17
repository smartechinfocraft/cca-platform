export type MonthOptionAvailability = {
  isEnabled?: boolean | string | number;
  showInStartMonthOnly?: boolean | string | number;
  startDate?: string;
};

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function isDisabledFlag(value: unknown): boolean {
  return value === false || value === "false" || value === 0 || value === "0";
}

export function isSameCalendarMonth(dateValue?: string, now = new Date()): boolean {
  if (!dateValue) return false;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth();
}

export function isMonthOptionVisible<T extends MonthOptionAvailability>(option: T, now = new Date()): boolean {
  if (isDisabledFlag(option.isEnabled)) return false;
  if (isTruthyFlag(option.showInStartMonthOnly)) return isSameCalendarMonth(option.startDate, now);
  return true;
}

export function getVisibleMonthOptions<T extends MonthOptionAvailability>(options?: T[], now = new Date()): T[] {
  if (!Array.isArray(options)) return [];
  return options.filter((option) => isMonthOptionVisible(option, now));
}
