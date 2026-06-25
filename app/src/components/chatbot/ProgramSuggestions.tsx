// ============================================================
//  components/chatbot/ProgramSuggestions.tsx
//  Fetches REAL matched programs from the deterministic backend
//  endpoint (/api/public/chatbot/recommend-programs) and renders
//  them as small cards the parent can tap to start registering.
//  Kept separate from the LLM call so a suggestion shown here is
//  always a program that actually exists, at its real price.
// ============================================================
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { recommendPrograms, type RecommendedProgram } from "../../services/chatbotService";

interface ProgramSuggestionsProps {
  age: number;
  skillLevel: string;
  onPick: (programId: string) => void;
}

function ProgramSuggestions({ age, skillLevel, onPick }: ProgramSuggestionsProps) {
  const [programs, setPrograms] = useState<RecommendedProgram[] | null>(null);
  const [matched, setMatched] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    recommendPrograms(age, skillLevel)
      .then((res) => {
        if (cancelled) return;
        setPrograms(res.data);
        setMatched(res.matched);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [age, skillLevel]);

  if (error) return null;

  if (!programs) {
    return (
      <div className="flex gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="cca-suggest-card w-[150px] h-[86px] skeleton" />
        ))}
      </div>
    );
  }

  if (programs.length === 0) return null;

  return (
    <div>
      {!matched && (
        <p className="text-[11px] mb-1.5" style={{ color: "var(--ink-400)" }}>
          No exact match — here are a few popular programs instead:
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {programs.map((p, i) => (
          <motion.button
            key={p._id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            onClick={() => onPick(p._id)}
            className="cca-suggest-card text-left flex-shrink-0 w-[160px]"
          >
            <p className="font-display font-semibold text-[12.5px] leading-snug line-clamp-2" style={{ color: "var(--outfield)" }}>
              {p.title}
            </p>
            {p.location?.title && (
              <p className="text-[10.5px] mt-1" style={{ color: "var(--ink-400)" }}>📍 {p.location.title}</p>
            )}
            <p className="text-[12px] font-semibold mt-1.5" style={{ color: "var(--leather)" }}>
              {p.discountedPrice ? `$${p.discountedPrice}` : p.basePrice ? `$${p.basePrice}` : "See pricing"}
            </p>
            <span
              className="inline-block mt-1.5 text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--gold-glow)", color: "var(--outfield)" }}
            >
              Select →
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export default ProgramSuggestions;
