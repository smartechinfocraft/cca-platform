const features = [
  {
    icon: "🎓",
    title: "Certified Coaches",
    desc: "Learn from ICC-qualified coaches with professional playing experience. Every session is planned, structured, and focused on your child's growth.",
    color: "bg-blue-50",
    iconBg: "bg-blue-100",
  },
  {
    icon: "🏆",
    title: "Tournament Exposure",
    desc: "Regular competitive fixtures against other academies. CCA players have represented California at state and national junior tournaments.",
    color: "bg-amber-50",
    iconBg: "bg-amber-100",
  },
  {
    icon: "📍",
    title: "Multiple Locations",
    desc: "Convenient training centers across the Bay Area — Fremont, San Jose, Dublin, Sunnyvale, and growing. Find a ground near you.",
    color: "bg-emerald-50",
    iconBg: "bg-emerald-100",
  },
  {
    icon: "📋",
    title: "Structured Curriculum",
    desc: "A clear development pathway from U8 to U16. Every batch follows a periodized curriculum covering batting, bowling, fielding, and mindset.",
    color: "bg-violet-50",
    iconBg: "bg-violet-100",
  },
  {
    icon: "🤝",
    title: "Community & Values",
    desc: "Cricket builds character. We instill teamwork, discipline, and sportsmanship—values that go beyond the boundary.",
    color: "bg-pink-50",
    iconBg: "bg-pink-100",
  },
  {
    icon: "📊",
    title: "Progress Tracking",
    desc: "Regular skill assessments so parents can see their child's development. Clear milestones at every level.",
    color: "bg-amber-50",
    iconBg: "bg-amber-100",
  },
];

function WhyChooseCCA() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* Left — Sticky header */}
          <div className="lg:sticky lg:top-28">
            <span className="text-[var(--gold)] text-xs font-bold tracking-widest uppercase block mb-4">
              Why CCA
            </span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-[var(--outfield)] leading-tight">
              Everything Your<br />Young Cricketer Needs
            </h2>
            <p className="text-slate-500 mt-6 text-base leading-7">
              CCA isn't just a coaching program — it's a full development ecosystem that combines elite coaching, competitive opportunities, and a supportive community.
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
                Browse Programs →
              </button>
            </div>
          </div>

          {/* Right — Feature grid */}
          <div className="grid sm:grid-cols-2 gap-5">
            {features.map((item, i) => (
              <div key={i} className={`why-card ${item.color}`}>
                <div className={`w-12 h-12 ${item.iconBg} rounded-2xl flex items-center justify-center text-2xl mb-5`}>
                  {item.icon}
                </div>
                <h3 className="font-display font-bold text-[var(--outfield)] text-base">{item.title}</h3>
                <p className="text-slate-500 text-sm mt-3 leading-6">{item.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

export default WhyChooseCCA;
