// ============================================================
//  components/media/MagazineFlipbook.tsx
//  Fullscreen "real book" viewer for a magazine/newsletter PDF.
//  - Every page is rendered from the PDF client-side (utils/pdfToImages)
//  - page-flip drives the actual 3D page-turning animation
//  - Prev/Next arrows (and clicking a page corner) trigger flips
//  - A synthesized "swoosh" plays on every flip (utils/pageTurnSound)
//  No backend/admin changes needed — this just reads the same PDF
//  URL the old flat "View PDF" link used.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageFlip } from "page-flip";
import { renderPdfToImages } from "../../utils/pdfToImages";
import { playPageTurnSound } from "../../utils/pageTurnSound";

interface Props {
  title: string;
  fileUrl: string;
  onClose: () => void;
}

function MagazineFlipbook({ title, fileUrl, onClose }: Props) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const bookRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);

  // Close on Escape, lock body scroll — same convention as AlbumModal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") flipRef.current?.flipNext();
      if (e.key === "ArrowLeft") flipRef.current?.flipPrev();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Render every page of the PDF once.
  useEffect(() => {
    let cancelled = false;
    renderPdfToImages(fileUrl, 1.6)
      .then(({ pageImages }) => { if (!cancelled) setPages(pageImages); })
      .catch((err) => { if (!cancelled) setError(err?.message || "Couldn't open this issue right now."); });
    return () => { cancelled = true; };
  }, [fileUrl]);

  // Once pages are ready, mount the real page-flip book.
  useEffect(() => {
    if (!pages || !bookRef.current || flipRef.current) return;

    const isMobile = window.innerWidth < 768;
    const pageW = isMobile ? Math.min(340, window.innerWidth - 40) : 420;
    const pageH = Math.round(pageW * 1.35);

    const flip = new PageFlip(bookRef.current, {
      width: pageW,
      height: pageH,
      size: "stretch",
      minWidth: 260,
      maxWidth: 560,
      minHeight: 350,
      maxHeight: 760,
      showCover: true,
      maxShadowOpacity: 0.5,
      mobileScrollSupport: false,
      useMouseEvents: true,
    });
    flip.loadFromImages(pages);
    flip.on("flip", (e) => {
      setCurrentPage(e.data);
      playPageTurnSound();
    });
    flipRef.current = flip;

    return () => {
      flip.destroy();
      flipRef.current = null;
    };
  }, [pages]);

  const pageCount = pages?.length ?? 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(5,10,5,0.92)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Header */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4"
        >
          <p className="text-white/90 text-sm font-semibold truncate max-w-[70vw]">{title}</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            ✕
          </button>
        </div>

        {/* Book stage */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-4 md:gap-8 w-full justify-center px-2"
        >
          <button
            onClick={() => flipRef.current?.flipPrev()}
            disabled={!pages || currentPage <= 0}
            aria-label="Previous page"
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-xl disabled:opacity-30 transition"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            ‹
          </button>

          <div style={{ width: "min(88vw, 900px)", height: "min(72vh, 640px)" }} className="flex items-center justify-center">
            {error ? (
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <p className="text-white/70 text-sm">{error}</p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold px-4 py-2 rounded-full"
                  style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
                >
                  Open the PDF directly →
                </a>
              </div>
            ) : !pages ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-white/60 text-xs">Opening the magazine…</p>
              </div>
            ) : (
              <div ref={bookRef} />
            )}
          </div>

          <button
            onClick={() => flipRef.current?.flipNext()}
            disabled={!pages || currentPage >= pageCount - 1}
            aria-label="Next page"
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-xl disabled:opacity-30 transition"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            ›
          </button>
        </div>

        {/* Page counter */}
        {pages && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-6 px-4 py-1.5 rounded-full text-xs font-semibold text-white/80"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            {currentPage + 1} / {pageCount}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default MagazineFlipbook;