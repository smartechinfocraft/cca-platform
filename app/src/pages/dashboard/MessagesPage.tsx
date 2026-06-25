// ============================================================
//  pages/dashboard/MessagesPage.tsx
//  Parent-facing messaging: start a new batch-specific thread,
//  or reply to an existing one. Scoped server-side to batches the
//  parent is actually enrolled in (see backend parentAuth route).
// ============================================================
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import {
  getMessageableBatches,
  getMyMessageThreads,
  createMessageThread,
  replyToMessageThread,
  type MessageThread,
  type MessageableBatch,
} from "../../services/parentDashboardService";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const roleLabel: Record<string, string> = { PARENT: "You", ADMIN: "CCA Admin", COACH: "Coach" };
const roleColor: Record<string, string> = { PARENT: "var(--gold)", ADMIN: "var(--grass)", COACH: "var(--leather)" };

function MessagesPage() {
  const { token } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [batches, setBatches] = useState<MessageableBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<MessageThread | null>(null);
  const [composing, setComposing] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  // New-thread form state
  const [newBatchId, setNewBatchId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");

  const load = () => {
    if (!token) return;
    setLoading(true);
    Promise.all([getMyMessageThreads(token), getMessageableBatches(token)])
      .then(([t, b]) => { setThreads(t); setBatches(b); })
      .catch(() => toast.error("Couldn't load your messages."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const handleStartThread = async () => {
    if (!token || !newBatchId || !newSubject.trim() || !newBody.trim()) {
      toast.error("Please choose a batch, a subject, and write your message.");
      return;
    }
    setSending(true);
    try {
      await createMessageThread(token, { batchId: newBatchId, subject: newSubject.trim(), body: newBody.trim() });
      toast.success("Message sent — CCA staff will reply here.");
      setComposing(false);
      setNewBatchId(""); setNewSubject(""); setNewBody("");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Couldn't send your message.");
    } finally {
      setSending(false);
    }
  };

  const handleReply = async () => {
    if (!token || !activeThread || !replyBody.trim()) return;
    setSending(true);
    try {
      const updated = await replyToMessageThread(token, activeThread._id, replyBody.trim());
      setActiveThread(updated);
      setReplyBody("");
      load();
    } catch {
      toast.error("Couldn't send your reply.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--outfield)]">Messages</h1>
          <p className="text-sm text-[var(--ink-500)] mt-1">Questions about a batch? Message your coach or our staff directly.</p>
        </div>
        <button
          onClick={() => setComposing(true)}
          className="px-5 py-2.5 rounded-full text-sm font-semibold hover:scale-105 transition-transform shadow-md"
          style={{ background: "var(--gold)", color: "var(--outfield)" }}
        >
          + New Message
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl skeleton" />)}
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl" style={{ border: "1px solid var(--pitch-deep)" }}>
          <span className="text-4xl">💬</span>
          <p className="mt-3 text-[var(--ink-500)] text-sm">No messages yet. Have a question about a batch? Start one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => {
            const last = t.messages[t.messages.length - 1];
            return (
              <button
                key={t._id}
                onClick={() => setActiveThread(t)}
                className="w-full text-left bg-white rounded-2xl p-5 hover:shadow-md transition flex items-start justify-between gap-4"
                style={{ border: "1px solid var(--pitch-deep)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--outfield)] text-sm truncate">{t.subject}</p>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                      style={t.status === "OPEN" ? { background: "rgba(63,125,79,0.12)", color: "var(--grass)" } : { background: "var(--pitch-soft)", color: "var(--ink-400)" }}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-400)] mt-1">
                    {t.batchId?.title || "Batch"} {t.batchId?.dayOfWeek ? `· ${t.batchId.dayOfWeek}` : ""}
                  </p>
                  {last && (
                    <p className="text-sm text-[var(--ink-500)] mt-2 truncate">
                      <span style={{ color: roleColor[last.senderRole] }} className="font-semibold">{roleLabel[last.senderRole]}:</span>{" "}
                      {last.body}
                    </p>
                  )}
                </div>
                <span className="text-xs text-[var(--ink-400)] shrink-0">{formatDateTime(t.lastMessageAt)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Compose new thread modal */}
      <AnimatePresence>
        {composing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setComposing(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display text-lg font-semibold text-[var(--outfield)] mb-4">New Message</h2>
              {batches.length === 0 ? (
                <p className="text-sm text-[var(--ink-500)]">You don't have any active batch enrollments to message about yet.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--outfield)] mb-1">Which batch is this about?</label>
                    <select
                      value={newBatchId}
                      onChange={(e) => setNewBatchId(e.target.value)}
                      className="w-full rounded-xl border border-[var(--pitch-deep)] px-3 py-2.5 text-sm outline-none focus:border-[var(--gold)]"
                    >
                      <option value="">Select a batch…</option>
                      {batches.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.programTitle ? `${b.programTitle} — ` : ""}{b.title || "Batch"} {b.dayOfWeek ? `(${b.dayOfWeek})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--outfield)] mb-1">Subject</label>
                    <input
                      type="text"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="e.g. Question about pickup time"
                      className="w-full rounded-xl border border-[var(--pitch-deep)] px-3 py-2.5 text-sm outline-none focus:border-[var(--gold)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--outfield)] mb-1">Your Message</label>
                    <textarea
                      value={newBody}
                      onChange={(e) => setNewBody(e.target.value)}
                      rows={4}
                      placeholder="Type your question or note here…"
                      className="w-full rounded-xl border border-[var(--pitch-deep)] px-3 py-2.5 text-sm outline-none focus:border-[var(--gold)] resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setComposing(false)} className="px-4 py-2 rounded-full text-sm font-semibold text-[var(--ink-500)]">Cancel</button>
                    <button
                      onClick={handleStartThread}
                      disabled={sending}
                      className="px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
                      style={{ background: "var(--gold)", color: "var(--outfield)" }}
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thread detail / reply modal */}
      <AnimatePresence>
        {activeThread && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setActiveThread(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-display text-lg font-semibold text-[var(--outfield)]">{activeThread.subject}</h2>
                <button onClick={() => setActiveThread(null)} className="text-[var(--ink-400)] hover:text-[var(--outfield)]">✕</button>
              </div>
              <p className="text-xs text-[var(--ink-400)] mb-4">{activeThread.batchId?.title || "Batch"}</p>

              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {activeThread.messages.map((m) => (
                  <div key={m._id} className="rounded-2xl p-3" style={{ background: m.senderRole === "PARENT" ? "var(--pitch-soft)" : "#fff", border: "1px solid var(--pitch-deep)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold" style={{ color: roleColor[m.senderRole] }}>{m.senderName}</span>
                      <span className="text-[10px] text-[var(--ink-400)]">{formatDateTime(m.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[var(--outfield)]">{m.body}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleReply(); }}
                  placeholder="Type a reply…"
                  className="flex-1 rounded-full border border-[var(--pitch-deep)] px-4 py-2.5 text-sm outline-none focus:border-[var(--gold)]"
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !replyBody.trim()}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50"
                  style={{ background: "var(--gold)", color: "var(--outfield)" }}
                >
                  Send
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MessagesPage;
