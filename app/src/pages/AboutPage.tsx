// ============================================================
//  pages/AboutPage.tsx — Standalone About page.
//  Content is paraphrased from publicly available facts about
//  California Cricket Academy (calcricket.org), rewritten in our
//  own words and laid out with this app's own design system —
//  not copied text or design from the source site.
// ============================================================
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const offerings = [
  { icon: "🌍", title: "International Tours", desc: "Touring squads travel to the UK, India, and other cricket-playing nations for hands-on competitive experience abroad." },
  { icon: "🏏", title: "Long-Format Cricket", desc: "One of the only academies still teaching traditional long-format cricket, including multi-day matches played in whites with a red ball." },
  { icon: "🎽", title: "Certified Coaching Staff", desc: "Coaches are recruited for having played the game at a serious competitive level, not just for being available to teach." },
  { icon: "📅", title: "Games Every Weekend", desc: "Multiple matches run most weekends across the season, so skills are built through repetition and real game time, not just drills." },
  { icon: "👧", title: "Girls-Only Pathway", desc: "A dedicated girls' program and travel squad for ages 10–13, with CCA-trained players going on to represent USA youth and senior teams." },
  { icon: "🏆", title: "Local & National Tournaments", desc: "Players move from internal scrimmages into local leagues and on to regional and national tournament squads as their game develops." },
  { icon: "🎖️", title: "Citizenship, Not Just Cricket", desc: "Every player is coached toward becoming a good citizen as much as a good cricketer — discipline and sportsmanship are part of the curriculum." },
  { icon: "🗺️", title: "A Pathway for Every Skill Level", desc: "Players of every age and ability are placed on a clear development track instead of being grouped by age alone." },
  { icon: "🏗️", title: "Biggest Footprint in the Country", desc: "The largest cricket infrastructure of any academy nationwide, which lets CCA players take part in more games than almost anyone else." },
];

const whyChoose = [
  { title: "A Pathway for Every Player", desc: "A clear development track for players of all ages and skill levels — not a one-size-fits-all program." },
  { title: "Live-Webcast Tournaments", desc: "First to introduce live webcasting of the Junior National Tournament, bringing the games to families who can't be there in person." },
  { title: "Nine All-Youth Teams", desc: "The first all-youth cricket coaching academy in the United States to field nine teams." },
  { title: "Grassroots Pioneer", desc: "Among the first to introduce cricket at the grassroots level across the USA." },
  { title: "Coaches Recruited Worldwide", desc: "Experienced coaches are hired and invited in from around the world, not just the local area." },
  { title: "Built Toward the U19 World Cup", desc: "Training is structured with an eye on preparing players for the Under-19 World Cup stage." },
  { title: "Discipline & Sportsmanship", desc: "Every session reinforces discipline and sportsmanship alongside technical skill." },
  { title: "Sustained World-Class Coaching", desc: "A coaching program built for consistency over years, not a single clinic or season." },
];

const achievements = [
  { year: "ICC", title: "Best Junior Development Program", desc: "Awarded by the International Cricket Council on three separate occasions, alongside several other ICC honors." },
  { year: "ICC Americas", title: "Youth Development Awards", desc: "Multiple wins across several ICC Americas Youth Development categories." },
  { year: "2007", title: "Congressional Achievement Certificate", desc: "Presented by Congressman Mike Honda in recognition of CCA's community work." },
  { year: "2017", title: "Best Small Business Award", desc: "Recognized by the City of Cupertino for its contribution to the local community." },
  { year: "Ongoing", title: "Civic Recognition", desc: "Additional honors from the US Congress, State Assembly Senator, Santa Clara County Chamber, and the Cupertino Chamber's CitySTAR Awards." },
  { year: "Since 2004", title: "National Junior Championships", desc: "Multiple National Junior Championship titles across all age groups since the academy's founding." },
  { year: "2018–19", title: "Local NCCA Youth League", desc: "Took the local NCCA youth league title in every age group across both seasons." },
  { year: "5 Years", title: "UK County Championships", desc: "Won the Somerset county championship three times in the last five years on international tour." },
  { year: "10 Years", title: "USA U19 / U15 Representation", desc: "At least four to six CCA players have represented USA U19 and U15 national teams every year for the past decade." },
];

const testimonials = [
  {
    quote: "CCA's grassroots efforts in developing the game and giving young cricketers proper guidance and opportunity deserve real recognition — it's exactly the kind of foundation the sport needs in America.",
    name: "Sachin Tendulkar",
    role: "Former captain of the Indian national cricket team; regarded as one of the greatest batsmen in the sport's history.",
  },
  {
    quote: "Best wishes for the new academy — cricket is a growing game, and building it up in this part of the world is great news for the sport itself.",
    name: "John Wright",
    role: "Former New Zealand opening batsman and international coach.",
  },
  {
    quote: "A tremendous day of learning and playing an introductory version of the game — the knowledge, expertise, and enthusiasm the coaches brought made a real impression on our students.",
    name: "Ms. Karas",
    role: "Physical Education teacher, Kennedy Middle School",
  },
];

const founders = {
  names: "Hemant & Kinjal Buch",
  bio: [
    "Hemant and Kinjal Buch have been living in California since 1987. Hemant has a Masters degree in Industrial and Systems Engineering and Kinjal is an Architect. Hemant is with a leading High-Tech company in Silicon Valley. Hemant is a visiting professor at San Jose State University in California. Kinjal is currently working at the Los Gatos City parks and public works department and is a freelance architect working on home remodelling projects.",
    "Both Hemant and Kinjal are culturally active in the Indian community. Kinjal has been President of an Indian non-profit organization in the valley and has been volunteering for the local school district. Both Hemant and Kinjal enjoy unquestionable respect, credibility and confidence in the local community.",
  ],
};

function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-hidden" style={{ background: "var(--pitch)" }}>
      <Navbar />
      <div className="h-20" /> {/* Spacer for fixed navbar */}
      {/* ───────────── HERO ───────────── */}
      <section className="relative pt-4 pb-20 overflow-hidden" style={{ background: "linear-gradient(145deg, #1F2E1E 0%, #2A3D27 55%, #1F2E1E 100%)" }}>
        <div className="hero-bg-canvas" aria-hidden="true">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
          <div className="hero-dot-grid" />
        </div>
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="scoreboard-label on-dark justify-center">About California Cricket Academy</span>
            <h1 className="font-display text-4xl sm:text-6xl font-semibold text-white leading-tight mt-5 max-w-3xl mx-auto">
              The only academy with a pathway for every age and skill level.
            </h1>
            <p className="text-white/70 text-lg mt-6 leading-8 max-w-2xl mx-auto">
              California Cricket Academy runs the largest cricket infrastructure of any academy in the
              country — which means our players get to play more games than almost anyone else. CCA is a
              federally recognized 501(c)(3) nonprofit, and the first cricket academy and youth league
              built for children ages 6 to 17 in the United States.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
              <button
                onClick={() => navigate("/programs")}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-semibold text-sm shadow-lg hover:scale-105 transition-transform"
                style={{ background: "var(--gold)", color: "var(--outfield)" }}
              >
                Explore Programs →
              </button>
              <button
                onClick={() => navigate("/faq")}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-semibold text-sm border border-white/25 text-white hover:bg-white/10 transition-colors"
              >
                Read the FAQs
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───────────── STATS STRIP ───────────── */}
      <section className="py-12 relative" style={{ background: "var(--outfield-soft)" }}>
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: "6–17", label: "Ages Served" },
            { value: "9", label: "All-Youth Teams" },
            { value: "100+", label: "USA Team Alumni" },
            { value: "20+", label: "Years Since Founding" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="text-center"
            >
              <p className="font-display text-3xl sm:text-4xl font-semibold" style={{ color: "var(--gold-light)" }}>{s.value}</p>
              <p className="text-xs text-white/60 mt-1 uppercase tracking-wide">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ───────────── CCA OFFERS ───────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
              <span className="scoreboard-label justify-center">What CCA Offers</span>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--outfield)] mt-4">
                A Premier Cricket Academy, Built End to End
              </h2>
            </motion.div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {offerings.map((o, i) => (
              <motion.div
                key={o.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
                className="why-card"
              >
                <span className="text-3xl">{o.icon}</span>
                <h3 className="font-display font-semibold text-[var(--outfield)] text-lg mt-4">{o.title}</h3>
                <p className="text-[var(--ink-500)] text-sm mt-2 leading-6">{o.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── WHY CHOOSE CCA ───────────── */}
      <section className="py-20" style={{ background: "var(--pitch-soft)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
              <span className="scoreboard-label justify-center">Why Choose CCA</span>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--outfield)] mt-4">
                What Sets the Academy Apart
              </h2>
            </motion.div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {whyChoose.map((w, i) => (
              <motion.div
                key={w.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -16 : 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: (i % 4) * 0.06 }}
                className="flex items-start gap-4 p-5 rounded-2xl bg-white border"
                style={{ borderColor: "var(--pitch-deep)" }}
              >
                <span
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-display font-semibold text-sm"
                  style={{ background: "var(--gold-glow)", color: "var(--outfield)" }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display font-semibold text-[var(--outfield)] text-base">{w.title}</h3>
                  <p className="text-[var(--ink-500)] text-sm mt-1.5 leading-6">{w.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── AWARDS & ACHIEVEMENTS (timeline) ───────────── */}
      <section className="py-20 relative overflow-hidden" style={{ background: "var(--outfield)" }}>
        <div className="hero-bg-canvas" aria-hidden="true">
          <div className="hero-orb hero-orb-1" style={{ opacity: 0.25 }} />
        </div>
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="text-center mb-14">
            <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
              <span className="scoreboard-label on-dark justify-center">Awards & Achievements</span>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white mt-4">
                More Recognition Than Any Other Academy
              </h2>
              <p className="text-white/60 mt-4 max-w-xl mx-auto">
                CCA has earned more awards than any comparable academy in the country since it was founded.
              </p>
            </motion.div>
          </div>

          <div className="relative pl-8 sm:pl-10">
            <div
              className="absolute left-3 sm:left-4 top-1 bottom-1 w-px"
              style={{ background: "linear-gradient(to bottom, var(--gold), transparent)" }}
            />
            {achievements.map((a, i) => (
              <motion.div
                key={a.title}
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="relative mb-8 last:mb-0"
              >
                <span
                  className="absolute -left-8 sm:-left-10 top-1.5 w-3 h-3 rounded-full"
                  style={{ background: "var(--gold)", boxShadow: "0 0 0 4px var(--outfield), 0 0 12px var(--gold)" }}
                />
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 hover:border-[var(--gold-light)] transition-colors">
                  <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--gold-light)" }}>{a.year}</span>
                  <h3 className="font-display font-semibold text-white text-base mt-1.5">{a.title}</h3>
                  <p className="text-white/55 text-sm mt-1.5 leading-6">{a.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── MEET THE FOUNDERS ───────────── */}
      <section className="py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
              <span className="scoreboard-label justify-center">Meet the Founders</span>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--outfield)] mt-4">
                {founders.names}
              </h2>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid sm:grid-cols-[40%_1fr] gap-12 items-start bg-white rounded-3xl p-8 sm:p-10 border"
            style={{ borderColor: "var(--pitch-deep)", boxShadow: "var(--shadow-card)" }}
          >
            <div
              className="rounded-2xl mx-auto overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--gold-glow)" }}
            >
              <img
                src="/hemant-and-kinjal-buch.jpg"
                alt="Hemant and Kinjal Buch"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              {founders.bio.map((p, i) => (
                <p key={i} className="text-[var(--ink-500)] leading-8 mb-4 last:mb-0">{p}</p>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───────────── TESTIMONIALS ───────────── */}
      <section className="py-20" style={{ background: "var(--pitch-soft)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
              <span className="scoreboard-label justify-center">Words of Appreciation</span>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--outfield)] mt-4">
                From Players, Parents, and Legends of the Game
              </h2>
            </motion.div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-white rounded-2xl p-6 border flex flex-col"
                style={{ borderColor: "var(--pitch-deep)", boxShadow: "var(--shadow-card)" }}
              >
                <span className="text-3xl leading-none" style={{ color: "var(--gold)" }}>“</span>
                <p className="text-[var(--ink-600)] text-sm leading-6 mt-2 flex-1">{t.quote}</p>
                <div className="seam-divider mt-5 mb-4" />
                <p className="font-display font-semibold text-[var(--outfield)] text-sm">{t.name}</p>
                <p className="text-[var(--ink-400)] text-xs mt-1 leading-5">{t.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── CLOSING CTA ───────────── */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div {...fadeUp} transition={{ duration: 0.45 }}>
            <span className="scoreboard-label justify-center">Any Questions?</span>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--outfield)] mt-4">
              We're Happy to Talk
            </h2>
            <p className="text-[var(--ink-500)] mt-5 leading-8 max-w-xl mx-auto">
              Whether you're picking a batch for a six-year-old's first season or asking about the tournament
              pathway for a teenager, our team is glad to walk you through it.
            </p>
            <div className="seam-divider max-w-xs mx-auto mt-9" />
            <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
              <button
                onClick={() => navigate("/faq")}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-semibold text-sm border-2 hover:bg-[var(--pitch-soft)] transition-colors"
                style={{ borderColor: "var(--outfield)", color: "var(--outfield)" }}
              >
                Check Out FAQs
              </button>
              <button
                onClick={() => {
                  navigate("/");
                  setTimeout(() => document.querySelector("#locations")?.scrollIntoView({ behavior: "smooth" }), 200);
                }}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-semibold text-sm shadow-lg hover:scale-105 transition-transform"
                style={{ background: "var(--gold)", color: "var(--outfield)" }}
              >
                Find a Location →
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default AboutPage;
