import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HiOutlineCalendar,
  HiOutlineLocationMarker,
  HiOutlineSparkles,
  HiOutlineUserGroup,
  HiSearch,
  HiChevronDown,
  HiX,
} from "react-icons/hi";
import { getCategories, getPrograms } from "../services/programService";
import { isQuickRegisterVisible, QUICK_REGISTER_VISIBILITY_EVENT } from "../utils/quickRegisterVisibility";

export interface Filters {
  season: string;
  cities: string[];
  levels: string[];
  ageGroups: string[];
}

type Props = {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
};

type Season = { _id: string; title: string };

function SingleSelectDropdown({ label, icon, options, selected, placeholder, onChange }: {
  label: string;
  icon: React.ReactNode;
  options: string[];
  selected: string;
  placeholder: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filtered = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="space-y-2" ref={ref}>
      <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">{icon}{label}</label>
      <div className="relative">
        <button type="button" onClick={() => { setOpen((value) => !value); setQuery(""); }} className={`flex h-12 w-full items-center justify-between rounded-xl border bg-white px-4 text-left text-sm ${open ? "border-[#A33B2B] ring-2 ring-[#A33B2B]/10" : "border-slate-300"}`}>
          <span className={selected ? "text-slate-900" : "text-slate-500"}>{selected || placeholder}</span>
          <HiChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <div className="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="sticky top-0 border-b border-slate-200 bg-white p-2">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200"><HiSearch className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search categories..." className="h-9 min-w-0 w-full bg-transparent text-sm outline-none" autoFocus /></div>
          </div>
          <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-orange-50">{placeholder}</button>
          {filtered.map((option) => <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={`w-full border-t border-slate-100 px-4 py-3 text-left text-sm ${selected === option ? "bg-[#A33B2B]/10 font-semibold text-[#A33B2B]" : "text-slate-700 hover:bg-orange-50"}`}>{option}</button>)}
          {!filtered.length && <div className="px-4 py-3 text-sm text-slate-400">No matching categories</div>}
        </div>}
      </div>
    </div>
  );
}

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
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
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
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-2" ref={ref}>
      <label className="text-xs uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
        {icon}
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setQuery(""); }}
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
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-2">
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200 focus-within:ring-[#A33B2B]/40">
                <HiSearch className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  className="h-9 min-w-0 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  autoFocus
                />
              </div>
            </div>
            {filteredOptions.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-400">No matching options</div>
            )}
            {filteredOptions.map((opt) => {
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
function ProgramFilter({ filters, onChange }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeTitles, setActiveTitles] = useState<Set<string>>(new Set());
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [levelOptions, setLevelOptions] = useState<string[]>([]);
  const [ageGroupOptions, setAgeGroupOptions] = useState<string[]>([]);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [seasonQuery, setSeasonQuery] = useState("");
  const [isStuck, setIsStuck] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileDraft, setMobileDraft] = useState<Filters>(filters);
  const [ready, setReady] = useState(false);
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(isQuickRegisterVisible);
  const seasonRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Derive all filter options directly from programs data
    // This guarantees options shown always match what programs actually have
    Promise.all([
      getCategories(),
      getPrograms(),
    ])
      .then(([categoryData, progs]) => {
        const cats: Season[] = categoryData ?? [];
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
        setSeasonQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    let frameId = 0;
    const update = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const top = filterRef.current?.getBoundingClientRect().top;
        setIsStuck(typeof top === "number" && top <= 113 && window.scrollY > 0);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const filteredSeasons = seasons.filter((season) => season.title.toLowerCase().includes(seasonQuery.trim().toLowerCase()));
  const activeFilterCount = Number(Boolean(filters.season)) + filters.cities.length + filters.levels.length + filters.ageGroups.length;
  const activeCategoryOptions = seasons.filter((season) => activeTitles.has(season.title)).map((season) => season.title);

  useEffect(() => {
    const handleQuickRegisterVisibility = (event: Event) => {
      const open = (event as CustomEvent<boolean>).detail;
      setQuickRegisterOpen(open);
      if (open) setDrawerOpen(false);
    };
    window.addEventListener(QUICK_REGISTER_VISIBILITY_EVENT, handleQuickRegisterVisibility);
    return () => window.removeEventListener(QUICK_REGISTER_VISIBILITY_EVENT, handleQuickRegisterVisibility);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [drawerOpen]);

  const openMobileDrawer = () => {
    setMobileDraft({ ...filters, cities: [...filters.cities], levels: [...filters.levels], ageGroups: [...filters.ageGroups] });
    setDrawerOpen(true);
  };

  const updateMobileDraft = (next: Partial<Filters>) => setMobileDraft((current) => ({ ...current, ...next }));

  const resetFilters = () => onChange({ season: "", cities: [], levels: [], ageGroups: [] });

  return (
    <>
    <div ref={filterRef} className={`hidden rounded-[24px] border border-white/80 bg-white/95 p-4 backdrop-blur-xl transition-shadow duration-300 sm:p-5 lg:block ${isStuck ? "shadow-md shadow-slate-900/15" : "shadow-sm shadow-slate-200/40"}`}>
      <div className="hidden gap-3 lg:grid lg:grid-cols-[1.2fr_1.2fr_1.2fr_1.2fr_1.3fr] items-end">

        {/* ── Season custom dropdown ── */}
        <div className="space-y-2" ref={seasonRef}>
          <label className="text-xs uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
            <HiOutlineCalendar className="h-4 w-4 text-[#A33B2B]" />
            Category
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => { setSeasonOpen((v) => !v); setSeasonQuery(""); }}
              className={`w-full h-12 rounded-[12px] border bg-white/90 px-4 text-sm text-left flex items-center justify-between gap-2 outline-none transition duration-200 hover:border-slate-400 ${
                seasonOpen ? "border-[#A33B2B] ring-2 ring-[#A33B2B]/10" : "border-slate-300"
              }`}
            >
              <span className={filters.season ? "text-slate-900" : "text-slate-500"}>
                {filters.season || "All Categories"}
              </span>
              <HiChevronDown
                className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${seasonOpen ? "rotate-180" : ""}`}
              />
            </button>

            {seasonOpen && (
              <div className="absolute left-0 top-[calc(100%+4px)] max-h-64 w-full overflow-y-auto rounded-[14px] border border-slate-200 bg-white shadow-xl z-30">
                <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-2">
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200 focus-within:ring-[#A33B2B]/40">
                    <HiSearch className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                      value={seasonQuery}
                      onChange={(event) => setSeasonQuery(event.target.value)}
                      placeholder="Search categories..."
                      className="h-9 min-w-0 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { onChange({ season: "" }); setSeasonOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-sm transition ${
                    !filters.season
                      ? "bg-[#A33B2B]/10 text-[#A33B2B] font-semibold"
                      : "text-slate-700 hover:bg-orange-50 hover:text-[#A33B2B]"
                  }`}
                >
                  All Categories
                </button>

                {!ready && (
                  <div className="px-4 py-3 text-sm text-slate-400">Loading...</div>
                )}

                {ready && filteredSeasons.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-400">No matching categories</div>
                )}

                {ready && filteredSeasons.map((s) => {
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

        {/* ── Reset ── */}
        <div className="flex items-end">
          <button
            onClick={resetFilters}
            className="h-12 w-full rounded-[12px] border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition duration-200 hover:border-[#A33B2B]"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
    {createPortal(<>
      <div aria-hidden={quickRegisterOpen} className={`fixed inset-x-0 bottom-0 z-[9999] border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-transform duration-300 lg:hidden ${drawerOpen || quickRegisterOpen ? "translate-y-full pointer-events-none" : "translate-y-0"}`}>
        <div className="mx-auto flex max-w-lg gap-3">
          <button type="button" onClick={openMobileDrawer} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#A33B2B] px-5 text-sm font-bold text-white shadow-md">
            <HiSearch className="h-4 w-4" /> Filter Programs
            {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] text-[#A33B2B]">{activeFilterCount}</span>}
          </button>
          <button type="button" onClick={resetFilters} className="h-14 rounded-full border-2 border-slate-300 bg-white px-5 text-sm font-bold text-slate-800">Reset</button>
        </div>
      </div>
      <div className={`fixed inset-0 z-[10000] lg:hidden ${drawerOpen ? "visible" : "invisible pointer-events-none"}`} aria-hidden={!drawerOpen}>
        <button type="button" aria-label="Close filters" onClick={() => setDrawerOpen(false)} className={`absolute inset-0 bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-300 ${drawerOpen ? "opacity-100" : "opacity-0"}`} />
        <section role="dialog" aria-modal="true" aria-label="Filter programs" className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-300 ease-out ${drawerOpen ? "translate-y-0" : "translate-y-full"}`}>
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />
          <div className="mb-5 flex items-center justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A33B2B]">Programs</p><h2 className="mt-1 text-xl font-bold text-slate-900">Filter Programs</h2></div>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close filter drawer" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-700"><HiX className="h-5 w-5" /></button>
          </div>
          <div className="space-y-5">
            <SingleSelectDropdown label="Category" icon={<HiOutlineCalendar className="h-4 w-4 text-[#A33B2B]" />} options={activeCategoryOptions} selected={mobileDraft.season} placeholder="All Categories" onChange={(season) => updateMobileDraft({ season })} />
            <MultiSelectDropdown label="Location" icon={<HiOutlineLocationMarker className="h-4 w-4 text-[#A33B2B]" />} options={cityOptions} selected={mobileDraft.cities} placeholder="All Locations" onChange={(cities) => updateMobileDraft({ cities })} />
            <MultiSelectDropdown label="Skill Level" icon={<HiOutlineSparkles className="h-4 w-4 text-[#A33B2B]" />} options={levelOptions} selected={mobileDraft.levels} placeholder="All Levels" onChange={(levels) => updateMobileDraft({ levels })} />
            <MultiSelectDropdown label="Age Group" icon={<HiOutlineUserGroup className="h-4 w-4 text-[#A33B2B]" />} options={ageGroupOptions} selected={mobileDraft.ageGroups} placeholder="All Ages" onChange={(ageGroups) => updateMobileDraft({ ageGroups })} />
          </div>
          <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-slate-200 bg-white/95 pt-4 backdrop-blur-md">
            <button type="button" onClick={() => setMobileDraft({ season: "", cities: [], levels: [], ageGroups: [] })} className="h-14 rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700">Reset</button>
            <button type="button" onClick={() => { onChange(mobileDraft); setDrawerOpen(false); }} className="h-14 flex-1 rounded-full bg-[#A33B2B] px-6 text-sm font-bold text-white shadow-md">Filter Programs</button>
          </div>
        </section>
      </div>
      </>,
      document.body
    )}
    </>
  );
}

export default ProgramFilter;
