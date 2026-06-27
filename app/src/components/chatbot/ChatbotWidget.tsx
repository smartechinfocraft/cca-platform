// ============================================================
//  components/chatbot/ChatbotWidget.tsx
//
//  "CCA" — the academy's animated assistant chatbot. Mounted once
//  globally (see App.tsx). Talks via the Groq-backed
//  /api/public/chatbot/* routes. Anything it tells the user about
//  programs/FAQs is grounded in real data (see chatbot.js backend
//  route), and any action it takes (register, message a coach)
//  hands off to the app's real flows — it never fakes a result.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  HiOutlineSparkles, HiOutlineXMark, HiOutlinePaperAirplane, HiOutlineArrowPath,
} from "react-icons/hi2";
import { useAuth } from "../../context/AuthContext";
import { sendChatMessage, type ChatMessage } from "../../services/chatbotService";
import QuickActions from "./QuickActions";
import FitnessPanel from "./FitnessPanel";
import ProgramSuggestions from "./ProgramSuggestions";
import AccountDetailsPanel, { type AccountDetails } from "./AccountDetailsPanel";

export interface BotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  // Set on an assistant message when we detected age+skill in the
  // PRECEDING user message — renders program cards right after it,
  // once, instead of re-scanning the whole transcript every render.
  suggest?: { age: number; skillLevel: string };
}

const WELCOME = (name?: string) =>
  name
    ? `Hey ${name}! 👋 I'm CCA, your assistant here. Want help finding a program, checking your registration, or anything else?`
    : `Hyy! 👋 I'm CCA — California Cricket Academy's assistant. I can help you find the right program, walk you through registering, answer FAQs, or even help with fitness tips. What's up?`;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Light heuristic: does this message contain a plausible player age
// AND some skill-level language? If so we attach a suggestion card
// to the NEXT assistant reply. This never replaces the LLM's own
// answer — it just adds real, deterministic program cards alongside it.
function detectAgeAndSkill(text: string): { age: number; skillLevel: string } | null {
  const ageMatch = text.match(/\b(\d{1,2})\b/);
  if (!ageMatch) return null;
  const age = parseInt(ageMatch[1], 10);
  if (age < 4 || age > 19) return null;

  const skillMatch = text.match(/beginner|intermediate|advanced|pro\b|just start|basic|decent|new to|not pro|70%|80%|90%/i);
  let skillLevel = "BEGINNER";
  if (skillMatch) {
    const s = skillMatch[0].toLowerCase();
    if (s.includes("adv") || s === "pro") skillLevel = "ADVANCED";
    else if (s.includes("inter") || s.includes("decent") || /\d/.test(s)) skillLevel = "INTERMEDIATE";
  }
  return { age, skillLevel };
}

// Pages where the widget shouldn't appear — staff have their own tools.
function isHiddenOnPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/coach");
}

function ChatbotWidget() {
  const { user, token, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "fitness" | "account">("chat");
  const [pendingProgramId, setPendingProgramId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>(() => [
    { id: uid(), role: "assistant", content: WELCOME(user?.firstName) },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, view]);

  // Lock page scroll while the panel is open — the blur backdrop
  // handles the visual side, this stops the page scrolling behind it.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  if (isHiddenOnPath(location.pathname)) return null;

  const pushMessage = (m: Omit<BotMessage, "id">) =>
    setMessages((prev) => [...prev, { ...m, id: uid() }]);

  const handleReset = () => {
    setMessages([{ id: uid(), role: "assistant", content: WELCOME(user?.firstName) }]);
    setView("chat");
  };

  const askGroq = async (history: BotMessage[], pendingSuggest?: { age: number; skillLevel: string } | null) => {
    setSending(true);
    try {
      const apiHistory: ChatMessage[] = history.map((m) => ({ role: m.role, content: m.content }));
      const reply = await sendChatMessage(apiHistory, token);
      pushMessage({ role: "assistant", content: reply, suggest: pendingSuggest ?? undefined });
    } catch (err) {
      pushMessage({
        role: "assistant",
        content: "Sorry, I had trouble reaching my brain just now 🙈 — mind trying that again in a moment?",
      });
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const content = (textOverride ?? input).trim();
    if (!content || sending) return;
    setInput("");
    const next = [...messages, { id: uid(), role: "user" as const, content }];
    setMessages(next);
    await askGroq(next, detectAgeAndSkill(content));
  };

  // ── Quick action handlers ──────────────────────────────────
  const handleQuickAction = (action: string) => {
    switch (action) {
      case "register":
        if (isLoggedIn) {
          pushMessage({ role: "assistant", content: "You're already logged in! Head to Programs and pick one — registration continues right from there." });
          setOpen(false);
          navigate("/programs");
        } else {
          pushMessage({ role: "user", content: "I want to register" });
          pushMessage({
            role: "assistant",
            content:
              "Awesome 🏏 Let's get the player's details first, then I'll suggest a good program for them. Tap below whenever you're ready.",
          });
        }
        break;
      case "faq": {
        const askText = "Can you answer some frequently asked questions about CCA based on the real FAQ list?";
        pushMessage({ role: "user", content: "I have a question about CCA" });
        const next = [...messages, { id: uid(), role: "user" as const, content: askText }];
        askGroq(next);
        break;
      }
      case "profile":
        if (!isLoggedIn) {
          pushMessage({ role: "assistant", content: "You'll need to log in first to see your profile and registration status. Tap below to log in." });
        } else {
          setOpen(false);
          navigate("/dashboard");
        }
        break;
      case "coach":
        if (!isLoggedIn) {
          pushMessage({ role: "assistant", content: "Chatting with your coach or our admin team is available once you're logged in and enrolled in a batch — that's how we make sure messages reach the right person." });
        } else {
          setOpen(false);
          navigate("/dashboard/messages");
        }
        break;
      case "fitness":
        setView("fitness");
        break;
      case "reset":
        handleReset();
        break;
      case "go-login":
        setOpen(false);
        navigate("/login");
        break;
      default:
        break;
    }
  };

  const handlePickProgram = (programId: string) => {
    if (isLoggedIn) {
      setOpen(false);
      navigate(`/register-program/${programId}`);
    } else {
      setPendingProgramId(programId);
      setView("account");
    }
  };

  return createPortal(
    <>
      {/* ── Floating launcher ── */}
      {!open && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.3 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setOpen(true)}
          className="cca-chat-fab"
          aria-label="Open CCA chat assistant"
        >
          <span className="cca-chat-fab-ring" />
          <HiOutlineSparkles className="w-7 h-7" />
        </motion.button>
      )}

      {/* ── Backdrop + Panel ── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="cca-chat-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
            />

            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="fixed z-[100] bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[400px] h-[100dvh] sm:h-[640px] sm:max-h-[88vh] flex flex-col overflow-hidden sm:rounded-3xl"
              style={{ background: "var(--pitch)", boxShadow: "0 24px 70px rgba(31,46,30,0.35)" }}
            >
              {/* Header */}
              <div
                className="relative px-5 py-4 flex items-center justify-between flex-shrink-0"
                style={{ background: "linear-gradient(135deg, var(--outfield), var(--outfield-soft))" }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-display font-semibold text-sm"
                      style={{ background: "var(--gold)", color: "var(--outfield)" }}
                    >
                      CCA
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                      style={{ background: "var(--grass-light)", borderColor: "var(--outfield)" }}
                    />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-white text-sm leading-tight">CCA Assistant</p>
                    <p className="text-[11px] text-white/55">Online · usually replies instantly</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={handleReset} title="Reset chat" className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                    <HiOutlineArrowPath className="w-4 h-4" />
                  </button>
                  <button onClick={() => setOpen(false)} title="Close" className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                    <HiOutlineXMark className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </div>

              {/* Body */}
              {view === "fitness" ? (
                <FitnessPanel onBack={() => setView("chat")} />
              ) : view === "account" ? (
                <AccountDetailsPanel
                  onBack={() => setView("chat")}
                  onSubmit={(details: AccountDetails) => {
                    setOpen(false);
                    const target = pendingProgramId ? `/register-program/${pendingProgramId}` : "/dashboard";
                    navigate("/login", { state: { mode: "parent-register", from: target, prefill: details } });
                  }}
                />
              ) : (
                <>
                  <div ref={scrollRef} className="cca-chat-scroll flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {messages.map((m, idx) => (
                      <div key={m.id}>
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {m.role === "assistant" && (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mr-2 flex-shrink-0 mt-0.5"
                              style={{ background: "var(--gold-glow)", color: "var(--outfield)" }}
                            >
                              CCA
                            </div>
                          )}
                          <div className={`max-w-[78%] ${m.role === "user" ? "cca-bubble-user" : "cca-bubble-bot"}`}>
                            {m.content}
                          </div>
                        </motion.div>

                        {m.role === "assistant" && m.suggest && (
                          <div className="mt-2 ml-9">
                            <ProgramSuggestions age={m.suggest.age} skillLevel={m.suggest.skillLevel} onPick={handlePickProgram} />
                          </div>
                        )}

                        {/* One-off CTA chip right after the "let's get details" register prompt */}
                        {m.role === "assistant" && idx === messages.length - 1 && !isLoggedIn && m.content.includes("Tap below whenever you're ready") && (
                          <div className="mt-2 ml-9">
                            <button
                              onClick={() => setView("account")}
                              className="rounded-full px-4 py-2 text-xs font-semibold"
                              style={{ background: "var(--gold)", color: "var(--outfield)" }}
                            >
                              Enter Player &amp; Parent Details →
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {sending && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mr-2 flex-shrink-0" style={{ background: "var(--gold-glow)", color: "var(--outfield)" }}>
                          CCA
                        </div>
                        <div className="cca-bubble-bot flex items-center gap-1.5 py-3">
                          <span className="cca-typing-dot" /><span className="cca-typing-dot" /><span className="cca-typing-dot" />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Quick actions */}
                  <QuickActions onAction={handleQuickAction} isLoggedIn={isLoggedIn} />

                  {/* Composer */}
                  <div className="px-3 pb-3 pt-2 flex items-end gap-2 flex-shrink-0" style={{ background: "var(--pitch)" }}>
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSend(); }}
                      placeholder="Ask CCA anything…"
                      disabled={sending}
                      className="flex-1 rounded-full border-2 px-4 py-2.5 text-sm outline-none focus:border-[var(--gold)] transition-colors bg-white"
                      style={{ borderColor: "var(--pitch-deep)" }}
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={sending || !input.trim()}
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-transform hover:scale-105"
                      style={{ background: "var(--gold)", color: "var(--outfield)" }}
                    >
                      <HiOutlinePaperAirplane className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}

export default ChatbotWidget;
