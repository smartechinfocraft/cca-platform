import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { HiOutlineCheckCircle, HiOutlineArrowDownTray, HiOutlineHome, HiOutlineXMark, HiStar } from "react-icons/hi2";
import api from "../../api/axios";

interface SuccessData {
  registrationId?: string;
  receiptToken?: string;
  registrationNumber?: string;
  studentName?: string;
  programName?: string;
  paymentMethod?: string;
  totalAmount?: number;
  subtotal?: number;
  discount?: number;
  discountAmount?: number;
  couponCode?: string;
  transactionId?: string;
  paymentStatus?: string;
  email?: string;
  orderItems?: OrderItem[];
}

interface OrderStudent {
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
}

interface OrderItem {
  programTitle?: string;
  batchType?: string;
  batchName?: string;
  selectedMonth?: { label?: string };
  selectedMonthLabel?: string;
  selectedDays?: string;
  feePerStudent?: number;
  studentCount?: number;
  itemTotal?: number;
  students?: OrderStudent[];
}

const money = (value?: number) => `$${(Number(value) || 0).toFixed(2)}`;

const splitScheduleItems = (value?: string) =>
  String(value || "")
    .split(/\s*(?:\n|;|\+|\||,\s*(?=[A-Z][a-z]+day\b))\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

const isRegularWithoutMonth = (item: OrderItem) => {
  if (item.batchType === "REGULAR_WITHOUT_MONTH") return true;
  const batch = String(item.batchName || "").trim().toLowerCase();
  const month = String(item.selectedMonthLabel || item.selectedMonth?.label || "").trim().toLowerCase();
  return Boolean(batch && month && batch === month);
};

function SuccessPage() {
  const location = useLocation();
  const stateResponse = location.state as SuccessData | null;
  const storedResponse = (() => {
    try {
      const raw = sessionStorage.getItem("cca:lastRegistration");
      return raw ? (JSON.parse(raw) as SuccessData) : null;
    } catch {
      return null;
    }
  })();
  const receiptCredentials = stateResponse ?? storedResponse;
  const [response, setResponse] = useState<SuccessData | null>(null);
  const hasReceiptCredentials = Boolean(receiptCredentials?.registrationId && receiptCredentials?.receiptToken);
  const [receiptLoading, setReceiptLoading] = useState(hasReceiptCredentials);
  const [receiptError, setReceiptError] = useState(hasReceiptCredentials
    ? ""
    : "This receipt link is incomplete. Please open the invoice from your dashboard or confirmation email.");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  useEffect(() => {
    const registrationId = receiptCredentials?.registrationId;
    const receiptToken = receiptCredentials?.receiptToken;
    if (!registrationId || !receiptToken) return;

    let active = true;
    api.get(`/public/registration-success/${registrationId}`, {
      headers: { "X-Receipt-Token": receiptToken },
    }).then(({ data }) => {
      if (!active) return;
      const canonical = { ...data.data, registrationId, receiptToken } as SuccessData;
      setResponse(canonical);
      sessionStorage.setItem("cca:lastRegistration", JSON.stringify(canonical));
    }).catch(() => {
      if (active) setReceiptError("We could not verify this registration receipt. Please use your dashboard or confirmation email.");
    }).finally(() => {
      if (active) setReceiptLoading(false);
    });
    return () => { active = false; };
  }, [receiptCredentials?.registrationId, receiptCredentials?.receiptToken]);

  useEffect(() => {
    if (!response?.registrationId) return;
    const storageKey = `cca:feedback-prompt:${response.registrationId}`;
    if (sessionStorage.getItem(storageKey)) return;
    const timer = window.setTimeout(() => setFeedbackOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [response?.registrationId]);

  useEffect(() => {
    if (!feedbackOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !feedbackSaving) setFeedbackOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [feedbackOpen, feedbackSaving]);

  const registrationNumber = response?.registrationNumber ?? "";
  const studentName = response?.studentName ?? "—";
  const programName = response?.programName ?? "—";
  const paymentMethod = response?.paymentMethod ?? "—";
  const totalAmount = response?.totalAmount ?? 0;
  const orderItems = response?.orderItems ?? [];
  const calculatedOriginalPrice = orderItems.reduce((sum, item) => sum + Number(item.itemTotal ?? ((item.feePerStudent || 0) * (item.studentCount || item.students?.length || 1))), 0);
  const subtotal = Number(response?.subtotal ?? calculatedOriginalPrice) || totalAmount;
  const discountAmount = Number(response?.discountAmount ?? response?.discount ?? Math.max(0, subtotal - totalAmount)) || 0;
  const paymentConfirmed = response?.paymentStatus === "SUCCESS";

  const closeFeedback = () => {
    if (feedbackSaving) return;
    if (response?.registrationId) sessionStorage.setItem(`cca:feedback-prompt:${response.registrationId}`, "dismissed");
    setFeedbackOpen(false);
  };

  const submitFeedback = async () => {
    if (!response?.registrationId || !response.receiptToken || (!feedbackRating && !feedbackText.trim())) {
      setFeedbackError("Choose a rating or enter a comment, or select Not now.");
      return;
    }
    setFeedbackSaving(true);
    setFeedbackError("");
    try {
      await api.post(
        `/public/feedback/${response.registrationId}`,
        { rating: feedbackRating, feedback: feedbackText.trim() || undefined },
        { headers: { "X-Receipt-Token": response.receiptToken } },
      );
      sessionStorage.setItem(`cca:feedback-prompt:${response.registrationId}`, "submitted");
      setFeedbackOpen(false);
    } catch (error: any) {
      if (error.response?.status === 409) {
        sessionStorage.setItem(`cca:feedback-prompt:${response.registrationId}`, "submitted");
        setFeedbackOpen(false);
      } else {
        setFeedbackError(error.response?.data?.message || "We could not save your feedback. Please try again.");
      }
    } finally {
      setFeedbackSaving(false);
    }
  };

  if (receiptLoading || receiptError || !response) {
    return (
      <>
        <Navbar />
        <div className="h-20" />
        <main className="min-h-[70vh] bg-[#f8fafc] px-6 py-20 text-center text-[#0F172A]">
          <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 shadow-lg">
            <h1 className="text-2xl font-bold">{receiptLoading ? "Verifying registration…" : "Receipt unavailable"}</h1>
            {!receiptLoading && <p className="mt-4 text-sm text-slate-600">{receiptError}</p>}
            {!receiptLoading && <Link to="/dashboard/purchases" className="mt-6 inline-flex rounded-full bg-[#A33B2B] px-6 py-3 text-sm font-semibold text-white">View purchases</Link>}
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const handleDownloadReceipt = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 50;

    const OUTFIELD = "#1F2E1E";
    const GOLD = "#C9A227";
    const LEATHER = "#A33B2B";
    const GRASS = "#3F7D4F";
    const INK = "#6B6753";
    const INK_LIGHT = "#E4DCC8";

    // Letterhead
    doc.setFillColor(OUTFIELD);
    doc.rect(0, 0, pageWidth, 110, "F");
    doc.setFillColor(GOLD);
    doc.rect(0, 110, pageWidth, 4, "F");

    doc.setFillColor(GOLD);
    doc.circle(marginX + 20, 50, 20, "F");
    doc.setTextColor(OUTFIELD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("CCA", marginX + 20, 54, { align: "center" });

    doc.setTextColor("#FFFFFF");
    doc.setFontSize(16);
    doc.text("California Cricket Academy", marginX + 50, 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK_LIGHT);
    doc.text("Youth Training Programs", marginX + 50, 62);
    doc.text("California, USA   ·  calcricket_academy@yahoo.com", marginX + 50, 76);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(GOLD);
    doc.text("RECEIPT", pageWidth - marginX, 46, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor("#FFFFFF");
    doc.text(`# ${registrationNumber}`, pageWidth - marginX, 64, { align: "right" });
    doc.setTextColor(INK_LIGHT);
    doc.setFontSize(9);
    doc.text(
      new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      pageWidth - marginX,
      78,
      { align: "right" }
    );

    let y = 160;

    const ensureSpace = (height: number) => {
      if (y + height <= pageHeight - 95) return;
      doc.addPage();
      y = 56;
    };

    const estimateWrappedHeight = (text: string, width: number, lineHeight: number) => {
      return doc.splitTextToSize(text || "-", width).length * lineHeight;
    };

    // Paid badge
    doc.setFillColor(GRASS);
    const badgeLabel = "PAID";
    const badgeWidth = doc.getTextWidth(badgeLabel) + 28;
    doc.roundedRect(pageWidth - marginX - badgeWidth, y - 14, badgeWidth, 22, 11, 11, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(badgeLabel, pageWidth - marginX - badgeWidth / 2, y, { align: "center" });

    // Details
    const rowLabel = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(INK);
      doc.text(label, marginX, y);
      y += 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(OUTFIELD);
      doc.text(value, marginX, y);
      y += 30;
    };

    rowLabel("REGISTRATION", registrationNumber);
    rowLabel("PAYMENT METHOD", paymentMethod);

    // Itemized box
    doc.setFillColor(OUTFIELD);
    doc.rect(marginX, y, pageWidth - marginX * 2, 26, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DESCRIPTION", marginX + 12, y + 17);
    doc.text("AMOUNT", pageWidth - marginX - 12, y + 17, { align: "right" });
    y += 26;

    if (orderItems.length) {
      orderItems.forEach((item, index) => {
        const students = item.students ?? [];
        const schedule = splitScheduleItems(item.selectedDays);
        const hideBatchAndMonth = isRegularWithoutMonth(item);
        const studentCount = item.studentCount || students.length || 1;
        const itemTotal = item.itemTotal ?? ((item.feePerStudent || 0) * studentCount);
        const titleHeight = estimateWrappedHeight(item.programTitle || programName, pageWidth - marginX * 2 - 125, 13);
        const blockHeight = (hideBatchAndMonth ? 56 : 88) + titleHeight + Math.max(1, schedule.length) * 12 + Math.max(1, students.length) * 18;
        ensureSpace(blockHeight);

        const blockTop = y;
        doc.setDrawColor(INK_LIGHT);
        doc.setFillColor(index % 2 === 0 ? "#FFFFFF" : "#FBFAF5");
        doc.roundedRect(marginX, blockTop, pageWidth - marginX * 2, blockHeight, 8, 8, "FD");

        y += 18;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(OUTFIELD);
        doc.text(doc.splitTextToSize(item.programTitle || programName, pageWidth - marginX * 2 - 125), marginX + 14, y);
        doc.setTextColor(LEATHER);
        doc.text(money(itemTotal), pageWidth - marginX - 14, blockTop + 24, { align: "right" });
        y += titleHeight + 6;

        if (!hideBatchAndMonth) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(GOLD);
          doc.text("BATCH", marginX + 14, y);
          doc.text("MONTH", marginX + 230, y);
          y += 12;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(INK);
          doc.text(item.batchName || "-", marginX + 14, y, { maxWidth: 195 });
          doc.text(item.selectedMonthLabel || item.selectedMonth?.label || "-", marginX + 230, y, { maxWidth: 165 });
          y += 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(GOLD);
        doc.text("SCHEDULE", marginX + 14, y);
        y += 12;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(OUTFIELD);
        if (schedule.length) {
          schedule.forEach((day) => {
            doc.text(`- ${day}`, marginX + 20, y, { maxWidth: pageWidth - marginX * 2 - 40 });
            y += 12;
          });
        } else {
          doc.text("-", marginX + 20, y);
          y += 12;
        }

        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(GOLD);
        doc.text(`STUDENTS (${studentCount})`, marginX + 14, y);
        doc.text("PRICE", pageWidth - marginX - 14, y, { align: "right" });
        y += 12;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(OUTFIELD);
        if (students.length) {
          students.forEach((student) => {
            const name = `${student.firstName || ""} ${student.lastName || ""}`.trim() || "Student";
            const meta = [student.dob ? `DOB: ${student.dob}` : "", student.gender || ""].filter(Boolean).join(" - ");
            doc.text(name, marginX + 20, y, { maxWidth: 130 });
            if (meta) {
              doc.setTextColor(INK);
              doc.text(meta, marginX + 160, y, { maxWidth: 230 });
              doc.setTextColor(OUTFIELD);
            }
            doc.setFont("helvetica", "bold");
            doc.text(money(item.feePerStudent), pageWidth - marginX - 14, y, { align: "right" });
            doc.setFont("helvetica", "normal");
            y += 18;
          });
        } else {
          doc.text(`${studentCount} student(s)`, marginX + 20, y);
          doc.setFont("helvetica", "bold");
          doc.text(money(item.feePerStudent), pageWidth - marginX - 14, y, { align: "right" });
          doc.setFont("helvetica", "normal");
          y += 18;
        }

        y = blockTop + blockHeight + 14;
      });
    } else {
    doc.setDrawColor(INK_LIGHT);
    doc.setFillColor("#FFFFFF");
    doc.rect(marginX, y, pageWidth - marginX * 2, 32, "FD");
    doc.setTextColor(OUTFIELD);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${programName} — ${studentName}`, marginX + 12, y + 20);
    doc.text(`$${totalAmount}`, pageWidth - marginX - 12, y + 20, { align: "right" });
    y += 32 + 30;
    }

    // Payment breakdown
    ensureSpace(112);
    const totalsX = pageWidth - marginX - 200;
    doc.setDrawColor(INK_LIGHT);
    doc.line(totalsX, y, pageWidth - marginX, y);
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(OUTFIELD);
    doc.text("Original Price", totalsX, y);
    doc.text(money(subtotal), pageWidth - marginX, y, { align: "right" });
    y += 18;
    if (discountAmount > 0) {
      doc.setTextColor(GRASS);
      doc.text(`Discount${response?.couponCode ? ` (${response.couponCode})` : ""}`, totalsX, y);
      doc.text(`-${money(discountAmount)}`, pageWidth - marginX, y, { align: "right" });
      y += 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(OUTFIELD);
    doc.text("Transaction Amount", totalsX, y);
    doc.setTextColor(LEATHER);
    doc.text(money(totalAmount), pageWidth - marginX, y, { align: "right" });
    y += 44;

    // Payment method
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(INK);
    doc.text("PAYMENT METHOD", marginX, y);
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(OUTFIELD);
    doc.text(paymentMethod, marginX, y);

    // Footer
    doc.setDrawColor(INK_LIGHT);
    doc.line(marginX, pageHeight - 74, pageWidth - marginX, pageHeight - 74);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.text("Thank you for training with California Cricket Academy.", marginX, pageHeight - 54);
    doc.text("Questions about this receipt? Contact calcricket_academy@yahoo.com.", marginX, pageHeight - 40);
    doc.setFontSize(8);
    doc.text(
      "California Cricket Academy is a federally recognized 501(c)(3) nonprofit organization.",
      marginX,
      pageHeight - 24
    );

    doc.save(`Receipt-${registrationNumber}.pdf`);
  };

  return (
    <>
      <Navbar />
      <div className="h-20" />
      <main className="min-h-screen bg-[#f8fafc] text-[#0F172A]">
      <section className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
        <div className="rounded-[32px] bg-white p-8 shadow-2xl shadow-slate-200/50 ring-1 ring-slate-200/60 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            {/* Left */}
            <div className="space-y-7">
              {/* Success badge */}
              <div className="inline-flex items-center gap-3 rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                <HiOutlineCheckCircle className="h-5 w-5" />
                {paymentConfirmed ? "Registration Confirmed!" : "Registration Received"}
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
                  {paymentConfirmed ? "🎉 Your spot is reserved!" : "Your registration is awaiting payment"}
                </h1>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {paymentConfirmed
                    ? "Thank you for registering with CCA. Your enrollment is confirmed and your child is ready to begin their cricket journey!"
                    : "Thank you for registering with CCA. We will confirm enrollment after payment is successfully received."}
                </p>
              </div>

              {/* Registration details grid */}
              {/* <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Program", value: programName },
                  { label: "Student", value: studentName },
                  { label: "Payment Method", value: paymentMethod },
                  { label: "Total Paid", value: money(totalAmount) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
                    <p className="mt-2 text-base font-bold text-[#0F172A]">{value}</p>
                  </div>
                ))}
              </div> */}

              {orderItems.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-widest font-semibold text-slate-500">Registration Details</p>
                  {orderItems.map((item, index) => {
                    const students = item.students ?? [];
                    const schedule = splitScheduleItems(item.selectedDays);
                    const hideBatchAndMonth = isRegularWithoutMonth(item);
                    const itemTotal = item.itemTotal ?? ((item.feePerStudent || 0) * (item.studentCount || students.length || 1));
                    return (
                      <div key={`${item.programTitle || "program"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-widest font-semibold text-[#C9A227]">Program</p>
                            <h2 className="mt-1 text-lg font-bold text-[#0F172A]">{item.programTitle || programName}</h2>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Item total</p>
                            <p className="text-xl font-bold text-[#A33B2B]">{money(itemTotal)}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          {!hideBatchAndMonth && <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Batch</p>
                            <p className="mt-0.5 text-xs font-bold text-[#0F172A]">{item.batchName || "—"}</p>
                          </div>}
                          {!hideBatchAndMonth && <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Month</p>
                            <p className="mt-0.5 text-xs font-bold text-[#0F172A]">{item.selectedMonthLabel || item.selectedMonth?.label || "—"}</p>
                          </div>}
                          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Schedule</p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs font-bold text-[#0F172A]">
                              {schedule.length ? schedule.map((day) => <li key={day}>{day}</li>) : <li className="list-none -ml-4">—</li>}
                            </ul>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <p className="text-xs uppercase tracking-widest font-semibold text-slate-400">Students ({item.studentCount || students.length})</p>
                          <div className="mt-3 space-y-2">
                            {students.map((student, studentIndex) => (
                              <div key={`${student.firstName || ""}-${student.lastName || ""}-${studentIndex}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#ECE6D4] px-4 py-3">
                                <p className="text-sm font-bold text-[#0F172A]">
                                  {`${student.firstName || ""} ${student.lastName || ""}`.trim() || "Student"}
                                  <span className="ml-2 text-xs font-medium text-slate-500">{student.dob ? `DOB: ${student.dob}` : ""}{student.gender ? ` · ${student.gender}` : ""}</span>
                                </p>
                                <p className="text-sm font-bold text-[#0F172A]">{money(item.feePerStudent)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Payment Summary</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-slate-600">Original price</span><span className="font-semibold">{money(subtotal)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between gap-4 text-green-700"><span>Discount{response?.couponCode ? ` (${response.couponCode})` : ""}</span><span className="font-semibold">-{money(discountAmount)}</span></div>}
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 text-base"><span className="font-bold">Transaction amount</span><span className="font-bold text-[#A33B2B]">{money(totalAmount)}</span></div>
                  <div className="flex justify-between gap-4 text-xs text-slate-500"><span>Payment method</span><span>{paymentMethod}</span></div>
                  {response?.transactionId && <div className="flex justify-between gap-4 text-xs text-slate-500"><span>Transaction ID</span><span className="break-all text-right">{response.transactionId}</span></div>}
                </div>
              </div>

              {/* Notification confirmation */}
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-[#0F172A] mb-2">Email confirmation</p>
                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    📧 Email
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Check your registered email for the confirmation and invoice. You can also download this verified receipt below.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  to="/programs"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#A33B2B] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-[#A33B2B]/20 hover:bg-[#ea7a2e] transition"
                >
                  <HiOutlineHome className="h-4 w-4" />
                  Explore More Programs
                </Link>
                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3 text-sm font-semibold text-slate-700 hover:border-[#A33B2B] hover:text-[#0F172A] transition"
                >
                  <HiOutlineArrowDownTray className="h-4 w-4" />
                  Download Receipt
                </button>
              </div>
            </div>

            {/* Right — What happens next */}
            <aside className="space-y-5 rounded-[28px] border border-slate-200 bg-[#FEF4E6] p-6 sm:p-8">
              <div className="rounded-[20px] bg-white p-5 shadow-sm">
                <p className="text-sm uppercase tracking-widest text-[#A33B2B] font-semibold">What Happens Next</p>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="font-bold text-[#0F172A]">📧 Confirmation Email</p>
                    <p className="mt-1 text-xs">Invoice + barcode sent to your email within minutes.</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="font-bold text-[#0F172A]">🏏 Coach Onboarding</p>
                    <p className="mt-1 text-xs">Coach will reach out to schedule orientation and share prep materials.</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="font-bold text-[#0F172A]">📋 Dashboard Access</p>
                    <p className="mt-1 text-xs">Login to view course materials, schedule and attendance.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] bg-white p-5 shadow-sm">
                <p className="text-sm uppercase tracking-widest text-slate-500">Need Support?</p>
                <p className="mt-2 text-sm text-slate-600">
                  Contact us if you need to update your registration or have questions.
                </p>
                <div className="mt-3 rounded-xl bg-[#A33B2B]/10 px-4 py-3 text-sm font-semibold text-[#A33B2B]">
                  support@cca.example
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
      <Footer />
      {feedbackOpen && (
        <div
          className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-white/80 p-4 backdrop-blur-md"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && closeFeedback()}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="relative w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
          >
            <button
              type="button"
              onClick={closeFeedback}
              aria-label="Close feedback"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:text-[#A33B2B]"
            >
              <HiOutlineXMark className="h-6 w-6" />
            </button>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A33B2B]">Quick feedback</p>
            <h2 id="feedback-title" className="mt-2 pr-12 text-2xl font-bold text-[#0F172A]">How was your registration experience?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Share a rating, a comment, or both. You can also choose Not now.</p>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-[#0F172A]">Overall experience</legend>
              <div className="mt-3 flex gap-2" aria-label="Overall experience rating">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => { setFeedbackRating(rating); setFeedbackError(""); }}
                    aria-label={`${rating} out of 5 stars`}
                    aria-pressed={feedbackRating === rating}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${rating <= (feedbackRating || 0) ? "border-[#C9A227] bg-[#FEF4E6] text-[#C9A227]" : "border-slate-200 bg-white text-slate-300 hover:border-[#C9A227]"}`}
                  >
                    <HiStar className="h-6 w-6" />
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="mt-6 block text-sm font-semibold text-[#0F172A]" htmlFor="registration-feedback">Anything else you would like us to know?</label>
            <textarea
              id="registration-feedback"
              value={feedbackText}
              onChange={(event) => { setFeedbackText(event.target.value); setFeedbackError(""); }}
              maxLength={2000}
              rows={5}
              placeholder="Share your feedback (optional)"
              className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#0F172A] outline-none transition focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20"
            />
            <div className="mt-1 text-right text-xs text-slate-400">{feedbackText.length}/2000</div>
            {feedbackError && <p role="alert" className="mt-2 text-sm text-red-600">{feedbackError}</p>}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeFeedback} disabled={feedbackSaving} className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Not now</button>
              <button type="button" onClick={submitFeedback} disabled={feedbackSaving} className="rounded-full bg-[#A33B2B] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-[#A33B2B]/20 disabled:cursor-not-allowed disabled:opacity-60">
                {feedbackSaving ? "Sending…" : "Submit feedback"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default SuccessPage;
