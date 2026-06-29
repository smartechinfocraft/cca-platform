const data = [
  { value: "20+", label: "Years of Excellence", icon: "🏆", desc: "Established 2004" },
  { value: "3,000+", label: "Players Trained", icon: "🧑‍🤝‍🧑", desc: "Across California" },
  { value: "100+", label: "USA Representatives", icon: "🇺🇸", desc: "National squad players" },
  { value: "10+", label: "Locations", icon: "📍", desc: "Bay Area & beyond" },
  { value: "15+", label: "Expert Coaches", icon: "🎓", desc: "Certified professionals" },
  { value: "50+", label: "Tournaments Won", icon: "🥇", desc: "State & national titles" },
];

function Achievements() {
  return (
    <section className="py-20 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="inline-block text-[var(--gold)] text-xs font-bold tracking-widest uppercase mb-3">
            Our Track Record
          </span>
          <h2 className="font-display text-4xl font-bold text-[var(--outfield)]">
            Trusted by Thousands of Parents Across California
          </h2>
          <p className="text-slate-500 mt-3 max-w-lg mx-auto">
            Two decades of shaping young cricketers into confident athletes.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {data.map((item, i) => (
            <div key={i} className="stat-card group">
              <div className="text-3xl mb-3">{item.icon}</div>
              <p className="font-display text-3xl font-bold text-[var(--gold)]">{item.value}</p>
              <p className="text-sm font-semibold text-[var(--outfield)] mt-2">{item.label}</p>
              <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Achievements;
