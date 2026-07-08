// ============================================================
//  components/registration/WeeklyBatchSelector.tsx
//  Cascading "Select Batch" -> "Select Week" UI for WEEKLY batchType
//  programs — mirrors the admin panel's Batch / "+ Add Week" structure:
//    Select Batch = pick the Age Group + Level + Time + Ground group
//    Select Week  = pick ONE OR MORE weeks of that batch (checkboxes) —
//                    July 20-24, 27-31, ... — price = basePrice × number
//                    of weeks checked.
//  Used identically across View Details, Quick Registration and the
//  Chatbot registration flow (all three import this one component).
// ============================================================
import { useEffect, useState } from "react";
import {
  groupWeeklyBatches,
  formatWeekRangeLabel,
  calcWeeklyPrice,
  type WeeklyBatchRaw,
} from "../../utils/weeklyBatch";

interface Props {
  batches: WeeklyBatchRaw[];
  basePrice: number;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function WeeklyBatchSelector({ batches, basePrice, selectedIds, onChange }: Props) {
  const groups = groupWeeklyBatches(batches);

  // All currently-checked weeks always belong to the same batch group
  // (checking a box in a different group would leave orphaned selections,
  // so switching "Select Batch" always clears the week checkboxes below).
  const groupOfSelection = groups.find((g) => g.weeks.some((w) => selectedIds.includes(w._id)));

  // Which "Select Batch" option is currently chosen. Kept as its own piece
  // of state so the Week checklist can be shown/reset even before any week
  // is picked (selectedIds is only set once a week is checked).
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>(groupOfSelection?.key || "");

  // Keep in sync if selectedIds changes from outside (e.g. loaded from a
  // saved draft) after the initial render.
  useEffect(() => {
    if (groupOfSelection && groupOfSelection.key !== selectedGroupKey) {
      setSelectedGroupKey(groupOfSelection.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(",")]);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-gray-500">
        No batches are open for this age group / level right now. Please check back soon or contact us.
      </div>
    );
  }

  const selectedGroup = groups.find((g) => g.key === selectedGroupKey) || null;

  const handleBatchChange = (key: string) => {
    setSelectedGroupKey(key);
    // Changing the batch always clears any previously checked weeks — the
    // weeks belong to whichever batch group is currently selected.
    onChange([]);
  };

  const toggleWeek = (weekId: string) => {
    const next = selectedIds.includes(weekId)
      ? selectedIds.filter((id) => id !== weekId)
      : [...selectedIds, weekId];
    onChange(next);
  };

  const weekCount = selectedIds.length;
  const totalPrice = calcWeeklyPrice(basePrice, selectedIds);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Select Batch ── */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[#0F172A]">
          Select Batch <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedGroupKey}
          onChange={(e) => handleBatchChange(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-[#0F172A] focus:border-[#A33B2B] focus:outline-none focus:ring-1 focus:ring-[#A33B2B]"
        >
          <option value="">Choose an option</option>
          {groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.groupLabel}
            </option>
          ))}
        </select>
      </div>

      {/* ── Select Week (only once a Batch is chosen) — checkboxes, multi-select ── */}
      {selectedGroup && (
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#0F172A]">
            Select Week <span className="text-red-500">*</span>
            <span className="ml-1 font-normal text-xs text-gray-500">(select one or more)</span>
          </label>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-300 bg-white p-2">
            {selectedGroup.weeks.map((w) => {
              const checked = selectedIds.includes(w._id);
              return (
                <label
                  key={w._id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    checked ? "bg-[#A33B2B]/10 text-[#A33B2B] font-semibold" : "text-[#0F172A] hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleWeek(w._id)}
                    className="h-4 w-4 rounded accent-[#A33B2B]"
                  />
                  {formatWeekRangeLabel(w)}
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">{selectedGroup.groundAddress}</p>
        </div>
      )}

      {/* ── Price summary ── */}
      {weekCount > 0 && (
        <div className="mt-1 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
          <span className="text-sm">{weekCount} week{weekCount > 1 ? "s" : ""} selected</span>
          <span className="text-base font-bold">${totalPrice}</span>
        </div>
      )}
    </div>
  );
}