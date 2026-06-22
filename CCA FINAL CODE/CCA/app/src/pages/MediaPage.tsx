// ============================================================
//  pages/MediaPage.tsx — Standalone Media page.
//  Three real content types from the backend: photo Gallery,
//  CCA Magazine issues, and Newsletters (both PDFs). Falls back
//  to placeholder content only if the backend has nothing yet,
//  so the page never looks broken on a fresh install.
// ============================================================
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getMedia, resolveUploadUrl } from "../services/programService";

interface GalleryImage { path?: string; isCover?: boolean }
interface MediaItem {
  _id: string;
  title: string;
  description?: string;
  album?: string;
  imagePath?: string;
  filePath?: string;
  galleryImages?: GalleryImage[];
  publishDate?: string;
}

const FALLBACK_GALLERY: MediaItem[] = [
  { _id: "g1", title: "Spring Training Camp", album: "Training" },
  { _id: "g2", title: "Weekend League Action", album: "Tournaments" },
  { _id: "g3", title: "Girls' Travel Squad", album: "Tours" },
  { _id: "g4", title: "Coaching Clinic", album: "Coaching" },
  { _id: "g5", title: "Summer Camp Highlights", album: "Camps" },
  { _id: "g6", title: "Awards Night", album: "Community" },
];

type Tab = "GALLERY" | "MAGAZINE" | "NEWSLETTER";

const TABS: { key: Tab; label: string }[] = [
  { key: "GALLERY", label: "Photo Gallery" },
  { key: "MAGAZINE", label: "CCA Magazine" },
  { key: "NEWSLETTER", label: "Newsletters" },
];

function MediaPage() {
  const [activeTab, setActiveTab] = useState<Tab>("GALLERY");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<MediaItem | null>(null);

  useEffect(() => {
    setLoading(true);
    getMedia(activeTab)
      .then((data) => setItems(data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const coverFor = (item: MediaItem) => {
    const raw = item.imagePath || item.galleryImages?.find((g) => g.isCover)?.path || item.galleryImages?.[0]?.path;
    return resolveUploadUrl(raw);
  };

  const display: MediaItem[] = items.length > 0 ? items : (activeTab === "GALLERY" ? FALLBACK_GALLERY : []);

  return (
    <div className="overflow-x-hidden" style={{ background: "var(--pitch)" }}>
      <Navbar />

      <section className="relative pt-20 pb-12 overflow-hidden" style={{ background: "linear-gradient(145deg, #F3EFE2 0%, #ECE6D4 60%, #FBF8EF 100%)" }}>
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

      {/* GALLERY view */}
      {activeTab === "GALLERY" && (
        <section className="pb-20">
          <div className="max-w-6xl mx-auto px-6">
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="rounded-2xl skeleton aspect-[4/3]" />)}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {display.map((item, i) => {
                  const cover = coverFor(item);
                  return (
                    <motion.button
                      key={item._id}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
                      onClick={() => cover && setActiveImage(item)}
                      className="group relative rounded-2xl overflow-hidden bg-white aspect-[4/3] text-left border hover:shadow-xl transition-shadow"
                      style={{ borderColor: "var(--pitch-deep)" }}
                    >
                      {cover ? (
                        <img src={cover} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--pitch-soft)" }}>
                          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl" style={{ background: "var(--pitch-deep)" }}>🏏</div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[var(--outfield)]/85 via-[var(--outfield)]/0 to-transparent opacity-90" />
                      <div className="absolute bottom-0 left-0 p-5">
                        {item.album && (
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--gold-light)" }}>{item.album}</span>
                        )}
                        <p className="font-display font-semibold text-white text-base mt-1 leading-snug">{item.title}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
            {!loading && items.length === 0 && (
              <p className="text-center text-sm text-[var(--ink-400)] mt-10">More photos coming soon — check back after our next event.</p>
            )}
          </div>
        </section>
      )}

      {/* MAGAZINE / NEWSLETTER view — PDF list */}
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
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: "var(--pitch-soft)" }}>📄</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--outfield)] text-sm truncate">{item.title}</p>
                        {item.description && <p className="text-xs text-[var(--ink-400)] mt-0.5 truncate">{item.description}</p>}
                        {item.publishDate && (
                          <p className="text-xs text-[var(--ink-400)] mt-0.5">
                            {new Date(item.publishDate).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-semibold shrink-0" style={{ color: "var(--grass)" }}>View PDF →</span>
                    </motion.a>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Lightbox */}
      {activeImage && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6" onClick={() => setActiveImage(null)}>
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={coverFor(activeImage)} alt={activeImage.title} className="w-full rounded-2xl max-h-[70vh] object-contain bg-black" />
            <div className="mt-4 flex items-center justify-between text-white">
              <div>
                <p className="font-display font-semibold">{activeImage.title}</p>
                {activeImage.description && <p className="text-sm text-white/60 mt-1 max-w-xl">{activeImage.description}</p>}
              </div>
              <button onClick={() => setActiveImage(null)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0 ml-4" aria-label="Close">✕</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default MediaPage;
