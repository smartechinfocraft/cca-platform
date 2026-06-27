// ============================================================
//  pages/MediaPage.tsx — Standalone Media page.
//  Three real content types from the backend: photo Gallery,
//  CCA Magazine issues, and Newsletters (both PDFs). Falls back
//  to placeholder content only if the backend has nothing yet,
//  so the page never looks broken on a fresh install.
//
//  UPDATED:
//  - Gallery shows albums as cards (cover image + title + photo count)
//  - Clicking an album opens a modal with blurred background
//  - Modal has close button (top-right X)
//  - Modal body scrollable when many images
//  - Max 2 MB per image, max 100 images per album
// ============================================================
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getMedia, resolveUploadUrl } from "../services/programService";

interface GalleryImage { path?: string; url?: string; isCover?: boolean }
interface MediaItem {
  _id: string;
  title: string;
  description?: string;
  album?: string;
  imagePath?: string;
  coverImageUrl?: string;  // full URL set by backend — use this first
  filePath?: string;
  fileUrl?: string;
  galleryImages?: GalleryImage[];
  publishDate?: string;
}

const FALLBACK_GALLERY: MediaItem[] = [
  { _id: "g1", title: "Spring Training Camp",    album: "Training"    },
  { _id: "g2", title: "Weekend League Action",   album: "Tournaments" },
  { _id: "g3", title: "Girls' Travel Squad",     album: "Tours"       },
  { _id: "g4", title: "Coaching Clinic",         album: "Coaching"    },
  { _id: "g5", title: "Summer Camp Highlights",  album: "Camps"       },
  { _id: "g6", title: "Awards Night",            album: "Community"   },
];

type Tab = "GALLERY" | "MAGAZINE" | "NEWSLETTER";

const TABS: { key: Tab; label: string }[] = [
  { key: "GALLERY",    label: "Photo Gallery" },
  { key: "MAGAZINE",  label: "CCA Magazine"   },
  { key: "NEWSLETTER", label: "Newsletters"  },
];

// Resolve a gallery image URL — prefer .url (full URL from backend) over .path (disk path)
function resolveGalleryImg(img: GalleryImage): string | null {
  // .url is the full http URL saved by fileUrl() helper — use it directly
  if (img.url) {
    if (img.url.startsWith("http")) return img.url;
    return resolveUploadUrl(img.url) ?? null;
  }
  // .path is an absolute disk path — try to extract the uploads/ portion
  if (img.path) {
    const relative = img.path.replace(/\\/g, "/").split("uploads/").pop();
    if (relative) return resolveUploadUrl(`uploads/${relative}`) ?? null;
  }
  return null;
}

// Get the cover image URL for an album item
function coverFor(item: MediaItem): string | null {
  // coverImageUrl is a full http URL set directly by the backend — best source
  if (item.coverImageUrl) {
    if (item.coverImageUrl.startsWith("http")) return item.coverImageUrl;
    return resolveUploadUrl(item.coverImageUrl) ?? null;
  }
  // Fall back to the isCover gallery image
  const coverImg = item.galleryImages?.find((g) => g.isCover) ?? item.galleryImages?.[0];
  if (coverImg) return resolveGalleryImg(coverImg);
  return null;
}

// ── Album Modal ────────────────────────────────────────────
interface AlbumModalProps {
  item: MediaItem;
  onClose: () => void;
}

function AlbumModal({ item, onClose }: AlbumModalProps) {
  const images = item.galleryImages ?? [];

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <AnimatePresence>
      {/* Blurred backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
        }}
      >
        {/* Modal box — stop click propagation so it doesn't close when clicking inside */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "linear-gradient(145deg, #1a2a1a 0%, #0f1f0f 100%)",
            border: "1px solid rgba(212,175,55,0.3)",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "860px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "20px 24px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}>
            <div>
              {item.album && (
                <span style={{
                  fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: "#D4AF37",
                  display: "block", marginBottom: "4px",
                }}>{item.album}</span>
              )}
              <h2 style={{
                color: "#fff", fontSize: "18px", fontWeight: 700,
                margin: 0, lineHeight: 1.3,
              }}>{item.title}</h2>
              {item.description && (
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "4px 0 0" }}>
                  {item.description}
                </p>
              )}
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", display: "block", marginTop: "4px" }}>
                {images.length} photo{images.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close album"
              style={{
                width: "40px", height: "40px", borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff", fontSize: "18px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginLeft: "16px",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            >
              ✕
            </button>
          </div>

          {/* Scrollable image grid */}
          <div style={{
            overflowY: "auto",
            padding: "20px 24px 24px",
            flex: 1,
          }}>
            {images.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "60px 20px",
                color: "rgba(255,255,255,0.3)",
              }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>🖼️</div>
                <div style={{ fontSize: "15px" }}>No photos in this album yet</div>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "10px",
              }}>
                {images.map((img, i) => {
                  const src = resolveGalleryImg(img);
                  return (
                    <div
                      key={i}
                      style={{
                        position: "relative",
                        borderRadius: "10px",
                        overflow: "hidden",
                        aspectRatio: "1",
                        background: "rgba(255,255,255,0.04)",
                        border: img.isCover
                          ? "2px solid #D4AF37"
                          : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={`${item.title} #${i + 1}`}
                          loading="lazy"
                          style={{
                            width: "100%", height: "100%",
                            objectFit: "cover", display: "block",
                          }}
                        />
                      ) : (
                        <div style={{
                          width: "100%", height: "100%",
                          display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: "28px",
                          color: "rgba(255,255,255,0.15)",
                        }}>🏏</div>
                      )}
                      {img.isCover && (
                        <div style={{
                          position: "absolute", top: "6px", left: "6px",
                          background: "#D4AF37", color: "#000",
                          fontSize: "9px", fontWeight: 800,
                          padding: "2px 6px", borderRadius: "4px",
                          letterSpacing: "0.05em",
                        }}>COVER</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Page ──────────────────────────────────────────────
function MediaPage() {
  const [activeTab, setActiveTab]     = useState<Tab>("GALLERY");
  const [items, setItems]             = useState<MediaItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [openAlbum, setOpenAlbum]     = useState<MediaItem | null>(null);

  useEffect(() => {
    setLoading(true);
    getMedia(activeTab)
      .then((data) => setItems(data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const display: MediaItem[] =
    items.length > 0 ? items : (activeTab === "GALLERY" ? FALLBACK_GALLERY : []);

  return (
    <div className="overflow-x-hidden" style={{ background: "var(--pitch)" }}>
      <Navbar />
      <div className="h-20" />

      {/* Hero */}
      <section
        className="relative pt-20 pb-12 overflow-hidden"
        style={{ background: "linear-gradient(145deg, #F3EFE2 0%, #ECE6D4 60%, #FBF8EF 100%)" }}
      >
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="scoreboard-label">Moments From the Pitch</span>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--outfield)] mt-4">
              Media &amp; Gallery
            </h1>
            <p className="text-[var(--ink-500)] text-lg mt-5 leading-7 max-w-xl mx-auto">
              Training sessions, tournaments, tours, and the everyday wins that make up a season at CCA —
              plus our Magazine and Newsletter archive.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Tabs */}
      <section className="py-4">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex justify-center gap-2 mb-12">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="px-5 py-2.5 rounded-full text-sm font-semibold transition"
                style={
                  activeTab === t.key
                    ? { background: "var(--gold)", color: "var(--outfield)" }
                    : { background: "var(--pitch-soft)", color: "var(--ink-500)" }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY: Album cards ── */}
      {activeTab === "GALLERY" && (
        <section className="pb-20">
          <div className="max-w-6xl mx-auto px-6">
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-2xl skeleton aspect-[4/3]" />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {display.map((item, i) => {
                  const cover = coverFor(item);
                  const photoCount = item.galleryImages?.length ?? 0;
                  return (
                    <motion.button
                      key={item._id}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
                      onClick={() => setOpenAlbum(item)}
                      className="group relative rounded-2xl overflow-hidden bg-white aspect-[4/3] text-left border hover:shadow-xl transition-shadow"
                      style={{ borderColor: "var(--pitch-deep)" }}
                    >
                      {cover ? (
                        <img
                          src={cover}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: "var(--pitch-soft)" }}
                        >
                          <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                            style={{ background: "var(--pitch-deep)" }}
                          >🏏</div>
                        </div>
                      )}

                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[var(--outfield)]/85 via-[var(--outfield)]/0 to-transparent opacity-90" />

                      {/* Photo count badge */}
                      {photoCount > 0 && (
                        <div style={{
                          position: "absolute", top: "10px", right: "10px",
                          background: "rgba(0,0,0,0.6)", color: "#fff",
                          fontSize: "11px", fontWeight: 700,
                          padding: "3px 9px", borderRadius: "20px",
                          backdropFilter: "blur(4px)",
                        }}>
                          📷 {photoCount}
                        </div>
                      )}

                      {/* Title area */}
                      <div className="absolute bottom-0 left-0 p-5">
                        {item.album && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: "var(--gold-light)" }}
                          >{item.album}</span>
                        )}
                        <p className="font-display font-semibold text-white text-base mt-1 leading-snug">
                          {item.title}
                        </p>
                        {/* "View album" hint */}
                        <span style={{
                          display: "inline-block", marginTop: "6px",
                          fontSize: "11px", color: "rgba(255,255,255,0.65)",
                          border: "1px solid rgba(255,255,255,0.3)",
                          borderRadius: "12px", padding: "2px 10px",
                        }}>
                          View album →
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
            {!loading && items.length === 0 && (
              <p className="text-center text-sm text-[var(--ink-400)] mt-10">
                More photos coming soon — check back after our next event.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── MAGAZINE / NEWSLETTER: PDF list ── */}
      {(activeTab === "MAGAZINE" || activeTab === "NEWSLETTER") && (
        <section className="pb-20">
          <div className="max-w-3xl mx-auto px-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="rounded-2xl skeleton h-20" />)}
              </div>
            ) : display.length === 0 ? (
              <p className="text-center text-sm text-[var(--ink-400)] py-10">
                No {activeTab === "MAGAZINE" ? "magazine issues" : "newsletters"} published yet — check back soon.
              </p>
            ) : (
              <div className="space-y-3">
                {display.map((item, i) => {
                  const fileUrl = resolveUploadUrl(item.filePath);
                  return (
                    <motion.a
                      key={item._id}
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                      className="flex items-center gap-4 bg-white rounded-2xl p-5 hover:shadow-md transition"
                      style={{ border: "1px solid var(--pitch-deep)" }}
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                        style={{ background: "var(--pitch-soft)" }}
                      >📄</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--outfield)] text-sm truncate">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-[var(--ink-400)] mt-0.5 truncate">{item.description}</p>
                        )}
                        {item.publishDate && (
                          <p className="text-xs text-[var(--ink-400)] mt-0.5">
                            {new Date(item.publishDate).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-semibold shrink-0" style={{ color: "var(--grass)" }}>
                        View PDF →
                      </span>
                    </motion.a>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Album Modal ── */}
      {openAlbum && (
        <AlbumModal item={openAlbum} onClose={() => setOpenAlbum(null)} />
      )}

      <Footer />
    </div>
  );
}

export default MediaPage;