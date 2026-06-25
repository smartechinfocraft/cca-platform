// ============================================================
//  pages/Messages.jsx — Admin inbox for parent messages.
//  Admins see EVERY thread (unlike the coach inbox, which is
//  restricted to that coach's own assigned batches).
// ============================================================
import React, { useEffect, useState } from 'react';
import { messagesAPI } from '../api/client';
import { PageHeader, Btn, Select, SearchInput } from '../components/common/UI';
import toast from 'react-hot-toast';

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const roleLabel = { PARENT: 'Parent', ADMIN: 'Admin', COACH: 'Coach' };
const roleColor = { PARENT: '#F5D97A', ADMIN: '#86efac', COACH: '#fca5a5' };

export default function Messages() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await messagesAPI.getAll(params);
      setThreads(res.data.data);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleReply = async () => {
    if (!active || !replyBody.trim()) return;
    setSending(true);
    try {
      const res = await messagesAPI.reply(active._id, replyBody.trim());
      setActive(res.data.data);
      setReplyBody('');
      load();
    } catch {
      toast.error('Reply failed');
    } finally {
      setSending(false);
    }
  };

  const handleToggleResolved = async (thread) => {
    try {
      const newStatus = thread.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
      await messagesAPI.setStatus(thread._id, newStatus);
      toast.success(`Marked ${newStatus.toLowerCase()}`);
      load();
      if (active?._id === thread._id) setActive({ ...active, status: newStatus });
    } catch {
      toast.error('Failed to update status');
    }
  };

  const filtered = threads.filter(t =>
    !search ||
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.parentId?.email?.toLowerCase().includes(search.toLowerCase()) ||
    (`${t.parentId?.firstName} ${t.parentId?.lastName}`).toLowerCase().includes(search.toLowerCase()) ||
    t.batchId?.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader title="Messages" subtitle="Parent questions, scoped to a specific batch" />

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subject, parent, or batch..." />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '160px' }}>
          <option value="">All</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
        </Select>
        <Btn variant="ghost" onClick={load}>Refresh</Btn>
      </div>

      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>No messages found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(t => {
            const last = t.messages[t.messages.length - 1];
            return (
              <div
                key={t._id}
                onClick={() => setActive(t)}
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px', padding: '16px 20px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#fff', fontSize: '14px' }}>{t.subject}</strong>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase',
                      background: t.status === 'OPEN' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                      color: t.status === 'OPEN' ? '#86efac' : 'rgba(255,255,255,0.5)',
                    }}>
                      {t.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: '4px 0' }}>
                    {t.parentId ? `${t.parentId.firstName} ${t.parentId.lastName} (${t.parentId.email})` : 'Unknown parent'}
                    {' · '}{t.batchId?.title || 'Batch'} {t.batchId?.dayOfWeek ? `(${t.batchId.dayOfWeek})` : ''}
                  </p>
                  {last && (
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: roleColor[last.senderRole], fontWeight: 600 }}>{roleLabel[last.senderRole]}:</span> {last.body}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '0 0 8px' }}>{formatDateTime(t.lastMessageAt)}</p>
                  <Btn small variant="ghost" onClick={(e) => { e.stopPropagation(); handleToggleResolved(t); }}>
                    {t.status === 'OPEN' ? 'Mark Resolved' : 'Reopen'}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Thread detail panel */}
      {active && (
        <div
          onClick={() => setActive(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#16241a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '24px', maxWidth: '560px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{active.subject}</h3>
              <button onClick={() => setActive(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
              {active.parentId ? `${active.parentId.firstName} ${active.parentId.lastName}` : 'Unknown'} · {active.batchId?.title || 'Batch'}
            </p>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {active.messages.map(m => (
                <div key={m._id} style={{
                  background: m.senderRole === 'PARENT' ? 'rgba(255,255,255,0.03)' : 'rgba(245,217,122,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: roleColor[m.senderRole] }}>{m.senderName}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{formatDateTime(m.createdAt)}</span>
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
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '10px 16px', color: '#fff', fontSize: '13px', outline: 'none' }}
              />
              <Btn onClick={handleReply} disabled={sending || !replyBody.trim()}>{sending ? 'Sending…' : 'Send'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
