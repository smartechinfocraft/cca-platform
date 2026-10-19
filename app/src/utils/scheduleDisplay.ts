const WEEKDAY_ORDER: Record<string, number> = {
  mon: 0,
  monday: 0,
  tue: 1,
  tues: 1,
  tuesday: 1,
  wed: 2,
  wednesday: 2,
  thu: 3,
  thur: 3,
  thurs: 3,
  thursday: 3,
  fri: 4,
  friday: 4,
  sat: 5,
  saturday: 5,
  sun: 6,
  sunday: 6,
};

function weekdayOrder(schedule: string): number {
  const weekday = schedule.match(/^\s*([a-z]+)/i)?.[1]?.toLowerCase();
  return weekday ? WEEKDAY_ORDER[weekday] ?? 7 : 7;
}

export function sortScheduleItems(schedules: string[]): string[] {
  return schedules
    .map((schedule, index) => ({ schedule, index, order: weekdayOrder(schedule) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ schedule }) => schedule);
}

export function splitAndSortScheduleItems(value?: string): string[] {
  const schedules = String(value ?? "")
    .split(/\s*(?:\n|;|\+|\|)\s*|,\s*(?=(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b)/i)
    .map((schedule) => schedule.trim())
    .filter(Boolean);
  return sortScheduleItems(schedules);
}
