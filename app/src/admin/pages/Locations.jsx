// ============================================================
//  pages/Locations.js — Super Admin Only
//  Manage cricket grounds / practice facilities
// ============================================================
import React, { useEffect, useState } from 'react';
import { locationsAPI } from '../api/client';
import {
  PageHeader, DataTable, Modal, Btn, Badge,
  FormField, Input, SearchInput
} from '../components/common/UI';
import toast from 'react-hot-toast';

const EMPTY = {
  title: '', address: '', city: '', state: 'CA',
  zipCode: '', googleMapUrl: '', latitude: '', longitude: '', isActive: true,
};

export default function Locations() {
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
      const res = await locationsAPI.getAll();
      setRows(res.data.data);
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit   = (row) => {
    setEditing(row);
    setForm({
      title:       row.title       || '',
      address:     row.address     || '',
      city:        row.city        || '',
      state:       row.state       || 'CA',
      zipCode:     row.zipCode     || '',
      googleMapUrl:row.googleMapUrl|| '',
      latitude:    String(row.latitude  || ''),
      longitude:   String(row.longitude || ''),
      isActive:    row.isActive !== false,
    });
    setModalOpen(true);
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.title || !form.city) { toast.error('Title and City are required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        latitude:  form.latitude  ? parseFloat(form.latitude)  : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      };
      if (editing) {
        await locationsAPI.update(editing._id, payload);
        toast.success('Location updated!');
      } else {
        await locationsAPI.create(payload);
        toast.success('Location created!');
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
      await locationsAPI.remove(row._id);
      toast.success('Deleted');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Delete failed'); }
  };

  const filtered = rows.filter(r =>
    !search ||
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.city?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'title',   label: 'Location Name' },
    { key: 'address', label: 'Address', render: v => v || '—' },
    { key: 'city',    label: 'City' },
    { key: 'state',   label: 'State' },
    { key: 'zipCode', label: 'ZIP', render: v => v || '—' },
    {
      key: 'googleMapUrl', label: 'Map',
      render: v => v
        ? <a href={v} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontSize: '13px' }}>View Map ↗</a>
        : '—',
    },
    { key: 'isActive', label: 'Status', render: v => <Badge label={v ? 'ACTIVE' : 'INACTIVE'} /> },
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
        title="Locations"
        subtitle="Super Admin — manage cricket grounds and facilities"
        action={<Btn onClick={openCreate}>+ New Location</Btn>}
      />
      <div style={{ marginBottom: '20px' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or city..." />
      </div>
      <DataTable columns={columns} rows={filtered} loading={loading} emptyMsg="No locations yet." />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit: ${editing.title}` : 'Add New Location'} width="580px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Location Name" required>
              <Input value={form.title} onChange={f('title')} placeholder="e.g. Fremont Cricket Ground" />
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Full Address">
              <Input value={form.address} onChange={f('address')} placeholder="123 Park Road, Fremont, CA 94538" />
            </FormField>
          </div>
          <FormField label="City" required>
            <Input value={form.city} onChange={f('city')} placeholder="Fremont" />
          </FormField>
          <FormField label="State">
            <Input value={form.state} onChange={f('state')} placeholder="CA" />
          </FormField>
          <FormField label="ZIP Code">
            <Input value={form.zipCode} onChange={f('zipCode')} placeholder="94538" />
          </FormField>
          <FormField label="Latitude">
            <Input type="number" step="any" value={form.latitude} onChange={f('latitude')} placeholder="37.5485" />
          </FormField>
          <FormField label="Longitude">
            <Input type="number" step="any" value={form.longitude} onChange={f('longitude')} placeholder="-121.9886" />
          </FormField>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Google Maps URL">
              <Input value={form.googleMapUrl} onChange={f('googleMapUrl')} placeholder="https://maps.google.com/..." />
            </FormField>
          </div>
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
