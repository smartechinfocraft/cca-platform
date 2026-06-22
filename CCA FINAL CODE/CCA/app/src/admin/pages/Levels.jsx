// ============================================================
//  pages/Levels.js — Super Admin Only
//  Manage skill levels: Beginner Level 1, Beginner Level 2,
//  Intermediate, Junior, Juniors, etc.
// ============================================================
import React, { useEffect, useState } from 'react';
import { levelsAPI } from '../api/client';
import {
  PageHeader, DataTable, Modal, Btn, Badge,
  FormField, Input, Textarea, SearchInput
} from '../components/common/UI';
import toast from 'react-hot-toast';

const EMPTY = {
  title: '', description: '', sortOrder: '0', isActive: true,
};

export default function Levels() {
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
      const res = await levelsAPI.getAll();
      setRows(res.data.data);
    } catch { toast.error('Failed to load levels'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit   = (row) => {
    setEditing(row);
    setForm({
      title:       row.title       || '',
      description: row.description || '',
      sortOrder:   String(row.sortOrder || 0),
      isActive:    row.isActive !== false,
    });
    setModalOpen(true);
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required (e.g. Beginner Level 1)'); return; }
    setSaving(true);
    try {
      const payload = { ...form, sortOrder: parseInt(form.sortOrder) || 0 };
      if (editing) {
        await levelsAPI.update(editing._id, payload);
        toast.success('Level updated!');
      } else {
        await levelsAPI.create(payload);
        toast.success('Level created!');
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
      await levelsAPI.remove(row._id);
      toast.success('Deleted');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Delete failed'); }
  };

  const filtered = rows.filter(r =>
    !search || r.title?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'title',       label: 'Level' },
    { key: 'description', label: 'Description', render: v => v || '—' },
    { key: 'sortOrder',   label: 'Sort Order' },
    { key: 'isActive',    label: 'Status', render: v => <Badge label={v ? 'ACTIVE' : 'INACTIVE'} /> },
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
        title="Levels"
        subtitle="Super Admin — manage skill levels (Beginner Level 1, Intermediate, etc.)"
        action={<Btn onClick={openCreate}>+ New Level</Btn>}
      />
      <div style={{ marginBottom: '20px' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search levels..." />
      </div>
      <DataTable columns={columns} rows={filtered} loading={loading} emptyMsg="No levels yet. Create one!" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit: ${editing.title}` : 'Add New Level'} width="520px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Title (used in Program forms)" required>
              <Input value={form.title} onChange={f('title')} placeholder="e.g. Beginner Level 1" />
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Description (optional)">
              <Textarea value={form.description} rows={2} onChange={f('description')}
                placeholder="Shown in level info section..." />
            </FormField>
          </div>
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