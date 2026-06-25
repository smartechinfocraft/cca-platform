interface AgeGroupSelectorProps {
  selectedAgeGroup: string;
  onSelectAgeGroup: (ageGroup: string) => void;
}

const ageGroups: string[] = ["U8", "U10", "U12", "U14", "U16"];

function AgeGroupSelector({ selectedAgeGroup, onSelectAgeGroup }: AgeGroupSelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {ageGroups.map((ageGroup) => {
        const isActive = selectedAgeGroup === ageGroup;
        return (
          <button
            key={ageGroup}
            type="button"
            onClick={() => onSelectAgeGroup(ageGroup)}
            className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
              isActive
                ? "bg-[#F97316] text-white shadow-lg"
                : "bg-white text-slate-800 border border-slate-200 hover:bg-[#F97316]/10"
            }`}
          >
            {ageGroup}
          </button>
        );
      })}
    </div>
  );
}

export default AgeGroupSelector;
