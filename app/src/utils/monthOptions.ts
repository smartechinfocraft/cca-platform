export type MonthOptionAvailability = {
  isEnabled?: boolean | string | number;
  startDate?: string;
};

function isDisabledFlag(value: unknown): boolean {
  return value === false || value === "false" || value === 0 || value === "0";
}

export function isMonthOptionVisible<T extends MonthOptionAvailability>(option: T): boolean {
  if (isDisabledFlag(option.isEnabled)) return false;
  return true;
}

export function getVisibleMonthOptions<T extends MonthOptionAvailability>(options?: T[]): T[] {
  if (!Array.isArray(options)) return [];
  return options.filter((option) => isMonthOptionVisible(option));
}
