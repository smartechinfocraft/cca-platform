import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const stats = [
  { value: "20+",    label: "Years of Excellence", icon: "🏆" },
  { value: "3,000+", label: "Players Trained",     icon: "🧑‍🤝‍🧑" },
  { value: "100+",   label: "USA Representatives",  icon: "🇺🇸" },
  { value: "10+",    label: "Locations",            icon: "📍" },
];

// Cricket ball with an authentic stitched seam — the page's signature motif
function CricketBallSVG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="#A33B2B" stroke="#7A2C20" strokeWidth="1.5"/>
      <path d="M 8 20 Q 20 10 32 20 Q 20 30 8 20 Z" fill="none" stroke="#F3EFE2" strokeWidth="1.1" strokeDasharray="1.5 1.5" opacity="0.65"/>
      <path d="M 20 8 Q 10 20 20 32 Q 30 20 20 8 Z" fill="none" stroke="#F3EFE2" strokeWidth="1.1" strokeDasharray="1.5 1.5" opacity="0.65"/>
    </svg>
  );
}

export default function Hero() {
  const navigate  = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  // Scroll-reveal observer for hero children
  useEffect(() => {
    const els = sectionRef.current?.querySelectorAll(".reveal") ?? [];
    const io  = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
      }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!videoOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVideoOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [videoOpen]);

  return (
    <section ref={sectionRef} className="hero-gradient overflow-hidden relative min-h-[92vh] flex items-center">

      {/* ── Animated background ─────────────────────────────── */}
      <div className="hero-bg-canvas" aria-hidden="true">
        <div className="hero-dot-grid" />
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />

        {/* Spinning cricket ball decorations */}
        <CricketBallSVG className="w-14 h-14 absolute top-[18%] right-[12%] opacity-[0.14] spin-slow" />
        <CricketBallSVG className="w-8  h-8  absolute bottom-[22%] left-[6%] opacity-[0.1] spin-slow" />

        {/* Pitch crease lines */}
        <svg className="absolute bottom-0 left-0 w-full opacity-[0.05]" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <line x1="0" y1="40" x2="1440" y2="40" stroke="#1F2E1E" strokeWidth="2"/>
          <line x1="0" y1="80" x2="1440" y2="80" stroke="#1F2E1E" strokeWidth="1"/>
          <rect x="600" y="20" width="240" height="80" stroke="#1F2E1E" strokeWidth="1.5" fill="none"/>
        </svg>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 lg:py-32 w-full">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">

          {/* Left — Copy */}
          <div>
            {/* Eyebrow */}
            <div className="reveal animate-fade-in">
              <span className="scoreboard-label">
                <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: "var(--gold)" }} />
                California's Premier Youth Cricket Academy
              </span>
            </div>

            {/* Headline */}
            <h1 className="reveal reveal-delay-1 font-display text-[3.2rem] sm:text-6xl lg:text-[4.2rem] font-semibold text-[var(--outfield)] leading-[1.06] tracking-tight mt-4">
              Train Like A{" "}
              <span className="relative inline-block">
                <span style={{ color: "var(--cca-red)" }}>Champion</span>
                {/* Underline — seam-stitch detail, on-brand */}
                <svg
                  className="absolute -bottom-1.5 left-0 w-full"
                  viewBox="0 0 300 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 9 Q75 2 150 8 Q225 14 298 7"
                    stroke="var(--cca-red)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="5 5"
                    opacity="0.6"
                  />
                </svg>
              </span>
            </h1>

            <p className="reveal reveal-delay-2 text-[var(--ink-800)] text-lg mt-7 leading-[1.8] max-w-lg">
              Structured cricket training for ages 6–16 across California.
              Build skills, confidence, and competitive spirit with
              professional coaches who truly care.
            </p>

            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="reveal reveal-delay-2 mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--cca-red)]/25 bg-white/70 px-4 py-2 text-md font-semibold text-[var(--cca-red)] shadow-sm backdrop-blur-sm transition hover:border-[var(--cca-red)] hover:bg-white"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--cca-red)] text-xs text-white">▶</span>
              New to CCA? Watch Our 2-Min Intro Video
            </button>

            {/* CTA buttons */}
            <div className="reveal reveal-delay-3 flex flex-wrap gap-3 mt-9">
              <button
                onClick={() => navigate("/programs")}
                className="btn-glow px-8 py-3.5 rounded-full font-semibold text-sm shadow-lg hover:scale-105 transition-transform"
                style={{ background: "var(--outfield)", color: "var(--pitch)" }}
              >
                Fall 2026 Programs →
              </button>

                  {/* All Programs option */}
                <button
                  onClick={() => window.open("https://legacy.calcricket.org/product_cat/summer-2026/", "_blank")}
                  className="border-2 px-8 py-3.5 rounded-full font-semibold text-sm transition-all hover:scale-105"
                >
                  Summer 2026  <span className="flex gap-1 text-black/50">Legacy Site <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13 3H8.33333V4H11.2933L7.31333 7.98L8.02 8.68667L12 4.70667V7.66667H13V3ZM4.33333 3.66667C3.97971 3.66667 3.64057 3.80714 3.39052 4.05719C3.14048 4.30724 3 4.64638 3 5V11.6667C3 12.0203 3.14048 12.3594 3.39052 12.6095C3.64057 12.8595 3.97971 13 4.33333 13H11C11.3536 13 11.6928 12.8595 11.9428 12.6095C12.1929 12.3594 12.3333 12.0203 12.3333 11.6667V9.66667H11.3333V11.6667C11.3333 11.7551 11.2982 11.8399 11.2357 11.9024C11.1732 11.9649 11.0884 12 11 12H4.33333C4.24493 12 4.16014 11.9649 4.09763 11.9024C4.03512 11.8399 4 11.7551 4 11.6667V5C4 4.91159 4.03512 4.82681 4.09763 4.7643C4.16014 4.70179 4.24493 4.66667 4.33333 4.66667H6.33333V3.66667H4.33333Z" fill="black"/>
</svg></span>
                </button>

                <button
                  onClick={() => window.open("https://legacy.calcricket.org/product_cat/week-long/", "_blank")}
                  className="border-2 px-8 py-3.5 rounded-full font-semibold text-sm transition-all hover:scale-105"
                >
                  Week Long Camps <span className="flex gap-1 text-black/50">Legacy Site <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13 3H8.33333V4H11.2933L7.31333 7.98L8.02 8.68667L12 4.70667V7.66667H13V3ZM4.33333 3.66667C3.97971 3.66667 3.64057 3.80714 3.39052 4.05719C3.14048 4.30724 3 4.64638 3 5V11.6667C3 12.0203 3.14048 12.3594 3.39052 12.6095C3.64057 12.8595 3.97971 13 4.33333 13H11C11.3536 13 11.6928 12.8595 11.9428 12.6095C12.1929 12.3594 12.3333 12.0203 12.3333 11.6667V9.66667H11.3333V11.6667C11.3333 11.7551 11.2982 11.8399 11.2357 11.9024C11.1732 11.9649 11.0884 12 11 12H4.33333C4.24493 12 4.16014 11.9649 4.09763 11.9024C4.03512 11.8399 4 11.7551 4 11.6667V5C4 4.91159 4.03512 4.82681 4.09763 4.7643C4.16014 4.70179 4.24493 4.66667 4.33333 4.66667H6.33333V3.66667H4.33333Z" fill="black"/>
</svg></span>

                </button>
              {/* <button
                onClick={() => document.querySelector("#programs")?.scrollIntoView({ behavior: "smooth" })}
                className="border-2 px-8 py-3.5 rounded-full font-semibold text-sm transition-all hover:scale-105"
                style={{ borderColor: "var(--cca-red)", color: "var(--cca-red)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--cca-red)"; e.currentTarget.style.color = "var(--white)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--cca-red)"; }}
              >
                Register Now
              </button> */}


           
            </div>

            {/* Social proof strip */}
            <div className="reveal reveal-delay-4 flex items-center gap-5 mt-10 pt-10" style={{ borderTop: "1px solid var(--pitch-deep)" }}>
              {/* Avatars */}
              <div className="flex -space-x-2.5">
                {["🧒","👦","🧑","👧"].map((e, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-[13px] shadow-sm"
                    style={{ background: "var(--pitch-soft)" }}
                  >
                    {e}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--outfield)]">3,000+ families trust CCA</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5" style={{ color: "var(--gold)" }} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  ))}
                  <span className="text-xs text-[var(--ink-400)] ml-1">4.9 avg. rating</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Stats Card */}
          <div className="relative">

            {/* Floating rating badge — top-right */}
            <div className="badge-float absolute -top-5 -right-4 bg-white rounded-2xl px-5 py-3.5 shadow-xl z-20" style={{ border: "1px solid var(--pitch-deep)" }}>
              <p className="text-xs text-[var(--ink-400)] font-medium">Overall Rating</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-display text-2xl font-semibold text-[var(--outfield)]">4.9</span>
                <div className="flex text-sm leading-none" style={{ color: "var(--gold)" }}>★★★★★</div>
              </div>
            </div>

            {/* Main dark card */}
            <div className="rounded-[2rem] p-8 lg:p-9 text-white noise-overlay relative overflow-hidden shadow-2xl" style={{ background: "var(--outfield)" }}>
              {/* Glow behind card */}
              <div className="absolute -inset-1 rounded-[2rem] opacity-25 blur-2xl pointer-events-none" style={{ background: "radial-gradient(circle, var(--gold-glow), transparent)" }} />

              {/* Decorative circle accents */}
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none" style={{ background: "rgba(201,162,39,0.08)" }} />
              <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-white/[0.04] pointer-events-none" />

              <div className="relative z-10">
                {/* Card header */}
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "var(--gold)" }}>
                    <CricketBallSVG className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-white text-base">CCA Track Record</p>
                    <p className="text-xs text-white/50">Proudly serving since 2004</p>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-4">
                  {stats.map((s, i) => (
                    <div
                      key={i}
                      className="group relative bg-white/[0.07] hover:bg-white/[0.11] backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all duration-300 cursor-default"
                    >
                      <span className="text-xl mb-2 block">{s.icon}</span>
                      <p className="font-display text-3xl font-semibold leading-none" style={{ color: "var(--gold-light)" }}>{s.value}</p>
                      <p className="text-xs text-white/60 mt-2 leading-tight">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Enrolment CTA strip */}
                <div className="mt-6 rounded-2xl p-5 flex items-center justify-between shadow-lg" style={{ background: "linear-gradient(135deg, var(--gold), var(--gold-light))" }}>
                  <div>
                    <p className="font-semibold text-md" style={{ color: "var(--outfield)" }}>Fall 2026 Enrollment Open</p>

                  </div>
                  <button
                    onClick={() => navigate("/programs")}
                    className="bg-white text-xs font-bold px-5 py-2.5 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-md"
                    style={{ color: "var(--outfield)" }}
                  >
                    Join Now
                  </button>
                </div>
              </div>
            </div>

            {/* Floating badge — bottom-right */}
            <div className="badge-float-delayed absolute -bottom-5 -right-4 bg-white rounded-2xl px-5 py-3.5 shadow-xl z-20" style={{ border: "1px solid var(--pitch-deep)" }}>
              <p className="text-xs text-[var(--ink-400)] font-medium">USA Cricket Affiliated</p>
              <p className="font-display text-sm font-semibold text-[var(--outfield)] mt-0.5">🇺🇸 Certified Academy</p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Scrolling stats ticker — scoreboard style ─────────── */}
      <div className="absolute bottom-0 left-0 right-0 backdrop-blur-sm py-3 overflow-hidden z-10" style={{ background: "rgba(31,46,30,0.95)" }}>
        <div className="marquee-track">
          {[
            "🏏 20+ Years of Excellence",
            "⚡ ICC Certified Coaches",
            "🏆 3,000+ Players Trained",
            "📍 10+ Locations Across California",
            "🇺🇸 100+ USA Cricket Representatives",
            "🌟 California's #1 Youth Cricket Academy",
            "🏏 20+ Years of Excellence",
            "⚡ ICC Certified Coaches",
            "🏆 3,000+ Players Trained",
            "📍 10+ Locations Across California",
            "&#x1f1fa;&#x1f1f8; 100+ USA Cricket Representatives",
            "🌟 California's #1 Youth Cricket Academy",
          ].map((item, i) => (
            <span key={i} className="mx-8 text-lg font-semibold text-white/90 whitespace-nowrap tracking-wide">
              {item}
            </span>
          ))}
        </div>
      </div>

      {videoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close intro video"
            className="absolute inset-0 h-full w-full"
            onClick={() => setVideoOpen(false)}
          />
          <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/20">
            <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A33B2B]">CCA Intro</p>
                <h2 className="text-base font-bold text-[#0F172A] sm:text-lg">New to CCA?</h2>
              </div>
              <button
                type="button"
                onClick={() => setVideoOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-xl leading-none text-slate-500 transition hover:bg-slate-50"
                aria-label="Close video"
              >
                ×
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/rxJdJeBPWaY?si=WRt-fFh_nSasy1C8&info=0"
                title="CCA intro video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
