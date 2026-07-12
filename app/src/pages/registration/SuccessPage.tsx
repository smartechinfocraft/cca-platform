import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { Link, useLocation } from "react-router-dom";
import { jsPDF } from "jspdf";
import { HiOutlineCheckCircle, HiOutlineArrowDownTray, HiOutlineHome } from "react-icons/hi2";

interface SuccessData {
  registrationNumber?: string;
  studentName?: string;
  programName?: string;
  paymentMethod?: string;
  totalAmount?: number;
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
    .split(/\s*(?:\n|;|\s+\|\s+|,\s*(?=[A-Z][a-z]+day\b))\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

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
  const response = stateResponse ?? storedResponse;

  const registrationNumber =
    response?.registrationNumber ?? `CCA-${Date.now().toString(36).toUpperCase()}`;
  const studentName = response?.studentName ?? "—";
  const programName = response?.programName ?? "—";
  const paymentMethod = response?.paymentMethod ?? "—";
  const totalAmount = response?.totalAmount ?? 0;
  const orderItems = response?.orderItems ?? [];

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
    doc.text("10307 Bret Ave, Cupertino, CA 95014  ·  (408) 777-9983  ·  cca@calcricket.org", marginX + 50, 76);

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
        const studentCount = item.studentCount || students.length || 1;
        const itemTotal = item.itemTotal ?? ((item.feePerStudent || 0) * studentCount);
        const titleHeight = estimateWrappedHeight(item.programTitle || programName, pageWidth - marginX * 2 - 125, 13);
        const blockHeight = 88 + titleHeight + Math.max(1, schedule.length) * 12 + Math.max(1, students.length) * 18;
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

    // Total
    ensureSpace(84);
    const totalsX = pageWidth - marginX - 200;
    doc.setDrawColor(INK_LIGHT);
    doc.line(totalsX, y, pageWidth - marginX, y);
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(OUTFIELD);
    doc.text("Total Paid", totalsX, y);
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
    doc.text("Questions about this receipt? Contact cca@calcricket.org or (408) 777-9983.", marginX, pageHeight - 40);
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
                Registration Confirmed!
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
                  🎉 Your spot is reserved!
                </h1>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Thank you for registering with CCA. Your enrollment is confirmed and
                  your child is ready to begin their cricket journey!
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
                  <p className="text-xs uppercase tracking-widest font-semibold text-slate-500">Order Details</p>
                  {orderItems.map((item, index) => {
                    const students = item.students ?? [];
                    const schedule = splitScheduleItems(item.selectedDays);
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
                          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Batch</p>
                            <p className="mt-0.5 text-xs font-bold text-[#0F172A]">{item.batchName || "—"}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Month</p>
                            <p className="mt-0.5 text-xs font-bold text-[#0F172A]">{item.selectedMonthLabel || item.selectedMonth?.label || "—"}</p>
                          </div>
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

              {/* Notification confirmation */}
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-[#0F172A] mb-2">Confirmation Sent Via:</p>
                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    📧 Email
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    💬 WhatsApp
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Invoice and barcode will be delivered to your registered email & WhatsApp.
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
                    <p className="font-bold text-[#0F172A]">💬 WhatsApp Message</p>
                    <p className="mt-1 text-xs">Registration summary sent to your WhatsApp number.</p>
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
    </>
  );
}

export default SuccessPage;
