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
const roleColor = { PARENT: '#2563eb', ADMIN: '#b45309', COACH: '#0f172a' };

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
    <div style={{ padding: '16px', paddingBottom: '90px', color: '#0f172a' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Messages</h1>
      <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
        Questions from parents about your batches.
      </p>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading…</p>
      ) : threads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
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
                  background: '#ffffff', border: '1px solid #e2e8f0',
                  borderRadius: '14px', padding: '14px 16px', cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '14px' }}>{t.subject}</strong>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase',
                    background: t.status === 'OPEN' ? 'rgba(37,99,235,0.1)' : '#f1f5f9',
                    color: t.status === 'OPEN' ? '#2563eb' : '#94a3b8',
                  }}>{t.status}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0' }}>
                  {t.parentId ? `${t.parentId.firstName} ${t.parentId.lastName}` : 'Parent'} · {t.batchId?.title || 'Batch'}
                </p>
                {last && (
                  <p style={{ fontSize: '13px', color: '#334155', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: roleColor[last.senderRole], fontWeight: 600 }}>{roleLabel[last.senderRole]}:</span> {last.body}
                  </p>
                )}
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{formatDateTime(t.lastMessageAt)}</p>
              </div>
            );
          })}
        </div>
      )}

      {active && (
        <div
          onClick={() => setActive(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#ffffff', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', padding: '20px', width: '100%', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{active.subject}</h3>
              <button onClick={() => setActive(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {active.messages.map(m => (
                <div key={m._id} style={{
                  background: m.senderRole === 'COACH' ? 'rgba(37,99,235,0.08)' : '#f1f5f9',
                  borderRadius: '12px', padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: roleColor[m.senderRole] }}>{m.senderName}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>{m.body}</p>
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
                style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '10px 16px', color: '#0f172a', fontSize: '13px', outline: 'none' }}
              />
              <button
                onClick={handleReply}
                disabled={sending || !replyBody.trim()}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '20px', padding: '10px 18px', fontWeight: 700, fontSize: '13px', opacity: sending ? 0.6 : 1 }}
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