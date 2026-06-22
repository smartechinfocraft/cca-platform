import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HiUserGroup, HiShieldCheck, HiChartBar, HiLightningBolt, HiArrowRight,
} from "react-icons/hi";
import BatchCard from "../components/BatchCard";
import programImage from "../assets/images/hero-cricket.jpg.jpg";
import { getProgramById, getBatches } from "../services/programService";

function ProgramDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [program, setProgram] = useState<any | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const data = await getProgramById(id);
        setProgram(data ?? null);
        // Batches are included in the program response from the admin API
        if (Array.isArray(data?.batches)) {
          setBatches(data.batches);
        } else {
          const batchData = await getBatches(id);
          setBatches(batchData ?? []);
        }
      } catch {
        setError("Unable to load program");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return (
    <main className="bg-white text-[#0F172A]">
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">Loading program...</div>
    </main>
  );
  if (error || !program) return (
    <main className="bg-white text-[#0F172A]">
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">{error || "Program not found"}</div>
    </main>
  );

  const p = program;
  const coverImg = p.coverImageUrl || p.coverImagePath ? `${import.meta.env.VITE_API_BASE_URL?.replace("/api","")}/uploads/${p.coverImagePath}` : programImage;

  const displayBatches = batches.length > 0 ? batches : [];

  const benefits = [
    { icon: HiLightningBolt, title: "High-impact training", description: "Accelerated skill growth through focused practice sessions." },
    { icon: HiShieldCheck, title: "Performance coaching", description: "Expert-led development with pro-level game preparation." },
    { icon: HiChartBar, title: "Tactical advancement", description: "Match-ready strategies and situational awareness training." },
    { icon: HiUserGroup, title: "Team engagement", description: "Group drills and mentorship for stronger on-field chemistry." },
  ];

  return (
    <main className="bg-[#f8fafc] text-[#0F172A]">
      <section className="relative overflow-hidden py-14 md:py-20">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.16),transparent_52%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] items-center"
          >
            <div className="relative rounded-[24px] overflow-hidden bg-slate-100 shadow-2xl">
              <img
                src={p.coverImageUrl ?? programImage}
                alt={p.title}
                className="h-full w-full min-h-[420px] object-cover transition duration-700 hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).src = programImage; }}
              />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950/40 to-transparent" />
              <div className="absolute left-6 top-6 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#0F172A] shadow-sm backdrop-blur-sm">
                {p.location?.title || "Location"}
              </div>
            </div>

            <div className="rounded-[24px] bg-white/95 p-8 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center rounded-full bg-[#F97316]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#F97316]">
                  {p.category?.title || "Elite Academy"}
                </span>
                {p.skillLevels?.[0] && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-[#0F172A]">
                    {p.skillLevels[0]}
                  </span>
                )}
              </div>

              <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#0F172A] sm:text-5xl">{p.title}</h1>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] bg-slate-50 p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Location</p>
                  <p className="mt-3 text-lg font-semibold">{p.location?.title || "N/A"}</p>
                </div>
                <div className="rounded-[20px] bg-slate-50 p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Price</p>
                  <p className="mt-3 text-lg font-semibold text-[#F97316]">
                    {p.discountedPrice
                      ? <><s className="text-slate-400 text-sm mr-1">${p.basePrice}</s>${p.discountedPrice}</>
                      : p.basePrice ? `$${p.basePrice}` : "Contact us"
                    }
                  </p>
                </div>
              </div>

              <div className="mt-8 text-slate-600 leading-8">
                <p>{p.shortDescription || p.detailedDescription || "Experience an elevated cricket training program with performance-focused coaching."}</p>
                <div className="grid gap-3 sm:grid-cols-2 mt-4">
                  {p.skillLevels?.length > 0 && (
                    <div className="rounded-[20px] bg-[#F97316]/5 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-[#F97316]">Skill Levels</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.skillLevels.map((l: string) => (
                          <span key={l} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#0F172A] shadow-sm">{l}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {p.ageGroups?.length > 0 && (
                    <div className="rounded-[20px] bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Age Groups</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.ageGroups.map((g: string) => (
                          <span key={g} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#0F172A] shadow-sm">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={() => navigate(`/register-program/${p._id}`)}
                  className="inline-flex items-center justify-center rounded-full bg-[#F97316] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#ea7a2e]"
                >
                  Enroll Now <HiArrowRight className="ml-2 h-4 w-4" />
                </button>
                <button className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold transition hover:border-[#F97316]">
                  Book a Trial
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
          className="rounded-[24px] bg-white p-8 md:p-12 shadow-lg">
          <h2 className="text-3xl sm:text-4xl font-bold">Program Overview</h2>
          <p className="mt-4 text-slate-600 leading-8">{p.detailedDescription || p.shortDescription}</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <motion.div key={b.title} whileHover={{ y: -4 }} className="rounded-[24px] border border-slate-200 bg-[#f8fafc] p-6 shadow-sm">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316]/10 text-[#F97316]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">{b.title}</h3>
                  <p className="mt-3 text-slate-600 leading-7">{b.description}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* Batches */}
      {displayBatches.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-12">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="rounded-[24px] bg-[#fff7ed] p-8 shadow-lg">
            <h2 className="text-3xl sm:text-4xl font-bold">Available Batches</h2>
            <p className="mt-3 text-slate-600">Choose the schedule that fits your routine.</p>
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {displayBatches.map((batch: any) => (
                <BatchCard
                  key={batch._id || batch.name}
                  name={batch.title || batch.name || `${batch.dayOfWeek} Batch`}
                  days={Array.isArray(batch.multiDays) && batch.multiDays.length ? batch.multiDays.join(", ") : batch.dayOfWeek}
                  timing={`${batch.startTime ?? ""} - ${batch.endTime ?? ""}`}
                  fee={batch.price ?? 0}
                  seats={batch.maxCapacity - (batch.currentCapacity ?? 0)}
                />
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* Coaches */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }}
          className="rounded-[24px] bg-gradient-to-r from-[#F97316] via-[#fb923c] to-[#fde68a] p-10 shadow-2xl">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr] items-center">
            <div>
              <h2 className="text-4xl font-bold text-white">Ready to elevate your game?</h2>
              <p className="mt-4 max-w-2xl text-white/90 leading-8">Secure your place in a premium cricket training program.</p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
              <button onClick={() => navigate(`/register-program/${p._id}`)} className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0F172A] transition hover:bg-slate-100">
                Register Now
              </button>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

export default ProgramDetails;
