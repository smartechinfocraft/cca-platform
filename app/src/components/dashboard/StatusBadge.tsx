// ============================================================
//  components/dashboard/StatusBadge.tsx
//  Small color-coded pill used across the dashboard to show
//  registration status and payment status consistently.
// ============================================================

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-700",
  PAID: "bg-green-100 text-green-700",
  SUCCESS: "bg-green-100 text-green-700",
  PRESENT: "bg-green-100 text-green-700",

  PENDING: "bg-amber-100 text-amber-700",
  AWAITING_PAYMENT: "bg-amber-100 text-amber-700",
  WAITLISTED: "bg-amber-100 text-amber-700",
  LATE: "bg-amber-100 text-amber-700",

  CANCELLED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
  ABSENT: "bg-red-100 text-red-700",

  REFUNDED: "bg-slate-200 text-slate-600",
  EXCUSED: "bg-blue-100 text-blue-700",
};

const STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting Payment",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || "bg-slate-100 text-slate-600";
  const label = STATUS_LABELS[status] || status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize ${style}`}>
      {label.toLowerCase()}
    </span>
  );
}

export default StatusBadge;
