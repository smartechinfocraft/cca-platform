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

  const [filters, setFilters] = useState<Filters>({
    season: searchParams.get("season") ?? "",
    cities: [],
    levels: [],
    ageGroups: [],
  });

  const [page, setPage] = useState(1);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const filtered = useMemo(() => {
    let list = programs;

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
  }, [filters, programs]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function handleChange(next: Partial<Filters>) {
    setFilters((s) => ({ ...s, ...next }));
    setPage(1);
  }

  function handleReset() {
    setFilters({ season: "", cities: [], levels: [], ageGroups: [] });
    setPage(1);
  }

  return (
    <>
      <Navbar />
      <div className="h-20" />
      <section className="relative overflow-visible bg-[#f8fafc] py-14 md:py-20">
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

      <section className="py-12 md:py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Programs catalog</p>
              <h2 className="mt-3 text-3xl font-semibold text-[#0F172A]">Premium coaching options for every level</h2>
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