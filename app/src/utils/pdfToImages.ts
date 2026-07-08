// ============================================================
//  utils/pdfToImages.ts
//  Renders every page of a PDF (magazine/newsletter issue) into a
//  PNG data URL entirely in the browser, using pdf.js. This is what
//  lets us show a real book — a page-1 cover thumbnail on the media
//  page, and a full page-turn viewer — without any backend changes;
//  the admin just uploads the PDF like today.
// ============================================================
import * as pdfjsLib from "pdfjs-dist";
// Vite-native worker URL import — bundles the worker file and gives
// pdf.js a same-origin URL to load it from (avoids CORS/CDN issues).
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface RenderedPdf {
  pageImages: string[]; // data URLs, one per page, in order
  pageCount: number;
}

// Cache by URL so re-opening the same issue (or re-rendering its
// cover) doesn't re-download/re-render the PDF from scratch.
const cache = new Map<string, Promise<RenderedPdf>>();

/**
 * Render every page of the PDF at `url` to a PNG data URL.
 * `scale` controls resolution — higher for the full flipbook view,
 * lower is fine (and much faster) for just grabbing a cover thumbnail.
 */
export async function renderPdfToImages(url: string, scale = 1.4): Promise<RenderedPdf> {
  const cacheKey = `${url}::${scale}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const promise = (async (): Promise<RenderedPdf> => {
    // Fetch the bytes ourselves rather than handing pdf.js a bare URL.
    // pdf.js's own URL-based loader uses HTTP Range requests, which some
    // hosts/proxies mishandle for cross-origin requests (the PDF *file*
    // may still "exist" and load fine as a plain <a href> download, but
    // silently fail here) — fetching once ourselves gives a much clearer
    // error (bad CORS, 404, etc.) instead of an opaque pdf.js failure.
    let bytes: ArrayBuffer;
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) throw new Error(`Server responded ${res.status} for ${url}`);
      bytes = await res.arrayBuffer();
    } catch (err) {
      console.error("[MagazineFlipbook] Couldn't fetch PDF:", err);
      throw new Error("Couldn't download this issue's PDF.");
    }

    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    } catch (err) {
      console.error("[MagazineFlipbook] pdf.js couldn't parse the PDF:", err);
      throw new Error("Couldn't read this issue's PDF file.");
    }

    const pageImages: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not get canvas context.");

      await page.render({ canvas, canvasContext: context, viewport }).promise;
      pageImages.push(canvas.toDataURL("image/png"));
    }

    return { pageImages, pageCount: pdf.numPages };
  })();

  cache.set(cacheKey, promise);
  // Don't cache a failed attempt — a transient network hiccup shouldn't
  // permanently block this issue for the rest of the session.
  promise.catch(() => cache.delete(cacheKey));
  return promise;
}

/** Just the first page — used for the book-cover thumbnail on the media page. */
export async function renderPdfCover(url: string, scale = 1): Promise<string | null> {
  try {
    const { pageImages } = await renderPdfToImages(url, scale);
    return pageImages[0] ?? null;
  } catch (err) {
    console.error("[MagazineCover] Couldn't render cover:", err);
    return null;
  }
}