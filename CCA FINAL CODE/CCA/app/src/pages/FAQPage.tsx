// ============================================================
//  pages/FAQPage.tsx — Standalone FAQ page.
//  Pulls real FAQs from the backend when available; fallback
//  content below is paraphrased from publicly available CCA
//  facts (calcricket.org), rewritten in our own words.
// ============================================================
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getFAQs } from "../services/programService";

interface FaqItem { _id: string; question: string; answer: string; category?: string }

const FALLBACK: FaqItem[] = [
  { _id: "1", category: "Getting Started", question: "What's the youngest age my child can start?", answer: "Six years old is the typical starting point, and it's genuinely not too early — coaches place every new player into a batch based on age, current skill, and maturity, not age alone, so a six-year-old's first session is built specifically for that stage." },
  { _id: "2", category: "Getting Started", question: "How do I register, and what do I need to pick?", answer: "You'll choose an age group, a location, and a skill level when registering. If you're not sure which level fits, coaches place players into the right batch after an initial look at their skills." },
  { _id: "3", category: "Getting Started", question: "What equipment does my child need on day one?", answer: "Beginners really only need a properly sized cricket bat to get started. Additional gear can be added as a player progresses." },
  { _id: "4", category: "Training", question: "How many kids are in each training group?", answer: "Groups are kept small — typically 6 to 8 players per coach — specifically so each child gets real, focused attention rather than getting lost in a crowd." },
  { _id: "5", category: "Training", question: "What does a typical session actually look like?", answer: "Sessions open with a warm-up and a quick rundown of the day's plan, move into structured coached drills, and close with a cool-down and direct feedback for each player." },
  { _id: "6", category: "Training", question: "When do kids start playing real matches, not just drills?", answer: "Players start with internal practice games among teammates, then move on to external matches and tournaments as their skills develop — it's a progression, not a fixed schedule everyone follows at the same pace." },
  { _id: "7", category: "Inclusion & Safety", question: "Is this program open to girls too?", answer: "Yes — girls train in the same safe, inclusive environment as boys, and CCA-trained players have gone on to represent USA youth and senior national teams." },
  { _id: "8", category: "Inclusion & Safety", question: "How is player safety handled for younger kids?", answer: "Safety is treated as a primary consideration at every age group, with batch placement, coaching ratios, and session structure all designed around what's appropriate for that age." },
  { _id: "9", category: "Programs & Cost", question: "What's actually included in a season?", answer: "A typical annual program includes regular coached net sessions across the season, internal games, registration for external tournaments, and ongoing opportunities to play and improve." },
  { _id: "10", category: "Programs & Cost", question: "Is this only for kids who already play seriously?", answer: "No — the program is built for a wide range of kids, with different batches for different skill levels and age groups so everyone is training and playing at the right level for them." },
];

const CATEGORIES = ["All", "Getting Started", "Training", "Inclusion & Safety", "Programs & Cost"];

function FAQPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    getFAQs()
      .then((data) => setFaqs(data?.length ? data : []))
      .catch(() => setFaqs([]))
      .finally(() => setLoading(false));
  }, []);

  const display = faqs.length > 0 ? faqs : FALLBACK;
  const filtered = activeCategory === "All" ? display : display.filter((f) => f.category === activeCategory);
  const hasCategories = display.some((f) => f.category);

  return (
    <div className="overflow-x-hidden" style={{ background: "var(--pitch)" }}>
      <Navbar />

      <section className="relative pt-20 pb-12 overflow-hidden" style={{ background: "linear-gradient(145deg, #F3EFE2 0%, #ECE6D4 60%, #FBF8EF 100%)" }}>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="scoreboard-label">Questions, Answered</span>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--outfield)] mt-4">
              Frequently Asked Questions
            </h1>
            <p className="text-[var(--ink-500)] text-lg mt-5 leading-7">
              Everything parents ask before their child's first session. Can't find your answer here?{" "}
              <a href="mailto:hello@californiacricketacademy.org" className="font-semibold hover:underline" style={{ color: "var(--grass)" }}>
                Email us directly
              </a>.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          {hasCategories && (
            <div className="flex flex-wrap gap-2 justify-center mb-10">
              {CATEGORIES.filter((c) => c === "All" || display.some((f) => f.category === c)).map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className="px-4 py-2 rounded-full text-xs font-semibold transition"
                  style={
                    activeCategory === c
                      ? { background: "var(--gold)", color: "var(--outfield)" }
                      : { background: "var(--pitch-soft)", color: "var(--ink-500)" }
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="bg-white rounded-2xl h-16 skeleton" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((faq, i) => (
                <motion.div
                  key={faq._id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                  className={`faq-item ${open === faq._id ? "open" : ""}`}
                >
                  <button
                    onClick={() => setOpen(open === faq._id ? null : faq._id)}
                    className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-[var(--outfield)] text-sm"
                  >
                    <span>{faq.question}</span>
                    <span
                      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center transition-all text-sm font-bold"
                      style={
                        open === faq._id
                          ? { background: "var(--gold)", color: "var(--outfield)", transform: "rotate(45deg)" }
                          : { background: "var(--pitch-soft)", color: "var(--ink-500)" }
                      }
                    >
                      +
                    </span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${open === faq._id ? "max-h-[260px]" : "max-h-0"}`}>
                    <div className="px-7 pb-6 text-[var(--ink-500)] text-sm leading-7 pt-4" style={{ borderTop: "1px solid var(--pitch-soft)" }}>
                      {faq.answer}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default FAQPage;
