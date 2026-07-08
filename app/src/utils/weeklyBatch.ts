// ============================================================
//  utils/weeklyBatch.ts
//  Shared helpers for the WEEKLY batchType "multi-batch" flow.
//  Used identically by:
//    - pages/registration/ProgramSelection.tsx  (View Details)
//    - components/ProgramCard.tsx (QuickRegisterDrawer)
//    - components/chatbot/ChatbotRegistrationFlow.tsx
//  Keeping the logic in ONE place means all three surfaces stay
//  in sync automatically.
// ============================================================

export interface WeeklyBatchRaw {
  _id: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  groundAddress: string;
  ageGroups?: string[];
  skillLevels?: string[];
  label?: string;
  isActive?: boolean;
  // true = this entry is a "Week N" row nested under a root batch (added via
  // "+ Add Week" in the admin panel). It shares ageGroups/skillLevels/
  // groundAddress with its root but is still an independently selectable
  // entry for registration/pricing purposes.
  isSubWeek?: boolean;
}

export function fmt12(t: string): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr ?? "00"} ${ampm}`;
}

/** Human display line for one batch, e.g. "July 20 - July 24 · 4:00 PM - 5:30 PM" */
export function formatWeeklyBatchLine(batch: WeeklyBatchRaw): string {
  const dateLabel = batch.label || `${batch.startDate} - ${batch.endDate}`;
  const timeLabel = batch.startTime && batch.endTime
    ? `${fmt12(batch.startTime)} - ${fmt12(batch.endTime)}`
    : "";
  return [dateLabel, timeLabel].filter(Boolean).join(" · ");
}

/** One selectable "Batch" group in the Select Batch / Select Week UI —
 * a root batch (Age Group + Level + Time + Ground) plus every "Week N"
 * row nested under it. Built purely from array order, exactly the way the
 * admin panel stores it: a root (isSubWeek: false) followed by zero or
 * more sub-weeks (isSubWeek: true) that share its ageGroups/skillLevels/
 * groundAddress. */
export interface WeeklyBatchGroup {
  key: string;              // stable key = root batch's _id
  ageGroups: string[];
  skillLevels: string[];
  groundAddress: string;
  startTime: string;
  endTime: string;
  groupLabel: string;       // e.g. "U8 / U10 Beginner Level 1 - 9:00 AM - 12:00 PM - 47100 Fernald Street, Fremont"
  weeks: WeeklyBatchRaw[];  // every selectable week in this batch (root counts as Week 1)
}

function buildGroupLabel(b: WeeklyBatchRaw): string {
  const agePart   = b.ageGroups?.length   ? b.ageGroups.join(" / ")   : "";
  const levelPart = b.skillLevels?.length ? b.skillLevels.join(" / ") : "";
  const namePart  = [agePart, levelPart].filter(Boolean).join(" ");
  const timePart  = b.startTime && b.endTime ? `${fmt12(b.startTime)} - ${fmt12(b.endTime)}` : "";
  return [namePart, timePart, b.groundAddress].filter(Boolean).join(" - ");
}

/** Group a flat weeklyBatches array (as saved by the admin panel) into
 * selectable "Batch" groups for the Select Batch / Select Week dropdowns. */
export function groupWeeklyBatches(batches: WeeklyBatchRaw[]): WeeklyBatchGroup[] {
  const groups: WeeklyBatchGroup[] = [];
  for (const b of batches) {
    if (b.isSubWeek && groups.length > 0) {
      groups[groups.length - 1].weeks.push(b);
    } else {
      groups.push({
        key: b._id,
        ageGroups: b.ageGroups || [],
        skillLevels: b.skillLevels || [],
        groundAddress: b.groundAddress,
        startTime: b.startTime,
        endTime: b.endTime,
        groupLabel: buildGroupLabel(b),
        weeks: [b],
      });
    }
  }
  return groups;
}

/** Date-only range for the "Select Week" dropdown, e.g. "July 20 - 24"
 * (time isn't repeated here since it's already shown on the Batch line). */
export function formatWeekRangeLabel(batch: WeeklyBatchRaw): string {
  if (!batch.startDate || !batch.endDate) return batch.label || "";
  const s = new Date(batch.startDate);
  const e = new Date(batch.endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return batch.label || "";
  const sm = s.toLocaleDateString("en-US", { month: "long" });
  const em = e.toLocaleDateString("en-US", { month: "long" });
  return sm === em
    ? `${sm} ${s.getDate()} - ${e.getDate()}`
    : `${sm} ${s.getDate()} - ${em} ${e.getDate()}`;
}

/**
 * Only show batches that match the student's chosen Age Group / Level
 * (when the parent has picked one). If nothing is picked yet, show all.
 */
export function filterWeeklyBatches(
  batches: WeeklyBatchRaw[],
  ageGroup?: string | null,
  skillLevel?: string | null
): WeeklyBatchRaw[] {
  return batches.filter((b) => {
    const ageOk = !ageGroup || !b.ageGroups?.length || b.ageGroups.includes(ageGroup);
    const levelOk = !skillLevel || !b.skillLevels?.length || b.skillLevels.includes(skillLevel);
    return ageOk && levelOk;
  });
}

/**
 * Price = basePrice × number of batches selected.
 * This mirrors the SERVER-SIDE calculation in backend/src/utils/pricing.js
 * exactly — the server always recomputes and never trusts this value for
 * payment, but using the same formula here keeps the on-screen preview
 * accurate before the user pays.
 */
export function calcWeeklyPrice(basePrice: number, selectedBatchIds: string[]): number {
  const count = selectedBatchIds.length;
  if (count === 0) return 0;
  return Math.round(basePrice * count * 100) / 100;
}

/** Snapshot shape stored on the registration context's selectedBatch + sent to /register */
export interface SelectedWeeklyBatchSnapshot {
  _id: string;
  label: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  groundAddress: string;
}

export function toWeeklyBatchSnapshots(
  batches: WeeklyBatchRaw[],
  selectedIds: string[]
): SelectedWeeklyBatchSnapshot[] {
  return batches
    .filter((b) => selectedIds.includes(b._id))
    .map((b) => ({
      _id: b._id,
      label: b.label || formatWeeklyBatchLine(b),
      startDate: b.startDate,
      startTime: b.startTime,
      endDate: b.endDate,
      endTime: b.endTime,
      groundAddress: b.groundAddress,
    }));
}