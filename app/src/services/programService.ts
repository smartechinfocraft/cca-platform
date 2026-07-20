import api from "../api/axios";

const PUBLIC_READ_CACHE_MS = 30_000;
const publicReadCache = new Map<string, { expiresAt: number; data: unknown }>();
const publicReadRequests = new Map<string, Promise<unknown>>();

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function publicReadKey(url: string, params?: Record<string, string>): string {
  const query = new URLSearchParams(params ?? {});
  query.sort();
  return `${url}?${query.toString()}`;
}

function shouldRetryPublicRead(error: unknown): boolean {
  const response = (error as { response?: { status?: number } })?.response;
  if (!response) return true;
  const status = response.status ?? 0;
  return status === 408 || status === 429 || status >= 500;
}

async function publicGet<T>(url: string, params?: Record<string, string>): Promise<T> {
  const key = publicReadKey(url, params);
  const cached = publicReadCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data as T;
  if (cached) publicReadCache.delete(key);

  const existingRequest = publicReadRequests.get(key);
  if (existingRequest) return existingRequest as Promise<T>;

  const request = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await api.get(url, { params });
        const data = response.data.data as T;
        publicReadCache.set(key, { expiresAt: Date.now() + PUBLIC_READ_CACHE_MS, data });
        return data;
      } catch (error) {
        lastError = error;
        if (attempt === 2 || !shouldRetryPublicRead(error)) throw error;
        await wait(250 * (2 ** attempt));
      }
    }
    throw lastError;
  })().finally(() => publicReadRequests.delete(key));

  publicReadRequests.set(key, request);
  return request;
}

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
  return publicGet<any[]>("/public/programs", params);
};

export const getProgramById = async (id: string | number) => {
  return publicGet<any>(`/public/programs/${id}`);
};

export const getBatches = async (programId?: string) => {
  const params: Record<string, string> = {};
  if (programId) params.program = programId;
  return publicGet<any[]>("/public/batches", params);
};

export const getCategories = async () => {
  return publicGet<any[]>("/public/categories");
};

export const getLocations = async () => {
  // Try direct locations endpoint first (admin portal data)
  try {
    const locations = await publicGet<any[]>("/public/locations");
    if (locations && locations.length > 0) return locations;
  } catch {
    // fall through to program-derived locations
  }

  // Fallback: derive unique locations from programs
  const programs = await getPrograms();
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
  return publicGet<any[]>("/public/coaches");
};

export const getFAQs = async () => {
  return publicGet<any[]>("/public/content/faqs");
};

export const getSponsors = async () => {
  return publicGet<any[]>("/public/content/sponsors");
};

export const getMedia = async (type?: "GALLERY" | "MAGAZINE" | "NEWSLETTER") => {
  const params: Record<string, string> = {};
  if (type) params.type = type;
  return publicGet<any[]>("/public/content/media", params);
};
