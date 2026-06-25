// ============================================================
//  pages/AgeGroups.js — Super Admin Only
//  Manage age groups: U8, U9, U10, U11, U12, U13, U14, etc.
// ============================================================
import React, { useEffect, useState } from 'react';
import { ageGroupsAPI } from '../api/client';
import {
  PageHeader, DataTable, Modal, Btn, Badge,
  FormField, Input, SearchInput
} from '../components/common/UI';
import toast from 'react-hot-toast';

const EMPTY = {
  title: '', label: '', sortOrder: '0', isActive: true,
};

export default function AgeGroups() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ageGroupsAPI.getAll();
      setRows(res.data.data);
    } catch { toast.error('Failed to load age groups'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit   = (row) => {
    setEditing(row);
    setForm({
      title:     row.title     || '',
      label:     row.label     || '',
      sortOrder: String(row.sortOrder || 0),
      isActive:  row.isActive !== false,
    });
    setModalOpen(true);
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required (e.g. U10)'); return; }
    setSaving(true);
    try {
      const payload = { ...form, sortOrder: parseInt(form.sortOrder) || 0 };
      if (editing) {
        await ageGroupsAPI.update(editing._id, payload);
        toast.success('Age group updated!');
      } else {
        await ageGroupsAPI.create(payload);
        toast.success('Age group created!');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.title}"?`)) return;
    try {
      await ageGroupsAPI.remove(row._id);
      toast.success('Deleted');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Delete failed'); }
  };

  const filtered = rows.filter(r =>
    !search || r.title?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'title',     label: 'Age Group' },
    { key: 'label',     label: 'Display Label', render: v => v || '—' },
    { key: 'sortOrder', label: 'Sort Order' },
    { key: 'isActive',  label: 'Status', render: v => <Badge label={v ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: '_id', label: 'Actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn small onClick={() => openEdit(row)}>Edit</Btn>
          <Btn small variant="danger" onClick={() => handleDelete(row)}>Delete</Btn>
        </div>
      ),
    },
  ];

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader
        title="Age Groups"
        subtitle="Super Admin — manage age groups (U8, U10, U12, etc.)"
        action={<Btn onClick={openCreate}>+ New Age Group</Btn>}
      />
      <div style={{ marginBottom: '20px' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search age groups..." />
      </div>
      <DataTable columns={columns} rows={filtered} loading={loading} emptyMsg="No age groups yet. Create one!" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit: ${editing.title}` : 'Add New Age Group'} width="480px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <FormField label="Title (used in Program forms)" required>
            <Input value={form.title} onChange={f('title')} placeholder="e.g. U10" />
          </FormField>
          <FormField label="Display Label (optional)">
            <Input value={form.label} onChange={f('label')} placeholder="e.g. Under 10" />
          </FormField>
          <FormField label="Sort Order">
            <Input type="number" value={form.sortOrder} onChange={f('sortOrder')} placeholder="0" />
          </FormField>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                style={{ width: '16px', height: '16px', accentColor: '#D4AF37' }}
              />
              Active
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update' : 'Create')}</Btn>
        </div>
      </Modal>
    </div>
  );
}