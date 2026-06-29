import { useEffect, useRef, useState } from "react";
import {
  HiOutlineCalendar,
  HiOutlineLocationMarker,
  HiOutlineSparkles,
  HiOutlineUserGroup,
  HiSearch,
  HiChevronDown,
  HiX,
} from "react-icons/hi";
import { getPrograms } from "../services/programService";

export interface Filters {
  season: string;
  cities: string[];
  levels: string[];
  ageGroups: string[];
}

type Props = {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
  onSearch?: () => void;
};

type Season = { _id: string; title: string };

/* ── Generic multi-select dropdown ─────────────────────────── */
function MultiSelectDropdown({
  label,
  icon,
  options,
  selected,
  placeholder,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  options: string[];
  selected: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle(val: string) {
    if (selected.includes(val)) onChange(selected.filter((s) => s !== val));
    else onChange([...selected, val]);
  }

  const displayLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div className="space-y-2" ref={ref}>
      <label className="text-xs uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
        {icon}
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full h-12 rounded-[12px] border bg-white/90 px-4 text-sm text-left flex items-center justify-between gap-2 outline-none transition duration-200 hover:border-slate-400 ${
            open ? "border-[#A33B2B] ring-2 ring-[#A33B2B]/10" : "border-slate-300"
          }`}
        >
          <span className={selected.length > 0 ? "text-slate-900" : "text-slate-500"}>
            {displayLabel}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange([]); } }}
                className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center hover:bg-[#A33B2B]/20 transition"
              >
                <HiX className="h-2.5 w-2.5 text-slate-500" />
              </span>
            )}
            <HiChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {open && (
          <div className="absolute left-0 top-[calc(100%+4px)] w-full rounded-[14px] bg-white shadow-xl border border-slate-200 overflow-hidden z-30 max-h-56 overflow-y-auto">
            {options.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-400">No options available</div>
            )}
            {options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 border-t border-slate-100 first:border-t-0 transition ${
                    checked
                      ? "bg-[#A33B2B]/10 text-[#A33B2B] font-semibold"
                      : "text-slate-700 hover:bg-orange-50 hover:text-[#A33B2B]"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                      checked ? "bg-[#A33B2B] border-[#A33B2B]" : "border-slate-300"
                    }`}
                  >
                    {checked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
function ProgramFilter({ filters, onChange, onSearch }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeTitles, setActiveTitles] = useState<Set<string>>(new Set());
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [levelOptions, setLevelOptions] = useState<string[]>([]);
  const [ageGroupOptions, setAgeGroupOptions] = useState<string[]>([]);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const seasonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Derive all filter options directly from programs data
    // This guarantees options shown always match what programs actually have
    Promise.all([
      fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001/api"}/public/categories`).then(r => r.json()),
      getPrograms(),
    ])
      .then(([catRes, progs]) => {
        const cats: Season[] = catRes.data ?? [];
        setSeasons(cats);

        const progList: any[] = progs ?? [];

        // Which category titles have at least one active program
        const titles = new Set<string>();
        progList.forEach((p) => {
          if (p.category?.title) titles.add(p.category.title);
        });
        setActiveTitles(titles);

        // Cities: use p.cities[] array (primary city field on programs)
        // Fallback to location.city or location.title prefix
        const allCities = new Set<string>();
        progList.forEach((p) => {
          if (Array.isArray(p.cities) && p.cities.length > 0) {
            p.cities.forEach((c: string) => { if (c?.trim()) allCities.add(c.trim()); });
          } else if (p.location?.city?.trim()) {
            allCities.add(p.location.city.trim());
          } else if (p.location?.title) {
            const city = p.location.title.split(/[-–,]/)[0].trim();
            if (city) allCities.add(city);
          }
        });
        setCityOptions(Array.from(allCities).sort());

        // Levels and age groups
        const allLevels = new Set<string>();
        const allAges = new Set<string>();
        progList.forEach((p) => {
          if (Array.isArray(p.skillLevels)) p.skillLevels.forEach((l: string) => allLevels.add(l));
          if (Array.isArray(p.ageGroups)) p.ageGroups.forEach((a: string) => allAges.add(a));
        });
        setLevelOptions(Array.from(allLevels).sort());
        setAgeGroupOptions(Array.from(allAges).sort());

        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  // Close season dropdown on outside click
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
    <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border border-white/70 shadow-lg shadow-slate-200/30 rounded-[24px] p-4 sm:p-5 transition duration-300">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1.2fr_1.2fr_1.3fr] items-end">

        {/* ── Season custom dropdown ── */}
        <div className="space-y-2" ref={seasonRef}>
          <label className="text-xs uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
            <HiOutlineCalendar className="h-4 w-4 text-[#A33B2B]" />
            Season
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSeasonOpen((v) => !v)}
              className={`w-full h-12 rounded-[12px] border bg-white/90 px-4 text-sm text-left flex items-center justify-between gap-2 outline-none transition duration-200 hover:border-slate-400 ${
                seasonOpen ? "border-[#A33B2B] ring-2 ring-[#A33B2B]/10" : "border-slate-300"
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
                <button
                  type="button"
                  onClick={() => { onChange({ season: "" }); setSeasonOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-sm transition ${
                    !filters.season
                      ? "bg-[#A33B2B]/10 text-[#A33B2B] font-semibold"
                      : "text-slate-700 hover:bg-orange-50 hover:text-[#A33B2B]"
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
                          ? "bg-[#A33B2B]/10 text-[#A33B2B] font-semibold"
                          : "text-slate-700 hover:bg-orange-50 hover:text-[#A33B2B]"
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

        {/* ── City multi-select ── */}
        <MultiSelectDropdown
          label="Location"
          icon={<HiOutlineLocationMarker className="h-4 w-4 text-[#A33B2B]" />}
          options={cityOptions}
          selected={filters.cities}
          placeholder="All Locations"
          onChange={(v) => onChange({ cities: v })}
        />

        {/* ── Skill Level multi-select ── */}
        <MultiSelectDropdown
          label="Skill Level"
          icon={<HiOutlineSparkles className="h-4 w-4 text-[#A33B2B]" />}
          options={levelOptions}
          selected={filters.levels}
          placeholder="All Levels"
          onChange={(v) => onChange({ levels: v })}
        />

        {/* ── Age Group multi-select ── */}
        <MultiSelectDropdown
          label="Age Group"
          icon={<HiOutlineUserGroup className="h-4 w-4 text-[#A33B2B]" />}
          options={ageGroupOptions}
          selected={filters.ageGroups}
          placeholder="All Ages"
          onChange={(v) => onChange({ ageGroups: v })}
        />

        {/* ── Reset + Search ── */}
        <div className="flex flex-col gap-3 sm:flex-row items-stretch sm:items-end">
          <button
            onClick={() => onChange({ season: "", cities: [], levels: [], ageGroups: [] })}
            className="h-12 rounded-[12px] border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition duration-200 hover:border-[#A33B2B]"
          >
            Reset
          </button>
          <button
            onClick={() => onSearch && onSearch()}
            className="h-12 rounded-[12px] bg-[#A33B2B] px-5 text-sm font-semibold text-white transition duration-200 hover:bg-[#ea7a2e] flex items-center justify-center gap-2"
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