// ============================================================
//  services/parentDashboardService.ts
//  All API calls for the logged-in Parent Dashboard module.
//  Every endpoint here is scoped server-side to the parent's
//  own JWT (see backend parentAuth middleware) — a parent can
//  only ever see their own purchases / students / profile.
// ============================================================
import api from "../api/axios";
import type {
  DashboardData,
  Registration,
  StudentWithSummary,
  ParentProfile,
  AttendanceRecord,
  AttendanceSummary,
} from "../types/parentDashboard";

const authHeaders = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

// ── Dashboard overview ────────────────────────────────────────
export const getParentDashboard = async (token: string): Promise<DashboardData> => {
  const res = await api.get("/public/parent/dashboard", authHeaders(token));
  return res.data.data;
};

// ── Purchase history ───────────────────────────────────────────
export const getPurchaseHistory = async (token: string): Promise<Registration[]> => {
  const res = await api.get("/public/parent/purchases", authHeaders(token));
  return res.data.data;
};

export const getPurchaseDetail = async (
  token: string,
  registrationId: string
): Promise<{ registration: Registration; parent: ParentProfile }> => {
  const res = await api.get(`/public/parent/purchases/${registrationId}`, authHeaders(token));
  return res.data.data;
};

// ── Students ───────────────────────────────────────────────────
export const getMyStudents = async (token: string): Promise<StudentWithSummary[]> => {
  const res = await api.get("/public/parent/students", authHeaders(token));
  return res.data.data;
};

export interface StudentDetailResponse {
  student: StudentWithSummary;
  registrations: Registration[];
  attendance: AttendanceRecord[];
  attendanceSummary: AttendanceSummary;
}

export const getStudentDetail = async (
  token: string,
  studentId: string
): Promise<StudentDetailResponse> => {
  const res = await api.get(`/public/parent/students/${studentId}`, authHeaders(token));
  return res.data.data;
};

export const uploadStudentPhoto = async (
  token: string,
  studentId: string,
  file: File
): Promise<StudentWithSummary> => {
  const formData = new FormData();
  formData.append("photo", file);
  const res = await api.post(`/public/parent/students/${studentId}/photo`, formData, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
};

// ── Profile ────────────────────────────────────────────────────
export const getParentProfile = async (token: string): Promise<ParentProfile> => {
  const res = await api.get("/public/parent/profile", authHeaders(token));
  return res.data.data;
};

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export const updateParentProfile = async (
  token: string,
  payload: UpdateProfilePayload
): Promise<ParentProfile> => {
  const res = await api.put("/public/parent/profile", payload, authHeaders(token));
  return res.data.data;
};

export const updateParentPassword = async (
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  await api.put(
    "/public/parent/profile/password",
    { currentPassword, newPassword },
    authHeaders(token)
  );
};

export const uploadParentPhoto = async (
  token: string,
  file: File
): Promise<ParentProfile> => {
  const formData = new FormData();
  formData.append("photo", file);
  const res = await api.post("/public/parent/profile/photo", formData, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
};

// ── Messaging — parent <-> admin/coach, scoped to a specific batch ──
export interface MessageEntry {
  _id: string;
  senderRole: "PARENT" | "ADMIN" | "COACH";
  senderName: string;
  body: string;
  createdAt: string;
}

export interface MessageThread {
  _id: string;
  subject: string;
  studentName?: string;
  status: "OPEN" | "RESOLVED";
  batchId: { _id: string; title?: string; dayOfWeek?: string; startTime?: string; endTime?: string };
  messages: MessageEntry[];
  lastMessageAt: string;
  createdAt: string;
}

export interface MessageableBatch {
  _id: string;
  title?: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  programTitle?: string;
  studentNames: string[];
}

export const getMessageableBatches = async (token: string): Promise<MessageableBatch[]> => {
  const res = await api.get("/public/parent/messages/batches", authHeaders(token));
  return res.data.data;
};

export const getMyMessageThreads = async (token: string): Promise<MessageThread[]> => {
  const res = await api.get("/public/parent/messages", authHeaders(token));
  return res.data.data;
};

export const createMessageThread = async (
  token: string,
  payload: { batchId: string; subject: string; body: string; studentName?: string }
): Promise<MessageThread> => {
  const res = await api.post("/public/parent/messages", payload, authHeaders(token));
  return res.data.data;
};

export const replyToMessageThread = async (
  token: string,
  threadId: string,
  body: string
): Promise<MessageThread> => {
  const res = await api.post(`/public/parent/messages/${threadId}/reply`, { body }, authHeaders(token));
  return res.data.data;
};
