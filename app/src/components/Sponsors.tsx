import { useEffect, useState } from "react";
import { getSponsors, resolveUploadUrl } from "../services/programService";

const FALLBACK_SPONSORS = [
  { _id: "s1", name: "Bay Area Cricket", websiteUrl: "#" },
  { _id: "s2", name: "Cricket USA", websiteUrl: "#" },
  { _id: "s3", name: "Youth Sports CA", websiteUrl: "#" },
  { _id: "s4", name: "Silicon Valley CC", websiteUrl: "#" },
];

function Sponsors() {
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSponsors()
      .then((data) => setSponsors(data ?? []))
      .catch(() => setSponsors([]))
      .finally(() => setLoading(false));
  }, []);

  const display = sponsors.length > 0 ? sponsors : FALLBACK_SPONSORS;
  const logoUrlFor = (s: any) => resolveUploadUrl(s.coverImagePath || s.coverImageUrl);

  return (
    <section id="sponsors" className="py-20 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-[var(--gold)] text-xs font-bold tracking-widest uppercase block mb-3">
            Partners &amp; Sponsors
          </span>
          <h2 className="font-display text-3xl font-bold text-[var(--outfield)]">
            Proudly Supported By
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-5">
          {loading
            ? [1,2,3,4].map(i => <div key={i} className="sponsor-logo animate-pulse bg-slate-100" />)
            : display.map((s) => {
                const logoUrl = logoUrlFor(s);
                return (
                <a
                  key={s._id}
                  href={s.websiteUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="sponsor-logox  hover:scale-105 transition-transform"
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt={s.name} className="max-h-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">🏏</div>
                      <span className="text-xs font-semibold text-slate-600 text-center">{s.name}</span>
                    </div>
                  )}
                </a>
                );
              })
          }
        </div>

        <p className="text-center text-sm text-slate-400 mt-10">
          Interested in sponsoring CCA?{" "}
          <a href="mailto:hello@calcricket.org" className="text-[var(--gold)] font-semibold hover:underline">
            Get in touch
          </a>
        </p>
      </div>
    </section>
  );
}

export default Sponsors;
