// ============================================================
//  pages/Categories.js — Super Admin Only
//  Manage seasons: Summer 2026, Winter 2026, Fall 2026, etc.
// ============================================================
import React, { useEffect, useState } from 'react';
import { categoriesAPI } from '../api/client';
import {
  PageHeader, DataTable, Modal, Btn, Badge,
  FormField, Input, Textarea, SearchInput
} from '../components/common/UI';
import toast from 'react-hot-toast';

const EMPTY = {
  title: '', shortDescription: '', detailedDescription: '',
  holidayNotes: '', whatsappGroupLink: '', bannerImageUrl: '',
  sortOrder: '0', isActive: true,
};

export default function Categories() {
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
      const res = await categoriesAPI.getAll();
      setRows(res.data.data);
    } catch { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit   = (row) => {
    setEditing(row);
    setForm({
      title:              row.title              || '',
      shortDescription:   row.shortDescription   || '',
      detailedDescription:row.detailedDescription|| '',
      holidayNotes:       row.holidayNotes       || '',
      whatsappGroupLink:  row.whatsappGroupLink  || '',
      bannerImageUrl:     row.bannerImageUrl     || '',
      sortOrder:          String(row.sortOrder   || 0),
      isActive:           row.isActive !== false,
    });
    setModalOpen(true);
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, sortOrder: parseInt(form.sortOrder) || 0 };
      if (editing) {
        await categoriesAPI.update(editing._id, payload);
        toast.success('Category updated!');
      } else {
        await categoriesAPI.create(payload);
        toast.success('Category created!');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    try {
      await categoriesAPI.remove(row._id);
      toast.success('Deleted');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Delete failed'); }
  };

  const filtered = rows.filter(r =>
    !search || r.title?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'title',       label: 'Season / Category' },
    { key: 'slug',        label: 'Slug', render: v => <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#F5D97A' }}>{v}</span> },
    { key: 'sortOrder',   label: 'Order' },
    { key: 'isActive',    label: 'Status', render: v => <Badge label={v ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'whatsappGroupLink', label: 'WhatsApp', render: v => v ? <a href={v} target="_blank" rel="noreferrer" style={{ color: '#22c55e', fontSize: '12px' }}>Link ↗</a> : '—' },
    { key: 'createdAt', label: 'Created', render: v => new Date(v).toLocaleDateString() },
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
        title="Categories"
        subtitle="Super Admin — manage seasons (Summer, Winter, Fall...)"
        action={<Btn onClick={openCreate}>+ New Category</Btn>}
      />
      <div style={{ marginBottom: '20px' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories..." />
      </div>
      <DataTable columns={columns} rows={filtered} loading={loading} emptyMsg="No categories yet." />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit: ${editing.title}` : 'Create New Category'} width="600px">
        <div>
          <FormField label="Category Title" required>
            <Input value={form.title} onChange={f('title')} placeholder="e.g. Summer 2026" />
          </FormField>
          <FormField label="Short Description">
            <Input value={form.shortDescription} onChange={f('shortDescription')} placeholder="Brief summary for listings" />
          </FormField>
          <FormField label="Detailed Description">
            <Textarea value={form.detailedDescription} onChange={f('detailedDescription')} rows={3} placeholder="Full description shown on season page..." />
          </FormField>
          <FormField label="Holiday / Closure Notes">
            <Textarea value={form.holidayNotes} onChange={f('holidayNotes')} rows={2} placeholder="e.g. No sessions on July 4th" />
          </FormField>
          <FormField label="WhatsApp Group Link">
            <Input value={form.whatsappGroupLink} onChange={f('whatsappGroupLink')} placeholder="https://chat.whatsapp.com/..." />
          </FormField>
          <FormField label="Banner Image URL">
            <Input value={form.bannerImageUrl} onChange={f('bannerImageUrl')} placeholder="https://cdn.calcricket.org/banners/..." />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <FormField label="Sort Order">
              <Input type="number" value={form.sortOrder} onChange={f('sortOrder')} placeholder="0" />
            </FormField>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                <input type="checkbox" checked={form.isActive}
                  onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: '#D4AF37' }}
                />
                Active
              </label>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update' : 'Create')}</Btn>
        </div>
      </Modal>
    </div>
  );
}
