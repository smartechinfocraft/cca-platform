import { useState } from "react";

const performanceCenterFeatures = [
  {
   icon: "🏏",
    stat: "5",
    title: "Turf Training Setup",
    desc: "The only academy with 5 turf game wickets and 2 turf batting cages.",
  },
  {
    icon: "🏟️",
    stat: "7",
    title: "Cricket Fields",
    desc: "Dedicated fields for match play, tactical sessions, and game scenarios.",
  },
  {
    icon: "🥅",
    stat: "14",
    title: "Batting Cages",
    desc: "High-volume batting access for focused repetitions and faster improvement.",
  },
  {
    icon: "⚾",
    stat: "Pro",
    title: "Bowling Machines",
    desc: "Machine-led practice for pace, swing, reaction time, and shot selection.",
  },
  {
    icon: "💪",
    stat: "Fit",
    title: "Conditioning Training",
    desc: "Fitness and conditioning built into cricket development.",
  },
];

function WhyChooseCCA() {
  const [openFeature, setOpenFeature] = useState(0);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* Left - Sticky header */}
          <div className="lg:sticky lg:top-28">
            <span className="text-[var(--gold)] text-xs font-bold tracking-widest uppercase block mb-4">
              Why CCA
            </span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-[var(--outfield)] leading-tight">
              Everything Your<br />Young Cricketer Needs
            </h2>
            <p className="text-slate-500 mt-6 text-base leading-7">
              CCA isn't just a coaching program - it's a full development ecosystem that combines elite coaching, competitive opportunities, and a supportive community.
            </p>

            <div className="mt-10 bg-[var(--outfield)] rounded-3xl p-8 text-white">
              <p className="font-display text-lg font-bold">Ready to get started?</p>
              <p className="text-slate-300 text-sm mt-2 leading-6">
                Enrollment is open. Browse programs and find the right fit for your child's age and skill level.
              </p>
              <button
                onClick={() => document.querySelector("#programs")?.scrollIntoView({ behavior: "smooth" })}
                className="mt-5 bg-[var(--gold)] text-[var(--outfield)] px-6 py-3 rounded-full text-sm font-semibold hover:bg-[var(--gold-light)] transition"
              >
                Browse Programs -&gt;
              </button>
            </div>
          </div>

          {/* Right - Feature grid */}
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 sm:p-6">
            <div className="mb-6 border-l-4 border-[var(--gold)] pl-4">
             
              <h3 className="font-display text-3xl font-bold text-[var(--outfield)] mt-2">
                 High Performance Center
              </h3>
            </div>

            <div className="grid gap-4">
              {performanceCenterFeatures.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOpenFeature(openFeature === i ? -1 : i)}
                  aria-expanded={openFeature === i}
                  className="why-card border border-[var(--gold)]/40 bg-[var(--gold)]/10 shadow-sm text-left p-1 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-lg font-display font-bold bg-[var(--gold)]/15 text-[var(--outfield)]">
                      {item.icon}
                    </div>
                    <h4 className="font-display font-bold text-lg text-[var(--outfield)] flex-1">
                      {item.stat} {item.title}
                    </h4>
                    <span className="w-8 h-8 shrink-0 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[var(--outfield)] font-bold">
                      {openFeature === i ? "-" : "+"}
                    </span>
                  </div>

                  <div
                    className={`grid transition-all duration-300 ${
                      openFeature === i ? "grid-rows-[1fr] mt-4" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="text-md leading-6 text-black">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export default WhyChooseCCA;
