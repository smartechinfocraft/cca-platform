// ============================================================
//  components/chatbot/ChatbotRegistrationFlow.tsx
//
//  The fully-automated in-chat flow: Login/Register → pick a
//  Program → pick a Batch → enter player details → Review →
//  Add to Cart OR Pay (PayPal/Check) → Done.
//
//  Every step calls the SAME real backend endpoints the normal
//  website pages use (/public/auth/*, /public/programs,
//  /public/batches, /public/paypal/*, /public/register), so every
//  registration/payment made here shows up identically in the
//  database and in the Admin panel — nothing here is "fake".
// ============================================================
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineShoppingCart } from "react-icons/hi2";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import {
  chatLoginParent,
  chatRegisterParent,
  fetchChatPrograms,
  fetchChatBatches,
  createChatPaypalOrder,
  captureChatPaypalOrder,
  submitChatRegistration,
  type ChatProgram,
  type ChatBatch,
} from "../../services/chatbotService";

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

type Step =
  | "auth-choice" | "login" | "register"
  | "program" | "batch" | "student"
  | "review" | "payment" | "done";

interface Props {
  onBack: () => void;
  onClose: () => void;
  pushMessage: (content: string) => void;
  initialProgramId?: string | null;
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
      <div className="cca-bubble-bot max-w-[85%] text-[13px]">{children}</div>
    </motion.div>
  );
}

function OptionButton({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl px-4 py-3 mb-2 transition hover:scale-[1.01]"
      style={{ background: "var(--gold-glow)", border: "1px solid var(--pitch-deep)" }}
    >
      <p className="text-sm font-semibold" style={{ color: "var(--outfield)" }}>{label}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-400)" }}>{sub}</p>}
    </button>
  );
}

function TextField({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="mb-3">
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--ink-400)" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border-2 px-3 py-2 text-sm outline-none focus:border-[var(--gold)] bg-white"
        style={{ borderColor: "var(--pitch-deep)" }}
      />
    </div>
  );
}

function ChatbotRegistrationFlow({ onBack, onClose, pushMessage, initialProgramId }: Props) {
  const { user, token, isLoggedIn, login, register } = useAuth();
  const { addItem } = useCart();

  const [step, setStep] = useState<Step>(isLoggedIn ? "program" : "auth-choice");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // auth forms
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", city: "" });

  // program / batch
  const [programs, setPrograms] = useState<ChatProgram[] | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<ChatProgram | null>(null);
  const [batches, setBatches] = useState<ChatBatch[] | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<ChatBatch | null>(null);

  // student
  const [student, setStudent] = useState({ firstName: "", lastName: "", dob: "", gender: "" });

  // payment
  const [paymentMethod, setPaymentMethod] = useState<"PayPal" | "Check" | null>(null);
  const [checkNumber, setCheckNumber] = useState("");
  const [result, setResult] = useState<{ registrationNumber: string; programName: string; totalAmount: number; paymentStatus: string } | null>(null);

  const paypalRef = useRef<HTMLDivElement>(null);
  const paypalLoaded = useRef(false);

  // ── Load programs when entering the program step ──
  useEffect(() => {
    if (step === "program" && !programs) {
      fetchChatPrograms().then(setPrograms).catch(() => setError("Couldn't load programs right now."));
    }
  }, [step, programs]);

  // ── If a program was pre-picked (from a suggestion card), jump straight to batch selection ──
  useEffect(() => {
    if (initialProgramId && isLoggedIn && step === "program" && !selectedProgram) {
      fetchChatPrograms().then((list) => {
        const p = list.find((x) => x._id === initialProgramId);
        if (p) handlePickProgram(p);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load batches when a program is selected ──
  const handlePickProgram = (p: ChatProgram) => {
    setSelectedProgram(p);
    setError(null);
    setStep("batch");
    fetchChatBatches(p._id).then(setBatches).catch(() => setError("Couldn't load batches for this program."));
  };

  // ── PayPal button rendering — same pattern as the real PaymentPage ──
  useEffect(() => {
    if (step !== "payment" || paymentMethod !== "PayPal" || paypalLoaded.current) return;
    if (!PAYPAL_CLIENT_ID || !selectedProgram) return;

    const renderButtons = () => {
      if (!window.paypal) { setTimeout(renderButtons, 400); return; }
      if (!paypalRef.current) return;
      paypalLoaded.current = true;
      paypalRef.current.innerHTML = "";

      window.paypal.Buttons({
        style: { layout: "vertical", color: "blue", shape: "pill", label: "pay" },
        createOrder: async () => {
          const order = await createChatPaypalOrder({
            programId: selectedProgram._id,
            batchId: selectedBatch?._id,
            studentCount: 1,
            sessionsPerWeek: selectedBatch?.sessionsPerWeek,
          });
          return order.orderID;
        },
        onApprove: async (data: { orderID: string }) => {
          setSubmitting(true);
          setError(null);
          try {
            const capture = await captureChatPaypalOrder({
              orderID: data.orderID,
              programId: selectedProgram._id,
              batchId: selectedBatch?._id,
              studentCount: 1,
              sessionsPerWeek: selectedBatch?.sessionsPerWeek,
            });
            await finishRegistration("PayPal", capture.transactionId);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment failed.");
            setSubmitting(false);
          }
        },
        onError: () => setError("PayPal had a problem. Please try again."),
        onCancel: () => setError("Payment was cancelled."),
      }).render(paypalRef.current);
    };

    if (!window.paypal) {
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
      script.async = true;
      script.onload = renderButtons;
      document.body.appendChild(script);
    } else {
      renderButtons();
    }
  }, [step, paymentMethod, selectedProgram, selectedBatch]);

  // ── Auth handlers ──
  const doRegister = async () => {
    const { firstName, lastName, email, phone, password, city } = regForm;
    if (!firstName || !lastName || !email || !phone || !password) {
      setError("Please fill in all fields, including a password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await register({ firstName, lastName, email, phone, password, city });
      pushMessage(`Account created — welcome, ${firstName}! 🎉`);
      setStep("program");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  const doLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(loginForm.email, loginForm.password);
      pushMessage("Logged in successfully! 👋");
      setStep("program");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Final submit (Check, or after PayPal capture) ──
  const finishRegistration = async (method: "PayPal" | "Check", transactionId?: string) => {
    if (!selectedProgram) return;
    setSubmitting(true);
    setError(null);
    try {
      const parentInfo = user
        ? { parentName: `${user.firstName} ${user.lastName}`, email: user.email, phone: user.phone }
        : { parentName: `${regForm.firstName} ${regForm.lastName}`, email: regForm.email, phone: regForm.phone };

      const data = await submitChatRegistration(
        {
          selectedProgram: { _id: selectedProgram._id, title: selectedProgram.title },
          selectedBatch: selectedBatch ? { _id: selectedBatch._id, title: selectedBatch.title || selectedBatch.name, fee: selectedBatch.fee, sessionsPerWeek: selectedBatch.sessionsPerWeek } : undefined,
          students: [{ firstName: student.firstName, lastName: student.lastName, dob: student.dob, gender: student.gender }],
          parent: parentInfo,
          parentId: user?.id,
          sessionsPerWeek: selectedBatch?.sessionsPerWeek,
          paymentMethod: method,
          transactionId,
          checkNumber: method === "Check" ? checkNumber : undefined,
        },
        token
      );
      setResult({
        registrationNumber: data.registrationNumber,
        programName: data.programName,
        totalAmount: data.totalAmount,
        paymentStatus: data.paymentStatus,
      });
      setStep("done");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Add to cart instead of paying now ──
  const handleAddToCart = () => {
    if (!selectedProgram || !selectedBatch) return;
    addItem({
      programId: selectedProgram._id,
      programTitle: selectedProgram.title,
      programImage: selectedProgram.coverImageUrl,
      batchId: selectedBatch._id,
      batchName: selectedBatch.title || selectedBatch.name || "Batch",
      selectedMonth: "",
      selectedDays: selectedBatch.days || "",
      sessionsPerWeek: selectedBatch.sessionsPerWeek || 1,
      fee: selectedBatch.fee ?? selectedProgram.discountedPrice ?? selectedProgram.basePrice ?? 0,
      students: [{
        firstName: student.firstName, lastName: student.lastName, dob: student.dob,
        gender: student.gender, schoolName: "", medicalNotes: "",
      }],
    });
    pushMessage(`Added "${selectedProgram.title}" to your cart for ${student.firstName}. You can check out anytime from the cart icon, or come back here to pay now.`);
    onClose();
  };

  const price = selectedBatch?.fee ?? selectedProgram?.discountedPrice ?? selectedProgram?.basePrice ?? 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--outfield)" }}>
          <HiOutlineArrowLeft className="w-4 h-4" /> Back to chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto cca-chat-scroll px-5 py-3 space-y-3">

        {/* ── AUTH ── */}
        {step === "auth-choice" && (
          <>
            <Bubble>Let's get you registered 🏏 First — do you already have an account, or is this your first time?</Bubble>
            <OptionButton label="I already have an account" sub="Log in" onClick={() => setStep("login")} />
            <OptionButton label="I'm new here" sub="Create an account in chat" onClick={() => setStep("register")} />
          </>
        )}

        {step === "login" && (
          <>
            <Bubble>Welcome back! Log in to continue.</Bubble>
            <TextField label="Email" type="email" value={loginForm.email} onChange={(v) => setLoginForm({ ...loginForm, email: v })} placeholder="you@example.com" />
            <TextField label="Password" type="password" value={loginForm.password} onChange={(v) => setLoginForm({ ...loginForm, password: v })} placeholder="••••••••" />
            <button onClick={doLogin} disabled={submitting} className="cca-flow-btn">{submitting ? "Logging in…" : "Log In"}</button>
          </>
        )}

        {step === "register" && (
          <>
            <Bubble>Let's set up your parent account — including your password, right here.</Bubble>
            <TextField label="First name" value={regForm.firstName} onChange={(v) => setRegForm({ ...regForm, firstName: v })} placeholder="Priya" />
            <TextField label="Last name" value={regForm.lastName} onChange={(v) => setRegForm({ ...regForm, lastName: v })} placeholder="Shah" />
            <TextField label="Email" type="email" value={regForm.email} onChange={(v) => setRegForm({ ...regForm, email: v })} placeholder="you@example.com" />
            <TextField label="Phone" type="tel" value={regForm.phone} onChange={(v) => setRegForm({ ...regForm, phone: v })} placeholder="(555) 123-4567" />
            <TextField label="City" value={regForm.city} onChange={(v) => setRegForm({ ...regForm, city: v })} placeholder="Cupertino" />
            <TextField label="Set a password" type="password" value={regForm.password} onChange={(v) => setRegForm({ ...regForm, password: v })} placeholder="At least 6 characters" />
            <button onClick={doRegister} disabled={submitting} className="cca-flow-btn">{submitting ? "Creating account…" : "Create Account & Continue"}</button>
          </>
        )}

        {/* ── PROGRAM ── */}
        {step === "program" && (
          <>
            <Bubble>Great, {user?.firstName || regForm.firstName || "there"}! Which program would you like to register for?</Bubble>
            {!programs && <p className="text-xs" style={{ color: "var(--ink-400)" }}>Loading programs…</p>}
            {programs?.map((p) => (
              <OptionButton
                key={p._id}
                label={p.title}
                sub={p.discountedPrice ? `$${p.discountedPrice} (was $${p.basePrice})` : p.basePrice ? `$${p.basePrice}` : undefined}
                onClick={() => handlePickProgram(p)}
              />
            ))}
          </>
        )}

        {/* ── BATCH ── */}
        {step === "batch" && (
          <>
            <Bubble>Pick a batch / schedule for "{selectedProgram?.title}":</Bubble>
            {!batches && <p className="text-xs" style={{ color: "var(--ink-400)" }}>Loading batches…</p>}
            {batches?.length === 0 && <p className="text-xs" style={{ color: "var(--ink-400)" }}>No open batches right now — please check back soon.</p>}
            {batches?.map((b) => (
              <OptionButton
                key={b._id}
                label={`${b.title || b.name}${b.days ? ` — ${b.days}` : ""}`}
                sub={`${b.timing || ""}${b.timing ? " — " : ""}$${b.fee}`}
                onClick={() => { setSelectedBatch(b); setStep("student"); }}
              />
            ))}
          </>
        )}

        {/* ── STUDENT ── */}
        {step === "student" && (
          <>
            <Bubble>Now tell me about the player:</Bubble>
            <TextField label="Player first name" value={student.firstName} onChange={(v) => setStudent({ ...student, firstName: v })} placeholder="Arjun" />
            <TextField label="Player last name" value={student.lastName} onChange={(v) => setStudent({ ...student, lastName: v })} placeholder="Patel" />
            <TextField label="Date of birth" type="date" value={student.dob} onChange={(v) => setStudent({ ...student, dob: v })} />
            <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--ink-400)" }}>Gender</p>
            <div className="flex gap-2 mb-3">
              {["Male", "Female", "Other"].map((g) => (
                <button
                  key={g}
                  onClick={() => setStudent({ ...student, gender: g })}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: student.gender === g ? "var(--gold)" : "var(--gold-glow)",
                    color: "var(--outfield)",
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              onClick={() => student.firstName && student.lastName && setStep("review")}
              disabled={!student.firstName || !student.lastName}
              className="cca-flow-btn"
            >
              Continue to Review
            </button>
          </>
        )}

        {/* ── REVIEW ── */}
        {step === "review" && (
          <>
            <Bubble>Here's a quick summary — looks good?</Bubble>
            <div className="rounded-2xl p-4 mb-3 text-sm space-y-1.5" style={{ background: "var(--gold-glow)" }}>
              <p><strong>Program:</strong> {selectedProgram?.title}</p>
              <p><strong>Batch:</strong> {selectedBatch?.title || selectedBatch?.name}</p>
              <p><strong>Player:</strong> {student.firstName} {student.lastName}</p>
              <p><strong>Total:</strong> ${price}</p>
            </div>
            <button onClick={() => setStep("payment")} className="cca-flow-btn">Pay & Register Now</button>
            <button
              onClick={handleAddToCart}
              className="cca-flow-btn-outline flex items-center justify-center gap-2"
            >
              <HiOutlineShoppingCart className="w-4 h-4" /> Add to Cart Instead
            </button>
          </>
        )}

        {/* ── PAYMENT ── */}
        {step === "payment" && (
          <>
            <Bubble>How would you like to pay (${price})?</Bubble>
            {!paymentMethod && (
              <>
                <OptionButton label="Pay with PayPal" sub="Fast & secure online payment" onClick={() => setPaymentMethod("PayPal")} />
                <OptionButton label="Pay by Check" sub="Mail a check, spot held 7 days" onClick={() => setPaymentMethod("Check")} />
              </>
            )}

            {paymentMethod === "PayPal" && (
              <div className="mb-3">
                <div ref={paypalRef} className="min-h-[120px] flex items-center justify-center">
                  <p className="text-xs" style={{ color: "var(--ink-400)" }}>Loading PayPal…</p>
                </div>
              </div>
            )}

            {paymentMethod === "Check" && (
              <div className="mb-3">
                <TextField label="Check number (optional)" value={checkNumber} onChange={setCheckNumber} placeholder="1234" />
                <button onClick={() => finishRegistration("Check")} disabled={submitting} className="cca-flow-btn">
                  {submitting ? "Submitting…" : "Submit Registration"}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── DONE ── */}
        {step === "done" && result && (
          <div className="text-center py-4">
            <HiOutlineCheckCircle className="w-12 h-12 mx-auto mb-2" style={{ color: "var(--gold)" }} />
            <p className="font-display font-semibold text-base" style={{ color: "var(--outfield)" }}>
              {result.paymentStatus === "SUCCESS" ? "Registration Complete! 🎉" : "Registration Received!"}
            </p>
            <p className="text-sm mt-2" style={{ color: "var(--ink-400)" }}>
              Confirmation #{result.registrationNumber} for {result.programName} — ${result.totalAmount}.
            </p>
            <button onClick={onClose} className="cca-flow-btn mt-4">Done</button>
          </div>
        )}

        {error && (
          <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "#fee2e2", color: "#991b1b" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatbotRegistrationFlow;
