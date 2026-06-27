// ============================================================
//  components/chatbot/AccountDetailsPanel.tsx
//
//  Collects the parent/guardian's details in a friendly,
//  one-question-at-a-time flow (still feels like chatting with
//  CCA, just structured so the data is reliable). On submit, we
//  hand off to the REAL /login register form with everything
//  pre-filled — except the password, which the person always
//  types themselves directly into the real form for security.
// ============================================================
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiOutlineArrowLeft, HiOutlineLockClosed } from "react-icons/hi2";

export interface AccountDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
}

interface AccountDetailsPanelProps {
  onBack: () => void;
  onSubmit: (details: AccountDetails) => void;
}

const STEPS: { key: keyof AccountDetails; question: string; placeholder: string; type?: string }[] = [
  { key: "firstName", question: "What's your first name?", placeholder: "e.g. Priya" },
  { key: "lastName", question: "And your last name?", placeholder: "e.g. Shah" },
  { key: "email", question: "What's the best email to reach you at?", placeholder: "you@example.com", type: "email" },
  { key: "phone", question: "And a phone number?", placeholder: "(555) 123-4567", type: "tel" },
  { key: "city", question: "Last one — what city are you in?", placeholder: "e.g. Cupertino" },
];

function AccountDetailsPanel({ onBack, onSubmit }: AccountDetailsPanelProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [details, setDetails] = useState<AccountDetails>({ firstName: "", lastName: "", email: "", phone: "", city: "" });
  const [value, setValue] = useState("");

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const answeredSoFar = STEPS.slice(0, stepIndex).map((s) => ({ q: s.question, a: details[s.key] }));

  const handleNext = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const updated = { ...details, [step.key]: trimmed };
    setDetails(updated);
    setValue("");
    if (isLast) {
      onSubmit(updated);
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold mb-3" style={{ color: "var(--outfield)" }}>
          <HiOutlineArrowLeft className="w-4 h-4" /> Back to chat
        </button>

        {/* progress dots */}
        <div className="flex gap-1.5 mb-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{ background: i <= stepIndex ? "var(--gold)" : "var(--pitch-deep)" }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto cca-chat-scroll px-5 py-3 space-y-3">
        {/* Recap of answered steps, chat-style, so it still feels conversational */}
        {answeredSoFar.map((qa, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-start">
              <div className="cca-bubble-bot max-w-[80%] text-[13px]">{qa.q}</div>
            </div>
            <div className="flex justify-end">
              <div className="cca-bubble-user max-w-[80%] text-[13px]">{qa.a}</div>
            </div>
          </div>
        ))}

        <AnimatePresence mode="wait">
          <motion.div
            key={step.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="flex justify-start"
          >
            <div className="cca-bubble-bot max-w-[80%] text-[13px]">{step.question}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t" style={{ borderColor: "var(--pitch-deep)" }}>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type={step.type || "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleNext(); }}
            placeholder={step.placeholder}
            className="flex-1 rounded-full border-2 px-4 py-2.5 text-sm outline-none focus:border-[var(--gold)] transition-colors bg-white"
            style={{ borderColor: "var(--pitch-deep)" }}
          />
          <button
            onClick={handleNext}
            disabled={!value.trim()}
            className="rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-40 transition-transform hover:scale-105 flex-shrink-0"
            style={{ background: "var(--gold)", color: "var(--outfield)" }}
          >
            {isLast ? "Continue" : "Next"}
          </button>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] mt-3" style={{ color: "var(--ink-400)" }}>
          <HiOutlineLockClosed className="w-3.5 h-3.5 flex-shrink-0" />
          You'll set your password on the secure signup page next — CCA never asks for it in chat.
        </p>
      </div>
    </div>
  );
}

export default AccountDetailsPanel;
