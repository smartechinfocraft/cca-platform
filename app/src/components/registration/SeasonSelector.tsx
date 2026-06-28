interface SeasonSelectorProps {
  selectedSeason: string;
  onSelectSeason: (season: string) => void;
}

const seasons: string[] = ["Summer", "Winter", "Fall"];

function SeasonSelector({ selectedSeason, onSelectSeason }: SeasonSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {seasons.map((season) => {
        const isSelected = selectedSeason === season;
        return (
          <button
            key={season}
            type="button"
            onClick={() => onSelectSeason(season)}
            className={`rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
              isSelected
                ? "border-[#A33B2B] bg-[#A33B2B]/10 text-[#0F172A] shadow-md"
                : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            <span className="text-sm font-semibold uppercase tracking-[0.16em]">
              {season}
            </span>
            <p className="mt-2 text-sm text-gray-500">Select {season} season training.</p>
          </button>
        );
      })}
    </div>
  );
}

export default SeasonSelector;
