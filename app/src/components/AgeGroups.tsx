import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPrograms } from "../services/programService";

const fallback = ["U8", "U10", "U12", "U14", "U16"];

const AGE_DETAILS: Record<string, { age: string; desc: string; icon: string }> = {
  "U8":  { age: "Ages 5–8",  desc: "Fun fundamentals & cricket basics", icon: "🌱" },
  "U10": { age: "Ages 8–10", desc: "Skill development & teamwork", icon: "⚡" },
  "U12": { age: "Ages 10–12", desc: "Technique refinement & competition", icon: "🎯" },
  "U14": { age: "Ages 12–14", desc: "Tactical cricket & match play", icon: "🏏" },
  "U16": { age: "Ages 14–16", desc: "High-performance & representative pathways", icon: "🏆" },
};

function AgeGroups() {
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getPrograms()
      .then((data: any[]) => {
        const all = new Set<string>();
        (data ?? []).forEach((p) => {
          if (Array.isArray(p.ageGroups)) p.ageGroups.forEach((g: string) => all.add(g));
        });
        setAgeGroups(Array.from(all).sort());
      })
      .catch(() => setAgeGroups([]))
      .finally(() => setLoading(false));
  }, []);

  const display = ageGroups.length > 0 ? ageGroups : fallback;

  return (
    <section id="age-groups" className="py-24 bg-[#FFFBF5]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-[var(--gold)] text-xs font-bold tracking-widest uppercase block mb-3">
            Choose Your Level
          </span>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-[var(--outfield)]">
            Programs by Age Group
          </h2>
          <p className="text-slate-500 mt-4 max-w-md mx-auto">
            Every stage of development is covered — from total beginners to aspiring national players.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-wrap justify-center gap-4">
            {[1,2,3,4,5].map(i => <div key={i} className="w-44 h-36 rounded-3xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-5">
            {display.map((group) => {
              const detail = AGE_DETAILS[group] ?? { age: "Youth", desc: "Structured cricket training", icon: "🏏" };
              const isActive = active === group;
              return (
                <button
                  key={group}
                  onClick={() => {
                    setActive(isActive ? null : group);
                    navigate(`/programs?ageGroup=${group}`);
                  }}
                  className={`group flex flex-col items-center w-44 p-6 rounded-3xl border-2 transition-all duration-200 shadow-sm
                    ${isActive
                      ? "border-[var(--gold)] bg-[var(--gold)] text-[var(--outfield)] shadow-[var(--gold-glow)] shadow-lg scale-105"
                      : "border-slate-200 bg-white hover:border-[var(--gold)] hover:bg-amber-50 hover:scale-105"
                    }`}
                >
                  <span className="text-3xl mb-3">{detail.icon}</span>
                  <p className={`font-display text-2xl font-bold ${isActive ? "text-white" : "text-[var(--outfield)]"}`}>
                    {group}
                  </p>
                  <p className={`text-xs mt-1.5 font-medium ${isActive ? "text-amber-100" : "text-slate-400"}`}>
                    {detail.age}
                  </p>
                  <p className={`text-xs mt-1 text-center leading-tight ${isActive ? "text-amber-50" : "text-slate-400"}`}>
                    {detail.desc}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-center text-sm text-slate-400 mt-8">
          Click an age group to browse matching programs
        </p>
      </div>
    </section>
  );
}

export default AgeGroups;
