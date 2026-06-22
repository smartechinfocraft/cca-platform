// ============================================================
//  pages/AdminUsers.js — Super Admin Only
//  View all admins, create new ones, activate/deactivate
// ============================================================
import React, { useEffect, useState } from 'react';
import { authAPI } from '../api/client';
import { useAdminAuth } from '../context/AuthContext';
import {
  PageHeader, DataTable, Modal, Btn, Badge,
  FormField, Input, Select
} from '../components/common/UI';
import toast from 'react-hot-toast';

const EMPTY = { username: '', email: '', password: '', firstName: '', lastName: '', role: 'ADMIN' };

export default function AdminUsers() {
  const { user: currentUser } = useAdminAuth();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await authAPI.listAdmins(); setRows(res.data.data); }
    catch { toast.error('Failed to load admins'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleCreate = async () => {
    if (!form.username || !form.email || !form.password || !form.firstName) {
      toast.error('Username, email, password, and first name are required');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await authAPI.createAdmin(form);
      toast.success(`Admin "${form.username}" created!`);
      setModalOpen(false);
      setForm(EMPTY);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Create failed');
    } finally { setSaving(false); }
  };

  const handleToggle = async (row) => {
    if (row._id === currentUser.id) { toast.error("You can't deactivate yourself"); return; }
    const action = row.status === 'ACTIVE' ? 'deactivate' : 'activate';
    if (!window.confirm(`${action} "${row.username}"?`)) return;
    try {
      await authAPI.toggleStatus(row._id);
      toast.success(`Admin ${action}d`);
      load();
    } catch { toast.error('Failed'); }
  };

  const columns = [
    {
      key: 'firstName', label: 'Name',
      render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: row.role === 'SUPER_ADMIN' ? 'rgba(212,175,55,0.2)' : 'rgba(59,130,246,0.2)',
            border: `1px solid ${row.role === 'SUPER_ADMIN' ? 'rgba(212,175,55,0.3)' : 'rgba(59,130,246,0.3)'}`,
            color: row.role === 'SUPER_ADMIN' ? '#F5D97A' : '#93c5fd',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: '700', flexShrink: 0,
          }}>
            {row.firstName?.[0]}{row.lastName?.[0]}
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: '500', fontSize: '14px' }}>{v} {row.lastName}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{row.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'username', label: 'Username', render: v => <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#F5D97A' }}>{v}</span> },
    { key: 'role',     label: 'Role',   render: v => <Badge label={v} /> },
    { key: 'status',   label: 'Status', render: v => <Badge label={v} /> },
    {
      key: 'lastLogin', label: 'Last Login',
      render: v => v
        ? <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{new Date(v).toLocaleString()}</span>
        : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>Never</span>,
    },
    { key: 'createdAt', label: 'Created', render: v => new Date(v).toLocaleDateString() },
    {
      key: '_id', label: 'Actions',
      render: (_, row) => {
        const isSelf = row._id === currentUser.id;
        return (
          <Btn
            small
            disabled={isSelf}
            variant={row.status === 'ACTIVE' ? 'danger' : 'success'}
            onClick={() => handleToggle(row)}
          >
            {isSelf ? 'You' : row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </Btn>
        );
      },
    },
  ];

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader
        title="Admin Users"
        subtitle="Super Admin — manage all admin accounts"
        action={<Btn onClick={() => { setForm(EMPTY); setModalOpen(true); }}>+ Create Admin</Btn>}
      />

      {/* Info box */}
      <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
        ⭐ <strong style={{ color: '#F5D97A' }}>Super Admin</strong> — full access including programs, locations, categories, and admin management.<br />
        🔧 <strong style={{ color: '#93c5fd' }}>Admin</strong> — batches, registrations, coaches, reports, coupons, content. Cannot access Super Admin sections.
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyMsg="No admin users found." />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create New Admin" width="520px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <FormField label="First Name" required>
            <Input value={form.firstName} onChange={f('firstName')} placeholder="Admin" />
          </FormField>
          <FormField label="Last Name">
            <Input value={form.lastName} onChange={f('lastName')} placeholder="User" />
          </FormField>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Username" required>
              <Input value={form.username} onChange={f('username')} placeholder="admin.cca.03" style={{ fontFamily: 'monospace' }} />
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Email" required>
              <Input type="email" value={form.email} onChange={f('email')} placeholder="admin3@calcricket.org" />
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Password (min 8 chars)" required>
              <div style={{ position: 'relative' }}>
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={f('password')}
                  placeholder="Strong password..."
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Role">
              <Select value={form.role} onChange={f('role')}>
                <option value="ADMIN">Admin (Normal)</option>
                {/* Note: Super Admin can't create another Super Admin from here for safety */}
              </Select>
            </FormField>
          </div>
        </div>
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
          💡 The new admin will be able to manage: batches, registrations, coaches, reports, coupons, and content.
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Admin'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
