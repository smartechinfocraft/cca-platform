// ============================================================
//  pages/dashboard/PurchaseHistory.tsx
//  Full order history: program, payment method/status, amount,
//  students covered, and a one-click "Download Invoice" PDF.
// ============================================================
import { useEffect, useState } from "react";
import {
  HiOutlineArrowDownTray,
  HiOutlineReceiptPercent,
  HiOutlineCreditCard,
  HiOutlineBanknotes,
} from "react-icons/hi2";
import { useAuth } from "../../context/AuthContext";
import { getPurchaseHistory, getPurchaseDetail } from "../../services/parentDashboardService";
import type { Registration, RegistrationStatus, PaymentStatus } from "../../types/parentDashboard";
import StatusBadge from "../../components/dashboard/StatusBadge";
import { buildInvoicePdf } from "../../utils/pdfGenerators";
import toast from "react-hot-toast";

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

type StatusFilter = "ALL" | RegistrationStatus;
type PayFilter = "ALL" | PaymentStatus;

function PurchaseHistory() {
  const { token } = useAuth();
  const [purchases, setPurchases] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [payFilter, setPayFilter] = useState<PayFilter>("ALL");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getPurchaseHistory(token)
      .then(setPurchases)
      .catch(() => setError("Couldn't load your purchase history. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = purchases.filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (payFilter !== "ALL" && p.paymentStatus !== payFilter) return false;
    return true;
  });

  // Sum all non-cancelled/refunded registrations.
  // Check payments stay as paymentStatus=PENDING until admin confirms —
  // filtering only SUCCESS would always show $0 for check-paying families.
  const totalSpent = purchases
    .filter(p => !["CANCELLED", "REFUNDED"].includes(p.status))
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  const handleDownloadInvoice = async (registrationId: string) => {
    if (!token) return;
    setDownloadingId(registrationId);
    try {
      const { registration, parent } = await getPurchaseDetail(token, registrationId);
      buildInvoicePdf(registration, parent);
    } catch {
      toast.error("Couldn't generate the invoice. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">Purchase History</h1>
        <p className="text-slate-500 mt-1">View payments and program registrations, and download invoices.</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Orders</p>
          <p className="text-xl font-bold text-[#0F172A] mt-1">{purchases.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Paid</p>
          <p className="text-xl font-bold text-[#0F172A] mt-1">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Pending Payments</p>
          <p className="text-xl font-bold text-amber-600 mt-1">
            {purchases.filter(p => p.paymentStatus === "PENDING").length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 outline-none focus:border-[#F97316]"
        >
          <option value="ALL">All Statuses</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PAID">Paid</option>
          <option value="AWAITING_PAYMENT">Awaiting Payment</option>
          <option value="PENDING">Pending</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REFUNDED">Refunded</option>
          <option value="WAITLISTED">Waitlisted</option>
        </select>
        <select
          value={payFilter}
          onChange={(e) => setPayFilter(e.target.value as PayFilter)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 outline-none focus:border-[#F97316]"
        >
          <option value="ALL">All Payments</option>
          <option value="SUCCESS">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map(i => <div key={i} className="h-28 rounded-3xl bg-white ring-1 ring-slate-200/60" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/60">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <HiOutlineReceiptPercent className="h-6 w-6 text-slate-400" />
          </div>
          <p className="font-semibold text-[#0F172A]">
            {purchases.length === 0 ? "No purchases yet" : "No purchases match these filters"}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {purchases.length === 0
              ? "Programs you register your child for will appear here with full payment details."
              : "Try adjusting the filters above."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((reg) => (
            <div key={reg._id} className="rounded-3xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-slate-200/60">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#FEF4E6] flex items-center justify-center flex-shrink-0">
                    {reg.paymentMethod === "PAYPAL" ? (
                      <HiOutlineCreditCard className="h-6 w-6 text-[#F97316]" />
                    ) : (
                      <HiOutlineBanknotes className="h-6 w-6 text-[#F97316]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#0F172A] truncate">{reg.programId?.title || "CCA Program"}</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{reg.registrationNumber}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {reg.students?.map(s => s.firstName + " " + s.lastName).join(", ") || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <p className="text-lg font-bold text-[#0F172A]">${reg.totalAmount?.toFixed(2)}</p>
                  <div className="flex gap-2">
                    <StatusBadge status={reg.status} />
                    <StatusBadge status={reg.paymentStatus} />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                  <span><span className="font-semibold text-slate-600">Ordered:</span> {formatDate(reg.createdAt)}</span>
                  <span><span className="font-semibold text-slate-600">Payment:</span> {reg.paymentMethod}</span>
                  {reg.transactionId && (
                    <span className="font-mono"><span className="font-semibold text-slate-600">Txn:</span> {reg.transactionId}</span>
                  )}
                  {reg.batches?.length > 0 && (
                    <span>
                      <span className="font-semibold text-slate-600">Batch:</span>{" "}
                      {reg.batches.map(b => `${b.title || ""} ${b.dayOfWeek || ""}`.trim()).join(", ")}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleDownloadInvoice(reg._id)}
                  disabled={downloadingId === reg._id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-[#F97316] hover:text-[#0F172A] transition disabled:opacity-50"
                >
                  <HiOutlineArrowDownTray className="h-4 w-4" />
                  {downloadingId === reg._id ? "Preparing..." : "Download Invoice"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PurchaseHistory;