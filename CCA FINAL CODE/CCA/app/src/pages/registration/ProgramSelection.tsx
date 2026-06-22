import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HiOutlineArrowLeft, HiOutlineArrowRight } from "react-icons/hi2";
import { useRegistration } from "../../context/RegistrationContext";
import { getProgramById } from "../../services/programService";
import type { Program } from "../../types/program";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TimeSlot { startTime: string; endTime: string; }
interface MonthOption { label: string; startDate: string; endDate: string; weeks: string | number; }
interface BatchRaw {
  _id: string;
  name: string;
  title?: string;
  days: string;
  dayOfWeek?: string;
  multiDays?: string[];
  timing: string;
  timeSlots?: TimeSlot[];
  fee: number;
  price?: number;
  pricePerSession?: number;
  seats: number;
  maxCapacity?: number;
  sessionsPerWeek?: number;
  monthOptions?: MonthOption[];
  location?: { title?: string; city?: string; address?: string };
  groundLocationNote?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAY_FULL: Record<string, string> = {
  MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
  FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
};

function fmt12(t: string): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr ?? "00"} ${ampm}`;
}

function getDayLabel(batch: BatchRaw): string {
  if (batch.dayOfWeek === "MULTI" && batch.multiDays && batch.multiDays.length > 0)
    return batch.multiDays.map((d) => DAY_FULL[d] ?? d).join(" / ");
  if (batch.dayOfWeek && batch.dayOfWeek !== "MULTI") return DAY_FULL[batch.dayOfWeek] ?? batch.dayOfWeek;
  return batch.days ?? "";
}

// Build individual day+time+location options for the dropdown
// Each day × each timeSlot = one option
function buildDaySlotOptions(batch: BatchRaw): string[] {
  const slots = getSlots(batch);
  const location = getLocationStr(batch);
  const locationSuffix = location ? ` - ${location}` : "";

  // Get list of individual days
  let days: string[] = [];
  if (batch.multiDays && batch.multiDays.length > 0) {
    days = batch.multiDays.map((d) => DAY_FULL[d] ?? d);
  } else if (batch.dayOfWeek && batch.dayOfWeek !== "MULTI") {
    days = [DAY_FULL[batch.dayOfWeek] ?? batch.dayOfWeek];
  } else if (batch.days) {
    days = [batch.days];
  }

  if (days.length === 0) return [];

  const options: string[] = [];
  for (const day of days) {
    if (slots.length > 0) {
      for (const s of slots) {
        options.push(`${day} - ${fmt12(s.startTime)} - ${fmt12(s.endTime)}${locationSuffix}`);
      }
    } else {
      options.push(`${day}${locationSuffix}`);
    }
  }
  return options;
}

function getSlots(batch: BatchRaw): TimeSlot[] {
  if (batch.timeSlots && batch.timeSlots.length > 0) return batch.timeSlots;
  const parts = batch.timing?.split(" - ");
  if (parts?.length === 2) return [{ startTime: parts[0].trim(), endTime: parts[1].trim() }];
  return [];
}

function getLocationStr(batch: BatchRaw): string {
  if (batch.location?.address) return batch.location.address;
  if (batch.location?.city) return batch.location.city;
  if (batch.location?.title) return batch.location.title;
  if (batch.groundLocationNote) return batch.groundLocationNote;
  return "";
}

function getPricePerSession(batch: BatchRaw): number {
  return batch.pricePerSession ?? batch.price ?? batch.fee ?? 0;
}

function freqLabel(n: number): string {
  const m: Record<number, string> = { 1: "Once a Week", 2: "Twice a Week", 3: "Thrice a Week" };
  return m[n] ?? `${n}× a Week`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProgramSelection() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { setSelectedBatch, setSelectedProgram, students, updateStudent, currentStudentIndex } =
    useRegistration();

  const [program, setProgram] = useState<Program | null>(null);
  const [batches, setBatches] = useState<BatchRaw[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Per-program selections ──
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<MonthOption | null>(null);
  const [selectedFreq, setSelectedFreq] = useState<number>(1); // sessions/week
  // Per-frequency: chosen slot for each session (e.g. freq=2 → daySlots[0], daySlots[1])
  const [daySlots, setDaySlots] = useState<(string | null)[]>([null]);

  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchProgram = async () => {
      if (!id) return;
      try {
        const data = await getProgramById(id);
        const batchItems: BatchRaw[] = Array.isArray(data?.batches)
          ? data.batches.map((b: any) => ({
              _id: b._id,
              name: b.name ?? b.title ?? `Batch ${b._id}`,
              title: b.title,
              days: b.days ?? "",
              dayOfWeek: b.dayOfWeek,
              multiDays: b.multiDays,
              timing: b.timing ?? "",
              timeSlots: b.timeSlots,
              fee: Number(b.price ?? b.fee ?? 0),
              price: Number(b.price ?? b.fee ?? 0),
              pricePerSession: Number(b.pricePerSession ?? b.price ?? b.fee ?? 0),
              seats: Number(b.maxCapacity ?? b.capacity ?? b.seats ?? 0),
              sessionsPerWeek: b.sessionsPerWeek ?? undefined,
              monthOptions: Array.isArray(b.monthOptions) ? b.monthOptions : [],
              location: b.location,
              groundLocationNote: b.groundLocationNote,
            }))
          : [];
        setProgram(data ?? null);
        setBatches(batchItems);
        setSelectedProgram(data ?? null);
        // default freq to first batch's sessionsPerWeek
        if (batchItems.length > 0 && batchItems[0].sessionsPerWeek)
          setSelectedFreq(batchItems[0].sessionsPerWeek);
      } catch {
        setProgram(null); setBatches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProgram();
  }, [id, setSelectedProgram]);

  // When frequency changes, reset day slot selections
  useEffect(() => {
    setDaySlots(Array(selectedFreq).fill(null));
  }, [selectedFreq]);

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const activeBatch = batches.find((b) => b._id === selectedBatchId) ?? null;
  const pricePerSession = activeBatch ? getPricePerSession(activeBatch) : 0;
  const totalPrice = pricePerSession * selectedFreq;
  const slots = activeBatch ? getSlots(activeBatch) : [];
  const locationStr = activeBatch ? getLocationStr(activeBatch) : "";
  const monthOpts: MonthOption[] = activeBatch?.monthOptions ?? [];

  // Available frequencies: from sessionsPerWeek max down to 1
  const maxFreq = activeBatch?.sessionsPerWeek ?? 3;
  const freqOptions = Array.from({ length: maxFreq }, (_, i) => i + 1);

  // Build dropdown options for each day slot
  // Each option: "Day - StartTime - EndTime - Location"
  const slotOptions: string[] = activeBatch ? buildDaySlotOptions(activeBatch) : [];

  const allDaySlotsSelected = daySlots.every((s) => s !== null);
  const canConfirm = Boolean(activeBatch) && Boolean(selectedMonth) && allDaySlotsSelected;

  const handleConfirm = () => {
    if (!activeBatch || !selectedMonth) return;
    // IMPORTANT: _id and sessionsPerWeek must be preserved here (not just
    // display fields) — the payment step sends these to the backend so it
    // can look up the REAL price itself. Without _id, server-side price
    // verification has nothing to look up and would reject the payment.
    const batchForContext = {
      _id: activeBatch._id,
      name: activeBatch.name,
      days: daySlots.filter(Boolean).join(" + "),
      timing: daySlots.filter(Boolean).join(" | "),
      fee: totalPrice,
      seats: activeBatch.seats,
      sessionsPerWeek: selectedFreq,
      selectedMonth,
      selectedFrequency: selectedFreq,
    };
    setSelectedBatch(batchForContext as any);
    updateStudent(currentStudentIndex, { selectedBatch: batchForContext as any });
    navigate("/student-details");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="bg-[#f5f8fc] min-h-screen flex items-center justify-center">
        <div className="text-slate-500 text-sm animate-pulse">Loading program details...</div>
      </main>
    );
  }
  if (!program) {
    return (
      <main className="bg-[#f5f8fc] min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-sm">Program not found.</div>
      </main>
    );
  }

  const programTitle =
    `${program.ageGroups?.[0] ?? ""} - ${program.skillLevels?.[0] ?? ""} - ${
      typeof program.location === "string" ? program.location : program.location?.title ?? ""
    }`.replace(/^[ -]+|[ -]+$/g, "");

  return (
    <main className="bg-[#f5f8fc] text-[#0F172A] min-h-screen">
      {/* ── Back ── */}
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <button
          type="button"
          onClick={() => navigate(`/programs/${id}`)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#F97316] transition"
        >
          <HiOutlineArrowLeft className="h-4 w-4" />
          Back to program
        </button>
      </div>

      {/* ── Batch Cards ── */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {batches.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">
            No batches available for this program.
          </div>
        )}

        {batches.map((batch) => {
          const isSelected = selectedBatchId === batch._id;
          const pps = getPricePerSession(batch);
          const bMonthOpts = batch.monthOptions ?? [];
          const bMaxFreq = batch.sessionsPerWeek ?? 3;
          const bFreqOpts = Array.from({ length: bMaxFreq }, (_, i) => i + 1);
          const bSlots = getSlots(batch);
          const bLocation = getLocationStr(batch);

          return (
            <div
              key={batch._id}
              className={`rounded-2xl border bg-white shadow-sm transition ${
                isSelected ? "border-[#1a1a2e] ring-2 ring-[#1a1a2e]/10" : "border-slate-200"
              }`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between p-5 pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-[#0F172A]">
                      {programTitle || batch.name}
                    </h2>
                    {batch.name && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                        {batch.name}
                      </span>
                    )}
                  </div>
                  {bMonthOpts.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {bMonthOpts.map((m, mi) => (
                        <p key={mi} className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="text-slate-400">📅</span>
                          {m.label} {m.startDate ? `Starts – ${new Date(m.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-2xl font-bold text-[#2563EB]">
                    $ {isSelected ? totalPrice : pps * selectedFreq}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 px-5 py-4 space-y-5">
                {/* Select Month(s) */}
                {bMonthOpts.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A] mb-2">Select Month(s)</p>
                    <div className="flex flex-wrap gap-3">
                      {bMonthOpts.map((opt, oi) => {
                        const isChecked = isSelected && selectedMonth?.label === opt.label;
                        return (
                          <label
                            key={oi}
                            className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"
                          >
                            <input
                              type="radio"
                              name={`month-${batch._id}`}
                              checked={isChecked}
                              onChange={() => {
                                setSelectedBatchId(batch._id);
                                setSelectedMonth(opt);
                                setSelectedFreq(batch.sessionsPerWeek ?? 1);
                              }}
                              className="accent-[#1a1a2e] w-4 h-4"
                            />
                            {opt.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* If no month options, just a "Select" radio */}
                {bMonthOpts.length === 0 && (
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                      <input
                        type="radio"
                        name={`batch-select-${batch._id}`}
                        checked={isSelected}
                        onChange={() => {
                          setSelectedBatchId(batch._id);
                          setSelectedMonth({ label: batch.name, startDate: "", endDate: "", weeks: "" });
                          setSelectedFreq(batch.sessionsPerWeek ?? 1);
                        }}
                        className="accent-[#1a1a2e] w-4 h-4"
                      />
                      Select this batch
                    </label>
                  </div>
                )}

                {/* Batch Frequency — only shown when this batch is selected */}
                {isSelected && (
                  <>
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A] mb-2">Batch Frequency</p>
                      <div className="flex flex-wrap gap-4">
                        {bFreqOpts.map((n) => (
                          <label key={n} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                            <input
                              type="radio"
                              name={`freq-${batch._id}`}
                              checked={selectedFreq === n}
                              onChange={() => setSelectedFreq(n)}
                              className="accent-[#1a1a2e] w-4 h-4"
                            />
                            {freqLabel(n)}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Divider */}
                    <hr className="border-slate-100" />

                    {/* Select Day Batch(s) — N dropdowns based on frequency */}
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A] mb-3">Select Day Batch(s)</p>
                      <div className="space-y-3">
                        {Array.from({ length: selectedFreq }).map((_, di) => {
                          const dayLabel = di === 0 ? "Select Day 1 Batch" : `Select Day ${di + 1} Batch`;
                          return (
                            <select
                              key={di}
                              value={daySlots[di] ?? ""}
                              onChange={(e) => {
                                const val = e.target.value || null;
                                setDaySlots((prev) => {
                                  const next = [...prev];
                                  next[di] = val;
                                  return next;
                                });
                              }}
                              className={`w-full rounded-lg border px-4 py-3 text-sm text-[#0F172A] bg-white shadow-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 ${
                                daySlots[di]
                                  ? "border-[#1a1a2e]"
                                  : "border-slate-300"
                              }`}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "right 12px center",
                                backgroundSize: "16px",
                                paddingRight: "40px",
                              }}
                            >
                              <option value="">{dayLabel}</option>
                              {buildDaySlotOptions(batch)
                                .filter(
                                  (opt) =>
                                    opt === daySlots[di] ||
                                    !daySlots.some((selected, si) => si !== di && selected === opt)
                                )
                                .map((opt, oi) => (
                                  <option key={oi} value={opt}>{opt}</option>
                                ))}
                            </select>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Price + Register */}
              {isSelected && (
                <div className="border-t border-slate-100 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Registration Price</p>
                    <p className="text-3xl font-bold text-[#0F172A] mt-0.5">$ {totalPrice}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!canConfirm}
                    onClick={handleConfirm}
                    className="inline-flex items-center gap-2 rounded-full bg-[#1a1a2e] px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Register Now <HiOutlineArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {students.length > 1 && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs uppercase tracking-widest text-blue-600 font-semibold">
              Students Added: {students.length}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Currently setting up student #{currentStudentIndex + 1}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}