interface BatchCardProps {
  name: string;
  days: string;
  timing: string;
  fee: number;
  seats: number;
}

function BatchCard({ name, days, timing, fee, seats }: BatchCardProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:shadow-lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-orange-500 font-semibold">{name}</p>
            <h3 className="mt-2 text-2xl font-bold text-[#0F172A]">Batch Details</h3>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-[#0F172A]">
            {seats} seats left
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500">Days</p>
            <p className="mt-2 text-base font-semibold text-[#0F172A]">{days}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500">Timing</p>
            <p className="mt-2 text-base font-semibold text-[#0F172A]">{timing}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500">Monthly Fee</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A]">${fee}</p>
          </div>

          <button className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">
            Register Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default BatchCard;
