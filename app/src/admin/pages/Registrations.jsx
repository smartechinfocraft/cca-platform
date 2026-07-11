// ============================================================
//  pages/Registrations.jsx
//  Normal Admin: view, filter, update status, add notes
// ============================================================
import React, { useEffect, useState } from 'react';
import { registrationsAPI, batchesAPI } from '../api/client';
import { useAdminAuth } from '../context/AuthContext';
import { PageHeader, DataTable, Modal, Btn, Badge, FormField, Select, Textarea, SearchInput } from '../components/common/UI';
import toast from 'react-hot-toast';

const STATUSES = ['PENDING','AWAITING_PAYMENT','PAID','CONFIRMED','CANCELLED','REFUNDED','WAITLISTED'];

const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;

const splitScheduleItems = (value) =>
  String(value || '')
    .split(/\s*(?:\n|;|\s+\|\s+|,\s*(?=[A-Z][a-z]+day\b))\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

export default function Registrations() {
  const { isSuperAdmin } = useAdminAuth();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterStatus, setFilter] = useState('');
  const [selected, setSelected]   = useState(null);
  const [statusForm, setStatusForm] = useState({ status: '', adminNote: '' });
  const [confirmingId, setConfirmingId] = useState(null); // tracks which row is being confirmed

  // Super-admin-only batch reassignment
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [reassigning, setReassigning] = useState(false);
  const [lastEmailResult, setLastEmailResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await registrationsAPI.getAll(params);
      setRows(res.data.data);
    } catch (e) {
      toast.error('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const openEdit = (row) => {
    setSelected(row);
    setStatusForm({ status: row.status, adminNote: row.adminNote || '' });
    setLastEmailResult(null);
    setSelectedBatchIds((row.batches || []).map(b => (typeof b === 'string' ? b : b._id)));

    if (isSuperAdmin && row.programId?._id) {
      batchesAPI.getAll({ program: row.programId._id, active: 'true' })
        .then(res => setAvailableBatches(res.data.data || []))
        .catch(() => setAvailableBatches([]));
    }
  };

  const toggleBatchSelection = (batchId) => {
    setSelectedBatchIds(prev =>
      prev.includes(batchId) ? prev.filter(id => id !== batchId) : [...prev, batchId]
    );
  };

  const handleReassignBatch = async () => {
    setReassigning(true);
    try {
      const res = await registrationsAPI.superAdminEdit(selected._id, { batches: selectedBatchIds });
      if (res.data.changes?.length) {
        toast.success(`Batch updated — ${res.data.emailSent ? 'parent notified by email' : 'parent email could not be sent, check SMTP settings'}`);
        setLastEmailResult(res.data.emailSent);
      } else {
        toast('No batch change detected.', { icon: 'ℹ️' });
      }
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Batch reassignment failed');
    } finally {
      setReassigning(false);
    }
  };

  const handleSave = async () => {
    try {
      await registrationsAPI.updateStatus(selected._id, statusForm);
      toast.success('Registration updated');
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    }
  };

  const handleWhatsapp = async (row) => {
    try {
      await registrationsAPI.toggleWhatsapp(row._id);
      toast.success('WhatsApp status updated');
      load();
    } catch (e) {
      toast.error('Failed');
    }
  };

  // ── Check payment confirm ────────────────────────────────────
  // Marks paymentStatus=SUCCESS, status=CONFIRMED in one click
  const handleConfirmCheck = async (row) => {
    setConfirmingId(row._id);
    try {
      await registrationsAPI.confirmCheck(row._id);
      toast.success(`✅ Check confirmed — ${row.registrationNumber} marked as CONFIRMED`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to confirm check');
    } finally {
      setConfirmingId(null);
    }
  };

  // Client-side search filter
  const filtered = rows.filter(r =>
    !search ||
    r.registrationNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.programId?.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.parentId?.email?.toLowerCase().includes(search.toLowerCase()) ||
    (`${r.parentId?.firstName} ${r.parentId?.lastName}`).toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'registrationNumber',
      label: 'Reg #',
      render: (v, row) => (
        <button
          type="button"
          onClick={() => openEdit(row)}
          style={{ background: 'transparent', border: 0, color: '#F5D97A', cursor: 'pointer', fontWeight: 700, padding: 0 }}
        >
          {v}
        </button>
      ),
    },
    { key: 'parentId',    label: 'Parent',  render: (v) => v ? `${v.firstName} ${v.lastName}` : '—' },
    { key: 'parentEmail', label: 'Email',   render: (_, row) => row.parentId?.email || '—' },
    { key: 'programId',   label: 'Program', render: (v) => v?.title || '—' },
    { key: 'totalAmount', label: 'Amount',  render: (v) => `$${(v || 0).toLocaleString()}` },
    { key: 'status',      label: 'Status',  render: (v) => <Badge label={v} /> },
    { key: 'paymentMethod', label: 'Payment' },
    {
      key: 'checkNumber', label: 'Check #',
      render: (v) => v || '—',
    },
    {
      // ── Confirm Check button — only shows for CHECK + not yet CONFIRMED ──
      key: 'confirmCheck', label: 'Confirm Check',
      render: (_, row) => {
        if (row.paymentMethod !== 'CHECK') return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>—</span>;
        if (row.status === 'CONFIRMED' && row.paymentStatus === 'SUCCESS') {
          return (
            <span style={{ color: '#86efac', fontSize: '12px', fontWeight: 600 }}>
              ✅ Received
            </span>
          );
        }
        return (
          <button
            disabled={confirmingId === row._id}
            onClick={() => handleConfirmCheck(row)}
            style={{
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.4)',
              color: '#86efac',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: confirmingId === row._id ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              opacity: confirmingId === row._id ? 0.5 : 1,
            }}
          >
            {confirmingId === row._id ? 'Confirming…' : '✓ Mark Received'}
          </button>
        );
      },
    },
    {
      key: 'isWhatsappJoined', label: 'WhatsApp',
      render: (v, row) => (
        <button
          onClick={() => handleWhatsapp(row)}
          style={{
            background: v ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${v ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: v ? '#86efac' : 'rgba(255,255,255,0.4)',
            borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px',
          }}
        >
          {v ? '✅ Joined' : '⬜ Not joined'}
        </button>
      ),
    },
    { key: 'createdAt', label: 'Date', render: (v) => new Date(v).toLocaleDateString() },
    {
      key: '_id', label: 'Actions',
      render: (_, row) => (
        <Btn small onClick={() => openEdit(row)}>Edit</Btn>
      ),
    },
  ];

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader
        title="Registrations"
        subtitle="View and manage parent registrations"
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reg # or program..." />
        <Select value={filterStatus} onChange={e => setFilter(e.target.value)} style={{ width: '180px' }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Btn variant="ghost" onClick={load}>Refresh</Btn>
      </div>

      <DataTable columns={columns} rows={filtered} loading={loading} emptyMsg="No registrations found" />

      {/* Edit modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Edit: ${selected?.registrationNumber}`}>
        {selected && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
              <div><strong style={{ color: '#F5D97A' }}>Program:</strong> {selected.programId?.title || '—'}</div>
              <div style={{ marginTop: '4px' }}><strong style={{ color: '#F5D97A' }}>Amount:</strong> ${selected.totalAmount}</div>
              <div style={{ marginTop: '4px' }}><strong style={{ color: '#F5D97A' }}>Payment:</strong> {selected.paymentMethod} {selected.checkNumber ? `— Check #${selected.checkNumber}` : ''}</div>
            </div>

            {/* ── Inline check confirm banner inside modal ── */}
            {Array.isArray(selected.orderItems) && selected.orderItems.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#F5D97A', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Order Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                  {selected.orderItems.map((item, index) => {
                    const students = item.students || [];
                    const schedule = splitScheduleItems(item.selectedDays);
                    const itemTotal = item.itemTotal || ((Number(item.feePerStudent) || 0) * (Number(item.studentCount) || students.length || 1));
                    return (
                      <div key={`${item.programTitle || 'program'}-${index}`} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '14px', background: 'rgba(255,255,255,0.035)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Program</div>
                            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 800, marginTop: '3px' }}>{item.programTitle || selected.programId?.title || '—'}</div>
                          </div>
                          <div style={{ textAlign: 'right', color: '#F5D97A', fontWeight: 800, fontSize: '15px', whiteSpace: 'nowrap' }}>{money(itemTotal)}</div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                          <div style={{ background: 'rgba(15,23,42,0.45)', borderRadius: '8px', padding: '8px 10px' }}>
                            <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Batch</div>
                            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>{item.batchName || '—'}</div>
                          </div>
                          <div style={{ background: 'rgba(15,23,42,0.45)', borderRadius: '8px', padding: '8px 10px' }}>
                            <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Month</div>
                            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>{item.selectedMonthLabel || item.selectedMonth?.label || '—'}</div>
                          </div>
                          <div style={{ background: 'rgba(15,23,42,0.45)', borderRadius: '8px', padding: '8px 10px', minWidth: '220px' }}>
                            <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Schedule</div>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#fff', fontSize: '12px', fontWeight: 700 }}>
                              {schedule.length ? schedule.map(day => <li key={day}>{day}</li>) : <li style={{ listStyle: 'none', marginLeft: '-16px' }}>—</li>}
                            </ul>
                          </div>
                        </div>
                        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                            Students ({item.studentCount || students.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {students.map((student, studentIndex) => (
                              <div key={`${student.firstName || ''}-${student.lastName || ''}-${studentIndex}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', background: 'rgba(245,217,122,0.12)', borderRadius: '8px', padding: '8px 10px', color: '#fff', fontSize: '12px' }}>
                                <div>
                                  <strong>{`${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student'}</strong>
                                  <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{student.dob ? `DOB: ${student.dob}` : ''}{student.gender ? ` · ${student.gender}` : ''}</span>
                                </div>
                                <strong>{money(item.feePerStudent)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selected.paymentMethod === 'CHECK' && selected.status !== 'CONFIRMED' && (
              <div style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div>
                  <div style={{ color: '#86efac', fontWeight: 600, fontSize: '13px' }}>💵 Check Payment Pending</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
                    Once you physically receive the check, click confirm to mark this registration as paid.
                  </div>
                </div>
                <button
                  disabled={confirmingId === selected._id}
                  onClick={() => handleConfirmCheck(selected)}
                  style={{
                    background: '#16a34a',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    opacity: confirmingId === selected._id ? 0.6 : 1,
                  }}
                >
                  {confirmingId === selected._id ? 'Confirming…' : '✓ Confirm Check Received'}
                </button>
              </div>
            )}

            <FormField label="Update Status" required>
              <Select value={statusForm.status} onChange={e => setStatusForm(p => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>

            <FormField label="Admin Note">
              <Textarea
                value={statusForm.adminNote}
                onChange={e => setStatusForm(p => ({ ...p, adminNote: e.target.value }))}
                placeholder="Internal note visible only to admins..."
              />
            </FormField>

            {isSuperAdmin && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F5D97A', marginBottom: '8px' }}>
                  🔐 Super Admin — Reassign Batch
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
                  Changing the batch sends an automatic email to the parent showing exactly what changed.
                </p>
                {availableBatches.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>No active batches found for this program.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                    {availableBatches.map(b => (
                      <label key={b._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedBatchIds.includes(b._id)}
                          onChange={() => toggleBatchSelection(b._id)}
                        />
                        {b.title} — {b.dayOfWeek} {b.startTime}-{b.endTime}
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '10px' }}>
                  <Btn small variant="ghost" onClick={handleReassignBatch} disabled={reassigning}>
                    {reassigning ? 'Saving & emailing parent…' : 'Save Batch Change'}
                  </Btn>
                </div>
                {lastEmailResult === false && (
                  <p style={{ fontSize: '12px', color: '#fca5a5', marginTop: '8px' }}>
                    ⚠️ The change saved, but the notification email could not be sent. Check SMTP settings in the backend .env.
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Btn variant="ghost" onClick={() => setSelected(null)}>Cancel</Btn>
              <Btn onClick={handleSave}>Save Changes</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
