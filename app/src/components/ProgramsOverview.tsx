import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPrograms } from "../services/programService";

const fallback = [
  { _id: "1", title: "Beginner Program", shortDescription: "Perfect for kids taking their first steps into cricket. Fun, fundamental skill-building.", basePrice: 199, tag: "Most Popular" },
  { _id: "2", title: "Intermediate Program", shortDescription: "Build on the basics—match tactics, fielding, and competitive play for developing players.", basePrice: 249, tag: null },
  { _id: "3", title: "Advanced Program", shortDescription: "High-performance training for serious cricketers chasing representative opportunities.", basePrice: 349, tag: "Competitive" },
  { _id: "4", title: "Summer Camp", shortDescription: "Intensive two-week residential camp. Immersive cricket with top coaches every day.", basePrice: 499, tag: "Seasonal" },
];

const ICONS = ["🏏", "⚡", "🎯", "☀️"];
const BG_COLORS = ["bg-amber-50", "bg-blue-50", "bg-emerald-50", "bg-violet-50"];
const ICON_COLORS = ["bg-amber-100", "bg-blue-100", "bg-emerald-100", "bg-violet-100"];

function ProgramsOverview() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getPrograms()
      .then((data) => setPrograms((data ?? []).slice(0, 4)))
      .catch(() => setPrograms([]))
      .finally(() => setLoading(false));
  }, []);

  const display = programs.length > 0 ? programs : fallback;

  return (
    <section id="programs" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14 gap-6">
          <div>
            <span className="text-[var(--gold)] text-xs font-bold tracking-widest uppercase block mb-3">
              What We Offer
            </span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-[var(--outfield)] leading-tight">
              Programs for Every Skill Level
            </h2>
            <p className="text-slate-500 mt-4">
              From first-timers to future national players—there's a CCA program built for your child.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-slate-100 rounded-3xl h-72 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {display.map((program: any, i: number) => (
              <div key={program._id} className="program-card flex flex-col">
                {/* Image or colored header */}
                <div className={`relative h-44 ${program.coverImageUrl ? "" : BG_COLORS[i % 4]} flex items-center justify-center overflow-hidden`}>
                  {program.coverImageUrl ? (
                    <img src={program.coverImageUrl} alt={program.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-16 h-16 rounded-2xl ${ICON_COLORS[i % 4]} flex items-center justify-center text-3xl`}>
                      {ICONS[i % 4]}
                    </div>
                  )}
                  {/* Tag badge */}
                  {(program.tag || fallback[i]?.tag) && (
                    <span className="absolute top-4 left-4 bg-[var(--gold)] text-[var(--outfield)] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      {program.tag || fallback[i]?.tag}
                    </span>
                  )}
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-display font-bold text-lg text-[var(--outfield)]">{program.title}</h3>
                  <p className="text-slate-500 text-sm mt-2 flex-1 leading-6">
                    {program.shortDescription ?? ""}
                  </p>
                  <div className="flex items-center justify-between mt-5 pt-5 border-t border-slate-100">
                    {program.basePrice ? (
                      <span className="text-[var(--gold)] font-bold text-lg">${program.basePrice}<span className="text-xs text-slate-400 font-normal"></span></span>
                    ) : <span />}
                    <button
                      onClick={() => navigate(`/programs/${program._id}`)}
                      className="text-sm font-semibold text-[var(--outfield)] hover:text-[var(--gold)] transition flex items-center gap-1"
                    >
                     Program Details
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <button
            onClick={() => navigate("/programs")}
            className="bg-[var(--gold)] hover:bg-[var(--gold-light)] text-[var(--white)] px-10 py-3.5 rounded-full font-semibold text-sm shadow-md shadow-[var(--gold-glow)] hover:shadow-[var(--gold-glow)] transition-all hover:scale-105"
          >
            View All Programs →
          </button>
        </div>
      </div>
    </section>
  );
}

export default ProgramsOverview;