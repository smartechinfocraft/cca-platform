// ============================================================
//  components/chatbot/ChatbotRegistrationFlow.tsx
//
//  The fully-automated in-chat flow, matching the REAL site flow
//  step-for-step: Login/Register → Program (search + city/age/
//  season filters) → Batch → Month → Frequency → Days → Player
//  details → Billing/Address → Review → Pay (PayPal/Check) or Add
//  to Cart → Done.
//
//  - A step-history stack powers per-step "Back" (no more landing
//    back at the chatbot homepage mid-flow).
//  - A progress bar up top shows how far through the flow you are.
//
//  Every step calls the SAME real backend endpoints the normal
//  website pages use, so every registration/payment made here
//  shows up identically in the database and Admin panel.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineShoppingCart } from "react-icons/hi2";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import WaiverConsent from "../registration/WaiverConsent";
import WeeklyBatchSelector from "../registration/WeeklyBatchSelector";
import { WAIVER_AGREEMENT_VERSION } from "../../constants/waiverAgreement";
import { calcWeeklyPrice, toWeeklyBatchSnapshots, formatWeekRangeLabel, type WeeklyBatchRaw } from "../../utils/weeklyBatch";
import {
  fetchChatPrograms,
  fetchChatProgramDetail,
  fetchChatCategories,
  createChatPaypalOrder,
  captureChatPaypalOrder,
  submitChatRegistration,
  type ChatProgram,
  type ChatBatch,
  type ChatMonthOption,
  type ChatCategory,
} from "../../services/chatbotService";

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

// ── Day-slot helpers (mirrors ProgramDetails.tsx logic) ──
const DAY_FULL: Record<string, string> = {
  MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
  FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
};
function fmt12(t?: string): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr ?? "00"} ${ampm}`;
}
function buildDaySlotOptions(batch: ChatBatch): string[] {
  const slot = batch.timeSlots && batch.timeSlots.length > 0 ? batch.timeSlots[0] : null;
  const locationSuffix = batch.locationLabel ? ` - ${batch.locationLabel}` : "";
  let days: string[] = [];
  if (batch.multiDays && batch.multiDays.length > 0) days = batch.multiDays.map((d) => DAY_FULL[d] ?? d);
  else if (batch.dayOfWeek && batch.dayOfWeek !== "MULTI") days = [DAY_FULL[batch.dayOfWeek] ?? batch.dayOfWeek];
  if (days.length === 0) return [];
  return days.map((day) => (slot ? `${day} - ${fmt12(slot.startTime)} - ${fmt12(slot.endTime)}${locationSuffix}` : `${day}${locationSuffix}`));
}
function freqLabel(n: number): string {
  const m: Record<number, string> = { 1: "Once a Week", 2: "Twice a Week", 3: "Thrice a Week" };
  return m[n] ?? `${n} times a Week`;
}
// Normalizes batchType comparisons — protects against stray whitespace/casing
// coming back from the API so the WEEKLY step is never silently skipped.
function isWeekly(batchType?: string | null): boolean {
  return (batchType ?? "").toString().trim().toUpperCase() === "WEEKLY";
}

type Step =
  | "auth-choice" | "login" | "register"
  | "program" | "batch" | "weekly" | "month" | "frequency" | "days"
  | "student" | "billing"
  | "review" | "payment" | "done";

// Maps every step to a "phase" used by the progress bar (several
// steps — batch/weekly/month/frequency/days — collapse into one phase).
const PHASES: { key: string; label: string; steps: Step[] }[] = [
  { key: "account",  label: "Account",  steps: ["auth-choice", "login", "register"] },
  { key: "program",  label: "Program",  steps: ["program"] },
  { key: "schedule", label: "Schedule", steps: ["batch", "weekly", "month", "frequency", "days"] },
  { key: "player",   label: "Player",   steps: ["student"] },
  { key: "billing",  label: "Billing",  steps: ["billing"] },
  { key: "review",   label: "Review",   steps: ["review"] },
  { key: "payment",  label: "Payment",  steps: ["payment"] },
  { key: "done",     label: "Done",     steps: ["done"] },
];
function phaseIndexFor(step: Step): number {
  const i = PHASES.findIndex((p) => p.steps.includes(step));
  return i === -1 ? 0 : i;
}

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

function OptionButton({ label, sub, onClick, selected }: { label: string; sub?: string; onClick: () => void; selected?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl px-4 py-3 mb-2 transition hover:scale-[1.01]"
      style={{
        background: selected ? "var(--gold)" : "var(--gold-glow)",
        border: "1px solid var(--pitch-deep)",
      }}
    >
      <p className="text-sm font-semibold" style={{ color: "var(--outfield)" }}>{label}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: selected ? "var(--outfield)" : "var(--ink-400)" }}>{sub}</p>}
    </button>
  );
}

function TextField({
  label, value, onChange, placeholder, type = "text", required = false,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div className="mb-3">
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--ink-400)" }}>
        {label}{required && <span style={{ color: "#c0392b" }}> *</span>}
      </label>
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

// ── Progress bar shown at the top of every step ──
function ProgressBar({ step }: { step: Step }) {
  const idx = phaseIndexFor(step);
  const percent = Math.round(((idx + 1) / PHASES.length) * 100);
  return (
    <div className="px-5 pb-2">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold" style={{ color: "var(--outfield)" }}>
          Step {idx + 1} of {PHASES.length} — {PHASES[idx].label}
        </p>
        <p className="text-[11px]" style={{ color: "var(--ink-400)" }}>{percent}% complete</p>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--pitch-deep)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--gold)" }}
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}

function ChatbotRegistrationFlow({ onBack, onClose, pushMessage, initialProgramId }: Props) {
  const { user, token, isLoggedIn, login, register } = useAuth();
  const { addItem } = useCart();

  const initialStep: Step = isLoggedIn ? "program" : "auth-choice";
  const [step, setStep] = useState<Step>(initialStep);
  const [stepStack, setStepStack] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forward navigation — remembers where we came from for Back.
  const goTo = (next: Step) => {
    setError(null);
    setStepStack((prev) => [...prev, step]);
    setStep(next);
  };
  // Back navigation — steps back through history; only exits to the
  // main chat once there's nowhere left to go back to.
  const goBack = () => {
    setError(null);
    setStepStack((prev) => {
      if (prev.length === 0) {
        onBack();
        return prev;
      }
      const next = [...prev];
      const last = next.pop() as Step;
      setStep(last);
      return next;
    });
  };

  // auth forms
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", city: "" });

  // program / filters
  const [programs, setPrograms] = useState<ChatProgram[] | null>(null);
  const [cities, setCities] = useState<string[] | null>(null);
  const [categories, setCategories] = useState<ChatCategory[] | null>(null);
  const [cityFilter, setCityFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [selectedProgram, setSelectedProgram] = useState<ChatProgram | null>(null);

  // batch / schedule
  const [batches, setBatches] = useState<ChatBatch[] | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<ChatBatch | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<ChatMonthOption | null>(null);
  const [frequency, setFrequency] = useState(1);
  const [daySlots, setDaySlots] = useState<(string | null)[]>([null]);

  // ── WEEKLY batchType: multi-select batches, price = basePrice × count ──
  // Same logic/component as the main site and Quick Register drawer.
  const [weeklyBatches, setWeeklyBatches] = useState<WeeklyBatchRaw[]>([]);
  const [selectedWeeklyBatchIds, setSelectedWeeklyBatchIds] = useState<string[]>([]);
  const isWeeklyProgram = isWeekly(selectedProgram?.batchType);

  // student
  const [student, setStudent] = useState({ firstName: "", lastName: "", dob: "", gender: "", schoolName: "" });

  // billing / address
  const [billing, setBilling] = useState({ address: "", city: "", state: "", zip: "" });

  // payment
  const [paymentMethod, setPaymentMethod] = useState<"PayPal" | "Check" | null>(null);
  const [checkNumber, setCheckNumber] = useState("");
  const [result, setResult] = useState<{ registrationNumber: string; programName: string; totalAmount: number; paymentStatus: string } | null>(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [waiverSignature, setWaiverSignature] = useState("");
  const [waiverDrawnSignature, setWaiverDrawnSignature] = useState("");
  const [waiverError, setWaiverError] = useState<string | null>(null);
  const waiverValid = waiverAccepted && Boolean(waiverSignature.trim()) && Boolean(waiverDrawnSignature);

  const paypalRef = useRef<HTMLDivElement>(null);
  const paypalLoaded = useRef(false);

  // Reset PayPal render state whenever we leave the payment step
  // (e.g. via Back), so it renders fresh if the user returns to it.
  useEffect(() => {
    if (step !== "payment") {
      paypalLoaded.current = false;
    }
  }, [step]);

  // ── Load programs + filter data when entering the program step ──
  useEffect(() => {
    if (step !== "program") return;
    if (!programs) fetchChatPrograms().then(setPrograms).catch(() => setError("Couldn't load programs right now."));
    if (!categories) fetchChatCategories().then(setCategories).catch(() => setCategories([]));
  }, [step, programs, categories]);

  // Cities are derived client-side once programs are loaded.
  useEffect(() => {
    if (!programs) return;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of programs) {
      const c = p.location?.city;
      if (c && !seen.has(c)) { seen.add(c); out.push(c); }
    }
    setCities(out);
  }, [programs]);

  // ── If a program was pre-picked (from a suggestion card), jump straight to batch selection ──
  useEffect(() => {
    if (initialProgramId && isLoggedIn) {
      fetchChatPrograms().then((list) => {
        const p = list.find((x) => x._id === initialProgramId);
        if (p) handlePickProgram(p);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Program → Batch (or Weekly Select-Batch/Select-Week for WEEKLY programs) ──
  const handlePickProgram = (p: ChatProgram) => {
    setSelectedProgram(p);
    setBatches(null);
    setWeeklyBatches([]);
    setSelectedWeeklyBatchIds([]);
    goTo(isWeekly(p.batchType) ? "weekly" : "batch");
    fetchChatProgramDetail(p._id)
      .then(({ batches: b, weeklyBatches: wb }) => {
        setBatches(b);
        setWeeklyBatches(wb);
      })
      .catch(() => setError("Couldn't load batches for this program."));
  };

  // ── Batch → (Month |) Frequency | Days ──
  const handlePickBatch = (b: ChatBatch) => {
    setSelectedBatch(b);
    setSelectedMonth(null);
    setFrequency(1);
    setDaySlots([null]);
    if (b.monthOptions && b.monthOptions.length > 0) {
      goTo("month");
    } else {
      proceedAfterMonth(b, null);
    }
  };

  const handlePickMonth = (b: ChatBatch, m: ChatMonthOption) => {
    setSelectedMonth(m);
    proceedAfterMonth(b, m);
  };

  const proceedAfterMonth = (b: ChatBatch, _m: ChatMonthOption | null) => {
    const maxFreq = b.sessionsPerWeek ?? 1;
    setFrequency(1);
    setDaySlots([null]);
    if (maxFreq > 1) goTo("frequency");
    else goTo("days");
  };

  const handlePickFrequency = (n: number) => {
    setFrequency(n);
    setDaySlots(Array(n).fill(null));
    goTo("days");
  };

  const dayOptions = selectedBatch ? buildDaySlotOptions(selectedBatch) : [];
  const allDaySlotsSelected = dayOptions.length === 0 || daySlots.every((s) => s !== null);

  // ── WEEKLY batchType: price = program basePrice × number of weeks picked ──
  const weeklyBasePrice = selectedProgram?.discountedPrice ?? selectedProgram?.basePrice ?? 0;
  const weeklyTotalPrice = calcWeeklyPrice(weeklyBasePrice, selectedWeeklyBatchIds);
  const weeklySnapshots = isWeeklyProgram ? toWeeklyBatchSnapshots(weeklyBatches, selectedWeeklyBatchIds) : [];

  const handleWeeklyContinue = () => {
    if (selectedWeeklyBatchIds.length === 0) return;
    goTo("student");
  };

  // ── Fee calculation — month price × frequency, same as the real site ──
  const monthPrice = selectedMonth ? Number(selectedMonth.price) || 0 : 0;
  const computedFee = isWeeklyProgram
    ? weeklyTotalPrice
    : selectedMonth
      ? monthPrice * frequency
      : (selectedBatch?.fee ?? selectedProgram?.discountedPrice ?? selectedProgram?.basePrice ?? 0);

  // ── PayPal button rendering ──
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
            sessionsPerWeek: frequency,
            weeklyBatchIds: isWeeklyProgram ? selectedWeeklyBatchIds : undefined,
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
              sessionsPerWeek: frequency,
              weeklyBatchIds: isWeeklyProgram ? selectedWeeklyBatchIds : undefined,
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
  }, [step, paymentMethod, selectedProgram, selectedBatch, frequency, isWeeklyProgram, selectedWeeklyBatchIds]);

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
      goTo("program");
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
      goTo("program");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Final submit (Check, or after PayPal capture) ──
  const finishRegistration = async (method: "PayPal" | "Check", transactionId?: string) => {
    if (!selectedProgram) return;
    if (!waiverValid) {
      setWaiverError("Please accept the waiver, type your e-signature, and draw your digital signature before registering.");
      setStep("review");
      return;
    }
    setSubmitting(true);
    setError(null);
    setWaiverError(null);
    try {
      const parentInfo = {
        parentName: user ? `${user.firstName} ${user.lastName}` : `${regForm.firstName} ${regForm.lastName}`,
        email: user?.email || regForm.email,
        phone: user?.phone || regForm.phone,
        address: billing.address,
        city: billing.city || regForm.city,
        state: billing.state,
        zip: billing.zip,
      };

      const data = await submitChatRegistration(
        {
          selectedProgram: { _id: selectedProgram._id, title: selectedProgram.title },
          selectedBatch: !isWeeklyProgram && selectedBatch
            ? { _id: selectedBatch._id, title: selectedBatch.title || selectedBatch.name, fee: computedFee, sessionsPerWeek: frequency }
            : undefined,
          selectedWeeklyBatches: isWeeklyProgram ? weeklySnapshots : undefined,
          students: [{ firstName: student.firstName, lastName: student.lastName, dob: student.dob, gender: student.gender, schoolName: student.schoolName }],
          parent: parentInfo,
          parentId: user?.id,
          sessionsPerWeek: isWeeklyProgram ? undefined : frequency,
          paymentMethod: method,
          transactionId,
          checkNumber: method === "Check" ? checkNumber : undefined,
          waiverConsent: {
            accepted: waiverAccepted,
            signature: waiverSignature.trim(),
            drawnSignature: waiverDrawnSignature,
            agreementVersion: WAIVER_AGREEMENT_VERSION,
          },
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
      setStepStack([]);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Add to cart instead of paying now ──
  // NOTE: the cart currently only supports the single-batch flow — WEEKLY
  // programs (multi-week selection) always pay/register immediately, so
  // this button is hidden for them in the Review step below.
  const handleAddToCart = () => {
    if (!selectedProgram || !selectedBatch || isWeeklyProgram) return;
    addItem({
      programId: selectedProgram._id,
      programTitle: selectedProgram.title,
      programImage: selectedProgram.coverImageUrl,
      batchId: selectedBatch._id,
      batchName: selectedBatch.title || selectedBatch.name || "Batch",
      selectedMonth: selectedMonth?.label || "",
      selectedDays: daySlots.filter(Boolean).join(" + "),
      sessionsPerWeek: frequency,
      fee: computedFee,
      students: [{
        firstName: student.firstName, lastName: student.lastName, dob: student.dob,
        gender: student.gender, schoolName: student.schoolName, medicalNotes: "",
      }],
    });
    pushMessage(`Added "${selectedProgram.title}" to your cart for ${student.firstName}. You can check out anytime from the cart icon, or come back here to pay now.`);
    onClose();
  };

  // ── Filtered program list ──
  const filteredPrograms = (programs || []).filter((p) => {
    const matchesCity = !cityFilter || p.location?.city === cityFilter;
    const matchesAge = !ageFilter || (p.ageGroups || []).some((g) => g === ageFilter);
    const matchesSeason = !seasonFilter || p.category?._id === seasonFilter;
    const matchesSearch = !searchText.trim() || p.title.toLowerCase().includes(searchText.trim().toLowerCase());
    return matchesCity && matchesAge && matchesSeason && matchesSearch;
  });
  const allAgeGroups = Array.from(new Set((programs || []).flatMap((p) => p.ageGroups || [])));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header: Back + progress bar (always visible, every step) */}
      <div className="pt-4 flex-shrink-0">
        <div className="px-5 mb-2">
          <button onClick={goBack} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--outfield)" }}>
            <HiOutlineArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
        <ProgressBar step={step} />
      </div>

      <div className="flex-1 overflow-y-auto cca-chat-scroll px-5 py-3 space-y-3">

        {/* ── AUTH ── */}
        {step === "auth-choice" && (
          <>
            <Bubble>Let's get you registered 🏏 First — do you already have an account, or is this your first time?</Bubble>
            <OptionButton label="I already have an account" sub="Log in" onClick={() => goTo("login")} />
            <OptionButton label="I'm new here" sub="Create an account in chat" onClick={() => goTo("register")} />
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

        {/* ── PROGRAM — search + city / age / season filters ── */}
        {step === "program" && (
          <>
            <Bubble>Great, {user?.firstName || regForm.firstName || "there"}! Which program would you like to register for?</Bubble>

            {!programs && <p className="text-xs" style={{ color: "var(--ink-400)" }}>Loading programs…</p>}

            {programs && (
              <>
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search programs…"
                  className="w-full rounded-xl border-2 px-3 py-2 text-sm outline-none focus:border-[var(--gold)] bg-white mb-2"
                  style={{ borderColor: "var(--pitch-deep)" }}
                />

                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--outfield)" }}
                >
                  {showFilters ? "Hide filters ▲" : "Filter by city / age group / season ▼"}
                </button>

                {showFilters && (
                  <div className="mb-3 space-y-2">
                    {cities && cities.length > 0 && (
                      <div>
                        <p className="text-[10.5px] font-semibold mb-1" style={{ color: "var(--ink-400)" }}>City</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                          <button onClick={() => setCityFilter("")} className="px-3 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                            style={{ background: cityFilter === "" ? "var(--gold)" : "var(--gold-glow)", color: "var(--outfield)" }}>All</button>
                          {cities.map((c) => (
                            <button key={c} onClick={() => setCityFilter(c)} className="px-3 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                              style={{ background: cityFilter === c ? "var(--gold)" : "var(--gold-glow)", color: "var(--outfield)" }}>{c}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {allAgeGroups.length > 0 && (
                      <div>
                        <p className="text-[10.5px] font-semibold mb-1" style={{ color: "var(--ink-400)" }}>Age Group</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                          <button onClick={() => setAgeFilter("")} className="px-3 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                            style={{ background: ageFilter === "" ? "var(--gold)" : "var(--gold-glow)", color: "var(--outfield)" }}>All</button>
                          {allAgeGroups.map((g) => (
                            <button key={g} onClick={() => setAgeFilter(g)} className="px-3 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                              style={{ background: ageFilter === g ? "var(--gold)" : "var(--gold-glow)", color: "var(--outfield)" }}>{g}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {categories && categories.length > 0 && (
                      <div>
                        <p className="text-[10.5px] font-semibold mb-1" style={{ color: "var(--ink-400)" }}>Season</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                          <button onClick={() => setSeasonFilter("")} className="px-3 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                            style={{ background: seasonFilter === "" ? "var(--gold)" : "var(--gold-glow)", color: "var(--outfield)" }}>All</button>
                          {categories.map((c) => (
                            <button key={c._id} onClick={() => setSeasonFilter(c._id)} className="px-3 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                              style={{ background: seasonFilter === c._id ? "var(--gold)" : "var(--gold-glow)", color: "var(--outfield)" }}>{c.title}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[11px] mb-2" style={{ color: "var(--ink-400)" }}>
                  {filteredPrograms.length} program{filteredPrograms.length !== 1 ? "s" : ""} found
                </p>

                {filteredPrograms.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--ink-400)" }}>No programs match these filters — try clearing one.</p>
                )}

                {filteredPrograms.map((p) => (
                  <OptionButton
                    key={p._id}
                    label={p.title}
                    sub={`${p.location?.title ? `📍 ${p.location.title} — ` : ""}${p.discountedPrice ? `$${p.discountedPrice} (was $${p.basePrice})` : p.basePrice ? `$${p.basePrice}` : ""}`}
                    onClick={() => handlePickProgram(p)}
                  />
                ))}
              </>
            )}
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
                label={b.title || b.name || "Batch"}
                sub={b.locationLabel || (b.fee ? `$${b.fee}` : undefined)}
                onClick={() => handlePickBatch(b)}
              />
            ))}
          </>
        )}

        {/* ── WEEKLY (batchType = WEEKLY) — Select Batch → Select Week(s) ── */}
        {step === "weekly" && (
          <>
            <Bubble>Select the batch and week(s) for "{selectedProgram?.title}":</Bubble>
            {weeklyBatches.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--ink-400)" }}>Loading batches…</p>
            ) : (
              <div className="mb-3 rounded-2xl bg-white p-1">
                <WeeklyBatchSelector
                  batches={weeklyBatches}
                  basePrice={weeklyBasePrice}
                  selectedIds={selectedWeeklyBatchIds}
                  onChange={setSelectedWeeklyBatchIds}
                />
              </div>
            )}
            <button onClick={handleWeeklyContinue} disabled={selectedWeeklyBatchIds.length === 0} className="cca-flow-btn">
              Continue — Player Details
            </button>
          </>
        )}

        {/* ── MONTH ── */}
        {step === "month" && selectedBatch && (
          <>
            <Bubble>Which month would you like to start?</Bubble>
            {(selectedBatch.monthOptions || []).map((m, i) => (
              <OptionButton
                key={i}
                label={m.label}
                sub={m.price ? `$${m.price}` : undefined}
                onClick={() => handlePickMonth(selectedBatch, m)}
              />
            ))}
          </>
        )}

        {/* ── FREQUENCY ── */}
        {step === "frequency" && selectedBatch && (
          <>
            <Bubble>How many times a week?</Bubble>
            {Array.from({ length: selectedBatch.sessionsPerWeek ?? 1 }, (_, i) => i + 1).map((n) => (
              <OptionButton
                key={n}
                label={freqLabel(n)}
                sub={selectedMonth?.price ? `$${Number(selectedMonth.price) * n} total` : undefined}
                onClick={() => handlePickFrequency(n)}
              />
            ))}
          </>
        )}

        {/* ── DAYS ── */}
        {step === "days" && selectedBatch && (
          <>
            <Bubble>Select day{frequency > 1 ? "s" : ""} for training:</Bubble>
            {dayOptions.length === 0 && (
              <p className="text-xs mb-2" style={{ color: "var(--ink-400)" }}>No specific day info for this batch — that's fine, we'll move on.</p>
            )}
            {dayOptions.length > 0 && (
              <div className="space-y-2 mb-3">
                {Array.from({ length: frequency }).map((_, di) => (
                  <select
                    key={di}
                    value={daySlots[di] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setDaySlots((prev) => { const next = [...prev]; next[di] = val; return next; });
                    }}
                    className="w-full rounded-xl border-2 px-3 py-2 text-sm bg-white outline-none focus:border-[var(--gold)]"
                    style={{ borderColor: daySlots[di] ? "var(--gold)" : "var(--pitch-deep)" }}
                  >
                    <option value="">Select Day {frequency > 1 ? di + 1 : ""}</option>
                    {dayOptions
                      .filter((opt) => opt === daySlots[di] || !daySlots.some((s, si) => si !== di && s === opt))
                      .map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                  </select>
                ))}
              </div>
            )}
            <div className="rounded-2xl p-3 mb-3 text-sm" style={{ background: "var(--gold-glow)" }}>
              <strong>Total: ${computedFee}</strong>
            </div>
            <button onClick={() => goTo("student")} disabled={!allDaySlotsSelected} className="cca-flow-btn">
              Continue — Player Details
            </button>
          </>
        )}

        {/* ── STUDENT ── */}
        {step === "student" && (
          <>
            {isWeeklyProgram && (
              <div className="rounded-2xl p-3 mb-1 text-xs" style={{ background: "var(--gold-glow)" }}>
                <p className="font-semibold mb-1" style={{ color: "var(--outfield)" }}>{selectedProgram?.title}</p>
                {weeklySnapshots.map((s) => (
                  <p key={s._id} style={{ color: "var(--ink-400)" }}>
                    • {formatWeekRangeLabel(s)}
                    {s.startTime && s.endTime ? ` (${fmt12(s.startTime)} - ${fmt12(s.endTime)})` : ""}
                  </p>
                ))}
                <p className="mt-1 font-semibold" style={{ color: "var(--outfield)" }}>Total: ${weeklyTotalPrice}</p>
              </div>
            )}
            <Bubble>Now tell me about the player:</Bubble>
            <TextField label="Player first name" value={student.firstName} onChange={(v) => setStudent({ ...student, firstName: v })} placeholder="Arjun" required />
            <TextField label="Player last name" value={student.lastName} onChange={(v) => setStudent({ ...student, lastName: v })} placeholder="Patel" required />
            <TextField label="Date of birth" type="date" value={student.dob} onChange={(v) => setStudent({ ...student, dob: v })} required />
            <TextField label="School name" value={student.schoolName} onChange={(v) => setStudent({ ...student, schoolName: v })} placeholder="Sunrise High School" />
            <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--ink-400)" }}>Gender</p>
            <div className="flex gap-2 mb-3">
              {["Male", "Female", "Other"].map((g) => (
                <button
                  key={g}
                  onClick={() => setStudent({ ...student, gender: g })}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: student.gender === g ? "var(--gold)" : "var(--gold-glow)", color: "var(--outfield)" }}
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              onClick={() => student.firstName && student.lastName && student.dob && student.gender && goTo("billing")}
              disabled={!student.firstName || !student.lastName || !student.dob || !student.gender}
              className="cca-flow-btn"
            >
              Continue to Billing Details
            </button>
          </>
        )}

        {/* ── BILLING / ADDRESS ── */}
        {step === "billing" && (
          <>
            <Bubble>
              {user
                ? `Thanks, ${user.firstName}! We have your email and phone on file — just need your address for billing/records:`
                : "Last step before payment — your billing address:"}
            </Bubble>
            <TextField label="Street address" value={billing.address} onChange={(v) => setBilling({ ...billing, address: v })} placeholder="123 Maple Avenue" />
            <TextField label="City" value={billing.city} onChange={(v) => setBilling({ ...billing, city: v })} placeholder="San Jose" />
            <div className="grid grid-cols-2 gap-2">
              <TextField label="State" value={billing.state} onChange={(v) => setBilling({ ...billing, state: v })} placeholder="CA" />
              <TextField label="ZIP code" value={billing.zip} onChange={(v) => setBilling({ ...billing, zip: v })} placeholder="95123" />
            </div>
            <button onClick={() => goTo("review")} className="cca-flow-btn">Continue to Review</button>
          </>
        )}

        {/* ── REVIEW ── */}
        {step === "review" && (
          <>
            <Bubble>Here's a quick summary — looks good?</Bubble>
            <div className="rounded-2xl p-4 mb-3 text-sm space-y-1.5" style={{ background: "var(--gold-glow)" }}>
              <p><strong>Program:</strong> {selectedProgram?.title}</p>
              {isWeeklyProgram ? (
                <>
                  <p><strong>Selected Week{weeklySnapshots.length > 1 ? "s" : ""}:</strong></p>
                  {weeklySnapshots.map((s) => (
                    <p key={s._id} className="pl-2">
                      • {formatWeekRangeLabel(s)}
                      {s.startTime && s.endTime ? ` (${fmt12(s.startTime)} - ${fmt12(s.endTime)})` : ""}
                    </p>
                  ))}
                </>
              ) : (
                <>
                  <p><strong>Batch:</strong> {selectedBatch?.title || selectedBatch?.name}</p>
                  {selectedMonth && <p><strong>Month:</strong> {selectedMonth.label}</p>}
                  <p><strong>Frequency:</strong> {freqLabel(frequency)}</p>
                  {daySlots.filter(Boolean).length > 0 && <p><strong>Days:</strong> {daySlots.filter(Boolean).join(" + ")}</p>}
                </>
              )}
              <p><strong>Player:</strong> {student.firstName} {student.lastName}</p>
              <p><strong>Billing:</strong> {[billing.address, billing.city, billing.state, billing.zip].filter(Boolean).join(", ") || "—"}</p>
              <p><strong>Total:</strong> ${computedFee}</p>
            </div>
            <WaiverConsent
              accepted={waiverAccepted}
              signature={waiverSignature}
              drawnSignature={waiverDrawnSignature}
              guardianName={user ? `${user.firstName} ${user.lastName}` : `${regForm.firstName} ${regForm.lastName}`.trim()}
              error={waiverError}
              onAcceptedChange={(accepted) => {
                setWaiverAccepted(accepted);
                if (accepted) setWaiverError(null);
              }}
              onSignatureChange={(signature) => {
                setWaiverSignature(signature);
                if (signature.trim()) setWaiverError(null);
              }}
              onDrawnSignatureChange={(signature) => {
                setWaiverDrawnSignature(signature);
                if (signature) setWaiverError(null);
              }}
            />
            <button
              onClick={() => {
                if (!waiverValid) {
                  setWaiverError("Please accept the waiver, type your e-signature, and draw your digital signature before registering.");
                  return;
                }
                goTo("payment");
              }}
              disabled={!waiverValid}
              className="cca-flow-btn"
            >
              Pay & Register Now
            </button>
            {!isWeeklyProgram && (
              <button onClick={handleAddToCart} className="cca-flow-btn-outline flex items-center justify-center gap-2">
                <HiOutlineShoppingCart className="w-4 h-4" /> Add to Cart Instead
              </button>
            )}
          </>
        )}

        {/* ── PAYMENT ── */}
        {step === "payment" && (
          <>
            <Bubble>How would you like to pay (${computedFee})?</Bubble>
            {!paymentMethod && (
              <>
                <OptionButton label="Pay with PayPal" sub="Fast & secure online payment" onClick={() => setPaymentMethod("PayPal")} />
                <OptionButton label="Pay by Check" sub="Mail a check, spot held 7 days" onClick={() => setPaymentMethod("Check")} />
              </>
            )}

            {paymentMethod === "PayPal" && (
              <div className="mb-3">
                <button onClick={() => setPaymentMethod(null)} className="text-xs font-semibold mb-2" style={{ color: "var(--outfield)" }}>
                  ← Choose a different payment method
                </button>
                <div ref={paypalRef} className="min-h-[120px] flex items-center justify-center">
                  <p className="text-xs" style={{ color: "var(--ink-400)" }}>Loading PayPal…</p>
                </div>
              </div>
            )}

            {paymentMethod === "Check" && (
              <div className="mb-3">
                <button onClick={() => setPaymentMethod(null)} className="text-xs font-semibold mb-2" style={{ color: "var(--outfield)" }}>
                  ← Choose a different payment method
                </button>
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