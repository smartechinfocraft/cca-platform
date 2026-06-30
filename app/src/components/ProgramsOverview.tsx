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
const backgroundVariants = [
  {
    card: "bg-gradient-to-br from-[#F8FAFC] via-[#E2E8F0] to-[#FCE7F3]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,_rgba(163,59,43,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.15),_transparent_35%)]",
  },
  {
    card: "bg-gradient-to-br from-[#FEF3C7] via-[#FDE68A] to-[#F59E0B]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,_rgba(217,119,6,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(234,88,12,0.15),_transparent_35%)]",
  },
  {
    card: "bg-gradient-to-br from-[#D1FAE5] via-[#6EE7B7] to-[#10B981]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,_rgba(5,150,105,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.15),_transparent_35%)]",
  },
  {
    card: "bg-gradient-to-br from-[#EDE9FE] via-[#C4B5FD] to-[#A78BFA]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.15),_transparent_35%)]",
  },
  {
    card: "bg-gradient-to-br from-[#FCE7F3] via-[#FBCFE8] to-[#F472B6]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(219,39,119,0.15),_transparent_35%)]",
  },
  {
    card: "bg-gradient-to-br from-[#E0F2FE] via-[#BAE6FD] to-[#38BDF8]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.15),_transparent_35%)]",
  },
  {
    card: "bg-gradient-to-br from-[#EEF2FF] via-[#C7D2FE] to-[#6366F1]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(79,70,229,0.15),_transparent_35%)]",
  },
  {
    card: "bg-gradient-to-br from-[#ECFCCB] via-[#BBF7D0] to-[#22C55E]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.15),_transparent_35%)]",
  },
  {
    card: "bg-gradient-to-br from-[#FCE7F3] via-[#FBCFE8] to-[#F472B6]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(219,39,119,0.15),_transparent_35%)]",
  },
  {
    card: "bg-gradient-to-br from-[#FFEDD5] via-[#FDBA74] to-[#F97316]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.15),_transparent_35%)]",
  },
];

function getBackgroundVariant(program: { _id?: string } | null | undefined, index: number) {
  const key = program?._id || String(index);
  const variantIndex =
    key.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    backgroundVariants.length;

  return backgroundVariants[variantIndex];
}

function ProgramCoverGraphic() {
  return (
    <div className="relative z-10 flex flex-col items-center gap-3">
      <div className="inline-flex items-center justify-center">
        <span className="text-3xl">
          <svg width="64" height="72" viewBox="0 0 64 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M2.51771 3.87145H6.31542C6.61427 3.87145 6.85956 4.11465 6.85956 4.41267V40.0725L6.7637 40.1667C5.04247 41.8831 4.19947 43.9046 4.0289 46.0216C3.8541 48.1949 4.43489 50.4006 5.51189 52.3996C5.84881 53.0251 6.24916 53.6451 6.69744 54.2453L6.85956 54.459V69.7508H14.6143V59.777C15.6264 60.03 16.6569 60.1354 17.6818 60.0665C18.2978 60.0258 18.9054 59.9246 19.4974 59.7587V69.7508H27.2522V53.5551L32.1353 48.6841V69.7508H33.8185C33.9792 69.7508 34.1117 69.8815 34.1117 70.0418V71.7076C34.1117 71.8693 33.9792 72 33.8185 72H0.293216C0.131101 72 0 71.8693 0 71.7076V70.0418C0 69.8815 0.131101 69.7508 0.293216 69.7508H1.97498V4.41126C1.97498 4.11465 2.21885 3.87145 2.51771 3.87145ZM44.2206 14.222C44.738 16.7552 47.2275 19.1323 49.6705 19.6539C50.0102 20.2879 50.5529 20.9261 51.2648 21.636C51.3988 21.7681 51.4664 21.9481 51.4664 22.128C51.4664 22.2967 51.4072 22.464 51.2916 22.5947L19.7737 54.0232C18.2315 55.5597 16.0338 55.3727 14.0363 54.279C13.1933 53.818 12.3856 53.198 11.6722 52.4769C10.9575 51.7543 10.3359 50.9305 9.86784 50.0632C8.69498 47.8843 8.50044 45.4256 10.2696 43.6614L41.3166 12.701C41.4506 12.5661 41.631 12.5 41.81 12.5C41.9905 12.5 42.1695 12.5661 42.3034 12.701C42.9829 13.3786 43.6046 13.8917 44.2206 14.222ZM49.5831 38.1944C52.0599 38.1944 54.3055 39.1967 55.9295 40.8175C57.5549 42.4356 58.5614 44.6749 58.5614 47.1476C58.5614 49.619 57.5549 51.8583 55.9309 53.4778L55.9013 53.5045C54.2774 55.1084 52.0444 56.0995 49.5831 56.0995C48.6048 56.0995 47.6645 55.9435 46.7834 55.6553C46.7454 55.6468 46.7101 55.6342 46.6749 55.6187C45.3799 55.1756 44.2038 54.4428 43.2366 53.4764C41.6113 51.8583 40.6048 49.619 40.6048 47.1476C40.6048 44.6777 41.6099 42.4398 43.2352 40.8189L43.2381 40.8147C44.8634 39.1953 47.1077 38.1944 49.5831 38.1944ZM59.9838 0.285368L63.7138 4.005C63.8967 4.18736 63.9996 4.43455 64 4.69241C64 4.90187 63.9309 5.11414 63.79 5.29267L63.7152 5.37983L60.1163 8.96872C60.0257 9.05939 59.9181 9.13129 59.7995 9.18027C59.681 9.22925 59.5539 9.25434 59.4255 9.25409C59.2733 9.25409 59.1182 9.21614 58.9773 9.14304C58.3344 9.77141 57.6028 10.4659 56.8571 11.1758C54.9343 13.0018 52.9015 14.9333 51.4326 16.6807C50.8377 17.3878 50.6418 17.9473 50.7672 18.4716C50.9124 19.0775 51.4566 19.7537 52.3038 20.5985C52.7267 21.0231 52.9381 21.5769 52.9381 22.128C52.9381 22.6594 52.7422 23.1922 52.3503 23.6083L20.8141 55.0606C18.7263 57.1412 15.8745 56.9556 13.33 55.5625C12.3644 55.0339 11.4411 54.3254 10.6263 53.5031C9.81568 52.6821 9.10943 51.7445 8.57515 50.7562C7.1133 48.0417 6.91595 44.9308 9.22925 42.6239L40.2763 11.6636C40.6992 11.2418 41.256 11.0324 41.81 11.0324C42.3655 11.0324 42.9223 11.2418 43.3438 11.6636C44.1713 12.4873 44.8479 13.0046 45.4611 13.1466C45.9982 13.2689 46.5607 13.0834 47.2458 12.5337C48.9699 11.1533 51.0125 9.00808 52.8916 7.033C53.5753 6.31325 54.2407 5.61459 54.8314 5.01011C54.7581 4.86954 54.72 4.71491 54.72 4.56168C54.72 4.34941 54.7905 4.13714 54.9315 3.96001L55.0048 3.87426L58.6051 0.285368C58.7883 0.103505 59.036 0.000971629 59.2944 0C59.5073 0 59.7202 0.0716935 59.8964 0.210863L59.9838 0.285368Z" fill="white" />
          </svg>
        </span>
      </div>
    </div>
  );
}

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
            {display.map((program: any, i: number) => {
              const selectedBackground = getBackgroundVariant(program, i);

              return (
                <div key={program._id} className="program-card flex flex-col">
                  {/* Image or colored header */}
                  <div className={`relative h-44 ${program.coverImageUrl ? `${selectedBackground.card} text-slate-900 text-sm font-semibold` : BG_COLORS[i % 4]} flex items-center justify-center overflow-hidden`}>
                    {program.coverImageUrl ? (
                      <>
                        <div className={`absolute inset-0 ${selectedBackground.overlay}`} />
                        <ProgramCoverGraphic />
                      </>
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
              );
            })}
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
