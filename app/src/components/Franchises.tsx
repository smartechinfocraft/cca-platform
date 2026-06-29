const franchises = [
  {
    logo: "/franchises/california-cricket-league.png",
    title: "California Cricket League",
    desc: "Statewide youth league and development platform where CCA teams compete each season.",
    tag: "League",
  },
  {
    logo: "/franchises/san-diego-surf-riders.png",
    title: "San Diego Surf Riders",
    desc: "CCA's Southern California affiliate - competitive club focused on match play and skills.",
    tag: "Affiliate",
  },
  {
    logo: "/franchises/us-junior-league.png",
    title: "US Junior League",
    desc: "National junior competition and talent identification program - CCA's pathway to the top.",
    tag: "National",
  },
];

function Franchises() {
  return (
    <section id="franchises" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-[var(--gold)] text-xs font-bold tracking-widest uppercase block mb-3">
            Our Network
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--outfield)]">
            IPL Style League Franchise ownership
          </h2>
          <p className="text-slate-500 mt-3 max-w-sm mx-auto">
            The CCA family extends across California and beyond.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {franchises.map((f) => (
            <div key={f.title} className="why-card bg-slate-50 group overflow-hidden">
              <div className="flex items-start flex-col gap-4">
                <div className="w-full rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm ring-1 ring-slate-200 transition duration-300 group-hover:scale-105">
                  <img
                    src={f.logo}
                    alt={`${f.title} logo`}
                    className=" w-full rounded-xl object-contain"
                    loading="lazy"
                  />
                </div>
                <div>
                  {/* <span className="text-[10px] font-bold text-[var(--gold)] uppercase tracking-wide">{f.tag}</span> */}
                  <h3 className="font-display font-bold text-[var(--outfield)] mt-1 text-base">{f.title}</h3>
                </div>
              </div>
              <p className="text-slate-500 text-sm mt-4 leading-6">{f.desc}</p>
              {/* <button className="mt-5 text-sm font-semibold text-[var(--outfield)] hover:text-[var(--gold)] transition flex items-center gap-1">
                Learn More
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button> */}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Franchises;
