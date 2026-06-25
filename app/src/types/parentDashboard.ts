// ============================================================
//  types/parentDashboard.ts — Shared types for the Parent
//  Dashboard module (dashboard, purchases, students, profile).
// ============================================================

export interface ProgramRef {
  _id: string;
  title: string;
  coverImageUrl?: string;
  basePrice?: number;
  discountedPrice?: number;
  sku?: string;
  startDate?: string;
  endDate?: string;
}

export interface BatchRef {
  _id: string;
  title?: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
}

export interface StudentRef {
  _id: string;
  firstName: string;
  lastName: string;
  studentCode?: string;
  photoUrl?: string;
  dob?: string;
  gender?: string;
}

export type RegistrationStatus =
  | "PENDING" | "AWAITING_PAYMENT" | "PAID" | "CONFIRMED"
  | "CANCELLED" | "REFUNDED" | "WAITLISTED";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
export type PaymentMethod = "PAYPAL" | "CHECK" | "PENDING";

export interface Registration {
  _id: string;
  registrationNumber: string;
  programId: ProgramRef;
  students: StudentRef[];
  batches: BatchRef[];
  status: RegistrationStatus;
  subtotal: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId?: string;
  checkNumber?: string;
  customerNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  _id: string;
  studentId: string | StudentRef;
  programId?: ProgramRef;
  batchId?: BatchRef;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note?: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late?: number;
  excused?: number;
  total: number;
  percentage: number | null;
}

export interface StudentWithSummary extends StudentRef {
  parentId: string;
  schoolName?: string;
  medicalNotes?: string;
  isActive?: boolean;
  createdAt: string;
  attendanceSummary: AttendanceSummary;
  programs: {
    registrationId: string;
    registrationNumber: string;
    status: RegistrationStatus;
    programTitle?: string;
  }[];
}

export interface DashboardStats {
  totalPrograms: number;
  activePrograms: number;
  totalStudents: number;
  totalSpent: number;
  pendingPayments: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentRegistrations: Registration[];
  students: StudentRef[];
  recentAttendance: AttendanceRecord[];
}

export interface ParentProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  photoUrl?: string;
  createdAt?: string;
}
