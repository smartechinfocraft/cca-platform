import { useState } from "react";

export interface BatchItem {
  _id?: string;
  name: string;
  days: string;
  timing: string;
  fee: number;
  seats: number;
  sessionsPerWeek?: number;
}

interface BatchListProps {
  batches: BatchItem[];
  onSelectBatch?: (batch: BatchItem) => void;
}

function BatchList({ batches, onSelectBatch }: BatchListProps) {
  const [activeBatch, setActiveBatch] = useState<string>("");

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {batches.map((batch, index) => {
        const isActive = activeBatch === batch.name;
        return (
          <div
           key={`${batch.name}-${index}`}
            className={`rounded-3xl p-6 transition ${isActive ? "border border-[#F97316] bg-[#fff7ed] shadow-xl" : "bg-white shadow-sm hover:-translate-y-1 hover:shadow-lg"}`}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F97316]">{batch.name}</p>
                  <h3 className="mt-3 text-2xl font-bold text-[#0F172A]">{batch.days}</h3>
                </div>
                {isActive && (
                  <span className="inline-flex items-center rounded-full bg-[#F97316]/10 px-3 py-1 text-xs font-semibold text-[#F97316]">
                    Selected
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Time</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{batch.timing}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Fee</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">${batch.fee}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Available Seats</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">{batch.seats}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveBatch(batch.name);
                  onSelectBatch?.(batch);
                }}
                className={`mt-2 rounded-full px-5 py-3 text-sm font-semibold transition ${isActive ? "bg-[#0F172A] text-white hover:bg-slate-900" : "bg-[#F97316] text-white hover:bg-orange-600"}`}
              >
                {isActive ? "Selected" : "Select Batch"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default BatchList;
