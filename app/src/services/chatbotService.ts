// ============================================================
//  services/chatbotService.ts
//  API calls for the CCA Assistant chatbot widget.
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
