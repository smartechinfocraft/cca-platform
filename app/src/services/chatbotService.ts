// ============================================================
//  services/chatbotService.ts
//  API calls for the CCA Assistant chatbot widget — including the
//  in-chat registration / payment flow.
// ============================================================
import api from "../api/axios";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const sendChatMessage = async (
  messages: ChatMessage[],
  token?: string | null
): Promise<string> => {
  const res = await api.post(
    "/public/chatbot/message",
    { messages },
    token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  );
  if (!res.data.success) throw new Error(res.data.message || "The assistant couldn't respond.");
  return res.data.reply as string;
};

export interface RecommendedProgram {
  _id: string;
  title: string;
  slug?: string;
  ageGroups?: string[];
  skillLevels?: string[];
  basePrice?: number;
  discountedPrice?: number;
  shortDescription?: string;
  coverImageUrl?: string;
  location?: { title?: string; city?: string };
}

export const recommendPrograms = async (
  age: number | string,
  skillLevel: string
): Promise<{ data: RecommendedProgram[]; matched: boolean }> => {
  const res = await api.post("/public/chatbot/recommend-programs", { age, skillLevel });
  if (!res.data.success) throw new Error(res.data.message || "Couldn't fetch recommendations.");
  return { data: res.data.data, matched: res.data.matched };
};

export interface BmiResult {
  bmi: number;
  category: string;
  saved: boolean;
}

export const calculateBmi = async (
  heightCm: number,
  weightKg: number,
  token?: string | null,
  studentId?: string
): Promise<BmiResult> => {
  const res = await api.post(
    "/public/chatbot/bmi",
    { heightCm, weightKg, studentId },
    token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  );
  if (!res.data.success) throw new Error(res.data.message || "Couldn't calculate BMI.");
  return { bmi: res.data.bmi, category: res.data.category, saved: res.data.saved };
};

// ============================================================
//  In-chat registration + payment flow helpers
//  These call the SAME public endpoints the normal site uses, so
//  anything done here shows up identically in the database and
//  in the admin panel.
// ============================================================

export interface ParentAuthResult {
  token: string;
  parent: { id: string; firstName: string; lastName: string; email: string; phone: string };
}

export const chatRegisterParent = async (data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  city?: string;
}): Promise<ParentAuthResult> => {
  const res = await api.post("/public/auth/register", data);
  if (!res.data.success) throw new Error(res.data.message || "Could not create your account.");
  return { token: res.data.token, parent: res.data.parent };
};

export const chatLoginParent = async (email: string, password: string): Promise<ParentAuthResult> => {
  const res = await api.post("/public/auth/login", { email, password });
  if (!res.data.success) throw new Error(res.data.message || "Login failed.");
  return { token: res.data.token, parent: res.data.parent };
};

export interface ChatProgram {
  _id: string;
  title: string;
  basePrice?: number;
  discountedPrice?: number;
  shortDescription?: string;
  coverImageUrl?: string;
  ageGroups?: string[];
  location?: { _id?: string; title?: string; city?: string };
}

export const fetchChatPrograms = async (): Promise<ChatProgram[]> => {
  const res = await api.get("/public/programs");
  return res.data.data || [];
};

// ── Locations, used for the filter chips in the program list ──
export interface ChatLocation {
  _id: string;
  title: string;
  city?: string;
}

export const fetchChatLocations = async (): Promise<ChatLocation[]> => {
  try {
    const res = await api.get("/public/locations");
    if (res.data?.data?.length) return res.data.data;
  } catch {
    // fall through to the derived fallback below
  }
  const programs = await fetchChatPrograms();
  const seen = new Set<string>();
  const out: ChatLocation[] = [];
  for (const p of programs) {
    if (p.location?._id && !seen.has(p.location._id)) {
      seen.add(p.location._id);
      out.push({ _id: p.location._id, title: p.location.title || "Location", city: p.location.city });
    }
  }
  return out;
};

export interface ChatBatch {
  _id: string;
  name?: string;
  title?: string;
  days?: string;
  timing?: string;
  fee: number;
  seats?: number;
  sessionsPerWeek?: number;
}

// ── Batches come from /public/programs/:id, NOT /public/batches ──
// /public/batches only reads the separate `Batch` collection, but
// most programs here store their schedule on Program.scheduleDays
// instead. /public/programs/:id has the fallback logic that builds
// a "synthetic" batch from scheduleDays when no real Batch docs
// exist — this is what the real ProgramDetails.tsx page uses, so we
// mirror the same mapping here.
export const fetchChatBatches = async (programId: string): Promise<ChatBatch[]> => {
  const res = await api.get(`/public/programs/${programId}`);
  if (!res.data.success) throw new Error(res.data.message || "Couldn't load batches.");
  const rawBatches: any[] = Array.isArray(res.data.data?.batches) ? res.data.data.batches : [];

  return rawBatches.map((b) => ({
    _id: b._id,
    name: b.name ?? b.title ?? `Batch ${b._id}`,
    title: b.title ?? b.name,
    days: b.days || (Array.isArray(b.multiDays) && b.multiDays.length ? b.multiDays.join(" + ") : b.dayOfWeek) || "",
    timing: b.timing || (b.startTime && b.endTime ? `${b.startTime} - ${b.endTime}` : ""),
    fee: Number(b.price ?? b.fee ?? b.pricePerSession ?? 0),
    seats: Math.max(0, Number(b.maxCapacity ?? b.seats ?? 0) - Number(b.currentCapacity ?? 0)),
    sessionsPerWeek: b.sessionsPerWeek,
  }));
};

export const validateChatCoupon = async (payload: {
  couponCode: string;
  programId: string;
  batchId?: string;
  studentCount?: number;
  sessionsPerWeek?: number;
}) => {
  const res = await api.post("/public/validate-coupon", payload);
  if (!res.data.success) throw new Error(res.data.message || "Invalid coupon.");
  return res.data as {
    subtotal: number;
    discount: number;
    total: number;
    coupon: { code: string; type: "PERCENTAGE" | "FIXED"; value: number; description: string };
  };
};

export const createChatPaypalOrder = async (payload: {
  programId: string;
  batchId?: string;
  studentCount: number;
  sessionsPerWeek?: number;
  couponCode?: string;
}) => {
  const res = await api.post("/public/paypal/create-order", payload);
  if (!res.data.success) throw new Error(res.data.message || "Could not start PayPal payment.");
  return res.data as { orderID: string; amount: number; discount: number; currency: string };
};

export const captureChatPaypalOrder = async (payload: {
  orderID: string;
  programId: string;
  batchId?: string;
  studentCount: number;
  sessionsPerWeek?: number;
  couponCode?: string;
}) => {
  const res = await api.post("/public/paypal/capture-order", payload);
  if (!res.data.success) throw new Error(res.data.message || "Payment capture failed.");
  return res.data as { transactionId: string; capturedAmount: number };
};

export interface ChatRegistrationPayload {
  selectedProgram: { _id: string; title: string };
  selectedBatch?: { _id: string; title?: string; name?: string; fee?: number; sessionsPerWeek?: number };
  students: Array<{
    firstName: string;
    lastName: string;
    dob?: string;
    gender?: string;
    schoolName?: string;
    medicalNotes?: string;
  }>;
  parent: { parentName: string; email: string; phone: string; city?: string };
  parentId?: string;
  sessionsPerWeek?: number;
  paymentMethod: "PayPal" | "Check";
  transactionId?: string;
  checkNumber?: string;
  couponCode?: string;
}

export const submitChatRegistration = async (
  payload: ChatRegistrationPayload,
  token?: string | null
) => {
  const res = await api.post(
    "/public/register",
    payload,
    token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  );
  if (!res.data.success) throw new Error(res.data.message || "Registration failed.");
  return res.data as {
    registrationNumber: string;
    studentName: string;
    programName: string;
    paymentStatus: string;
    totalAmount: number;
  };
};
