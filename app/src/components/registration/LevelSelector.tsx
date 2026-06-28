interface LevelSelectorProps {
  selectedLevel: string;
  onSelectLevel: (level: string) => void;
}

const levels: { name: string; description: string }[] = [
  { name: "Beginner", description: "Fundamental skills and confidence-building drills." },
  { name: "Intermediate", description: "Refined technique plus tactical game preparation." },
  { name: "Advanced", description: "High-performance training for competitive matches." },
];

function LevelSelector({ selectedLevel, onSelectLevel }: LevelSelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {levels.map((level) => {
        const isActive = selectedLevel === level.name;
        return (
          <button
            key={level.name}
            type="button"
            onClick={() => onSelectLevel(level.name)}
            className={`rounded-3xl border p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
              isActive
                ? "border-[#A33B2B] bg-[#A33B2B]/10 shadow-md"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-base font-semibold text-[#0F172A]">{level.name}</p>
            <p className="mt-2 text-sm text-gray-500">{level.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export default LevelSelector;
