import api from "../api/axios";

// The backend stores file paths like "uploads/media/abc123.jpg" — relative
// to the backend server root, NOT a full URL. This resolves that relative
// path to something the browser can actually load, by deriving the
// backend's origin from VITE_API_BASE_URL (which ends in "/api").
// Without this, any component reading these paths directly renders a
// broken image (this was a real, pre-existing bug — Media items existed
// but never displayed because the field names AND the path format didn't
// match what the homepage gallery expected).
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001/api";
const SERVER_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

export function resolveUploadUrl(relativePath?: string | null): string | undefined {
  if (!relativePath) return undefined;
  // If it's a localhost URL saved in DB, replace the origin with the real backend
  if (/^https?:\/\//i.test(relativePath)) {
    return relativePath.replace(/^https?:\/\/localhost:\d+/, SERVER_ORIGIN);
  }
  const cleanPath = relativePath.replace(/^\/+/, "");
  return `${SERVER_ORIGIN}/${cleanPath}`;
}

export const getPrograms = async (filters?: { category?: string; featured?: boolean }) => {
  const params: Record<string, string> = {};
  if (filters?.category) params.category = filters.category;
  if (filters?.featured) params.featured = "true";
  const response = await api.get("/public/programs", { params });
  return response.data.data;
};

export const getProgramById = async (id: string | number) => {
  const response = await api.get(`/public/programs/${id}`);
  return response.data.data;
};

export const getBatches = async (programId?: string) => {
  const params: Record<string, string> = {};
  if (programId) params.program = programId;
  const response = await api.get("/public/batches", { params });
  return response.data.data;
};

export const getCategories = async () => {
  const response = await api.get("/public/categories");
  return response.data.data;
};

export const getLocations = async () => {
  // Try direct locations endpoint first (admin portal data)
  try {
    const res = await api.get("/public/locations");
    if (res.data.data && res.data.data.length > 0) return res.data.data;
  } catch {
    // fall through to program-derived locations
  }

  // Fallback: derive unique locations from programs
  const response = await api.get("/public/programs");
  const programs = response.data.data ?? [];
  const seen = new Set<string>();
  const locations: { _id: string; title: string; city?: string; address?: string; latitude?: number; longitude?: number; googleMapUrl?: string }[] = [];
  for (const p of programs) {
    if (p.location && p.location._id && !seen.has(p.location._id)) {
      seen.add(p.location._id);
      locations.push(p.location);
    }
  }
  return locations;
};

export const getCoaches = async () => {
  const response = await api.get("/public/coaches");
  return response.data.data;
};

export const getFAQs = async () => {
  const response = await api.get("/public/content/faqs");
  return response.data.data;
};

export const getSponsors = async () => {
  const response = await api.get("/public/content/sponsors");
  return response.data.data;
};

export const getMedia = async (type?: "GALLERY" | "MAGAZINE" | "NEWSLETTER") => {
  const params: Record<string, string> = {};
  if (type) params.type = type;
  const response = await api.get("/public/content/media", { params });
  return response.data.data;
};
