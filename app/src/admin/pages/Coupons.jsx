// ============================================================
//  pages/Coupons.js — Both Admins
//  Create discount codes: percentage or fixed amount
// ============================================================
import React, { useEffect, useState } from 'react';
import { categoriesAPI, couponsAPI } from '../api/client';
import {
  PageHeader, DataTable, Modal, Btn, Badge,
  FormField, Input, Select, SearchInput
} from '../components/common/UI';
import toast from 'react-hot-toast';

const EMPTY = {
  code: '', type: 'PERCENTAGE', value: '', minAmount: '0',
  maxUses: '', expiresAt: '', description: '', isActive: true,
  isPubliclyVisible: true, categoryIds: [],
};

export default function Coupons() {
  const [rows, setRows]       = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await couponsAPI.getAll(); setRows(res.data.data); }
    catch { toast.error('Failed to load coupons'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    categoriesAPI.getAll()
      .then(res => setCategories(res.data.data))
      .catch(() => toast.error('Failed to load categories'));
  }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit   = (row) => {
    setEditing(row);
    setForm({
      code:        row.code        || '',
      type:        row.type        || 'PERCENTAGE',
      value:       String(row.value       || ''),
      minAmount:   String(row.minAmount   || '0'),
      maxUses:     row.maxUses != null ? String(row.maxUses) : '',
      expiresAt:   row.expiresAt ? row.expiresAt.split('T')[0] : '',
      description: row.description || '',
      isActive:    row.isActive !== false,
      isPubliclyVisible: row.isPubliclyVisible !== false,
      categoryIds: (row.categoryIds || []).map(category => String(category?._id || category)),
    });
    setModalOpen(true);
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.code || !form.value) { toast.error('Code and value are required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        code:      form.code.toUpperCase().trim(),
        value:     parseFloat(form.value),
        minAmount: parseFloat(form.minAmount) || 0,
        maxUses:   form.maxUses ? parseInt(form.maxUses) : null,
        expiresAt: form.expiresAt || undefined,
        categoryIds: [...new Set((form.categoryIds || []).map(category => String(category?._id || category)))],
      };
      let response;
      if (editing) {
        response = await couponsAPI.update(editing._id, payload);
      } else {
        response = await couponsAPI.create(payload);
      }
      const savedCategoryIds = (response.data.data?.categoryIds || [])
        .map(category => String(category?._id || category))
        .sort();
      if (JSON.stringify(savedCategoryIds) !== JSON.stringify([...payload.categoryIds].sort())) {
        throw new Error('Selected categories were not saved. Please retry.');
      }
      toast.success(editing ? 'Coupon updated!' : 'Coupon created!');
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete coupon "${row.code}"?`)) return;
    try { await couponsAPI.remove(row._id); toast.success('Deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Delete failed'); }
  };

  const filtered = rows.filter(r =>
    !search ||
    r.code?.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'code', label: 'Coupon Code',
      render: v => <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#F5D97A', background: 'rgba(212,175,55,0.1)', padding: '3px 10px', borderRadius: '6px' }}>{v}</span>,
    },
    { key: 'type',  label: 'Type',  render: v => <Badge label={v} /> },
    {
      key: 'value', label: 'Discount',
      render: (v, row) => row.type === 'PERCENTAGE' ? `${v}%` : `$${v}`,
    },
    { key: 'minAmount', label: 'Min Order', render: v => `$${v}` },
    {
      key: 'categoryIds', label: 'Categories',
      render: ids => {
        if (!ids?.length) return 'All categories';
        const names = ids.map(id => categories.find(category => category._id === String(id?._id || id))?.title).filter(Boolean);
        const unavailableCount = ids.length - names.length;
        if (!names.length) return `${ids.length} selected`;
        return unavailableCount ? `${names.join(', ')} + ${unavailableCount} unavailable` : names.join(', ');
      },
    },
    {
      key: 'usedCount', label: 'Used / Max',
      render: (v, row) => row.maxUses ? `${v} / ${row.maxUses}` : `${v} / ∞`,
    },
    {
      key: 'expiresAt', label: 'Expires',
      render: v => {
        if (!v) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>Never</span>;
        const expired = new Date(v) < new Date();
        return <span style={{ color: expired ? '#ef4444' : 'rgba(255,255,255,0.6)' }}>{new Date(v).toLocaleDateString()}</span>;
      },
    },
    { key: 'isActive', label: 'Status', render: v => <Badge label={v ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'isPubliclyVisible', label: 'Visibility', render: v => <Badge label={v === false ? 'DIRECT ENTRY' : 'PUBLIC'} /> },
    { key: 'description', label: 'Note', render: v => <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{v || '—'}</span> },
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
        title="Coupons & Discounts"
        subtitle="Create and manage discount codes for registrations"
        action={<Btn onClick={openCreate}>+ New Coupon</Btn>}
      />
      <div style={{ marginBottom: '20px' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code or description..." />
      </div>
      <DataTable columns={columns} rows={filtered} loading={loading} emptyMsg="No coupons yet." />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Coupon: ${editing.code}` : 'Create New Coupon'} width="520px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Coupon Code" required>
              <Input value={form.code} onChange={f('code')} placeholder="e.g. SUMMER10"
                style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '1px' }} />
            </FormField>
          </div>
          <FormField label="Discount Type" required>
            <Select value={form.type} onChange={f('type')}>
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FIXED">Fixed Amount ($)</option>
            </Select>
          </FormField>
          <FormField label={form.type === 'PERCENTAGE' ? 'Discount (%)' : 'Discount ($)'} required>
            <Input type="number" step="0.01" value={form.value} onChange={f('value')}
              placeholder={form.type === 'PERCENTAGE' ? '10' : '25.00'} />
          </FormField>
          <FormField label="Min Order Amount ($)">
            <Input type="number" value={form.minAmount} onChange={f('minAmount')} placeholder="0" />
          </FormField>
          <FormField label="Max Uses (blank = unlimited)">
            <Input type="number" value={form.maxUses} onChange={f('maxUses')} placeholder="∞" />
          </FormField>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Applies to Categories (blank = all categories)">
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px 8px' }}>
                {categories.map(category => {
                  const categoryId = String(category._id);
                  const checked = form.categoryIds.includes(categoryId);
                  return (
                    <label key={categoryId} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 4px', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setForm(current => ({
                          ...current,
                          categoryIds: e.target.checked
                            ? [...current.categoryIds, categoryId]
                            : current.categoryIds.filter(id => id !== categoryId),
                        }))}
                        style={{ width: '16px', height: '16px', accentColor: '#D4AF37', flex: '0 0 auto' }}
                      />
                      {category.title}
                    </label>
                  );
                })}
                {!categories.length && <span style={{ display: 'block', padding: '8px 4px', color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>No categories available</span>}
              </div>
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Expiry Date (optional)">
              <Input type="date" value={form.expiresAt} onChange={f('expiresAt')} style={{ width: '200px' }} />
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Internal Note">
              <Input value={form.description} onChange={f('description')} placeholder="e.g. Summer 2026 early bird" />
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                style={{ width: '16px', height: '16px', accentColor: '#D4AF37' }}
              />
              Active (usable by parents)
            </label>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
              <input type="checkbox" checked={form.isPubliclyVisible}
                onChange={e => setForm(p => ({ ...p, isPubliclyVisible: e.target.checked }))}
                style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#D4AF37' }}
              />
              <span>
                Show in public available-coupons list
                <span style={{ display: 'block', marginTop: '3px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                  Turn this off for private/admin test codes. The code will work only when entered directly.
                </span>
              </span>
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update Coupon' : 'Create Coupon')}</Btn>
        </div>
      </Modal>
    </div>
  );
}
