import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { useLocation, useNavigate } from "react-router-dom";
import {
  HiOutlineArrowLeft, HiOutlineArrowRight,
  HiOutlinePencilSquare, HiOutlineCheck, HiOutlineTag, HiOutlineXCircle, HiOutlineTrash,
} from "react-icons/hi2";
import { useRegistration } from "../../context/RegistrationContext";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import api from "../../api/axios";
import { isAxiosError } from "axios";

// Formats a month option's start/end dates + weeks as "Jul 5 - Aug 10 ( 5 week )"
function fmtMonthDateRange(startDate?: string, endDate?: string, weeks?: string | number): string {
  if (!startDate || !endDate) return "";
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const range = `${s.toLocaleDateString("en-US", opts)} - ${e.toLocaleDateString("en-US", opts)}`;
  return weeks ? `${range} ( ${weeks} week )` : range;
}

function splitSelectedDays(days?: string): string[] {
  return (days ?? "")
    .split(/\s*(?:\+|\||\n)\s*/)
    .map((day) => day.trim())
    .filter(Boolean);
}

function getEffectiveBatchFee(batch: any, fallbackPrice = 0): number {
  if (!batch) return fallbackPrice;
  const selectedMonthPrice = Number(batch.selectedMonth?.price);
  const selectedDayCount = splitSelectedDays(batch.days || batch.timing).length;
  if (selectedMonthPrice > 0 && selectedDayCount > 0) {
    return selectedMonthPrice * selectedDayCount;
  }
  return Number(batch.fee ?? fallbackPrice) || 0;
}

function ReviewOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const validateBillingOnEntry = Boolean((location.state as { validateBilling?: boolean } | null)?.validateBilling);
  const {
    selectedProgram,
    selectedBatch,
    students,
    parentDetails,
    updateParent,
    setTotalAmount,
    setCheckoutMode,
    createAccount,
    accountPassword,
    accountPasswordConfirm,
    setCreateAccount,
    setAccountPassword,
    setAccountPasswordConfirm,
    appliedCoupon,
    setAppliedCoupon,
    couponDiscount,
    setCouponDiscount,
  } = useRegistration();
  const { user, acceptSession } = useAuth();
  const { items, upsertItem, removeItem, setCoupon: setCartCoupon, setCouponDiscount: setCartCouponDiscount } = useCart();
  const cartSyncedRef = useRef(false);

  const [editingBilling, setEditingBilling] = useState(validateBillingOnEntry);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [existingParentAccount, setExistingParentAccount] = useState(false);
  const [existingGuestRecord, setExistingGuestRecord] = useState(false);
  const [checkingParentEmail, setCheckingParentEmail] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(() => {
    if (!validateBillingOnEntry) return new Set();
    const values = [
      ["parent-name", parentDetails.parentName], ["email", parentDetails.email],
      ["phone", parentDetails.phone], ["address", parentDetails.address],
      ["city", parentDetails.city], ["state", parentDetails.state], ["zip", parentDetails.zip],
    ] as const;
    return new Set(values.filter(([field, value]) => !value.trim() || (field === "email" && !/^\S+@\S+\.\S+$/.test(value.trim()))).map(([field]) => field));
  });

  // Coupon state — local to this page
  const [couponInput, setCouponInput] = useState(appliedCoupon?.code ?? "");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Available coupons
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (validateBillingOnEntry) {
      requestAnimationFrame(() => {
        const target = document.querySelector<HTMLInputElement>('[id^="review-"][class*="border-red-500"]');
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        target?.focus({ preventScroll: true });
      });
    }
  }, []);

  useEffect(() => {
    if (cartSyncedRef.current || !selectedProgram || !selectedBatch) return;

    const cartStudents = students
      .filter((student) => student.firstName.trim() && student.lastName.trim())
      .map((student) => ({
        firstName: student.firstName,
        lastName: student.lastName,
        dob: student.dob,
        gender: student.gender,
        schoolName: student.schoolName,
        medicalNotes: student.medicalNotes,
      }));

    if (cartStudents.length === 0) return;

    const batchId = selectedBatch._id ?? selectedBatch.name ?? "selected-batch";
    const selectedMonthOption = (selectedBatch as any).selectedMonth;
    const selectedMonth = selectedMonthOption?.label ?? "";
    const selectedDays = selectedBatch.days ?? selectedBatch.timing ?? "";
    const effectiveSelectedBatchFee = getEffectiveBatchFee(selectedBatch as any, selectedProgram.basePrice ?? 0);
    upsertItem({
      programId: selectedProgram._id,
      programTitle: selectedProgram.title,
      programImage: (selectedProgram as any).coverImageUrl,
      batchId,
      batchName: selectedBatch.name,
      selectedMonth,
      selectedMonthOption,
      selectedDays,
      sessionsPerWeek: Math.max(selectedBatch.sessionsPerWeek ?? 1, splitSelectedDays(selectedDays).length || 1),
      selectedWeeklyBatches: (selectedBatch as any).selectedWeeklyBatches,
      fee: effectiveSelectedBatchFee,
      students: cartStudents,
    });

    cartSyncedRef.current = true;
  }, [selectedBatch, selectedProgram, students, upsertItem]);

  useEffect(() => {
    if (user) {
      setCheckoutMode("account");
      updateParent({
        parentName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch available coupons on mount
  useEffect(() => {
    api.get("/public/coupons").then(res => {
      if (res.data.success) setAvailableCoupons(res.data.data);
    }).catch(() => { });
  }, []);

  // The currently selected batch is authoritative for this registration.
  // Saved draft/student records can carry an old selectedBatch from a previous
  // flow, so do not let stale per-student batch data override the visible
  // selected program/batch card.
  const studentFees = students.map(
    () => getEffectiveBatchFee(selectedBatch as any, selectedProgram?.basePrice ?? 0)
  );
  const perStudentFee = getEffectiveBatchFee(selectedBatch as any, selectedProgram?.basePrice ?? 0);
  const singleProgramSubtotal = studentFees.reduce((sum, fee) => sum + fee, 0);
  const subtotal = items.length > 0
    ? items.reduce((sum, item) => sum + item.fee * item.students.length, 0)
    : singleProgramSubtotal;
  const discount = couponDiscount;
  const grandTotal = Math.max(0, subtotal - discount);
  const reviewCartItems = useMemo(() => {
    return items.map((item) => ({
      programId: item.programId,
      programTitle: item.programTitle,
      batchId: item.batchId,
      batchName: item.batchName,
      studentCount: item.students.length || 1,
      sessionsPerWeek: item.sessionsPerWeek,
      selectedDays: item.selectedDays,
      selectedMonth: item.selectedMonthOption ?? { label: item.selectedMonth },
      selectedMonthLabel: item.selectedMonth,
      fee: item.fee,
      students: item.students,
    }));
  }, [items]);

  const billingValid =
    parentDetails.parentName.trim() &&
    /^\S+@\S+\.\S+$/.test(parentDetails.email.trim()) &&
    parentDetails.phone.trim() &&
    parentDetails.address.trim() &&
    parentDetails.city.trim() &&
    parentDetails.state.trim() &&
    parentDetails.zip.trim();
  const accountPasswordValid =
    user ||
    !createAccount ||
    (accountPassword.length >= 6 && accountPassword === accountPasswordConfirm);

  const clearInvalidField = (field: string) => {
    setInvalidFields((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  };

  const markInvalidAndScroll = (fields: string[]) => {
    setInvalidFields(new Set(fields));
    requestAnimationFrame(() => {
      const target = document.getElementById(`review-${fields[0]}`) as HTMLInputElement | null;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  };

  const checkParentEmail = async (openLogin = true): Promise<boolean> => {
    if (user) return true;
    const email = parentDetails.email.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return true;

    setCheckingParentEmail(true);
    try {
      const response = await api.post("/public/auth/check-parent-email", { email });
      const registered = Boolean(response.data?.registered);
      const guestRecord = Boolean(response.data?.exists) && !registered;
      setExistingParentAccount(registered);
      setExistingGuestRecord(guestRecord);
      if (registered) {
        setAccountError("A parent portal account with this email already exists. Please sign in to continue.");
        if (openLogin) {
          setLoginError(null);
          setLoginModalOpen(true);
        }
        return false;
      }
      if (guestRecord) {
        setAccountError("A prior guest registration already uses this email. Please contact support to verify ownership before continuing.");
        markInvalidAndScroll(["email"]);
        return false;
      }
      setAccountError(null);
      return true;
    } catch (error: unknown) {
      setAccountError((isAxiosError(error) && error.response?.data?.message) || "Unable to verify this email. Please try again.");
      markInvalidAndScroll(["email"]);
      return false;
    } finally {
      setCheckingParentEmail(false);
    }
  };

  const handleModalLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginSubmitting(true);
    setLoginError(null);
    try {
      const response = await api.post("/public/auth/login", {
        email: parentDetails.email.trim(),
        password: loginPassword,
      });
      acceptSession(response.data.token, response.data.parent);
      setExistingParentAccount(false);
      setExistingGuestRecord(false);
      setAccountError(null);
      setLoginModalOpen(false);
      setLoginPassword("");
      setCheckoutMode("account");
    } catch (error: unknown) {
      setLoginError((isAxiosError(error) && error.response?.data?.message) || "Unable to sign in. Please check your password and try again.");
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!billingValid) {
      if (user) setEditingBilling(true);
      const fields = ([
        ["parent-name", parentDetails.parentName], ["email", parentDetails.email],
        ["phone", parentDetails.phone], ["address", parentDetails.address],
        ["city", parentDetails.city], ["state", parentDetails.state], ["zip", parentDetails.zip],
      ] as const).filter(([field, value]) => !value.trim() || (field === "email" && !/^\S+@\S+\.\S+$/.test(value.trim()))).map(([field]) => field);
      markInvalidAndScroll(fields);
      return;
    }
    // Identity must be resolved before account-password validation. Otherwise
    // an existing user who left the "create account" option selected could be
    // asked to invent a new password before being shown the sign-in prompt.
    if (!user && !(await checkParentEmail(true))) return;
    if (!user && createAccount && !accountPasswordValid) {
      setAccountError(accountPassword.length < 6 ? "Password must be at least 6 characters." : "Passwords do not match.");
      markInvalidAndScroll(accountPassword.length < 6 ? ["account-password"] : ["account-password-confirm"]);
      return;
    }
    setExistingParentAccount(false);
    setAccountError(null);
    setCheckoutMode(user || createAccount ? "account" : "guest");
    setTotalAmount(grandTotal);
    navigate("/cart");
  };

  const handleEditProgram = (programId: string, cartId: string) => {
    navigate(`/register-program/${programId}?editProgram=true&cartId=${encodeURIComponent(cartId)}`);
  };

  const handleRemoveProgram = (cartId: string, programTitle: string) => {
    const confirmed = window.confirm(`Remove "${programTitle}" from your cart? This cannot be undone.`);
    if (!confirmed) return;
    const removingLastItem = items.length === 1;
    removeItem(cartId);
    if (removingLastItem) navigate("/programs");
  };

  const clearAppliedCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCartCoupon(null);
    setCartCouponDiscount(0);
  };

  const validateCoupon = async (code: string) => {
    if (!code || reviewCartItems.length === 0) return null;
    const res = await api.post("/public/validate-coupon", {
      couponCode: code,
      checkoutMode: "cart",
      cartItems: reviewCartItems,
    });

    if (!res.data.success) {
      throw new Error(res.data.message || "Invalid coupon.");
    }

    const couponType = res.data.coupon.type;
    const couponValue = res.data.coupon.value;
    const displayDiscount = Number(res.data.discount || 0);
    return {
      contextCoupon: {
        code: res.data.coupon.code,
        type: couponType,
        value: couponValue,
        description: res.data.coupon.description,
        discount: displayDiscount,
        usedCount: res.data.coupon.usedCount,
        maxUses: res.data.coupon.maxUses,
      },
      cartCoupon: {
        code: res.data.coupon.code,
        type: couponType,
        value: couponValue,
        description: res.data.coupon.description,
        discount: displayDiscount,
      },
      discount: displayDiscount,
    };
  };

  const applyValidatedCoupon = (validated: NonNullable<Awaited<ReturnType<typeof validateCoupon>>>) => {
    setAppliedCoupon(validated.contextCoupon);
    setCouponDiscount(validated.discount);
    setCartCoupon(validated.cartCoupon);
    setCartCouponDiscount(validated.discount);
    setCouponInput(validated.contextCoupon.code);
  };

  // ── Apply coupon ──────────────────────────────────────────
  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError(null);
    setCouponLoading(true);
    try {
      const validated = await validateCoupon(code);
      if (validated) applyValidatedCoupon(validated);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err as Error)?.message
        ?? "Could not validate coupon. Please try again.";
      setCouponError(msg);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    clearAppliedCoupon();
    setCouponInput("");
    setCouponError(null);
  };

  useEffect(() => {
    if (!appliedCoupon?.code || reviewCartItems.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const validated = await validateCoupon(appliedCoupon.code);
        if (!cancelled && validated) {
          applyValidatedCoupon(validated);
          setCouponError(null);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? (err as Error)?.message
          ?? "Coupon no longer applies to this order.";
        clearAppliedCoupon();
        setCouponError(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Revalidate only when the order payload or applied code changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCoupon?.code, JSON.stringify(reviewCartItems)]);

  const parentAddress = [parentDetails.address, parentDetails.city, parentDetails.state, parentDetails.zip]
    .filter(Boolean)
    .join(", ");

  const inputCls =
    "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/15";
  const fieldClass = (field: string) => `${inputCls} ${invalidFields.has(field) ? "border-red-500 bg-red-50 ring-2 ring-red-200" : ""}`;

  return (
    <>
      <Navbar />
      <div className="h-20" />
      <main className="min-h-screen bg-[#f8fafc] text-[#0F172A]">
        {/* Header */}
        <section className="max-w-7xl mx-auto px-6 py-10 sm:py-14">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[var(--gold)] transition"
          >
            <HiOutlineArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="mt-6 rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/60 sm:p-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-widest text-[var(--gold)]">Step 3 — Review &amp; Confirm</p>
                <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">Confirm Your Enrollment</h1>
                <p className="mt-2 text-slate-600 text-sm">
                  Review everything below — billing details are editable right here.
                </p>
              </div>
              <div className="rounded-full bg-[var(--gold)]/10 px-4 py-2 text-sm font-semibold text-[var(--gold)]">
                Final Review
              </div>
            </div>
            <div className="mt-6 overflow-hidden rounded-full bg-slate-100 h-2">
              <div className="h-2 rounded-full bg-[var(--gold)]" style={{ width: "75%" }} />
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 pb-16">
          <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              {/* Every program currently in the cart */}
              {items.map((item, programIndex) => (
              <div key={item.cartId} className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Program {programIndex + 1}</p>
                    <h2 className="mt-1 text-xl font-bold text-[#0F172A]">
                      {item.programTitle}
                    </h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-[var(--gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--gold)]">
                      Program
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEditProgram(item.programId, item.cartId)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <HiOutlinePencilSquare className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveProgram(item.cartId, item.programTitle)}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      aria-label={`Remove ${item.programTitle} from cart`}
                    >
                      <HiOutlineTrash className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </div>
                {item.batchId && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Selected Batch</p>
                    <p className="mt-1 text-base font-bold text-[#0F172A]">{item.batchName}</p>
                    {(() => {
                      const month = item.selectedMonthOption;
                      if (!month?.label) return null;
                      const dateRange = fmtMonthDateRange(month.startDate, month.endDate, month.weeks);
                      return (
                        <p className="mt-1 text-sm font-semibold text-[#0F172A]">
                          {month.label}
                          {dateRange && <span className="ml-1 font-normal text-slate-500">({dateRange})</span>}
                        </p>
                      );
                    })()}
                    <p className="mt-1 text-sm text-slate-500">
                      <ul className="mt-1 space-y-1 list-none">
                        {(item.selectedDays || "")
                          .split(/\s*\+\s*|\s*\|\s*/)
                          .filter((d: string, i: number, arr: string[]) => d.trim() && arr.indexOf(d.trim()) === i)
                          .map((day: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A33B2B]" />
                              {day.trim()}
                            </li>
                          ))}
                      </ul>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.students.map((student, index) => (
                        <span key={index} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {student.firstName} {student.lastName}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--gold)]">
                      ${item.fee.toFixed(2)} per student · ${(item.fee * item.students.length).toFixed(2)} total
                    </p>
                  </div>
                )}
              </div>
              ))}

              {/* Students List */}
              <div className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Students Enrolled</p>
                    <h2 className="mt-1 text-xl font-bold text-[#0F172A] flex items-center gap-2">
                       <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-sm font-bold text-white">
                              {students.length} 
              </span>
   
                      Student{students.length > 1 ? "s" : ""}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/student-details")}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[var(--gold)] hover:text-[var(--gold)] transition"
                  >
                    <HiOutlinePencilSquare className="h-3.5 w-3.5" /> Edit
                  </button>
                </div>

                <div className="space-y-3">
                  {students.map((s, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-widest">Student {i + 1}</p>
                          <p className="mt-1 text-base font-bold text-[#0F172A]">
                            {`${s.firstName} ${s.lastName}`.trim() || "—"}
                          </p>
                          <p className="text-sm text-slate-500">
                            {s.dob ? `DOB: ${s.dob}` : ""} {s.gender ? `· ${s.gender}` : ""}
                          </p>
                          {s.schoolName && (
                            <p className="text-sm text-slate-500">School: {s.schoolName}</p>
                          )}
                          {s.selectedBatch && (
                            <p className="mt-1 text-xs font-medium text-[var(--gold)]">
                              Batch: {s.selectedBatch.name}
                              {(() => {
                                const month = (s.selectedBatch as any).selectedMonth;
                                if (!month?.label) return null;
                                const dateRange = fmtMonthDateRange(month.startDate, month.endDate, month.weeks);
                                return ` — ${month.label}${dateRange ? ` (${dateRange})` : ""}`;
                              })()}
                            </p>
                          )}
                        </div>
                        <span className="rounded-full bg-[#0F172A] px-3 py-1 text-xs font-bold text-white">
                          #{i + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Parent / Billing */}
              <div className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Parent / Guardian</p>
                    <h2 className="mt-1 text-xl font-bold text-[#0F172A]">
                      {parentDetails.parentName || "Add your details"}
                    </h2>
                  </div>
                  {user && (
                    <button
                      type="button"
                      onClick={() => setEditingBilling((value) => !value)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[var(--gold)] hover:text-[var(--gold)] transition"
                    >
                      {editingBilling ? <><HiOutlineCheck className="h-3.5 w-3.5" /> Done</> : <><HiOutlinePencilSquare className="h-3.5 w-3.5" /> Edit</>}
                    </button>
                  )}
                </div>

                {user && (
                  <div className="mb-4 rounded-2xl bg-green-50 border border-green-200 p-3 text-xs text-green-700 font-medium">
                    Signed in as {user.firstName} {user.lastName}. Your account details are shown below.
                  </div>
                )}

                {user && !editingBilling ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "Email", value: parentDetails.email },
                      { label: "Phone", value: parentDetails.phone },
                      { label: "Address", value: parentAddress, full: true },
                    ].map(({ label, value, full }) => (
                      <div
                        key={label}
                        className={`rounded-2xl bg-slate-50 p-4 ${full ? "sm:col-span-2" : ""}`}
                      >
                        <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-semibold text-[#0F172A]">{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Parent Name <span className="text-red-500">*</span></label>
                        <input id="review-parent-name" type="text" value={parentDetails.parentName} onChange={e => { updateParent({ parentName: e.target.value }); clearInvalidField("parent-name"); }} placeholder="Full name" className={fieldClass("parent-name")} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Email <span className="text-red-500">*</span></label>
                        <input
                          id="review-email"
                          type="email"
                          value={parentDetails.email}
                          onChange={e => {
                            updateParent({ email: e.target.value });
                            setExistingParentAccount(false);
                            setExistingGuestRecord(false);
                            setAccountError(null);
                            clearInvalidField("email");
                          }}
                          onBlur={() => { void checkParentEmail(true); }}
                          placeholder="parent@example.com"
                          className={fieldClass("email")}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Phone <span className="text-red-500">*</span></label>
                        <input id="review-phone" type="tel" value={parentDetails.phone} onChange={e => { updateParent({ phone: e.target.value }); clearInvalidField("phone"); }} placeholder="(123) 456-7890" className={fieldClass("phone")} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">City <span className="text-red-500">*</span></label>
                        <input id="review-city" type="text" value={parentDetails.city} onChange={e => { updateParent({ city: e.target.value }); clearInvalidField("city"); }} placeholder="San Jose" className={fieldClass("city")} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Street Address <span className="text-red-500">*</span></label>
                      <input id="review-address" type="text" value={parentDetails.address} onChange={e => { updateParent({ address: e.target.value }); clearInvalidField("address"); }} placeholder="123 Maple Avenue" className={fieldClass("address")} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">State <span className="text-red-500">*</span></label>
                        <input id="review-state" type="text" value={parentDetails.state} onChange={e => { updateParent({ state: e.target.value }); clearInvalidField("state"); }} placeholder="CA" maxLength={2} className={fieldClass("state")} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-700">ZIP Code <span className="text-red-500">*</span></label>
                        <input id="review-zip" type="text" value={parentDetails.zip} onChange={e => { updateParent({ zip: e.target.value }); clearInvalidField("zip"); }} placeholder="95123" className={fieldClass("zip")} />
                      </div>
                    </div>
                    {!billingValid && (
                      <p className="text-xs text-amber-600">Name, email, phone, and full billing address are required before you can proceed to payment.</p>
                    )}
                  </div>
                )}

                {!user && (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <label className="flex items-start gap-3 text-sm font-semibold text-[#0F172A]">
                        <input
                          type="checkbox"
                          checked={createAccount}
                          onChange={(e) => {
                            setCreateAccount(e.target.checked);
                            setCheckoutMode(e.target.checked ? "account" : "guest");
                            setAccountError(null);
                          }}
                          className="mt-1 h-4 w-4"
                          style={{ accentColor: "var(--gold)" }}
                        />
                        <span>
                          Create a parent portal account
                          <span className="block text-xs font-normal text-slate-500">
                            Add a password now to track registrations, students, attendance, and messages later.
                          </span>
                        </span>
                      </label>
                      {!createAccount && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Continuing as guest
                        </span>
                      )}
                    </div>

                    {createAccount ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">Password</label>
                          <input
                            id="review-account-password"
                            type="password"
                            value={accountPassword}
                            onChange={(e) => {
                              setAccountPassword(e.target.value);
                              setAccountError(null);
                              clearInvalidField("account-password");
                            }}
                            placeholder="At least 6 characters"
                            className={fieldClass("account-password")}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">Confirm Password</label>
                          <input
                            id="review-account-password-confirm"
                            type="password"
                            value={accountPasswordConfirm}
                            onChange={(e) => {
                              setAccountPasswordConfirm(e.target.value);
                              setAccountError(null);
                              clearInvalidField("account-password-confirm");
                            }}
                            placeholder="Repeat password"
                            className={fieldClass("account-password-confirm")}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">
                        You can still complete payment without an account. Guest registrations are not linked to a parent portal login.
                      </p>
                    )}
                    {accountError && <p className="mt-3 text-xs font-semibold text-red-500">{accountError}</p>}
                    {existingParentAccount && (
                      <button
                        type="button"
                        onClick={() => setLoginModalOpen(true)}
                        className="mt-3 rounded-full bg-[#0F172A] px-5 py-2 text-xs font-semibold text-white"
                      >
                        Sign in to your parent account
                      </button>
                    )}
                    {existingGuestRecord && (
                      <p className="mt-3 text-xs text-slate-600">Contact CCA support before paying so the prior guest record can be verified and linked safely.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <aside className="space-y-5 xl:sticky xl:top-24">
              {/* Order Summary */}
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg">
                <p className="text-sm uppercase tracking-widest text-[var(--gold)]">Order Summary</p>
                <h2 className="mt-2 text-lg font-bold text-[#0F172A]">Total Amount</h2>

                <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                  {items.map((item) => (
                    <div key={item.cartId} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-slate-600">
                        {item.programTitle}
                        <span className="block text-xs text-slate-400">{item.batchName} · {item.students.length} student{item.students.length === 1 ? "" : "s"}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-[#0F172A]">${(item.fee * item.students.length).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-semibold text-[#0F172A]">${subtotal.toFixed(2)}</span>
                  </div>

                  {/* Discount line — only shown when a coupon is applied */}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 font-semibold">
                      <span>Discount ({appliedCoupon?.code})</span>
                      <span>− ${discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Grand Total</p>
                    <p className="mt-1 text-3xl font-bold text-[#0F172A]">${grandTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Coupon Box */}
              <div className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2 mb-3">
                  <HiOutlineTag className="h-4 w-4 text-[var(--gold)]" />
                  <p className="text-sm font-semibold text-[#0F172A]">Have a coupon code?</p>
                </div>

                {appliedCoupon ? (
                  /* Applied state */
                  <div className="rounded-2xl bg-green-50 border border-green-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-green-700">{appliedCoupon.code}</p>
                        {appliedCoupon.description && (
                          <p className="mt-0.5 text-xs text-green-600">{appliedCoupon.description}</p>
                        )}
                        <p className="mt-1 text-sm font-semibold text-green-700">
                          You save ${discount.toFixed(2)}!
                        </p>
                        {appliedCoupon.maxUses !== null && (
                          <p className="mt-1 text-xs text-green-500">
                            {appliedCoupon.maxUses - appliedCoupon.usedCount - 1} use{appliedCoupon.maxUses - appliedCoupon.usedCount - 1 !== 1 ? "s" : ""} remaining after this
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="flex-shrink-0 text-green-400 hover:text-red-500 transition"
                        aria-label="Remove coupon"
                      >
                        <HiOutlineXCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Input state */
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                        onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                        placeholder="Enter code"
                        maxLength={30}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/15 uppercase tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-[var(--gold-light)] transition"
                      >
                        {couponLoading ? "..." : "Apply"}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-xs text-red-500 font-medium">{couponError}</p>
                    )}
                    <p className="text-xs text-slate-400">Only one coupon can be used per order.</p>

                    {/* Available Coupons List */}
                    {availableCoupons.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Coupons</p>
                        {availableCoupons.map((c: any) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => { setCouponInput(c.code); setCouponError(null); }}
                            className="w-full text-left rounded-xl border border-dashed border-[var(--gold)] bg-[var(--gold)]/5 px-3 py-2.5 hover:bg-[var(--gold)]/10 transition"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-[var(--gold)] tracking-wider">{c.code}</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {c.type === "PERCENTAGE" ? `${c.value}% off` : `$${c.value} off`}
                              </span>
                            </div>
                            {c.description && (
                              <p className="mt-0.5 text-xs text-slate-500">{c.description}</p>
                            )}
                            {c.minAmount > 0 && (
                              <p className="mt-0.5 text-xs text-amber-600 font-medium">Min. order: ${c.minAmount}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70 space-y-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="w-full inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-[var(--gold)] transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={checkingParentEmail}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-[var(--outfield)] shadow-md hover:bg-[var(--gold-light)] transition disabled:cursor-wait disabled:opacity-60"
                >
                  {checkingParentEmail ? "Checking email..." : "Proceed to Payment"} <HiOutlineArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-5 text-sm text-slate-500">
                Use the edit buttons above to fix anything before paying.
              </div>
            </aside>
          </div>
        </section>
      </main>
      {loginModalOpen && !user && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="existing-parent-login-title">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Account found</p>
                <h2 id="existing-parent-login-title" className="mt-2 text-2xl font-bold text-[#0F172A]">Sign in to continue</h2>
              </div>
              <button type="button" onClick={() => setLoginModalOpen(false)} aria-label="Close sign-in dialog" className="text-2xl text-slate-400 hover:text-slate-700">&times;</button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">A parent portal account already exists for <strong>{parentDetails.email}</strong>. Sign in now; your cart and registration details will remain here.</p>
            <form onSubmit={handleModalLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Email</label>
                <input type="email" value={parentDetails.email} readOnly className={`${inputCls} bg-slate-100`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoFocus required className={inputCls} placeholder="Enter your password" />
              </div>
              {loginError && <p className="text-sm font-semibold text-red-600">{loginError}</p>}
              <button type="submit" disabled={loginSubmitting} className="w-full rounded-full bg-[#0F172A] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{loginSubmitting ? "Signing in..." : "Sign in and continue"}</button>
              <button type="button" onClick={() => navigate("/login", { state: { from: "/review-order", mode: "parent-login", prefill: { email: parentDetails.email } } })} className="w-full text-sm font-semibold text-slate-600 underline">Forgot password?</button>
            </form>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}

export default ReviewOrder;
