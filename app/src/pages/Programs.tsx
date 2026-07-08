import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProgramCard from "../components/ProgramCard";
import ProgramFilter from "../components/ProgramFilter";
import type { Filters } from "../components/ProgramFilter";
import { getPrograms } from "../services/programService";

const PAGE_SIZE = 6;

function Programs() {
  const [searchParams] = useSearchParams();

  // Footer (and other entry points) can deep-link here with ?city=, ?level=,
  // ?season= and/or ?program= so the listing arrives pre-filtered for that
  // specific Program / Location / Level that was clicked.
  const [filters, setFilters] = useState<Filters>({
    season: searchParams.get("season") ?? "",
    cities: searchParams.get("city") ? [searchParams.get("city") as string] : [],
    levels: searchParams.get("level") ? [searchParams.get("level") as string] : [],
    ageGroups: [],
  });
  const [programId, setProgramId] = useState<string>(searchParams.get("program") ?? "");
  const [categoryId, setCategoryId] = useState<string>(searchParams.get("category") ?? "");
  const [page, setPage] = useState(1);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Re-sync filters whenever the URL's query params change. Without this,
  // clicking a second footer link (e.g. another location) while already on
  // /programs would not update the list — React Router updates the URL but
  // does not remount this component, so the useState initial value above
  // only ever ran once. Watching searchParams.toString() picks up every
  // subsequent navigation, including repeat clicks on the same link type.
  useEffect(() => {
    setFilters({
      season: searchParams.get("season") ?? "",
      cities: searchParams.get("city") ? [searchParams.get("city") as string] : [],
      levels: searchParams.get("level") ? [searchParams.get("level") as string] : [],
      ageGroups: [],
    });
    setProgramId(searchParams.get("program") ?? "");
    setCategoryId(searchParams.get("category") ?? "");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  useEffect(() => {
    const fetchPrograms = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getPrograms();
        setPrograms(data ?? []);
      } catch {
        setError("Unable to load programs. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchPrograms();
  }, []);

  // Once programs are loaded, reflect the Navbar's ?category=<id> deep-link
  // in the Season dropdown too (not just the filtered results) — look up
  // that category's title from any program that belongs to it, and show it
  // as the selected Season so the UI matches what's actually filtered.
  useEffect(() => {
    if (!categoryId || programs.length === 0) return;
    const match = programs.find((p) => {
      const pCatId = typeof p.category === "object" ? p.category?._id : p.category;
      return pCatId === categoryId;
    });
    const title = match?.category?.title;
    if (title) {
      setFilters((s) => (s.season === title ? s : { ...s, season: title }));
    }
  }, [categoryId, programs]);

  const filtered = useMemo(() => {
    let list = programs;

    // Specific Program deep-link from Footer ("?program=<id>")
    if (programId) {
      list = list.filter((p) => p._id === programId);
    }

    // Category deep-link from Navbar's Training Programs dropdown
    // ("?category=<categoryId>") — match against p.category, which may be
    // either a populated object ({ _id, title }) or a plain id string.
    if (categoryId) {
      list = list.filter((p) => {
        const pCatId = typeof p.category === "object" ? p.category?._id : p.category;
        return pCatId === categoryId;
      });
    }

    // Season: match against populated category title
    if (filters.season) {
      list = list.filter((p) => p.category?.title === filters.season);
    }

    // City: match against p.cities[] array (primary field)
    // Fallback to location.city or location.title prefix
    if (filters.cities.length > 0) {
      list = list.filter((p) => {
        // Check p.cities[] array first (main source)
        if (Array.isArray(p.cities) && p.cities.length > 0) {
          return p.cities.some((c: string) => filters.cities.includes(c?.trim()));
        }
        // Fallback: location.city
        if (p.location?.city?.trim()) {
          return filters.cities.includes(p.location.city.trim());
        }
        // Fallback: first part of location.title
        if (p.location?.title) {
          const city = p.location.title.split(/[-–,]/)[0].trim();
          return filters.cities.includes(city);
        }
        return false;
      });
    }

    // Level: any match in skillLevels array
    if (filters.levels.length > 0) {
      list = list.filter((p) =>
        filters.levels.some((l) => p.skillLevels?.includes(l))
      );
    }

    // Age group: any match in ageGroups array
    if (filters.ageGroups.length > 0) {
      list = list.filter((p) =>
        filters.ageGroups.some((a) => p.ageGroups?.includes(a))
      );
    }

    return list;
  }, [filters, programs, programId, categoryId]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function handleChange(next: Partial<Filters>) {
    setFilters((s) => ({ ...s, ...next }));
    setCategoryId("");
    setPage(1);
  }

  function handleReset() {
    setFilters({ season: "", cities: [], levels: [], ageGroups: [] });
    setCategoryId("");
    setPage(1);
  }

  return (
    <>
      <Navbar />
      <div className="h-20" />
      <section className="relative overflow-visible bg-[#f8fafc] py-10 md:py-14">
        <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.18),transparent_48%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center rounded-full bg-[#A33B2B]/10 px-4 py-2 text-sm font-semibold text-[#A33B2B] tracking-[0.24em] uppercase">
              Premium Cricket Academy
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight text-[#0F172A]">
              Browse Training Programs
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600">
              Find the perfect cricket training program based on age, location and skill level.
            </p>
          </div>

          <div className="mt-10">
            <ProgramFilter filters={filters} onChange={handleChange} onSearch={() => setPage(1)} />
          </div>
        </div>
      </section>

      <section className="py-8 md:py-12 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
           
              <h2 className="mt-3 text-3xl font-semibold text-[#0F172A]">Available Programs</h2>
            </div>
            <div className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm border border-slate-200">
              Showing {filtered.length} {filtered.length === 1 ? "program" : "programs"}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-slate-500">Loading programs…</div>
          ) : error ? (
            <div className="text-center py-20 text-red-500">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto bg-white rounded-[24px] p-8 shadow-lg border border-slate-200">
                <h3 className="text-2xl font-bold text-[#0F172A]">No programs found</h3>
                <p className="text-slate-600 mt-3">Try adjusting filters or clear them to see all programs.</p>
                <div className="mt-6">
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-2 text-sm font-semibold text-[#0F172A] transition hover:border-[#A33B2B] hover:text-[#A33B2B]"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {paged.map((program) => (
                  <ProgramCard key={program._id} program={program} />
                ))}
              </div>

              <div className="mt-12 flex flex-col gap-3 items-center justify-center sm:flex-row sm:gap-4">
                <button
                  className="min-w-[120px] rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#A33B2B] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Prev
                </button>

                <div className="text-sm text-slate-700">
                  Page {page} of {pages}
                </div>

                <button
                  className="min-w-[120px] rounded-full bg-[#A33B2B] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ea7a2e] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page === pages}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </section>
      <Footer />
    </>
  );
}

export default Programs;