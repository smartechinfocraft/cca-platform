import { useEffect, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineArrowLeft, HiOutlineArrowRight,
  HiOutlinePencilSquare, HiOutlineCheck, HiOutlineTag, HiOutlineXCircle,
} from "react-icons/hi2";
import { useRegistration } from "../../context/RegistrationContext";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import api from "../../api/axios";

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

function ReviewOrder() {
  const navigate = useNavigate();
  const {
    selectedProgram,
    selectedBatch,
    students,
    parentDetails,
    updateParent,
    setTotalAmount,
    setCheckoutMode,
    appliedCoupon,
    setAppliedCoupon,
    couponDiscount,
    setCouponDiscount,
  } = useRegistration();
  const { user } = useAuth();
  const { items: cartItems, addItem } = useCart();
  const cartSyncedRef = useRef(false);

  const [editingBilling, setEditingBilling] = useState(false);

  // Coupon state — local to this page
  const [couponInput, setCouponInput] = useState(appliedCoupon?.code ?? "");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Available coupons
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);

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
    const selectedMonth = (selectedBatch as any).selectedMonth?.label ?? "";
    const selectedDays = selectedBatch.days ?? selectedBatch.timing ?? "";
    const sameRegistrationExists = cartItems.some((item) => {
      const sameStudents =
        item.students.length === cartStudents.length &&
        item.students.every((student, index) =>
          student.firstName === cartStudents[index]?.firstName &&
          student.lastName === cartStudents[index]?.lastName &&
          student.dob === cartStudents[index]?.dob
        );

      return (
        item.programId === selectedProgram._id &&
        item.batchId === batchId &&
        item.selectedMonth === selectedMonth &&
        item.selectedDays === selectedDays &&
        sameStudents
      );
    });

    if (!sameRegistrationExists) {
      addItem({
        programId: selectedProgram._id,
        programTitle: selectedProgram.title,
        programImage: (selectedProgram as any).coverImageUrl,
        batchId,
        batchName: selectedBatch.name,
        selectedMonth,
        selectedDays,
        sessionsPerWeek: selectedBatch.sessionsPerWeek ?? 1,
        fee: selectedBatch.fee,
        students: cartStudents,
      });
    }

    cartSyncedRef.current = true;
  }, [addItem, cartItems, selectedBatch, selectedProgram, students]);

  useEffect(() => {
    if (user) {
      setCheckoutMode("account");
      if (!parentDetails.parentName) {
        updateParent({
          parentName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phone,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch available coupons on mount
  useEffect(() => {
    api.get("/public/coupons").then(res => {
      if (res.data.success) setAvailableCoupons(res.data.data);
    }).catch(() => { });
  }, []);

  // Each student may have their own batch (different batch for a second child).
  // Sum each student's individual fee; fall back to the global selectedBatch fee,
  // then the program base price, so the total is always accurate.
  const studentFees = students.map(
    (s) => s.selectedBatch?.fee ?? selectedBatch?.fee ?? selectedProgram?.basePrice ?? 0
  );
  const perStudentFee = selectedBatch?.fee ?? selectedProgram?.basePrice ?? 0; // kept for "fee per student" display line
  const subtotal = studentFees.reduce((sum, fee) => sum + fee, 0);
  const discount = couponDiscount;
  const grandTotal = Math.max(0, subtotal - discount);

  const billingValid =
    parentDetails.parentName.trim() &&
    parentDetails.email.trim() &&
    parentDetails.phone.trim();

  const handleProceedToPayment = () => {
    if (!billingValid) { setEditingBilling(true); return; }
    setTotalAmount(grandTotal);
    navigate("/payment");
  };

  // ── Apply coupon ──────────────────────────────────────────
  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError(null);
    setCouponLoading(true);
    try {
      // When students have different batches, don't pass a single batchId — the
      // backend would price only one batch fee × studentCount, which would be wrong.
      // Instead omit batchId so it falls back to program-level pricing for the
      // minimum-amount check. The discount % is applied to our already-correct
      // frontend subtotal.
      const allSameBatch = students.every(
        (s) => (s.selectedBatch?._id ?? selectedBatch?._id) === (students[0].selectedBatch?._id ?? selectedBatch?._id)
      );
      const res = await api.post("/public/validate-coupon", {
        couponCode: code,
        programId: selectedProgram?._id,
        batchId: allSameBatch ? selectedBatch?._id : undefined,
        studentCount: students.length || 1,
        sessionsPerWeek: allSameBatch ? selectedBatch?.sessionsPerWeek : undefined,
        weeklyBatchIds: (selectedBatch as any)?.selectedWeeklyBatches?.map((w: any) => w._id),
      });
      if (res.data.success) {
        setAppliedCoupon({
          code: res.data.coupon.code,
          type: res.data.coupon.type,
          value: res.data.coupon.value,
          description: res.data.coupon.description,
          discount: res.data.discount,
          usedCount: res.data.coupon.usedCount,
          maxUses: res.data.coupon.maxUses,
        });
        setCouponDiscount(res.data.discount);
        setCouponInput(res.data.coupon.code);
      } else {
        setCouponError(res.data.message || "Invalid coupon.");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Could not validate coupon. Please try again.";
      setCouponError(msg);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponInput("");
    setCouponError(null);
  };

  const parentAddress = [parentDetails.address, parentDetails.city, parentDetails.state, parentDetails.zip]
    .filter(Boolean)
    .join(", ");

  const inputCls =
    "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/15";

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
              {/* Program & Batch */}
              <div className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Program Selected</p>
                    <h2 className="mt-1 text-xl font-bold text-[#0F172A]">
                      {selectedProgram?.title ?? "—"}
                    </h2>
                  </div>
                  <span className="rounded-full bg-[var(--gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--gold)]">
                    Program
                  </span>
                </div>
                {selectedProgram?.shortDescription && (
                  <p className="text-sm text-slate-500">{selectedProgram.shortDescription}</p>
                )}

                {selectedBatch && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Selected Batch</p>
                    <p className="mt-1 text-base font-bold text-[#0F172A]">{selectedBatch.name}</p>
                    {(() => {
                      const month = (selectedBatch as any).selectedMonth;
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
                        {(selectedBatch.days || selectedBatch.timing || "")
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
                    <p className="mt-2 text-sm font-semibold text-[var(--gold)]">${selectedBatch.fee} </p>
                  </div>
                )}
              </div>

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
                  <button
                    type="button"
                    onClick={() => setEditingBilling((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[var(--gold)] hover:text-[var(--gold)] transition"
                  >
                    {editingBilling ? <><HiOutlineCheck className="h-3.5 w-3.5" /> Done</> : <><HiOutlinePencilSquare className="h-3.5 w-3.5" /> Edit</>}
                  </button>
                </div>

                {user && (
                  <div className="mb-4 rounded-2xl bg-green-50 border border-green-200 p-3 text-xs text-green-700 font-medium">
                    ✅ Signed in as {user.firstName} {user.lastName} — details pre-filled, edit anything below if needed.
                  </div>
                )}

                {!editingBilling ? (
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
                        <input type="text" value={parentDetails.parentName} onChange={e => updateParent({ parentName: e.target.value })} placeholder="Full name" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Email <span className="text-red-500">*</span></label>
                        <input type="email" value={parentDetails.email} onChange={e => updateParent({ email: e.target.value })} placeholder="parent@example.com" className={inputCls} />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Phone <span className="text-red-500">*</span></label>
                        <input type="tel" value={parentDetails.phone} onChange={e => updateParent({ phone: e.target.value })} placeholder="(123) 456-7890" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">City</label>
                        <input type="text" value={parentDetails.city} onChange={e => updateParent({ city: e.target.value })} placeholder="San Jose" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Street Address</label>
                      <input type="text" value={parentDetails.address} onChange={e => updateParent({ address: e.target.value })} placeholder="123 Maple Avenue" className={inputCls} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">State</label>
                        <input type="text" value={parentDetails.state} onChange={e => updateParent({ state: e.target.value })} placeholder="CA" maxLength={2} className={inputCls} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-700">ZIP Code</label>
                        <input type="text" value={parentDetails.zip} onChange={e => updateParent({ zip: e.target.value })} placeholder="95123" className={inputCls} />
                      </div>
                    </div>
                    {!billingValid && (
                      <p className="text-xs text-amber-600">Name, email, and phone are required before you can proceed to payment.</p>
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
                  {/* Show individual student fees when batches differ, otherwise the simple ×N layout */}
                  {students.length === 1 ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Fee per student</span>
                        <span className="font-semibold text-[#0F172A]">${studentFees[0].toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Students</span>
                        <span className="font-semibold text-[#0F172A]">× 1</span>
                      </div>
                    </>
                  ) : (
                    students.map((s, i) => {
                      const fee = studentFees[i];
                      const batchName = s.selectedBatch?.name ?? selectedBatch?.name ?? "—";
                      const label = `${s.firstName || `Student ${i + 1}`} (${batchName})`;
                      return (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-600 truncate max-w-[60%]">{label}</span>
                          <span className="font-semibold text-[#0F172A]">${fee.toFixed(2)}</span>
                        </div>
                      );
                    })
                  )}
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
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-[var(--outfield)] shadow-md hover:bg-[var(--gold-light)] transition"
                >
                  Proceed to Payment <HiOutlineArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-5 text-sm text-slate-500">
                Use the edit buttons above to fix anything before paying.
              </div>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default ReviewOrder;
