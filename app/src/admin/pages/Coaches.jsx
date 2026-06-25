// ============================================================
//  pages/Coaches.js — Both Admins
//  Add, edit, deactivate coaches; view bio and assignments.
//
//  NEW: When a coach is created, the backend auto-generates a
//  username + password (format: <coachname>@<coachUniqueId>)
//  and emails it to the coach. This page shows those credentials
//  ONCE in a modal right after creation (in case the email fails
//  or the admin wants to hand them over directly), and lets the
//  admin resend/regenerate credentials at any time.
// ============================================================
import React, { useEffect, useState } from 'react';
import { coachesAPI } from '../api/client';
import {
  PageHeader, DataTable, Modal, Btn, Badge,
  FormField, Input, Textarea, SearchInput
} from '../components/common/UI';
import toast from 'react-hot-toast';

const EMPTY = {
  firstName: '', lastName: '', email: '', phone: '',
  bio: '', experience: '', speciality: '', photoUrl: '', status: 'ACTIVE',
};

export default function Coaches() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);

  // Holds { username, coachUid, password, emailSent, coachName } right after
  // a coach is created, so we can show it in the credentials modal.
  const [newCredentials, setNewCredentials] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const res = await coachesAPI.getAll(); setRows(res.data.data); }
    catch { toast.error('Failed to load coaches'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit   = (row) => {
    setEditing(row);
    setForm({
      firstName:  row.firstName  || '',
      lastName:   row.lastName   || '',
      email:      row.email      || '',
      phone:      row.phone      || '',
      bio:        row.bio        || '',
      experience: row.experience || '',
      speciality: row.speciality || '',
      photoUrl:   row.photoUrl   || '',
      status:     row.status     || 'ACTIVE',
    });
    setModalOpen(true);
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.firstName || !form.email) { toast.error('First name and email required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await coachesAPI.update(editing._id, form);
        toast.success('Coach updated!');
        setModalOpen(false);
      } else {
        const res = await coachesAPI.create(form);
        const { credentials, emailSent, data } = res.data;
        toast.success('Coach added!');
        setModalOpen(false);
        // Show the one-time credentials modal
        setNewCredentials({
          coachName: `${data.firstName} ${data.lastName}`,
          email: data.email,
          username: credentials.username,
          coachUid: credentials.coachUid,
          password: credentials.password,
          emailSent,
        });
      }
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Remove coach "${row.firstName} ${row.lastName}"?`)) return;
    try { await coachesAPI.remove(row._id); toast.success('Removed'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Delete failed'); }
  };

  const handleResend = async (row) => {
    if (!window.confirm(`Generate a new password for ${row.firstName} ${row.lastName} and email it to them?`)) return;
    setResendingId(row._id);
    try {
      await coachesAPI.resendCredentials(row._id);
      toast.success('New credentials emailed to the coach.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to resend credentials');
    } finally {
      setResendingId(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success('Copied!');
  };

  const filtered = rows.filter(r =>
    !search ||
    `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.speciality?.toLowerCase().includes(search.toLowerCase()) ||
    r.username?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'photoUrl', label: '',
      render: (v, row) => (
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'rgba(212,175,55,0.2)', border: '1px solid rgba(212,175,55,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#F5D97A', fontWeight: '700', fontSize: '14px',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {v
            ? <img src={v} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : `${row.firstName?.[0]}${row.lastName?.[0]}`
          }
        </div>
      ),
    },
    { key: 'firstName', label: 'Name', render: (v, row) => `${v} ${row.lastName}` },
    { key: 'email',     label: 'Email' },
    {
      key: 'username', label: 'Login Username',
      render: v => v
        ? <span style={{ fontFamily: 'monospace', fontSize: '12.5px', color: '#F5D97A' }}>{v}</span>
        : <span style={{ color: '#94a3b8' }}>—</span>,
    },
    { key: 'speciality',label: 'Speciality', render: v => v || '—' },
    { key: 'status',    label: 'Status',     render: v => <Badge label={v} /> },
    {
      key: '_id', label: 'Actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Btn small onClick={() => openEdit(row)}>Edit</Btn>
          <Btn small variant="ghost" disabled={resendingId === row._id} onClick={() => handleResend(row)}>
            {resendingId === row._id ? 'Sending...' : 'Resend Login'}
          </Btn>
          <Btn small variant="danger" onClick={() => handleDelete(row)}>Remove</Btn>
        </div>
      ),
    },
  ];

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader
        title="Coaches"
        subtitle="Manage coach profiles, assignments, and Coach Portal login access"
        action={<Btn onClick={openCreate}>+ Add Coach</Btn>}
      />
      <div style={{ marginBottom: '20px' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, username, speciality..." />
      </div>
      <DataTable columns={columns} rows={filtered} loading={loading} emptyMsg="No coaches yet." />

      {/* ── Add / Edit Coach Modal ─────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Coach' : 'Add New Coach'} width="580px">
        {!editing && (
          <div style={{
            background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#F5D97A',
          }}>
            A username and password will be generated automatically and emailed to the coach.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <FormField label="First Name" required>
            <Input value={form.firstName} onChange={f('firstName')} placeholder="Ravi" />
          </FormField>
          <FormField label="Last Name">
            <Input value={form.lastName} onChange={f('lastName')} placeholder="Sharma" />
          </FormField>
          <FormField label="Email" required>
            <Input type="email" value={form.email} onChange={f('email')} placeholder="coach@calcricket.org" />
          </FormField>
          <FormField label="Phone">
            <Input value={form.phone} onChange={f('phone')} placeholder="+1 408 555 0101" />
          </FormField>
          <FormField label="Speciality">
            <Input value={form.speciality} onChange={f('speciality')} placeholder="Batting, Fielding" />
          </FormField>
          <FormField label="Experience">
            <Input value={form.experience} onChange={f('experience')} placeholder="10 years" />
          </FormField>
          <FormField label="Status">
            <select value={form.status} onChange={f('status')} style={{
              width: '100%', background: '#0f3d22', border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none',
            }}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </FormField>
          <FormField label="Photo URL">
            <Input value={form.photoUrl} onChange={f('photoUrl')} placeholder="https://cdn.calcricket.org/coaches/..." />
          </FormField>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Bio">
              <Textarea value={form.bio} onChange={f('bio')} rows={3} placeholder="Coach's background and achievements..." />
            </FormField>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update Coach' : 'Add Coach')}</Btn>
        </div>
      </Modal>

      {/* ── One-time Credentials Modal (shown right after creation) ── */}
      <Modal open={!!newCredentials} onClose={() => setNewCredentials(null)} title="Coach Login Credentials" width="480px">
        {newCredentials && (
          <div>
            <p style={{ fontSize: '14px', color: '#cbd5e1', marginTop: 0 }}>
              {newCredentials.coachName}'s Coach Portal account has been created.
              {newCredentials.emailSent
                ? ' An email with these details has been sent to ' + newCredentials.email + '.'
                : ' ⚠️ The welcome email could not be sent — please share these details manually.'}
            </p>
            {[
              ['Username', newCredentials.username],
              ['Coach ID', newCredentials.coachUid],
              ['Password', newCredentials.password],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '10px 14px', marginBottom: '10px',
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '15px', color: '#F5D97A', fontWeight: 700 }}>{value}</div>
                </div>
                <Btn small variant="ghost" onClick={() => copyToClipboard(value)}>Copy</Btn>
              </div>
            ))}
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '20px' }}>
              This password is only shown once. If it's lost, use "Resend Login" on the coach's row to generate a new one.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={() => setNewCredentials(null)}>Done</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
