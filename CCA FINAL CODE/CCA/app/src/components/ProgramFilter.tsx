import { useEffect, useRef, useState } from "react";
import {
  HiOutlineCalendar,
  HiOutlineLocationMarker,
  HiOutlineSparkles,
  HiOutlineUserGroup,
  HiSearch,
  HiChevronDown,
} from "react-icons/hi";
import { getCategories, getLocations, getPrograms } from "../services/programService";

type Filters = {
  season: string;
  location: string;
  level: string;
  ageGroup: string;
};

type Props = {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
  onSearch?: () => void;
};

type Season = { _id: string; title: string };

function ProgramFilter({ filters, onChange, onSearch }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeTitles, setActiveTitles] = useState<Set<string>>(new Set());
  const [locations, setLocations] = useState<{ _id: string; title: string }[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const seasonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch everything in parallel so seasons + activeTitles are always in sync
    Promise.all([getCategories(), getPrograms(), getLocations()])
      .then(([cats, progs, locs]) => {
        // All categories (seasons)
        setSeasons(cats ?? []);

        // Which category titles have at least one program
        const titles = new Set<string>();
        (progs ?? []).forEach((p: any) => {
          if (p.category?.title) titles.add(p.category.title);
        });
        setActiveTitles(titles);

        // Locations
        setLocations(locs ?? []);

        // Levels + age groups derived from programs
        const allLevels = new Set<string>();
        const allAges = new Set<string>();
        (progs ?? []).forEach((p: any) => {
          if (Array.isArray(p.skillLevels)) p.skillLevels.forEach((l: string) => allLevels.add(l));
          if (Array.isArray(p.ageGroups)) p.ageGroups.forEach((a: string) => allAges.add(a));
        });
        setLevels(Array.from(allLevels).sort());
        setAgeGroups(Array.from(allAges).sort());

        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (seasonRef.current && !seasonRef.current.contains(e.target as Node)) {
        setSeasonOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="sticky top-4 z-20 bg-white/80 backdrop-blur-xl border border-white/70 shadow-lg shadow-slate-200/30 rounded-[24px] p-4 sm:p-5 transition duration-300">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1.2fr_1.2fr_1.3fr] items-end">

        {/* ── Season custom dropdown ── */}
        <div className="space-y-2" ref={seasonRef}>
          <label className="text-xs uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
            <HiOutlineCalendar className="h-4 w-4 text-[#F97316]" />
            Season
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSeasonOpen((v) => !v)}
              className={`w-full h-12 rounded-[12px] border bg-white/90 px-4 text-sm text-left flex items-center justify-between gap-2 outline-none transition duration-200 hover:border-slate-400 ${
                seasonOpen ? "border-[#F97316] ring-2 ring-[#F97316]/10" : "border-slate-300"
              }`}
            >
              <span className={filters.season ? "text-slate-900" : "text-slate-500"}>
                {filters.season || "All Seasons"}
              </span>
              <HiChevronDown
                className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${seasonOpen ? "rotate-180" : ""}`}
              />
            </button>

            {seasonOpen && (
              <div className="absolute left-0 top-[calc(100%+4px)] w-full rounded-[14px] bg-white shadow-xl border border-slate-200 overflow-hidden z-30">
                {/* All Seasons */}
                <button
                  type="button"
                  onClick={() => { onChange({ season: "" }); setSeasonOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-sm transition ${
                    !filters.season
                      ? "bg-[#F97316]/10 text-[#F97316] font-semibold"
                      : "text-slate-700 hover:bg-orange-50 hover:text-[#F97316]"
                  }`}
                >
                  All Seasons
                </button>

                {!ready && (
                  <div className="px-4 py-3 text-sm text-slate-400">Loading...</div>
                )}

                {ready && seasons.map((s) => {
                  const isLive = activeTitles.has(s.title);
                  const isSelected = filters.season === s.title;
                  return (
                    <button
                      key={s._id}
                      type="button"
                      disabled={!isLive}
                      onClick={() => {
                        if (!isLive) return;
                        onChange({ season: s.title });
                        setSeasonOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-3 border-t border-slate-100 transition ${
                        !isLive
                          ? "text-slate-400 cursor-not-allowed"
                          : isSelected
                          ? "bg-[#F97316]/10 text-[#F97316] font-semibold"
                          : "text-slate-700 hover:bg-orange-50 hover:text-[#F97316]"
                      }`}
                    >
                      <span>{s.title}</span>
                      {!isLive && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                          Coming Soon
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Location ── */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
            <HiOutlineLocationMarker className="h-4 w-4 text-[#F97316]" />
            Location
          </label>
          <select
            value={filters.location}
            onChange={(e) => onChange({ location: e.target.value })}
            className="w-full h-12 rounded-[12px] border border-slate-300 bg-white/90 px-4 text-sm text-slate-900 outline-none transition duration-200 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/10 hover:border-slate-400"
          >
            <option value="">All Locations</option>
            {locations.map((l) => <option key={l._id} value={l.title}>{l.title}</option>)}
          </select>
        </div>

        {/* ── Skill Level ── */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
            <HiOutlineSparkles className="h-4 w-4 text-[#F97316]" />
            Skill Level
          </label>
          <select
            value={filters.level}
            onChange={(e) => onChange({ level: e.target.value })}
            className="w-full h-12 rounded-[12px] border border-slate-300 bg-white/90 px-4 text-sm text-slate-900 outline-none transition duration-200 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/10 hover:border-slate-400"
          >
            <option value="">All Levels</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* ── Age Group ── */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
            <HiOutlineUserGroup className="h-4 w-4 text-[#F97316]" />
            Age Group
          </label>
          <select
            value={filters.ageGroup}
            onChange={(e) => onChange({ ageGroup: e.target.value })}
            className="w-full h-12 rounded-[12px] border border-slate-300 bg-white/90 px-4 text-sm text-slate-900 outline-none transition duration-200 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/10 hover:border-slate-400"
          >
            <option value="">All Ages</option>
            {ageGroups.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* ── Reset + Search ── */}
        <div className="flex flex-col gap-3 sm:flex-row items-stretch sm:items-end">
          <button
            onClick={() => onChange({ season: "", location: "", level: "", ageGroup: "" })}
            className="h-12 rounded-[12px] border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition duration-200 hover:border-[#F97316]"
          >
            Reset
          </button>
          <button
            onClick={() => onSearch && onSearch()}
            className="h-12 rounded-[12px] bg-[#F97316] px-5 text-sm font-semibold text-white transition duration-200 hover:bg-[#ea7a2e] flex items-center justify-center gap-2"
          >
            <HiSearch className="h-4 w-4" />
            Search
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProgramFilter;