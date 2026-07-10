import { useNavigate } from "react-router-dom";

function CTA() {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-white" id="contact">
      <div className="max-w-6xl mx-auto px-6">
        <div className="bg-[var(--outfield)] rounded-[40px] px-10 py-16 md:py-20 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[var(--gold)]/10 -translate-y-1/3 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4" />

          <div className="relative z-10 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-block bg-[var(--gold)]/20 text-[var(--gold)] text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide mb-6">
                Join CCA Today
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight">
                Ready to Start Your<br />Cricket Journey?
              </h2>
              <p className="text-slate-300 mt-5 leading-7 text-base">
                Enrollment is open for the current season. Spots fill fast — register now to secure your child's place in California's premier cricket academy.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => navigate("/programs")}
                className="w-full bg-[var(--gold)] hover:bg-[var(--gold-light)] text-[var(--outfield)] px-8 py-4 rounded-2xl font-bold text-base transition-all hover:scale-105 shadow-xl shadow-[var(--shadow-gold)]"
              >
                Browse & Register Now →
              </button>
              <p className="text-center text-slate-400 text-xs mt-1">
                Questions? Email us at{" "}
                <a href="mailto:hello@calcricket.org" className="text-[var(--gold)] hover:underline font-semibold">
                  hello@calcricket.org
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CTA;