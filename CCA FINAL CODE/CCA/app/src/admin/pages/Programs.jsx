// ============================================================
//  pages/Programs.js — Super Admin Only
//  ISSUE 4: Cover image file upload (jpg/jpeg/png) — NOT url
//  ISSUE 5: All image fields use file upload with extension check
// ============================================================
import React, { useEffect, useState, useRef } from 'react';
import { programsAPI, categoriesAPI, locationsAPI, ageGroupsAPI, levelsAPI } from '../api/client';
import {
  PageHeader, DataTable, Modal, Btn, Badge,
  FormField, Input, Select, Textarea, SearchInput
} from '../components/common/UI';
import toast from 'react-hot-toast';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS  = ['.jpg', '.jpeg', '.png'];

const EMPTY_FORM = {
  title: '', categoryId: '', locationId: '', batchType: 'REGULAR_WITH_MONTH',
  ageGroups: [], skillLevels: [], price: '', discountedPrice: '',
  startDate: '', endDate: '', registrationDeadline: '',
  maxCapacity: '', shortDescription: '', detailedDescription: '',
  specialNote: '', isFeatured: false, isActive: true,
};

const BATCH_TYPES = [
  { value: 'REGULAR_WITH_MONTH',    label: 'Regular (with month selection)' },
  { value: 'REGULAR_WITHOUT_MONTH', label: 'Regular (no month selection)'   },
  { value: 'WEEKLY',                label: 'Weekly'                          },
  { value: 'FIXED_DAYS',            label: 'Fixed Days'                      },
  { value: 'SPECIAL_CAMP',          label: 'Special Camp'                    },
];

// ── Auto-title builder ────────────────────────────────────
// Format: "U8/U10 - Beginner Level 1/Level 2 - Cupertino/Santa Clara"
function buildAutoTitle(ageGroups, skillLevels, locations, locationId) {
  const agePart   = ageGroups.length   > 0 ? ageGroups.join('/') : '';
  const levelPart = skillLevels.length > 0 ? skillLevels.join('/') : '';
  const loc       = locations.find(l => l._id === locationId);
  const locPart   = loc ? (loc.title || loc.city || '') : '';
  return [agePart, levelPart, locPart].filter(Boolean).join(' - ');
}

// ── Small image preview component ─────────────────────────
function ImageUploadField({ label, currentUrl, onFileSelect, required }) {
  const inputRef    = useRef();
  const [preview, setPreview] = useState(currentUrl || null);
  const [fileName, setFileName] = useState('');

  // Reset preview when currentUrl changes (e.g. open edit modal)
  useEffect(() => { setPreview(currentUrl || null); setFileName(''); }, [currentUrl]);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Only JPG, JPEG, PNG files are allowed');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      e.target.value = '';
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    onFileSelect(file);
  };

  return (
    <FormField label={label} required={required}>
      {/* Hidden native file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
        {/* Preview box */}
        <div
          onClick={() => inputRef.current.click()}
          style={{
            width: '120px', height: '90px', borderRadius: '8px', cursor: 'pointer',
            border: '2px dashed rgba(212,175,55,0.4)',
            background: preview ? 'transparent' : 'rgba(255,255,255,0.03)',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, position: 'relative',
          }}
        >
          {preview
            ? <img src={preview} alt="preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '28px', color: 'rgba(255,255,255,0.2)' }}>🖼️</span>
          }
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px',
            textAlign: 'center', padding: '3px',
          }}>
            {preview ? 'Change' : 'Upload'}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: '160px' }}>
          <Btn variant="ghost" small onClick={() => inputRef.current.click()}
            style={{ marginBottom: '8px' }}>
            📁 Choose Image
          </Btn>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.5' }}>
            {fileName
              ? <span style={{ color: '#86efac' }}>✔ {fileName}</span>
              : 'No file chosen'}
            <br />
            JPG, JPEG or PNG — max 5 MB
          </div>
        </div>
      </div>
    </FormField>
  );
}

export default function Programs() {
  const [rows, setRows]             = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations]   = useState([]);
  const [ageGroups, setAgeGroups]   = useState([]);
  const [levels, setLevels]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [coverFile, setCoverFile]   = useState(null); // the File object
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c, l, ag, lv] = await Promise.all([
        programsAPI.getAll(),
        categoriesAPI.getAll(),
        locationsAPI.getAll(),
        ageGroupsAPI.getAll(),
        levelsAPI.getAll(),
      ]);
      setRows(p.data.data);
      setCategories(c.data.data);
      setLocations(l.data.data);
      setAgeGroups((ag.data.data || []).filter(x => x.isActive));
      setLevels((lv.data.data || []).filter(x => x.isActive));
    } catch {
      toast.error('Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Auto-generate title whenever ageGroups / skillLevels / location changes ──
  useEffect(() => {
    // Don't overwrite if admin is manually editing an existing program's title
    // (we rebuild only when these three change — admin can still type to override)
    const auto = buildAutoTitle(form.ageGroups, form.skillLevels, locations, form.locationId);
    if (auto) setForm(prev => ({ ...prev, title: auto }));
  }, [form.ageGroups, form.skillLevels, form.locationId, locations]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCoverFile(null);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setCoverFile(null);
    setForm({
      title:               row.title || '',
      categoryId:          row.category?._id || row.categoryId || '',
      locationId:          row.location?._id  || row.locationId  || '',
      batchType:           row.batchType || 'REGULAR_WITH_MONTH',
      ageGroups:           row.ageGroups || [],
      skillLevels:         row.skillLevels || [],
      price:               row.basePrice || '',
      discountedPrice:     row.discountedPrice || '',
      startDate:           row.startDate ? row.startDate.split('T')[0] : '',
      endDate:             row.endDate   ? row.endDate.split('T')[0]   : '',
      registrationDeadline:row.registrationDeadline ? row.registrationDeadline.split('T')[0] : '',
      maxCapacity:         row.maxCapacity || '',
      shortDescription:    row.shortDescription || '',
      detailedDescription: row.detailedDescription || '',
      specialNote:         row.specialNote || '',
      isFeatured:          row.isFeatured || false,
      isActive:            row.isActive !== false,
      // existing cover url for preview
      _existingCoverUrl:   row.coverImageUrl || '',
    });
    setModalOpen(true);
  };

  const toggleChip = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleSave = async () => {
    if (!form.categoryId || !form.price) {
      toast.error('Category and Price are required');
      return;
    }
    setSaving(true);
    try {
      // Build FormData so we can send the image file
      const fd = new FormData();
      fd.append('title',               form.title);
      fd.append('category',            form.categoryId);
      if (form.locationId) fd.append('location', form.locationId);
      fd.append('batchType',           form.batchType);
      fd.append('basePrice',           parseFloat(form.price));
      if (form.discountedPrice) fd.append('discountedPrice', parseFloat(form.discountedPrice));
      if (form.maxCapacity)     fd.append('maxCapacity', parseInt(form.maxCapacity));
      if (form.startDate)       fd.append('startDate', form.startDate);
      if (form.endDate)         fd.append('endDate', form.endDate);
      if (form.registrationDeadline) fd.append('registrationDeadline', form.registrationDeadline);
      fd.append('shortDescription',    form.shortDescription);
      fd.append('detailedDescription', form.detailedDescription);
      fd.append('specialNote',         form.specialNote);
      fd.append('isFeatured',          form.isFeatured);
      fd.append('isActive',            form.isActive);
      // Arrays must be JSON-stringified for FormData
      fd.append('ageGroups',   JSON.stringify(form.ageGroups));
      fd.append('skillLevels', JSON.stringify(form.skillLevels));
      // Cover image file (only if user selected one)
      if (coverFile) fd.append('coverImage', coverFile);

      if (editing) {
        await programsAPI.update(editing._id, fd);
        toast.success('Program updated!');
      } else {
        await programsAPI.create(fd);
        toast.success('Program created!');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (row) => {
    if (!window.confirm(`Deactivate "${row.title}"?`)) return;
    try {
      await programsAPI.remove(row._id);
      toast.success('Program deactivated');
      load();
    } catch {
      toast.error('Failed');
    }
  };

  const handleHardDelete = async (row) => {
    if (!window.confirm(`⚠️ PERMANENTLY DELETE "${row.title}"?\n\nThis cannot be undone. This only works if the program has no batches or registrations.`)) return;
    try {
      await programsAPI.hardRemove(row._id);
      toast.success('Program permanently deleted');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    }
  };

  const filtered = rows.filter(r =>
    !search || r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'coverImageUrl', label: 'Cover',
      render: v => v
        ? <img src={v} alt="cover"
            style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '4px' }} />
        : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '20px' }}>🖼️</span>,
    },
    { key: 'title',     label: 'Program Title' },
    { key: 'sku',       label: 'SKU',      render: v => <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#F5D97A' }}>{v}</span> },
    { key: 'category',  label: 'Category', render: v => v?.title || '—' },
    { key: 'location',  label: 'Location', render: v => v?.city  || '—' },
    { key: 'basePrice', label: 'Price',    render: v => `$${v}` },
    { key: 'ageGroups', label: 'Age Groups', render: v => (v||[]).join(', ') || '—' },
    { key: 'isActive',  label: 'Status',   render: v => <Badge label={v ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'isFeatured',label: 'Featured', render: v => v ? '⭐' : '—' },
    {
      key: '_id', label: 'Actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn small onClick={() => openEdit(row)}>Edit</Btn>
          {row.isActive && <Btn small variant="danger" onClick={() => handleDeactivate(row)}>Deactivate</Btn>}
          <Btn small variant="danger" onClick={() => handleHardDelete(row)}
            style={{ background: 'rgba(139,0,0,0.3)', borderColor: 'rgba(139,0,0,0.6)' }}>
            🗑 Delete
          </Btn>
        </div>
      ),
    },
  ];

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader
        title="Programs"
        subtitle="Super Admin — create and manage training programs"
        action={<Btn onClick={openCreate}>+ New Program</Btn>}
      />

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or SKU..." />
      </div>

      <DataTable columns={columns} rows={filtered} loading={loading} emptyMsg="No programs found. Create one!" />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit: ${editing.title}` : 'Create New Program'}
        width="680px"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>

          {/* ── ISSUE 4: Cover Image Upload ── */}
          <div style={{ gridColumn: '1 / -1' }}>
            <ImageUploadField
              label="Cover Image"
              currentUrl={form._existingCoverUrl || ''}
              onFileSelect={(file) => setCoverFile(file)}
            />
          </div>

          {/* Auto-generated Title — built from Age Groups + Skill Levels + Location */}
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Program Title (auto-generated)">
              <div style={{
                padding: '10px 14px',
                background: 'rgba(212,175,55,0.08)',
                border: '1px solid rgba(212,175,55,0.3)',
                borderRadius: '8px',
                color: form.title ? '#F5D97A' : 'rgba(255,255,255,0.3)',
                fontSize: '14px',
                fontWeight: form.title ? '600' : '400',
                letterSpacing: form.title ? '0.01em' : 'normal',
                minHeight: '42px',
                display: 'flex',
                alignItems: 'center',
              }}>
                {form.title || '← Select Age Groups, Skill Levels and Location below to generate title'}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '5px' }}>
                Format: U8/U10 - Beginner Level 1/Level 2 - Cupertino/Santa Clara
              </div>
            </FormField>
          </div>

          {/* Category */}
          <FormField label="Category (Season)" required>
            <Select value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}>
              <option value="">— Select Season —</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
            </Select>
          </FormField>

          {/* Location */}
          <FormField label="Location">
            <Select value={form.locationId} onChange={e => setForm(p => ({ ...p, locationId: e.target.value }))}>
              <option value="">— Select Location —</option>
              {locations.map(l => <option key={l._id} value={l._id}>{l.title} ({l.city})</option>)}
            </Select>
          </FormField>

          {/* Batch Type */}
          <FormField label="Batch Type" required>
            <Select value={form.batchType} onChange={e => setForm(p => ({ ...p, batchType: e.target.value }))}>
              {BATCH_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
            </Select>
          </FormField>

          {/* Max Capacity */}
          <FormField label="Max Capacity">
            <Input type="number" value={form.maxCapacity}
              onChange={e => setForm(p => ({ ...p, maxCapacity: e.target.value }))} placeholder="60" />
          </FormField>

          {/* Price */}
          <FormField label="Base Price ($)" required>
            <Input type="number" value={form.price}
              onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="250" />
          </FormField>

          {/* Discounted Price */}
          <FormField label="Discounted Price ($)">
            <Input type="number" value={form.discountedPrice}
              onChange={e => setForm(p => ({ ...p, discountedPrice: e.target.value }))} placeholder="Optional" />
          </FormField>

          {/* Start / End Date */}
          <FormField label="Start Date">
            <Input type="date" value={form.startDate}
              onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
          </FormField>
          <FormField label="End Date">
            <Input type="date" value={form.endDate}
              onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
          </FormField>

          {/* Registration Deadline */}
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Registration Deadline">
              <Input type="date" value={form.registrationDeadline} style={{ width: '200px' }}
                onChange={e => setForm(p => ({ ...p, registrationDeadline: e.target.value }))} />
            </FormField>
          </div>

          {/* Age Groups */}
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Age Groups">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                {ageGroups.map(ag => (
                  <button key={ag._id} type="button"
                    onClick={() => toggleChip('ageGroups', ag.title)}
                    style={{
                      padding: '5px 14px', borderRadius: '20px', border: '1px solid',
                      cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                      borderColor: form.ageGroups.includes(ag.title) ? '#D4AF37' : 'rgba(255,255,255,0.15)',
                      background:  form.ageGroups.includes(ag.title) ? 'rgba(212,175,55,0.2)' : 'transparent',
                      color:       form.ageGroups.includes(ag.title) ? '#F5D97A' : 'rgba(255,255,255,0.5)',
                    }}
                  >{ag.title}</button>
                ))}
              </div>
              {ageGroups.length === 0 && (
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
                  No age groups yet — add some in the <strong>Age Groups</strong> page first.
                </div>
              )}
            </FormField>
          </div>

          {/* Skill Levels */}
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Skill Levels">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                {levels.map(sl => (
                  <button key={sl._id} type="button"
                    onClick={() => toggleChip('skillLevels', sl.title)}
                    style={{
                      padding: '5px 14px', borderRadius: '20px', border: '1px solid',
                      cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                      borderColor: form.skillLevels.includes(sl.title) ? '#22c55e' : 'rgba(255,255,255,0.15)',
                      background:  form.skillLevels.includes(sl.title) ? 'rgba(34,197,94,0.15)' : 'transparent',
                      color:       form.skillLevels.includes(sl.title) ? '#86efac' : 'rgba(255,255,255,0.5)',
                    }}
                  >{sl.title}</button>
                ))}
              </div>
            </FormField>
          </div>

          {/* Descriptions */}
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Short Description">
              <Textarea value={form.shortDescription} rows={2}
                onChange={e => setForm(p => ({ ...p, shortDescription: e.target.value }))}
                placeholder="Displayed on program cards..." />
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Detailed Description">
              <Textarea value={form.detailedDescription} rows={3}
                onChange={e => setForm(p => ({ ...p, detailedDescription: e.target.value }))}
                placeholder="Full program details shown on program page..." />
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Special Note">
              <Input value={form.specialNote}
                onChange={e => setForm(p => ({ ...p, specialNote: e.target.value }))}
                placeholder="e.g. Bring water bottle and cricket shoes" />
            </FormField>
          </div>

          {/* Toggles */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '24px' }}>
            {[
              { field: 'isFeatured', label: '⭐ Featured on homepage' },
              { field: 'isActive',   label: '✅ Active (visible on website)' },
            ].map(({ field, label }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                <input type="checkbox" checked={form[field]}
                  onChange={e => setForm(p => ({ ...p, [field]: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: '#D4AF37' }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update Program' : 'Create Program')}</Btn>
        </div>
      </Modal>
    </div>
  );
}