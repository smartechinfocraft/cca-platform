// ============================================================
//  components/media/MagazineCover.tsx
//  A single "book" thumbnail for the CCA Magazine row — page 1 of
//  the issue's PDF rendered as a cover, stacked page edges on the
//  right for depth, and a slight tilt that straightens on hover.
//  Clicking calls onOpen(), which mounts the MagazineFlipbook modal.
// ============================================================
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { renderPdfCover } from "../../utils/pdfToImages";

interface Props {
  title: string;
  yearLabel: string;
  fileUrl: string;
  onOpen: () => void;
}

function MagazineCover({ title, yearLabel, fileUrl, onOpen }: Props) {
  const [cover, setCover] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    renderPdfCover(fileUrl).then((img) => {
      if (cancelled) return;
      if (img) setCover(img);
      else setFailed(true);
    });
    return () => { cancelled = true; };
  }, [fileUrl]);

  return (
    <div className="flex flex-col items-center">
      <p
        className="font-display font-semibold text-lg mb-4 tracking-wide"
        style={{ color: "var(--outfield)" }}
      >
        {yearLabel}
      </p>

      <motion.button
        onClick={onOpen}
        aria-label={`Open ${title}`}
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        whileHover="hover"
        transition={{ duration: 0.4 }}
        className="relative"
        style={{ width: 220, height: 300, perspective: 900 }}
      >
        {/* Stacked page edges — gives the flat cover image page depth */}
        {[10, 6, 3].map((offset, i) => (
          <div
            key={offset}
            className="absolute rounded-r-md"
            style={{
              inset: 0,
              left: offset,
              top: offset * 0.6,
              background: "#f4f1ea",
              border: "1px solid var(--pitch-deep)",
              zIndex: i,
              boxShadow: "2px 2px 6px rgba(0,0,0,0.08)",
            }}
          />
        ))}

        {/* Cover face */}
        <motion.div
          variants={{
            hover: { rotateY: -10, x: -4, boxShadow: "16px 18px 34px rgba(0,0,0,0.35)" },
          }}
          initial={{ rotateY: -4, boxShadow: "10px 12px 24px rgba(0,0,0,0.25)" }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="absolute inset-0 rounded-r-md overflow-hidden"
          style={{
            zIndex: 10,
            transformStyle: "preserve-3d",
            transformOrigin: "left center",
            background: "var(--pitch-soft)",
            border: "1px solid var(--pitch-deep)",
          }}
        >
          {cover ? (
            <img src={cover} alt={title} className="w-full h-full object-cover" />
          ) : failed ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4 text-center">
              <span className="text-2xl">🏏</span>
              <span className="text-xs font-semibold" style={{ color: "var(--ink-400)" }}>{title}</span>
            </div>
          ) : (
            <div className="w-full h-full skeleton" />
          )}

          {/* Subtle spine shading for a "real book" read */}
          <div
            className="absolute inset-y-0 left-0 w-3 pointer-events-none"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.25), transparent)" }}
          />
        </motion.div>
      </motion.button>

      <span
        className="mt-4 text-xs font-semibold px-3 py-1 rounded-full"
        style={{ background: "var(--gold-glow)", color: "var(--outfield)" }}
      >
        Open &amp; flip through →
      </span>
    </div>
  );
}

export default MagazineCover;