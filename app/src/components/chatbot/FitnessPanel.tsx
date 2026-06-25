// ============================================================
//  components/chatbot/FitnessPanel.tsx
//  "Fitness Check" quick action — collects height + weight,
//  calls the deterministic /api/public/chatbot/bmi endpoint
//  (pure arithmetic, not an LLM guess), then shows generic,
//  age-appropriate cricket-fitness encouragement. Optionally
//  logs the result against one of the parent's real students.
//
//  Health-content note: this gives general wellness encouragement
//  only — no calorie targets, no weight-loss plans, no diagnosis.
//  BMI category text is descriptive ("above typical range"), not
//  a medical label, and we say outright that a doctor reads BMI
//  properly for growing kids, not a chart like this.
// ============================================================
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiOutlineArrowLeft, HiOutlineHeart } from "react-icons/hi2";
import { useAuth } from "../../context/AuthContext";
import { calculateBmi, type BmiResult } from "../../services/chatbotService";
import { getMyStudents } from "../../services/parentDashboardService";
import type { StudentWithSummary } from "../../types/parentDashboard";

const TIPS = [
  "Warm up for 8-10 minutes before any net session — loose hamstrings and shoulders prevent most cricket injuries.",
  "Hydrate well before and during practice, especially on hot Bay Area afternoons — little sips, often.",
  "Aim for 8-10 hours of sleep on training nights — that's when young bodies actually build strength and reflexes.",
  "Balanced plates beat strict diets — protein, carbs, and veggies at most meals fuels both batting stamina and bowling speed.",
  "Rest days matter as much as training days. Overuse is the #1 cause of junior bowling injuries — follow your coach's spell limits.",
];

interface FitnessPanelProps {
  onBack: () => void;
}

function FitnessPanel({ onBack }: FitnessPanelProps) {
  const { isLoggedIn, token } = useAuth();

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"metric" | "imperial">("metric");
  const [students, setStudents] = useState<StudentWithSummary[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [result, setResult] = useState<BmiResult | null>(null);
  const [tip, setTip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn && token) {
      getMyStudents(token).then(setStudents).catch(() => {});
    }
  }, [isLoggedIn, token]);

  const handleCalculate = async () => {
    setError(null);
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w) { setError("Enter both height and weight."); return; }

    const heightCm = unit === "metric" ? h : h * 2.54; // imperial entered in inches
    const weightKg = unit === "metric" ? w : w * 0.4536; // imperial entered in lbs

    setLoading(true);
    try {
      const res = await calculateBmi(heightCm, weightKg, token, studentId || undefined);
      setResult(res);
      setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't calculate that — try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto cca-chat-scroll px-5 py-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold mb-4" style={{ color: "var(--outfield)" }}>
        <HiOutlineArrowLeft className="w-4 h-4" /> Back to chat
      </button>

      <div className="flex items-center gap-2 mb-1">
        <HiOutlineHeart className="w-5 h-5" style={{ color: "var(--leather)" }} />
        <h3 className="font-display font-semibold text-lg" style={{ color: "var(--outfield)" }}>Fitness Check</h3>
      </div>
      <p className="text-sm leading-6 mb-5" style={{ color: "var(--ink-500)" }}>
        A quick BMI check plus a tip for staying match-ready. This is general wellness info, not medical advice —
        for growing kids, a pediatrician is the right person to properly assess healthy weight ranges.
      </p>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex gap-2 mb-1">
              <button
                onClick={() => setUnit("metric")}
                className="flex-1 rounded-xl py-2 text-xs font-semibold border-2"
                style={unit === "metric" ? { borderColor: "var(--gold)", background: "var(--gold-glow)", color: "var(--outfield)" } : { borderColor: "var(--pitch-deep)", color: "var(--ink-500)" }}
              >
                cm / kg
              </button>
              <button
                onClick={() => setUnit("imperial")}
                className="flex-1 rounded-xl py-2 text-xs font-semibold border-2"
                style={unit === "imperial" ? { borderColor: "var(--gold)", background: "var(--gold-glow)", color: "var(--outfield)" } : { borderColor: "var(--pitch-deep)", color: "var(--ink-500)" }}
              >
                in / lbs
              </button>
            </div>

            <input
              type="number"
              placeholder={unit === "metric" ? "Height (cm)" : "Height (inches)"}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[var(--gold)] transition-colors"
              style={{ borderColor: "var(--pitch-deep)" }}
            />
            <input
              type="number"
              placeholder={unit === "metric" ? "Weight (kg)" : "Weight (lbs)"}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[var(--gold)] transition-colors"
              style={{ borderColor: "var(--pitch-deep)" }}
            />

            {isLoggedIn && students.length > 0 && (
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[var(--gold)] transition-colors bg-white"
                style={{ borderColor: "var(--pitch-deep)" }}
              >
                <option value="">Don't save — just calculate</option>
                {students.map((s) => (
                  <option key={s._id} value={s._id}>Save to {s.firstName} {s.lastName}'s profile</option>
                ))}
              </select>
            )}

            {error && (
              <p className="text-xs rounded-lg p-2.5" style={{ background: "var(--leather-glow)", color: "var(--leather)" }}>{error}</p>
            )}

            <button
              onClick={handleCalculate}
              disabled={loading}
              className="w-full rounded-full py-3 font-semibold text-sm disabled:opacity-50 transition-transform hover:scale-[1.02]"
              style={{ background: "var(--gold)", color: "var(--outfield)" }}
            >
              {loading ? "Calculating…" : "Calculate BMI"}
            </button>
          </motion.div>
        ) : (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="rounded-2xl p-5 text-center" style={{ background: "var(--pitch-soft)" }}>
              <motion.p
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                className="font-display text-4xl font-semibold"
                style={{ color: "var(--outfield)" }}
              >
                {result.bmi}
              </motion.p>
              <p className="text-sm font-semibold mt-1" style={{ color: "var(--leather)" }}>{result.category}</p>
              {result.saved && (
                <p className="text-[11px] mt-2" style={{ color: "var(--ink-400)" }}>✓ Saved to the student's fitness history</p>
              )}
            </div>

            <div className="mt-4 rounded-2xl p-4 bg-white border" style={{ borderColor: "var(--pitch-deep)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--outfield)" }}>🏏 Today's fitness tip</p>
              <p className="text-sm leading-6" style={{ color: "var(--ink-500)" }}>{tip}</p>
            </div>

            <p className="text-[11px] mt-4 leading-5" style={{ color: "var(--ink-400)" }}>
              BMI is one rough number and reads differently for growing kids than adults — please use a
              pediatrician's guidance for anything beyond general encouragement.
            </p>

            <button
              onClick={() => { setResult(null); setHeight(""); setWeight(""); }}
              className="w-full rounded-full py-2.5 mt-4 font-semibold text-sm border-2"
              style={{ borderColor: "var(--outfield)", color: "var(--outfield)" }}
            >
              Check again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FitnessPanel;
