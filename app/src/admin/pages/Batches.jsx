// ============================================================
//  pages/Batches.js — Normal Admin
//  Add / edit batches: day, time, price, coach, capacity
//  UPDATED: Added pricePerSession + monthOptions for CCA-style registration
// ============================================================
import React, { useEffect, useState } from 'react';
import { batchesAPI, programsAPI, coachesAPI, locationsAPI } from '../api/client';
import {
  PageHeader, DataTable, Modal, Btn, Badge,
  FormField, Input, Select, SearchInput
} from '../components/common/UI';
import toast from 'react-hot-toast';

const ALL_DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const emptySlot = () => ({ startTime: '09:00', endTime: '10:30' });
const emptyMonthOption = () => ({ label: '', startDate: '', endDate: '', weeks: '' });

const EMPTY = {
  programId: '', locationId: '', coachId: '',
  title: '',
  multiDays: [],
  timeSlots: [emptySlot()],
  groundLocationNote: '', maxCapacity: '20',
  startDate: '', endDate: '',
  // Per-session price: price for 1 session/week. 2x = price*2, 3x = price*3
  pricePerSession: '',
  // Legacy single price (kept for backward compat)
  price: '',
  sessionsPerWeek: '',
  // Month/duration options shown on registration page
  monthOptions: [],
  isActive: true,
};

export default function Batches() {
  const [rows, setRows]           = useState([]);
  const [programs, setPrograms]   = useState([]);
  const [coaches, setCoaches]     = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterProg, setFilterProg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterProg) params.program = filterProg;
      const [b, p, c, l] = await Promise.all([
        batchesAPI.getAll(params),
        programsAPI.getAll({ active: true }),
        coachesAPI.getAll(),
        locationsAPI.getAll(),
      ]);
      setRows(b.data.data);
      setPrograms(p.data.data);
      setCoaches(c.data.data);
      setLocations(l.data.data);
    } catch {
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterProg]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    let multiDays = row.multiDays || [];
    let timeSlots = [];
    if (row.timeSlots && row.timeSlots.length > 0) {
      timeSlots = row.timeSlots;
    } else {
      timeSlots = [{ startTime: row.startTime || '09:00', endTime: row.endTime || '10:30' }];
    }
    setForm({
      programId:          row.program?._id  || '',
      locationId:         row.location?._id || '',
      coachId:            row.coach?._id    || '',
      title:              row.title         || '',
      multiDays: multiDays.length > 0 ? multiDays
        : (row.dayOfWeek && row.dayOfWeek !== 'MULTI' ? [row.dayOfWeek] : []),
      timeSlots,
      groundLocationNote: row.groundLocationNote || '',
      maxCapacity:        row.maxCapacity   || '20',
      startDate:          row.startDate ? row.startDate.split('T')[0] : '',
      endDate:            row.endDate   ? row.endDate.split('T')[0]   : '',
      pricePerSession:    row.pricePerSession || '',
      price:              row.price || '',
      sessionsPerWeek:    row.sessionsPerWeek || '',
      monthOptions:       row.monthOptions || [],
      isActive:           row.isActive !== false,
    });
    setModalOpen(true);
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const toggleMultiDay = (day) => {
    setForm(prev => ({
      ...prev,
      multiDays: prev.multiDays.includes(day)
        ? prev.multiDays.filter(d => d !== day)
        : [...prev.multiDays, day],
    }));
  };

  // Time slot helpers
  const addSlot = () =>
    setForm(prev => ({ ...prev, timeSlots: [...prev.timeSlots, emptySlot()] }));
  const removeSlot = (idx) =>
    setForm(prev => ({ ...prev, timeSlots: prev.timeSlots.filter((_, i) => i !== idx) }));
  const updateSlot = (idx, field, value) =>
    setForm(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));

  // Month option helpers
  const addMonthOption = () =>
    setForm(prev => ({ ...prev, monthOptions: [...prev.monthOptions, emptyMonthOption()] }));
  const removeMonthOption = (idx) =>
    setForm(prev => ({ ...prev, monthOptions: prev.monthOptions.filter((_, i) => i !== idx) }));
  const updateMonthOption = (idx, field, value) =>
    setForm(prev => ({
      ...prev,
      monthOptions: prev.monthOptions.map((m, i) => i === idx ? { ...m, [field]: value } : m),
    }));

  const handleSave = async () => {
    if (!form.programId) { toast.error('Program is required'); return; }
    if (form.multiDays.length === 0) { toast.error('Please select at least one training day'); return; }
    if (form.timeSlots.length === 0) { toast.error('At least one time slot is required'); return; }
    for (const slot of form.timeSlots) {
      if (!slot.startTime || !slot.endTime) { toast.error('All time slots need a start and end time'); return; }
    }
    if (!form.pricePerSession && !form.price) {
      toast.error('Price per session is required'); return;
    }

    setSaving(true);
    try {
      const firstSlot = form.timeSlots[0];
      const pricePerSess = parseFloat(form.pricePerSession) || parseFloat(form.price) || 0;
      const payload = {
        ...form,
        program:          form.programId,
        location:         form.locationId || undefined,
        coach:            form.coachId    || undefined,
        maxCapacity:      parseInt(form.maxCapacity) || 20,
        pricePerSession:  pricePerSess,
        price:            pricePerSess, // keep backward compat
        startTime:        firstSlot.startTime,
        endTime:          firstSlot.endTime,
        dayOfWeek:        form.multiDays.length === 1 ? form.multiDays[0] : 'MULTI',
        timeSlots:        form.timeSlots,
        multiDays:        form.multiDays,
        monthOptions:     form.monthOptions,
      };
      if (editing) {
        await batchesAPI.update(editing._id, payload);
        toast.success('Batch updated!');
      } else {
        await batchesAPI.create(payload);
        toast.success('Batch created!');
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
    if (!window.confirm('Deactivate this batch?')) return;
    try { await batchesAPI.remove(row._id); toast.success('Batch deactivated'); load(); }
    catch { toast.error('Failed'); }
  };

  const handleHardDelete = async (row) => {
    if (!window.confirm(`⚠️ PERMANENTLY DELETE batch "${row.title || row.dayOfWeek}"?\n\nThis cannot be undone.`)) return;
    try { await batchesAPI.hardRemove(row._id); toast.success('Batch permanently deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Delete failed'); }
  };

  const formatDays = (row) => {
    if (row.multiDays && row.multiDays.length > 0) return row.multiDays.join(', ');
    return row.dayOfWeek || '—';
  };

  const formatTime = (row) => {
    if (row.timeSlots && row.timeSlots.length > 1)
      return row.timeSlots.map(s => `${s.startTime}–${s.endTime}`).join(' | ');
    return `${row.startTime} – ${row.endTime}`;
  };

  const filtered = rows.filter(r =>
    !search ||
    r.program?.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.multiDays?.some(d => d.toLowerCase().includes(search.toLowerCase()))
  );

  const columns = [
    { key: 'program',   label: 'Program',  render: v => v?.title || '—' },
    { key: 'title',     label: 'Batch Title', render: v => v || '—' },
    { key: 'dayOfWeek', label: 'Day(s)',   render: (v, row) => <span style={{ fontWeight:'600', color:'#F5D97A' }}>{formatDays(row)}</span> },
    { key: 'startTime', label: 'Time(s)',  render: (_, row) => <span style={{ fontSize:'12px' }}>{formatTime(row)}</span> },
    {
      key: 'pricePerSession', label: 'Price/Session',
      render: (v, row) => {
        const p = v || row.price;
        return p ? (
          <div>
            <div style={{ color:'#F5D97A', fontWeight:'600' }}>${p}/session</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>
              2×=${p*2} | 3×=${p*3}
            </div>
          </div>
        ) : '—';
      }
    },
    { key: 'sessionsPerWeek', label: 'Frequency', render: v => v ? `${v}×/week` : '—' },
    {
      key: 'monthOptions', label: 'Month Options',
      render: v => v?.length > 0 ? <Badge label={`${v.length} options`} /> : <span style={{color:'rgba(255,255,255,0.3)'}}>none</span>
    },
    {
      key: 'currentCapacity', label: 'Capacity',
      render: (v, row) => {
        const pct = row.maxCapacity ? Math.round((v / row.maxCapacity) * 100) : 0;
        const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#A33B2B' : '#22c55e';
        return (
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ color }}>{v}/{row.maxCapacity}</span>
            <div style={{ width:'60px', height:'6px', background:'rgba(255,255,255,0.1)', borderRadius:'3px', overflow:'hidden' }}>
              <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:'3px' }} />
            </div>
          </div>
        );
      },
    },
    { key: 'coach',    label: 'Coach',    render: v => v ? `${v.firstName} ${v.lastName}` : '—' },
    { key: 'location', label: 'Location', render: v => v?.city || '—' },
    { key: 'isActive', label: 'Status',   render: v => <Badge label={v ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: '_id', label: 'Actions',
      render: (_, row) => (
        <div style={{ display:'flex', gap:'8px' }}>
          <Btn small onClick={() => openEdit(row)}>Edit</Btn>
          {row.isActive && <Btn small variant="danger" onClick={() => handleDeactivate(row)}>Off</Btn>}
          {!row.isActive && (
            <Btn small variant="danger" onClick={() => handleHardDelete(row)}
              style={{ background: 'rgba(139,0,0,0.3)', borderColor: 'rgba(139,0,0,0.6)' }}>
              🗑 Delete
            </Btn>
          )}
        </div>
      ),
    },
  ];

  // ── Styles ─────────────────────────────────────────────
  const slotRowStyle = {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', padding: '10px 12px', marginBottom: '8px',
  };
  const dayBtnStyle = (active) => ({
    padding: '5px 12px', borderRadius: '20px', border: '1px solid',
    cursor: 'pointer', fontSize: '12px', fontWeight: '600',
    borderColor: active ? '#D4AF37' : 'rgba(255,255,255,0.15)',
    background:  active ? 'rgba(212,175,55,0.2)' : 'transparent',
    color:       active ? '#F5D97A' : 'rgba(255,255,255,0.5)',
  });
  const monthRowStyle = {
    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
    gap: '8px', alignItems: 'end',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', padding: '10px 12px', marginBottom: '8px',
  };

  const pricePerSess = parseFloat(form.pricePerSession) || 0;

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader
        title="Batches"
        subtitle="Manage schedule slots — days, times, prices, coaches"
        action={<Btn onClick={openCreate}>+ New Batch</Btn>}
      />

      <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by program or day..." />
        <Select value={filterProg} onChange={e => setFilterProg(e.target.value)} style={{ width:'220px' }}>
          <option value="">All Programs</option>
          {programs.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
        </Select>
        <Btn variant="ghost" onClick={load}>↻ Refresh</Btn>
      </div>

      <DataTable columns={columns} rows={filtered} loading={loading} emptyMsg="No batches yet. Create one!" />

      {/* ── Modal ─────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Batch' : 'Create New Batch'} width="700px">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>

          {/* Program */}
          <div style={{ gridColumn:'1 / -1' }}>
            <FormField label="Program" required>
              <Select value={form.programId} onChange={f('programId')}>
                <option value="">— Select Program —</option>
                {programs.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
              </Select>
            </FormField>
          </div>

          {/* Batch Label */}
          <FormField label="Batch Label / Title">
            <Input value={form.title} onChange={f('title')} placeholder="e.g. Mon/Wed 5 PM" />
          </FormField>

          {/* Sessions Per Week */}
          <FormField label="Default Frequency (shown on website)">
            <Select value={form.sessionsPerWeek} onChange={f('sessionsPerWeek')}>
              <option value="">— Select frequency —</option>
              <option value="1">Once a week</option>
              <option value="2">Twice a week</option>
              <option value="3">Thrice a week</option>
              <option value="4">4 times a week</option>
              <option value="5">5 times a week</option>
              <option value="6">6 times a week</option>
              <option value="7">Every day</option>
            </Select>
          </FormField>

          {/* ── Training Days ── */}
          <div style={{ gridColumn:'1 / -1' }}>
            <FormField label="Training Days (select all that apply)" required>
              <label style={{ display:'inline-flex', alignItems:'center', gap:'7px', cursor:'pointer',
                marginBottom:'10px', color:'rgba(255,255,255,0.6)', fontSize:'13px', fontWeight:'500', padding:'5px 0' }}>
                <input type="checkbox"
                  checked={form.multiDays.length === ALL_DAYS.length}
                  onChange={e => setForm(prev => ({ ...prev, multiDays: e.target.checked ? [...ALL_DAYS] : [] }))}
                  style={{ width:'15px', height:'15px', accentColor:'#D4AF37', cursor:'pointer' }}
                />
                Select All Days
              </label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                {ALL_DAYS.map(d => (
                  <button key={d} type="button" onClick={() => toggleMultiDay(d)} style={dayBtnStyle(form.multiDays.includes(d))}>
                    {d}
                  </button>
                ))}
              </div>
              {form.multiDays.length === 0 && (
                <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.35)', marginTop:'6px' }}>Select at least one day</div>
              )}
            </FormField>
          </div>

          {/* ── Time Slots ── */}
          <div style={{ gridColumn:'1 / -1' }}>
            <FormField label="Time Slots" required>
              {form.timeSlots.map((slot, idx) => (
                <div key={idx} style={slotRowStyle}>
                  <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'12px', minWidth:'24px' }}>#{idx+1}</span>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', display:'block', marginBottom:'3px' }}>Start</label>
                    <Input type="time" value={slot.startTime} onChange={e => updateSlot(idx, 'startTime', e.target.value)} />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', display:'block', marginBottom:'3px' }}>End</label>
                    <Input type="time" value={slot.endTime} onChange={e => updateSlot(idx, 'endTime', e.target.value)} />
                  </div>
                  {form.timeSlots.length > 1 && (
                    <button type="button" onClick={() => removeSlot(idx)}
                      style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)',
                        color:'#f87171', borderRadius:'6px', padding:'4px 10px', cursor:'pointer', fontSize:'13px' }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addSlot}
                style={{ background:'rgba(212,175,55,0.1)', border:'1px dashed rgba(212,175,55,0.4)',
                  color:'#F5D97A', borderRadius:'8px', padding:'7px 16px', cursor:'pointer',
                  fontSize:'13px', fontWeight:'600', width:'100%', marginTop:'4px' }}>
                + Add Another Time Slot
              </button>
            </FormField>
          </div>

          {/* ── PRICE PER SESSION ── */}
          <div style={{ gridColumn:'1 / -1' }}>
            <FormField label="Price Per Session (₹ or $) — auto-multiplies on registration" required>
              <Input type="number" value={form.pricePerSession} onChange={f('pricePerSession')}
                placeholder="e.g. 400 → Twice a week = 800, Thrice = 1200" />
              {pricePerSess > 0 && (
                <div style={{ marginTop:'8px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
                  {[1,2,3].map(n => (
                    <div key={n} style={{ background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.3)',
                      borderRadius:'8px', padding:'6px 14px', fontSize:'13px', color:'#F5D97A' }}>
                      {n === 1 ? 'Once' : n === 2 ? 'Twice' : 'Thrice'} a week = ${pricePerSess * n}
                    </div>
                  ))}
                </div>
              )}
            </FormField>
          </div>

          {/* Capacity */}
          <FormField label="Max Capacity" required>
            <Input type="number" value={form.maxCapacity} onChange={f('maxCapacity')} placeholder="20" />
          </FormField>

          {/* Dates */}
          <FormField label="Batch Start Date">
            <Input type="date" value={form.startDate} onChange={f('startDate')} />
          </FormField>

          {/* ── MONTH OPTIONS ── */}
          <div style={{ gridColumn:'1 / -1' }}>
            <FormField label="Month / Duration Options (shown as radio buttons on registration page)">
              <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'10px' }}>
                e.g. "May to June (5 Weeks)", "July to August (5 Weeks)", "May to August (10 Weeks)"
              </div>
              {form.monthOptions.map((opt, idx) => (
                <div key={idx} style={monthRowStyle}>
                  <div>
                    <label style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', display:'block', marginBottom:'3px' }}>Label (shown to user)</label>
                    <Input value={opt.label} onChange={e => updateMonthOption(idx, 'label', e.target.value)}
                      placeholder="e.g. May to June (5 Weeks)" />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', display:'block', marginBottom:'3px' }}>Start Date</label>
                    <Input type="date" value={opt.startDate} onChange={e => updateMonthOption(idx, 'startDate', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', display:'block', marginBottom:'3px' }}>End Date</label>
                    <Input type="date" value={opt.endDate} onChange={e => updateMonthOption(idx, 'endDate', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', display:'block', marginBottom:'3px' }}>Weeks</label>
                    <Input type="number" value={opt.weeks} onChange={e => updateMonthOption(idx, 'weeks', e.target.value)} placeholder="5" />
                  </div>
                  <button type="button" onClick={() => removeMonthOption(idx)}
                    style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)',
                      color:'#f87171', borderRadius:'6px', padding:'4px 10px', cursor:'pointer', fontSize:'13px', alignSelf:'end' }}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={addMonthOption}
                style={{ background:'rgba(212,175,55,0.1)', border:'1px dashed rgba(212,175,55,0.4)',
                  color:'#F5D97A', borderRadius:'8px', padding:'7px 16px', cursor:'pointer',
                  fontSize:'13px', fontWeight:'600', width:'100%', marginTop:'4px' }}>
                + Add Month Option
              </button>
            </FormField>
          </div>

          {/* Coach */}
          <FormField label="Coach">
            <Select value={form.coachId} onChange={f('coachId')}>
              <option value="">— No coach assigned —</option>
              {coaches.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
            </Select>
          </FormField>

          {/* Location override */}
          <FormField label="Location (override)">
            <Select value={form.locationId} onChange={f('locationId')}>
              <option value="">— Same as program —</option>
              {locations.map(l => <option key={l._id} value={l._id}>{l.title}</option>)}
            </Select>
          </FormField>

          {/* Ground note */}
          <div style={{ gridColumn:'1 / -1' }}>
            <FormField label="Ground / Field Note">
              <Input value={form.groundLocationNote} onChange={f('groundLocationNote')}
                placeholder="e.g. Ground 2, East Entrance" />
            </FormField>
          </div>

          {/* Active */}
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', color:'rgba(255,255,255,0.7)', fontSize:'14px' }}>
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                style={{ width:'16px', height:'16px', accentColor:'#D4AF37' }}
              />
              Active (visible to parents)
            </label>
          </div>
        </div>

        <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'24px',
          borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:'20px' }}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update Batch' : 'Create Batch')}</Btn>
        </div>
      </Modal>
    </div>
  );
}
