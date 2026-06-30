import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPrograms } from "../services/programService";

type FooterLink = { label: string; href: string };

function Footer() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  const [programLinks, setProgramLinks] = useState<FooterLink[]>([]);
  const [locationLinks, setLocationLinks] = useState<FooterLink[]>([]);
  const [levelLinks, setLevelLinks] = useState<FooterLink[]>([]);

  // Same data source as the Training Programs page (ProgramFilter.tsx) and
  // the Locations page: derive Programs(Seasons) / Locations / Levels directly
  // from the live programs list, so the footer always stays in sync with the
  // DB without any manual updates.
  useEffect(() => {
    getPrograms()
      .then((data) => {
        const progList: any[] = data ?? [];

        // Programs column -> Season name only (e.g. "Summer 2025"), not the
        // full program title. Dedup by category title, link filters /programs
        // by that season.
        const seasonsSeen = new Set<string>();
        const seasons: FooterLink[] = [];
        progList.forEach((p) => {
          const seasonTitle = p.category?.title;
          if (seasonTitle && !seasonsSeen.has(seasonTitle)) {
            seasonsSeen.add(seasonTitle);
            seasons.push({ label: seasonTitle, href: `/programs?season=${encodeURIComponent(seasonTitle)}` });
          }
        });
        setProgramLinks(seasons);

        // Locations: count programs per city (same fallback logic as
        // ProgramFilter), then keep only the top 5 busiest locations.
        const cityCounts = new Map<string, number>();
        progList.forEach((p) => {
          const citiesForProgram = new Set<string>();
          if (Array.isArray(p.cities) && p.cities.length > 0) {
            p.cities.forEach((c: string) => { if (c?.trim()) citiesForProgram.add(c.trim()); });
          } else if (p.location?.city?.trim()) {
            citiesForProgram.add(p.location.city.trim());
          } else if (p.location?.title) {
            const city = p.location.title.split(/[-–,]/)[0].trim();
            if (city) citiesForProgram.add(city);
          }
          citiesForProgram.forEach((city) => {
            cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
          });
        });

        const topCities = Array.from(cityCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([city]) => ({ label: city, href: `/programs?city=${encodeURIComponent(city)}` }));

        setLocationLinks([
          ...topCities,
          { label: "All Locations", href: "/programs" },
        ]);

        // Levels: unique skillLevels across all programs (unchanged)
        const allLevels = new Set<string>();
        progList.forEach((p) => {
          if (Array.isArray(p.skillLevels)) p.skillLevels.forEach((l: string) => { if (l) allLevels.add(l); });
        });
        setLevelLinks(
          Array.from(allLevels)
            .sort()
            .map((level) => ({ label: level, href: `/programs?level=${encodeURIComponent(level)}` }))
        );
      })
      .catch(() => {
        setProgramLinks([]);
        setLocationLinks([]);
        setLevelLinks([]);
      });
  }, []);

  const links: Record<string, FooterLink[]> = {
    Programs: programLinks,
    Locations: locationLinks,
    Level: levelLinks,
    Company: [
      { label: "About CCA", href: "/about" },
      { label: "Media", href: "/media" },
      { label: "FAQ", href: "/faq" },
      { label: "Donate Now", href: "/donate" },
    ],
  };

  return (
    <footer style={{ background: "var(--outfield)" }} className="text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-6 gap-10">

          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-display font-semibold text-sm text-white" style={{ background: "var(--gold)", color: "var(--outfield)" }}>
                CCA
              </div>
              <div>
                <p className="font-display font-semibold text-white text-base">California Cricket Academy</p>
                <p className="text-xs text-white/50">Youth Training Programs</p>
              </div>
            </div>
            <p className="text-white/50 text-sm leading-6 mt-4 max-w-xs">
              California's premier youth cricket development program — building champions since 2004.
            </p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([heading, items]) => (
            <div key={heading}>
              <h4 className="font-semibold text-white text-sm mb-4">{heading}</h4>
              <ul className="space-y-2.5">
                {items.length === 0 ? (
                  <li className="text-sm text-white/30">—</li>
                ) : (
                  items.map((item) => (
                    <li key={item.label}>
                      <button
                        onClick={() => {
                          if (item.href.startsWith("#")) {
                            if (window.location.pathname !== "/") {
                              navigate("/");
                              setTimeout(() => document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth" }), 200);
                            } else {
                              document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth" });
                            }
                          } else {
                            navigate(item.href);
                          }
                        }}
                        className="text-sm text-white/50 hover:text-white transition"
                      >
                        {item.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">© {year} California Cricket Academy. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs text-white/40">
            <span>hello@calcricket.org</span>
            <span>·</span>
            <span>(408) 555-0100</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
