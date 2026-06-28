const milestones = [
  { year: "2004", label: "Academy Founded", desc: "Started with 12 players in Fremont." },
  { year: "2010", label: "Bay Area Expansion", desc: "Opened 5 new locations across the Bay." },
  { year: "2018", label: "100 USA Players", desc: "Our 100th player represented the USA." },
  { year: "2024", label: "3,000+ Alumni", desc: "A proud network of CCA graduates." },
];

function AboutCCA() {
  return (
    <section id="about" className="py-24 bg-[#FFFBF5]">
      <div className="max-w-7xl mx-auto px-6">

        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — Visual */}
          <div className="space-y-5">
            <div className="bg-[#0F172A] rounded-3xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#A33B2B]/10 -translate-y-1/2 translate-x-1/2" />
              <span className="inline-block bg-[#A33B2B] text-white text-xs font-bold px-3 py-1 rounded-full mb-5 uppercase tracking-wide">Our Story</span>
              <h3 className="font-display text-2xl font-bold leading-snug">
                From a single ground in Fremont to California's largest cricket academy.
              </h3>
              <p className="text-slate-300 text-sm mt-4 leading-7">
                Founded in 2004 by former first-class cricketers, CCA was built on a simple belief: every young player deserves world-class coaching, regardless of background.
              </p>
            </div>

            {/* Milestones */}
            <div className="grid grid-cols-2 gap-4">
              {milestones.map((m, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-md transition">
                  <p className="font-display text-2xl font-bold text-[#A33B2B]">{m.year}</p>
                  <p className="font-semibold text-[#0F172A] text-sm mt-1">{m.label}</p>
                  <p className="text-slate-400 text-xs mt-1 leading-tight">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Content */}
          <div>
            <span className="text-[#A33B2B] text-xs font-bold tracking-widest uppercase block mb-4">About CCA</span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-[#0F172A] leading-tight">
              Developing Young Cricketers Since 2004
            </h2>
            <p className="text-slate-500 mt-6 leading-8">
              California Cricket Academy provides structured cricket coaching that goes beyond the technical. We develop the whole athlete — teaching resilience, teamwork, and leadership through the sport we love.
            </p>
            <p className="text-slate-500 mt-4 leading-8">
              Our mission is simple: give every young cricketer in California access to the coaching, facilities, and competitive opportunities they need to reach their potential — on and off the field.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-5 py-4">
                <span className="text-2xl">🏏</span>
                <div>
                  <p className="font-bold text-[#0F172A] text-sm">ICC Certified</p>
                  <p className="text-xs text-slate-400">Coaching standard</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-5 py-4">
                <span className="text-2xl">🔒</span>
                <div>
                  <p className="font-bold text-[#0F172A] text-sm">Safe Sport</p>
                  <p className="text-xs text-slate-400">Certified program</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-5 py-4">
                <span className="text-2xl">🇺🇸</span>
                <div>
                  <p className="font-bold text-[#0F172A] text-sm">USA Cricket</p>
                  <p className="text-xs text-slate-400">Affiliated academy</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => document.querySelector("#programs")?.scrollIntoView({ behavior: "smooth" })}
              className="mt-8 bg-[#0F172A] text-white px-8 py-4 rounded-full text-sm font-semibold hover:bg-slate-800 transition hover:scale-105 shadow-md"
            >
              Explore Programs →
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}

export default AboutCCA;
