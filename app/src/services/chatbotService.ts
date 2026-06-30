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
//  NEW — In-chat registration + payment flow helpers
//  These just call the SAME public endpoints the normal site uses,
//  so anything done here shows up identically in the database and
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
}

export const fetchChatPrograms = async (): Promise<ChatProgram[]> => {
  const res = await api.get("/public/programs");
  return res.data.data || [];
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

export const fetchChatBatches = async (programId: string): Promise<ChatBatch[]> => {
  const res = await api.get("/public/batches", { params: { program: programId } });
  return res.data.data || [];
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
