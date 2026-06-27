// ============================================================
//  pages/Messages.jsx — Coach inbox.
//  Only shows threads for batches THIS coach is assigned to
//  (enforced server-side, not just hidden in the UI).
// ============================================================
import React, { useEffect, useState } from 'react';
import { coachPortalAPI } from '../api/client';
import toast from 'react-hot-toast';

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const roleLabel = { PARENT: 'Parent', ADMIN: 'Admin', COACH: 'You' };
const roleColor = { PARENT: '#D4AF37', ADMIN: '#86efac', COACH: '#93c5fd' };

export default function Messages() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true);
    coachPortalAPI.getMessages()
      .then(res => setThreads(res.data.data))
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleReply = async () => {
    if (!active || !replyBody.trim()) return;
    setSending(true);
    try {
      const res = await coachPortalAPI.replyMessage(active._id, replyBody.trim());
      setActive(res.data.data);
      setReplyBody('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Reply failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: '16px', paddingBottom: '90px', color: '#fff' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Messages</h1>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
        Questions from parents about your batches.
      </p>

      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</p>
      ) : threads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.4)' }}>
          <span style={{ fontSize: '32px' }}>💬</span>
          <p style={{ marginTop: '12px', fontSize: '13px' }}>No messages yet for your batches.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {threads.map(t => {
            const last = t.messages[t.messages.length - 1];
            return (
              <div
                key={t._id}
                onClick={() => setActive(t)}
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)',
                  borderRadius: '14px', padding: '14px 16px', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '14px' }}>{t.subject}</strong>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase',
                    background: t.status === 'OPEN' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                    color: t.status === 'OPEN' ? '#86efac' : 'rgba(255,255,255,0.5)',
                  }}>{t.status}</span>
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '4px 0' }}>
                  {t.parentId ? `${t.parentId.firstName} ${t.parentId.lastName}` : 'Parent'} · {t.batchId?.title || 'Batch'}
                </p>
                {last && (
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: roleColor[last.senderRole], fontWeight: 600 }}>{roleLabel[last.senderRole]}:</span> {last.body}
                  </p>
                )}
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>{formatDateTime(t.lastMessageAt)}</p>
              </div>
            );
          })}
        </div>
      )}

      {active && (
        <div
          onClick={() => setActive(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0a2416', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', padding: '20px', width: '100%', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>{active.subject}</h3>
              <button onClick={() => setActive(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {active.messages.map(m => (
                <div key={m._id} style={{
                  background: m.senderRole === 'COACH' ? 'rgba(147,197,253,0.08)' : 'rgba(255,255,255,0.04)',
                  borderRadius: '12px', padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: roleColor[m.senderRole] }}>{m.senderName}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>{m.body}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleReply(); }}
                placeholder="Type a reply…"
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px', padding: '10px 16px', color: '#fff', fontSize: '13px', outline: 'none' }}
              />
              <button
                onClick={handleReply}
                disabled={sending || !replyBody.trim()}
                style={{ background: '#D4AF37', color: '#0a2416', border: 'none', borderRadius: '20px', padding: '10px 18px', fontWeight: 700, fontSize: '13px', opacity: sending ? 0.6 : 1 }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
