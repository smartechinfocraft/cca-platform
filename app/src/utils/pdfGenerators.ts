// ============================================================
//  utils/pdfGenerators.ts
//  Builds downloadable PDFs entirely on the client with jsPDF —
//  no server-side PDF rendering needed. Two generators:
//    - buildInvoicePdf(...)   → itemized purchase / payment invoice
//    - buildIdCardPdf(...)    → student ID card (credit-card size)
// ============================================================
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Registration, ParentProfile } from "../types/parentDashboard";
import type { StudentWithSummary } from "../types/parentDashboard";

const OUTFIELD = "#1F2E1E";
const GOLD = "#C9A227";
const LEATHER = "#A33B2B";
const GRASS = "#3F7D4F";
const INK = "#6B6753";
const INK_LIGHT = "#E4DCC8";
const PITCH_SOFT = "#ECE6D4";

const ACADEMY = {
  name: "California Cricket Academy",
  tagline: "Youth Training Programs",
  address: "10307 Bret Ave, Cupertino, CA 95014",
  phone: "(408) 777-9983",
  email: "cca@calcricket.org",
};

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const money = (n?: number) => `$${(n ?? 0).toFixed(2)}`;

// ── Invoice PDF ──────────────────────────────────────────────
// One line item PER STUDENT (not one combined line for the whole
// registration), so a multi-child registration shows exactly what
// was charged for each child — what "too bad UI" in the old
// version was really missing: real itemization, not just a total.
export function buildInvoicePdf(registration: Registration, parent: ParentProfile) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 50;

  // ── Letterhead ──
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
  doc.text(ACADEMY.name, marginX + 50, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK_LIGHT);
  doc.text(ACADEMY.tagline, marginX + 50, 62);
  doc.text(`${ACADEMY.address}  ·  ${ACADEMY.phone}  ·  ${ACADEMY.email}`, marginX + 50, 76);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(GOLD);
  doc.text("INVOICE", pageWidth - marginX, 46, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#FFFFFF");
  doc.text(`# ${registration.registrationNumber}`, pageWidth - marginX, 64, { align: "right" });
  doc.setTextColor(INK_LIGHT);
  doc.setFontSize(9);
  doc.text(formatDate(registration.createdAt), pageWidth - marginX, 78, { align: "right" });

  let y = 150;

  // ── Status badge ──
  const isPaid = registration.paymentStatus === "SUCCESS";
  const badgeColor = isPaid ? GRASS : "#B45309";
  const badgeLabel = isPaid ? "PAID" : registration.paymentStatus;
  doc.setFillColor(badgeColor);
  const badgeWidth = doc.getTextWidth(badgeLabel) + 28;
  doc.roundedRect(pageWidth - marginX - badgeWidth, y - 14, badgeWidth, 22, 11, 11, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(badgeLabel, pageWidth - marginX - badgeWidth / 2, y, { align: "center" });

  // ── Bill To ──
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("BILLED TO", marginX, y);
  y += 16;
  doc.setTextColor(OUTFIELD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`${parent.firstName} ${parent.lastName}`, marginX, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK);
  doc.text(parent.email, marginX, y);
  y += 13;
  if (parent.phone) { doc.text(parent.phone, marginX, y); y += 13; }
  const addressLine = [parent.address, parent.city, parent.state, parent.zip].filter(Boolean).join(", ");
  if (addressLine) { doc.text(addressLine, marginX, y); y += 13; }

  y += 24;

  // ── Program summary line ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(INK);
  doc.text("PROGRAM", marginX, y);
  y += 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(OUTFIELD);
  doc.text(registration.programId?.title || "CCA Program", marginX, y);

  const batchLabel = registration.batches?.length
    ? registration.batches.map(b => `${b.title || ""} ${b.dayOfWeek || ""} ${b.startTime || ""}-${b.endTime || ""}`.trim()).filter(Boolean).join("  ·  ")
    : "Schedule to be confirmed";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK);
  doc.text(batchLabel, marginX, y + 16);

  y += 42;

  // ── Itemized line-item table: one row per student ──
  const colDesc = marginX + 12;
  const colCode = pageWidth - marginX - 220;
  const colAmt = pageWidth - marginX - 12;

  doc.setFillColor(OUTFIELD);
  doc.rect(marginX, y, pageWidth - marginX * 2, 26, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("STUDENT", colDesc, y + 17);
  doc.text("MEMBER ID", colCode, y + 17);
  doc.text("AMOUNT", colAmt, y + 17, { align: "right" });
  y += 26;

  const students = registration.students?.length ? registration.students : [];
  const perStudentAmount = students.length > 0 ? registration.subtotal / students.length : registration.subtotal;
  const rowHeight = 32;

  if (students.length === 0) {
    doc.setDrawColor(INK_LIGHT);
    doc.setFillColor("#FFFFFF");
    doc.rect(marginX, y, pageWidth - marginX * 2, rowHeight, "FD");
    doc.setTextColor(OUTFIELD);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(registration.customerNote || "Registration", colDesc, y + 20);
    doc.text(money(registration.subtotal), colAmt, y + 20, { align: "right" });
    y += rowHeight;
  } else {
    students.forEach((s, i) => {
      const rowBg = i % 2 === 0 ? "#FFFFFF" : PITCH_SOFT;
      doc.setFillColor(rowBg);
      doc.rect(marginX, y, pageWidth - marginX * 2, rowHeight, "F");
      doc.setDrawColor(INK_LIGHT);
      doc.line(marginX, y + rowHeight, pageWidth - marginX, y + rowHeight);

      doc.setTextColor(OUTFIELD);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${s.firstName} ${s.lastName}`, colDesc, y + 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(INK);
      doc.text(s.studentCode || "—", colCode, y + 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(OUTFIELD);
      doc.text(money(perStudentAmount), colAmt, y + 20, { align: "right" });

      y += rowHeight;
    });
  }

  y += 30;

  // ── Totals ──
  const totalsX = pageWidth - marginX - 200;
  const rows: [string, string][] = [["Subtotal", money(registration.subtotal)]];
  if (registration.discountAmount) rows.push(["Discount", `-${money(registration.discountAmount)}`]);

  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(label, totalsX, y);
    doc.setTextColor(OUTFIELD);
    doc.text(value, pageWidth - marginX, y, { align: "right" });
    y += 18;
  });

  y += 34;

  if (y > pageHeight - 210) {
    doc.addPage();
    y = 60;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(INK);
  doc.text("WAIVER & CONSENT", marginX, y);
  y += 16;

  doc.setFillColor(PITCH_SOFT);
  doc.roundedRect(marginX, y - 10, pageWidth - marginX * 2, 94, 8, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(OUTFIELD);
  doc.text(`Consent Accepted: ${registration.waiverAccepted ? "Yes" : "No"}`, marginX + 14, y + 6);
  doc.text(`Typed Signature: ${registration.waiverSignature || "Not captured"}`, marginX + 14, y + 22);
  doc.text(`Accepted At: ${formatDate(registration.waiverAcceptedAt || registration.createdAt)}`, marginX + 14, y + 38);
  doc.text(`Agreement Version: ${registration.waiverAgreementVersion || "Not captured"}`, marginX + 14, y + 54);

  if (registration.waiverDrawnSignature?.startsWith("data:image")) {
    doc.setTextColor(INK);
    doc.text("Drawn Signature:", pageWidth - marginX - 190, y + 6);
    try {
      doc.addImage(registration.waiverDrawnSignature, "PNG", pageWidth - marginX - 190, y + 14, 176, 50);
    } catch {
      doc.setTextColor(LEATHER);
      doc.text("Drawn signature could not be rendered.", pageWidth - marginX - 190, y + 26);
    }
  } else {
    doc.setTextColor(INK);
    doc.text("Drawn Signature: Not captured", pageWidth - marginX - 190, y + 22);
  }

  doc.setDrawColor(INK_LIGHT);
  doc.line(totalsX, y, pageWidth - marginX, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(OUTFIELD);
  doc.text("Total Paid", totalsX, y);
  doc.setTextColor(LEATHER);
  doc.text(money(registration.totalAmount), pageWidth - marginX, y, { align: "right" });

  y += 44;

  // ── Payment method ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(INK);
  doc.text("PAYMENT METHOD", marginX, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(OUTFIELD);
  doc.text(registration.paymentMethod, marginX, y);
  if (registration.transactionId) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.text(`Transaction ID: ${registration.transactionId}`, marginX, y + 15);
  }
  if (registration.checkNumber) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.text(`Check #: ${registration.checkNumber}`, marginX, y + 15);
  }

  // ── Footer ──
  doc.setDrawColor(INK_LIGHT);
  doc.line(marginX, pageHeight - 74, pageWidth - marginX, pageHeight - 74);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK);
  doc.text("Thank you for training with California Cricket Academy.", marginX, pageHeight - 54);
  doc.text(`Questions about this invoice? Contact ${ACADEMY.email} or ${ACADEMY.phone}.`, marginX, pageHeight - 40);
  doc.setFontSize(8);
  doc.text("California Cricket Academy is a federally recognized 501(c)(3) nonprofit organization.", marginX, pageHeight - 24);

  doc.save(`Invoice-${registration.registrationNumber}.pdf`);
}

// ── Student ID Card PDF ──────────────────────────────────────
// Renders a single credit-card-sized (3.375in x 2.125in) ID card
// onto an A4 page so it prints / saves cleanly.
//
// NOTE: this card intentionally has NO student photo. Instead it
// carries a QR code that encodes the student's studentCode in
// plain text — the exact same code the Coach Portal's scanner
// (src/coach/pages/Scan.jsx) reads directly to mark attendance in
// real time. Scanning the card pulls up the student's full record
// in the coach app immediately; the card itself only needs to show
// enough for a human to recognize at a glance, plus the scannable
// code as a human-readable fallback if the QR can't be scanned.
export async function buildIdCardPdf(student: StudentWithSummary, programTitle?: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const cardW = 3.375 * 72; // 243pt
  const cardH = 2.125 * 72; // 153pt
  const cardX = (pageWidth - cardW) / 2;
  const cardY = 100;

  // Card background
  doc.setFillColor(OUTFIELD);
  doc.roundedRect(cardX, cardY, cardW, cardH, 12, 12, "F");

  // Orange accent stripe / header
  doc.setFillColor(GOLD);
  doc.roundedRect(cardX, cardY, cardW, 34, 12, 12, "F");
  doc.setFillColor(OUTFIELD);
  doc.rect(cardX, cardY + 22, cardW, 12, "F");

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CALIFORNIA CRICKET ACADEMY", cardX + 12, cardY + 22);

  // QR code — encodes the studentCode as plain text, scanned directly
  // by the Coach Portal to mark real-time attendance.
  const qrSize = 64;
  const qrX = cardX + 14;
  const qrY = cardY + 46;

  let qrDrawn = false;
  if (student.studentCode) {
    try {
      const qrDataUrl = await generateQrDataUrl(student.studentCode);
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      qrDrawn = true;
    } catch {
      qrDrawn = false;
    }
  }
  if (!qrDrawn) {
    doc.setFillColor("#1E293B");
    doc.rect(qrX, qrY, qrSize, qrSize, "F");
    doc.setTextColor("#94A3B8");
    doc.setFontSize(7);
    doc.text("QR CODE", qrX + qrSize / 2, qrY + qrSize / 2 + 3, { align: "center" });
  }
  doc.setDrawColor(GOLD);
  doc.rect(qrX, qrY, qrSize, qrSize, "S");

  // Student details
  const textX = qrX + qrSize + 14;
  let ty = qrY + 12;
  doc.setTextColor("#94A3B8");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("STUDENT NAME", textX, ty);
  ty += 12;
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`${student.firstName} ${student.lastName}`, textX, ty);

  ty += 16;
  doc.setTextColor("#94A3B8");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("MEMBER ID", textX, ty);
  ty += 12;
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(student.studentCode || "—", textX, ty);

  ty += 16;
  doc.setTextColor("#94A3B8");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("PROGRAM", textX, ty);
  ty += 12;
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(programTitle || "CCA Program", cardW - (textX - cardX) - 10), textX, ty);

  // Bottom strip
  doc.setFillColor("#1E293B");
  doc.rect(cardX, cardY + cardH - 18, cardW, 18, "F");
  doc.setTextColor("#94A3B8");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Scan QR at check-in  •  Valid for current season", cardX + cardW / 2, cardY + cardH - 6, { align: "center" });

  // Instructions below the card
  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Print this card, cut along the edges, and laminate for daily use at check-in.", pageWidth / 2, cardY + cardH + 40, { align: "center" });
  doc.setFontSize(9);
  doc.text("Coaches scan the QR code with the Coach Portal app to mark attendance instantly.", pageWidth / 2, cardY + cardH + 56, { align: "center" });

  doc.save(`ID-Card-${student.studentCode || student.firstName}.pdf`);
}

// Helper: generate a QR code as a data URL using the `qrcode` package.
// Encodes the raw studentCode string — no JSON wrapper — because that's
// exactly what the Coach Portal scanner sends straight to the
// scanAttendance API as `studentCode`. Keeping it plain text also means
// any generic QR reader (not just our app) can still show a human the
// code if needed.
async function generateQrDataUrl(text: string): Promise<string> {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 256,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });
}

// ── Custom Report PDF ────────────────────────────────────────
// Renders the Admin "Custom Report Builder" results (same data as
// the CSV export) as a clean, presentation-ready PDF: branded
// letterhead, the active filters, a totals strip, a striped
// autoTable, and a page-numbered footer with a generated timestamp
// on every page.
export interface CustomReportRow {
  _id?: string;
  name?: string;
  revenue: number;
  count: number;
  avgValue: number;
  discount: number;
}

export interface CustomReportTotals {
  revenue: number;
  count: number;
  discount: number;
}

export interface CustomReportFilterLabels {
  program?: string;
  location?: string;
  level?: string;
  status?: string;
  from?: string;
  to?: string;
}

export function buildCustomReportPdf(
  rows: CustomReportRow[],
  totals: CustomReportTotals,
  filters: CustomReportFilterLabels,
  generatedAt?: string
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  // ── Letterhead ──
  doc.setFillColor(OUTFIELD);
  doc.rect(0, 0, pageWidth, 80, "F");
  doc.setFillColor(GOLD);
  doc.rect(0, 80, pageWidth, 3, "F");

  doc.setFillColor(GOLD);
  doc.circle(marginX + 16, 38, 16, "F");
  doc.setTextColor(OUTFIELD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CCA", marginX + 16, 41, { align: "center" });

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(ACADEMY.name, marginX + 42, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(INK_LIGHT);
  doc.text(ACADEMY.tagline, marginX + 42, 48);
  doc.text(`${ACADEMY.address}  ·  ${ACADEMY.phone}  ·  ${ACADEMY.email}`, marginX + 42, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(GOLD);
  doc.text("CUSTOM REPORT", pageWidth - marginX, 36, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(INK_LIGHT);
  doc.text(formatDate(generatedAt || new Date().toISOString()), pageWidth - marginX, 50, { align: "right" });

  let y = 104;

  // ── Filters applied ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(INK);
  doc.text("FILTERS APPLIED", marginX, y);
  y += 16;

  const filterLines: string[] = [
    `Program: ${filters.program || "All Programs"}`,
    `Location: ${filters.location || "All Locations"}`,
    `Level: ${filters.level || "All Levels"}`,
    `Status: ${filters.status || "All Statuses"}`,
    `From: ${filters.from || "—"}`,
    `To: ${filters.to || "—"}`,
  ];

  // Stack each filter on its own line (instead of a fixed-width grid) so
  // long values — e.g. a long Program title — never overlap the next
  // filter's text. Each line is also wrapped to the available content
  // width in case a single value is very long.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(OUTFIELD);
  const contentWidth = pageWidth - marginX * 2;
  const lineHeight = 13;
  filterLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * lineHeight;
  });
  y += 10;

  // ── Totals strip ──
  doc.setFillColor(PITCH_SOFT);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, 36, 6, 6, "F");
  const totalsCols = [
    { label: "Total Revenue", value: money(totals.revenue), color: GOLD },
    { label: "Registrations", value: String(totals.count), color: GRASS },
    { label: "Total Discounts", value: money(totals.discount), color: LEATHER },
  ];
  const totalsColWidth = (pageWidth - marginX * 2) / totalsCols.length;
  totalsCols.forEach((t, i) => {
    const cx = marginX + i * totalsColWidth + 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(INK);
    doc.text(t.label.toUpperCase(), cx, y + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(t.color);
    doc.text(t.value, cx, y + 28);
  });

  y += 56;

  // ── Data table ──
  const head = [["Program", "Revenue", "Count", "Avg Value", "Discount"]];
  const body = rows.length
    ? rows.map((r) => [
        r.name || "—",
        money(r.revenue),
        String(r.count),
        money(r.avgValue),
        money(r.discount),
      ])
    : [["No matching records found for the selected filters.", "", "", "", ""]];

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: marginX, right: marginX },
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 8,
      textColor: OUTFIELD,
      lineColor: INK_LIGHT,
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: OUTFIELD,
      textColor: "#FFFFFF",
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: PITCH_SOFT },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 90 },
      2: { halign: "right", cellWidth: 70 },
      3: { halign: "right", cellWidth: 90 },
      4: { halign: "right", cellWidth: 90 },
    },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageW = doc.internal.pageSize.getWidth();
      const pageCount = doc.getNumberOfPages();
      const currentPage = doc.getCurrentPageInfo().pageNumber;

      doc.setDrawColor(INK_LIGHT);
      doc.line(marginX, pageHeight - 40, pageW - marginX, pageHeight - 40);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(INK);
      doc.text(`Generated on ${formatDate(generatedAt || new Date().toISOString())}`, marginX, pageHeight - 24);
      doc.text(`Page ${currentPage} of ${pageCount}`, pageW - marginX, pageHeight - 24, { align: "right" });
    },
  });

  const dateStamp = new Date().toISOString().split("T")[0];
  doc.save(`CCA_Report_${(filters.program || "All").replace(/\s+/g, "_")}_${dateStamp}.pdf`);
}
