// ============================================================
//  admin/pages/ProgramForm.jsx — Super Admin Only
//  Full-page Create / Edit form (replaces the old modal)
//  NEW FILE — place at: app/src/admin/pages/ProgramForm.jsx
//  Routes:  /admin/programs/new
//           /admin/programs/:id/edit
// ============================================================
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { programsAPI, categoriesAPI, locationsAPI, ageGroupsAPI, levelsAPI, coachesAPI } from '../api/client';
import {
  PageHeader, Btn, FormField, Input, Select, Textarea
} from '../components/common/UI';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS  = ['.jpg', '.jpeg', '.png'];

const BATCH_TYPES = [
  { value: 'REGULAR_WITH_MONTH',    label: 'Regular (with month selection)' },
  { value: 'REGULAR_WITHOUT_MONTH', label: 'Regular (no month selection)'   },
  { value: 'WEEKLY',                label: 'Weekly'                          },

];

const ALL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_LABELS = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday',
  THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

const EMPTY_FORM = {
  title:                '',
  categoryId:           '',
  cities:               [],    // multi-city chips — for title only
  locationId:           '',    // single main location for DB
  batchType:            'REGULAR_WITH_MONTH',
  ageGroups:            [],
  skillLevels:          [],
  price:                '250',
  discountedPrice:      '',
  maxCapacity:          '99',
  startDate:            '',
  endDate:              '',
  registrationDeadline: '',
  monthOptions:         [],    // [{label, startDate, endDate, weeks, price, isEnabled, showInStartMonthOnly}]
  weeklyBatches:        [],    // [{startDate,startTime,endDate,endTime,groundAddress,ageGroups,skillLevels,label}] — WEEKLY batch type only
  scheduleDays:         [],    // [{day, startTime, endTime, groundAddress}]
  coachId:              '',
  shortDescription:     '',
  detailedDescription:  '',
  specialNote:          '',
  isFeatured:           false,
  isActive:             true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Build auto title: "U8/U10 - Beginner Level 1/Level 2 - Dublin/Fremont"
function buildAutoTitle(ageGroups, skillLevels, cities) {
  const agePart   = ageGroups.length   > 0 ? ageGroups.join('/')   : '';
  const levelPart = skillLevels.length > 0 ? skillLevels.join('/') : '';
  const cityPart  = cities.length      > 0 ? cities.join('/')      : '';
  return [agePart, levelPart, cityPart].filter(Boolean).join(' - ');
}

// ── Month option helper ──────────────────────────────────────────────────────
// Admin selects start+end date of a month → auto-calc weeks & label only.
// Price is left blank so admin enters it manually (no auto-price calculation).
function calcMonthOption(startDate, endDate, basePrice, daysPerWeek) {
  if (!startDate || !endDate) return { weeks: '', price: '', label: '' };
  const ms = new Date(endDate) - new Date(startDate);
  if (ms <= 0) return { weeks: '', price: '', label: '' };
  const days     = Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1;
  const rawWeeks = Math.ceil(days / 7);
  // Count sessions: number of scheduled days per week × raw weeks
  const spw      = parseInt(daysPerWeek) || 1;
  const sessions = Math.round(rawWeeks * spw);
  const fmtMonth = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long' });
  const sm = fmtMonth(startDate);
  const em = fmtMonth(endDate);
  const label = sm === em ? `${sm} (${sessions} Sessions)` : `${sm} - ${em} (${sessions} Sessions)`;
  // Price is intentionally left blank — admin must enter manually
  return { weeks: Math.round(rawWeeks), price: '', label };
}

const isTruthyFlag = (value) => value === true || value === 'true' || value === 1 || value === '1';
const isDisabledFlag = (value) => value === false || value === 'false' || value === 0 || value === '0';

const normalizeMonthOption = (option = {}) => ({
  ...option,
  isEnabled: !isDisabledFlag(option.isEnabled),
  showInStartMonthOnly: isTruthyFlag(option.showInStartMonthOnly),
});

const emptyMonthOption = () => normalizeMonthOption({ label: '', startDate: '', endDate: '', weeks: '', price: '' });
const serializeMonthOptions = (monthOptions = []) => monthOptions.map(normalizeMonthOption);

// ── Weekly Batch helper (WEEKLY batch type only) ─────────────────────────────
// Admin picks Start Date/Time + End Date/Time → auto-calc label like
// "July 20 - July 24 (4:00 PM - 5:30 PM)".
const emptyWeeklyBatch = () => ({
  startDate: '', startTime: '', endDate: '', endTime: '',
  groundAddress: '', ageGroups: [], skillLevels: [],
  isSubWeek: false, // true = a compact "Week N" row nested under a batch, not a full standalone batch
});

function fmtTime12(t) {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr ?? '00'} ${ampm}`;
}

function calcBatchLabel(startDate, startTime, endDate, endTime) {
  if (!startDate || !endDate) return '';
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s) || isNaN(e)) return '';
  const sm = s.toLocaleDateString('en-US', { month: 'long' });
  const em = e.toLocaleDateString('en-US', { month: 'long' });
  const dateLabel = sm === em ? `${sm} ${s.getDate()} - ${e.getDate()}` : `${sm} ${s.getDate()} - ${em} ${e.getDate()}`;
  const timeLabel = startTime && endTime ? ` (${fmtTime12(startTime)} - ${fmtTime12(endTime)})` : '';
  return `${dateLabel}${timeLabel}`;
}

// Weekdays used to auto-build the Monday-Friday schedule for WEEKLY batch type
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

// Format a location record into "address, city" for the Ground Address dropdown
function formatLocationAddress(location) {
  if (!location) return '';
  const parts = [location.address, location.city].filter(Boolean);
  return parts.join(', ');
}

// Frequency label from number of days selected
function frequencyLabel(count) {
  if (count === 1) return 'Once a week';
  if (count === 2) return 'Twice a week';
  if (count === 3) return 'Thrice a week';
  return `${count} times a week`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(212,175,55,0.15)',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
    }}>
      <div style={{
        color: '#F5D97A', fontWeight: '700', fontSize: '15px',
        marginBottom: '18px',
        borderBottom: '1px solid rgba(212,175,55,0.15)',
        paddingBottom: '10px',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ImageUploadField({ label, currentUrl, onFileSelect, required }) {
  const inputRef                  = useRef();
  const [preview, setPreview]     = useState(currentUrl || null);
  const [fileName, setFileName]   = useState('');

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
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png"
        style={{ display: 'none' }} onChange={handleChange} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
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
            ? <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
        <div style={{ flex: 1, minWidth: '160px' }}>
          <Btn variant="ghost" small onClick={() => inputRef.current.click()} style={{ marginBottom: '8px' }}>
            📁 Choose Image
          </Btn>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.5' }}>
            {fileName
              ? <span style={{ color: '#86efac' }}>✔ {fileName}</span>
              : 'No file chosen'}
            <br />JPG, JPEG or PNG — max 5 MB
          </div>
        </div>
      </div>
    </FormField>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProgramForm() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const isEdit   = Boolean(id);

  const [form,        setForm]        = useState(EMPTY_FORM);
  const [coverFile,   setCoverFile]   = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(isEdit);
  const [slugPreview, setSlugPreview] = useState('');

  // Master data
  const [categories, setCategories] = useState([]);
  const [locations,  setLocations]  = useState([]);
  const [ageGroups,  setAgeGroups]  = useState([]);
  const [levels,     setLevels]     = useState([]);
  const [coaches,    setCoaches]    = useState([]);

  // ── Load master data ──────────────────────────────────────
  useEffect(() => {
    Promise.all([
      categoriesAPI.getAll(),
      locationsAPI.getAll(),
      ageGroupsAPI.getAll(),
      levelsAPI.getAll(),
      coachesAPI.getAll(),
    ]).then(([c, l, ag, lv, co]) => {
      setCategories(c.data.data || []);
      setLocations(l.data.data  || []);
      setAgeGroups((ag.data.data || []).filter(x => x.isActive));
      setLevels((lv.data.data   || []).filter(x => x.isActive));
      setCoaches((co.data.data  || []).filter(x => x.status === 'ACTIVE'));
    }).catch(() => toast.error('Failed to load form data'));
  }, []);

  // ── Load existing program when editing ────────────────────
  useEffect(() => {
    if (!isEdit) return;
    programsAPI.getOne(id).then(res => {
      const row = res.data.data;
      setForm({
        title:                row.title || '',
        categoryId:           row.category?._id || '',
        cities:               row.cities || [],
        locationId:           row.location?._id || '',
        batchType:            row.batchType || 'REGULAR_WITH_MONTH',
        ageGroups:            row.ageGroups || [],
        skillLevels:          row.skillLevels || [],
        price:                String(row.basePrice ?? '250'),
        discountedPrice:      row.discountedPrice ? String(row.discountedPrice) : '',
        maxCapacity:          String(row.maxCapacity ?? '99'),
        startDate:            row.startDate ? row.startDate.split('T')[0] : '',
        endDate:              row.endDate   ? row.endDate.split('T')[0]   : '',
        registrationDeadline: row.registrationDeadline ? row.registrationDeadline.split('T')[0] : '',
        monthOptions:         (row.monthOptions || []).map(normalizeMonthOption),
        weeklyBatches:        row.weeklyBatches || [],
        scheduleDays:         row.scheduleDays  || [],
        // row.coachId comes back POPULATED ({_id, firstName, lastName, ...})
        // from GET /programs/:id — only the ID string belongs in form state,
        // otherwise Save/Update sends "[object Object]" and the whole
        // request 500s with a Mongoose CastError on coachId.
        coachId:              row.coachId?._id || row.coachId || '',
        shortDescription:     row.shortDescription || '',
        detailedDescription:  row.detailedDescription || '',
        specialNote:          row.specialNote || '',
        isFeatured:           row.isFeatured || false,
        isActive:             row.isActive !== false,
        _existingCoverUrl:    row.coverImageUrl || '',
        _existingSlug:        row.slug || '',
      });
      setSlugPreview(row.slug || '');
    }).catch(() => toast.error('Failed to load program'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // ── Auto-generate title ───────────────────────────────────
  useEffect(() => {
    const auto = buildAutoTitle(form.ageGroups, form.skillLevels, form.cities);
    if (auto) setForm(prev => ({ ...prev, title: auto }));
  }, [form.ageGroups, form.skillLevels, form.cities]);

  // ── Auto-generate slug preview from category ──────────────
  useEffect(() => {
    if (form._existingSlug) { setSlugPreview(form._existingSlug); return; }
    const cat = categories.find(c => c._id === form.categoryId);
    if (cat) {
      const base = cat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setSlugPreview(`${base}-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }, [form.categoryId, categories]);

  // ── Month option helpers ──────────────────────────────────────────────────
  // When admin picks start/end date for a month option, auto-fill weeks, price, label.
  // Admin can still override any field manually.
  const addMonthOption = () =>
    setForm(prev => ({ ...prev, monthOptions: [...prev.monthOptions, emptyMonthOption()] }));

  const removeMonthOption = (idx) =>
    setForm(prev => ({ ...prev, monthOptions: prev.monthOptions.filter((_, i) => i !== idx) }));

  const updateMonthOption = (idx, field, value) =>
    setForm(prev => {
      const updated = prev.monthOptions.map((m, i) => i === idx ? { ...m, [field]: value } : m);
      if (field === 'startDate' || field === 'endDate') {
        const opt = updated[idx];
        const sd  = field === 'startDate' ? value : opt.startDate;
        const ed  = field === 'endDate'   ? value : opt.endDate;
        if (sd && ed && new Date(ed) > new Date(sd)) {
          const auto = calcMonthOption(sd, ed, prev.price, prev.scheduleDays.length || 1);
          // Keep admin price intact; only auto-fill weeks & label
          const existingPrice = updated[idx].price;
          updated[idx] = { ...updated[idx], weeks: auto.weeks, label: auto.label, price: existingPrice || '' };
        }
      }
      return { ...prev, monthOptions: updated };
    });

  // ── Weekly Batch helpers (WEEKLY batch type only) ──────────────────────────
  // Each entry in form.weeklyBatches is either:
  //  - a ROOT batch (isSubWeek: false) — full card: Age Group/Level chips,
  //    Start/End Date+Time, Ground Address.
  //  - a SUB-WEEK (isSubWeek: true) — a compact "Week N" row nested right
  //    under its root's card, holding ONLY Start/End Date+Time. It shares
  //    the root's ageGroups/skillLevels/groundAddress (kept in sync below)
  //    so the backend/registration side still sees a complete, independently
  //    selectable batch for each week.
  const addWeeklyBatch = () =>
    setForm(prev => ({ ...prev, weeklyBatches: [...prev.weeklyBatches, emptyWeeklyBatch()] }));

  // Remove a batch. If it's a ROOT batch, its trailing sub-weeks are removed
  // with it (otherwise they'd become orphaned and wrongly render as a new root).
  const removeWeeklyBatch = (idx) =>
    setForm(prev => {
      const batches = prev.weeklyBatches;
      if (batches[idx]?.isSubWeek) {
        return { ...prev, weeklyBatches: batches.filter((_, i) => i !== idx) };
      }
      let end = idx + 1;
      while (end < batches.length && batches[end].isSubWeek) end++;
      return { ...prev, weeklyBatches: batches.filter((_, i) => i < idx || i >= end) };
    });

  // Copy ageGroups/skillLevels/groundAddress from a ROOT batch onto all of
  // its trailing sub-weeks, so they never fall out of sync with the root.
  const syncSubWeeks = (batches, rootIdx) => {
    const root = batches[rootIdx];
    const updated = [...batches];
    let i = rootIdx + 1;
    while (i < updated.length && updated[i].isSubWeek) {
      updated[i] = {
        ...updated[i],
        ageGroups: root.ageGroups,
        skillLevels: root.skillLevels,
        groundAddress: root.groundAddress,
      };
      i++;
    }
    return updated;
  };

  const updateWeeklyBatch = (idx, field, value) =>
    setForm(prev => {
      let updated = prev.weeklyBatches.map((b, i) => i === idx ? { ...b, [field]: value } : b);
      if (['startDate', 'startTime', 'endDate', 'endTime'].includes(field)) {
        const b = updated[idx];
        updated[idx] = { ...b, label: calcBatchLabel(b.startDate, b.startTime, b.endDate, b.endTime) };
      }
      // If a ROOT batch's shared field changed, keep its sub-weeks in sync.
      if (field === 'groundAddress' && !updated[idx].isSubWeek) {
        updated = syncSubWeeks(updated, idx);
      }
      return { ...prev, weeklyBatches: updated };
    });

  // Add 7 days to a 'YYYY-MM-DD' date string. Returns '' if input is empty/invalid.
  const addDays = (dateStr, days) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return '';
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // "+ Add Week" on a ROOT batch (rootIdx): appends a compact sub-week row
  // right after the last existing week in that group, with dates cascaded
  // 7 days past whichever week was last — so clicking it repeatedly stacks
  // Week 2, Week 3, Week 4... in order. Ground/AgeGroup/Level are inherited
  // from the root and are NOT shown/edited on the sub-week row itself.
  const addWeekToBatch = (rootIdx) =>
    setForm(prev => {
      const batches = prev.weeklyBatches;
      let lastIdx = rootIdx;
      while (lastIdx + 1 < batches.length && batches[lastIdx + 1].isSubWeek) lastIdx++;
      const root   = batches[rootIdx];
      const source = batches[lastIdx];
      const newStartDate = addDays(source.startDate, 7);
      const newEndDate   = addDays(source.endDate, 7);
      const newWeek = {
        startDate: newStartDate,
        startTime: source.startTime,
        endDate:   newEndDate,
        endTime:   source.endTime,
        groundAddress: root.groundAddress,
        ageGroups:     root.ageGroups,
        skillLevels:   root.skillLevels,
        isSubWeek: true,
        label: calcBatchLabel(newStartDate, source.startTime, newEndDate, source.endTime),
      };
      const updated = [...batches];
      updated.splice(lastIdx + 1, 0, newWeek);
      return { ...prev, weeklyBatches: updated };
    });

  // Toggle an age group / skill level chip on a ROOT batch. Only values
  // already selected at the program level (form.ageGroups / form.skillLevels)
  // are ever offered here — enforced in the render below. Trailing sub-weeks
  // are kept in sync since they share the same tags as their root.
  const toggleWeeklyBatchTag = (idx, field, value) =>
    setForm(prev => {
      let updated = prev.weeklyBatches.map((b, i) => {
        if (i !== idx) return b;
        const current = b[field] || [];
        const next = current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value];
        return { ...b, [field]: next };
      });
      if (!updated[idx].isSubWeek) updated = syncSubWeeks(updated, idx);
      return { ...prev, weeklyBatches: updated };
    });

  // ── Weekly schedule helper (WEEKLY batch type only) ────────────────────────
  // Admin enters ONE Start Time / End Time / Ground Address, and it's applied
  // automatically to Monday-Friday. This keeps form.scheduleDays as the single
  // source of truth (same shape the backend already expects).
  const updateWeeklyScheduleField = (field, value) =>
    setForm(prev => {
      const current = prev.scheduleDays[0] || { startTime: '', endTime: '', groundAddress: '' };
      const merged = { ...current, [field]: value };
      const newDays = WEEKDAYS.map(day => ({
        day,
        startTime:     merged.startTime,
        endTime:       merged.endTime,
        groundAddress: merged.groundAddress,
      }));
      return { ...prev, scheduleDays: newDays };
    });

  // Whenever batchType switches TO 'WEEKLY', force scheduleDays into the
  // Monday-Friday shape (preserving any previously entered time/address).
  useEffect(() => {
    if (form.batchType !== 'WEEKLY') return;
    setForm(prev => {
      if (prev.batchType !== 'WEEKLY') return prev;
      const daysPresent = prev.scheduleDays.map(d => d.day);
      const alreadyWeekly =
        prev.scheduleDays.length === 5 && WEEKDAYS.every(d => daysPresent.includes(d));
      if (alreadyWeekly) return prev;
      const base = prev.scheduleDays[0] || { startTime: '', endTime: '', groundAddress: '' };
      return {
        ...prev,
        scheduleDays: WEEKDAYS.map(day => ({
          day,
          startTime:     base.startTime     || '',
          endTime:       base.endTime       || '',
          groundAddress: base.groundAddress || '',
        })),
      };
    });
  }, [form.batchType]);

  // Keep every batch's ageGroups/skillLevels a SUBSET of the program-level
  // selections (Section: title chips). If the admin unchecks "U9" up top
  // after already tagging a batch with U9, strip it from the batch too —
  // otherwise a batch could silently reference an age/level no longer
  // offered for this program.
  useEffect(() => {
    setForm(prev => {
      if (prev.weeklyBatches.length === 0) return prev;
      const nextBatches = prev.weeklyBatches.map(b => ({
        ...b,
        ageGroups:   (b.ageGroups   || []).filter(v => prev.ageGroups.includes(v)),
        skillLevels: (b.skillLevels || []).filter(v => prev.skillLevels.includes(v)),
      }));
      return { ...prev, weeklyBatches: nextBatches };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ageGroups, form.skillLevels]);

  // ─── Toggle helpers ───────────────────────────────────────

  const toggleChip = (field, value) =>
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }));

  const toggleCity = (city) =>
    setForm(prev => ({
      ...prev,
      cities: prev.cities.includes(city)
        ? prev.cities.filter(c => c !== city)
        : [...prev.cities, city],
    }));

  const toggleDay = (day) =>
    setForm(prev => {
      const exists = prev.scheduleDays.find(d => d.day === day);
      if (exists) return { ...prev, scheduleDays: prev.scheduleDays.filter(d => d.day !== day) };
      return {
        ...prev,
        scheduleDays: [...prev.scheduleDays, { day, startTime: '', endTime: '', groundAddress: '' }],
      };
    });

  const updateDayField = (day, field, value) =>
    setForm(prev => ({
      ...prev,
      scheduleDays: prev.scheduleDays.map(d => d.day === day ? { ...d, [field]: value } : d),
    }));

  // ─── Price preview calculation ────────────────────────────
  const daysCount = form.scheduleDays.length;
  const basePrice = parseFloat(form.price) || 0;

  // ─── Submit ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.categoryId) { toast.error('Category (Season) is required'); return; }
    if (!form.price)      { toast.error('Price is required'); return; }
    if (form.batchType === 'WEEKLY') {
      if (form.weeklyBatches.length === 0) {
        toast.error('Add at least one Batch for this Weekly program'); return;
      }
      const incomplete = form.weeklyBatches.some(b =>
        !b.startDate || !b.startTime || !b.endDate || !b.endTime || !b.groundAddress ||
        (b.ageGroups || []).length === 0 || (b.skillLevels || []).length === 0
      );
      if (incomplete) {
        toast.error('Every Batch needs Start/End Date & Time, Ground, at least one Age Group and one Level'); return;
      }
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title',               form.title);
      fd.append('category',            form.categoryId);
      if (form.locationId)             fd.append('location', form.locationId);
      fd.append('batchType',           form.batchType);
      fd.append('basePrice',           parseFloat(form.price));
      if (form.discountedPrice)        fd.append('discountedPrice', parseFloat(form.discountedPrice));
      fd.append('maxCapacity',         parseInt(form.maxCapacity) || 99);
      if (form.startDate)              fd.append('startDate', form.startDate);
      if (form.endDate)                fd.append('endDate', form.endDate);
      if (form.registrationDeadline)   fd.append('registrationDeadline', form.registrationDeadline);
      fd.append('shortDescription',    form.shortDescription);
      fd.append('detailedDescription', form.detailedDescription);
      fd.append('specialNote',         form.specialNote);
      fd.append('isFeatured',          form.isFeatured);
      fd.append('isActive',            form.isActive);
      if (form.coachId)                fd.append('coachId', form.coachId);
      fd.append('sessionsPerWeek',     daysCount);
      fd.append('ageGroups',           JSON.stringify(form.ageGroups));
      fd.append('skillLevels',         JSON.stringify(form.skillLevels));
      fd.append('cities',              JSON.stringify(form.cities));
      // Save month options exactly as admin entered them (price is always manually set).
      fd.append('monthOptions',        JSON.stringify(serializeMonthOptions(form.monthOptions)));
      // TEMP DEBUG — open browser DevTools Console before clicking Save/Update
      // and check this log to confirm the new week is actually in form.weeklyBatches.
      console.log('[DEBUG] Sending weeklyBatches:', form.weeklyBatches);
      fd.append('weeklyBatches',       JSON.stringify(form.weeklyBatches));
      fd.append('scheduleDays',        JSON.stringify(form.scheduleDays));
      if (coverFile)                   fd.append('coverImage', coverFile);

      if (isEdit) {
        await programsAPI.update(id, fd);
        toast.success('Program updated!');
      } else {
        await programsAPI.create(fd);
        toast.success('Program created!');
      }
      navigate('/admin/programs');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ─── Unique cities from locations ─────────────────────────
  const uniqueCities = [...new Set(locations.map(l => l.city).filter(Boolean))];

  // ─── Chip button style helper ─────────────────────────────
  const chipStyle = (selected, color = '#D4AF37', bg = 'rgba(212,175,55,0.2)') => ({
    padding: '5px 14px', borderRadius: '20px', border: '1px solid', cursor: 'pointer',
    fontSize: '13px', fontWeight: '500',
    borderColor: selected ? color    : 'rgba(255,255,255,0.15)',
    background:  selected ? bg       : 'transparent',
    color:       selected ? color    : 'rgba(255,255,255,0.5)',
  });

  if (loading) {
    return (
      <div style={{ color: '#F5D97A', padding: '60px', textAlign: 'center', fontSize: '16px' }}>
        Loading program...
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div style={{ color: '#fff', maxWidth: '900px' }}>
      <PageHeader
        title={isEdit ? 'Edit Program' : 'Create New Program'}
        subtitle={isEdit
          ? 'Update program details, schedule and pricing'
          : 'Fill in all details to create a new training program'}
        action={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Btn variant="ghost" onClick={() => navigate('/admin/programs')}>← Back</Btn>
            <Btn onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : (isEdit ? 'Update Program' : 'Create Program')}
            </Btn>
          </div>
        }
      />

      {/* ── SECTION 1: Cover Image ── */}
      <Section title="📷 Cover Image">
        <ImageUploadField
          label="Cover Image"
          currentUrl={form._existingCoverUrl || ''}
          onFileSelect={file => setCoverFile(file)}
        />
      </Section>

      {/* ── SECTION 2: Title & Identification ── */}
      <Section title="📋 Program Title & Identification">
        {/* Auto Title display */}
        <FormField label="Program Title (auto-generated)">
          <div style={{
            padding: '10px 14px',
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: '8px',
            color: form.title ? '#F5D97A' : 'rgba(255,255,255,0.3)',
            fontSize: '14px',
            fontWeight: form.title ? '600' : '400',
            minHeight: '42px', display: 'flex', alignItems: 'center',
          }}>
            {form.title || '← Select Age Groups, Levels and Cities below to generate title'}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '5px' }}>
            Format: U8/U10 - Beginner Level 1/Level 2 - Dublin/Fremont
          </div>
        </FormField>

        {/* Slug preview */}
        {slugPreview && (
          <FormField label="Slug / SKU ID (auto-generated)">
            <div style={{
              padding: '8px 14px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'monospace', fontSize: '13px', color: '#86efac',
            }}>
              {slugPreview}
            </div>
          </FormField>
        )}

        {/* Category + Main Location */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <FormField label="Category (Season)" required>
            <Select value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}>
              <option value="">— Select Season —</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
            </Select>
          </FormField>

          <FormField label="Main Location (for DB)">
            <Select value={form.locationId} onChange={e => setForm(p => ({ ...p, locationId: e.target.value }))}>
              <option value="">— Select Location —</option>
              {locations.map(l => <option key={l._id} value={l._id}>{l.title} ({l.city})</option>)}
            </Select>
          </FormField>
        </div>

        {/* City chips — multi-select for title only */}
        <FormField label="Cities (for title — select all that apply)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            {uniqueCities.length === 0 && (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                No cities found — add locations in the Locations page first.
              </div>
            )}
            {uniqueCities.map(city => (
              <button key={city} type="button" onClick={() => toggleCity(city)}
                style={chipStyle(form.cities.includes(city))}>
                {city}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '5px' }}>
            Selected cities appear in the title only (e.g. Dublin/Fremont). Not linked to main DB location.
          </div>
        </FormField>
      </Section>

      {/* ── SECTION 3: Age Groups & Levels ── */}
      <Section title="🎯 Age Groups & Skill Levels">
        <FormField label="Age Groups (multi-select)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            {ageGroups.length === 0 && (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                No age groups yet — add some in the Age Groups page first.
              </div>
            )}
            {ageGroups.map(ag => (
              <button key={ag._id} type="button"
                onClick={() => toggleChip('ageGroups', ag.title)}
                style={chipStyle(form.ageGroups.includes(ag.title))}>
                {ag.title}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Skill Levels (multi-select)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            {levels.map(sl => (
              <button key={sl._id} type="button"
                onClick={() => toggleChip('skillLevels', sl.title)}
                style={chipStyle(form.skillLevels.includes(sl.title), '#22c55e', 'rgba(34,197,94,0.15)')}>
                {sl.title}
              </button>
            ))}
          </div>
        </FormField>
      </Section>

      {/* ── SECTION 4: Pricing & Capacity ── */}
      <Section title="💰 Pricing & Capacity">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 20px' }}>
          <FormField label="Base Price ($)" required>
            <Input
              type="number"
              value={form.price}
              onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
              placeholder="250"
            />
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
              Price per day × days selected by user
            </div>
          </FormField>

          <FormField label="Max Capacity">
            <Input
              type="number"
              value={form.maxCapacity}
              onChange={e => setForm(p => ({ ...p, maxCapacity: e.target.value }))}
              placeholder="99"
            />
          </FormField>

          <FormField label="Discounted Price ($)">
            <Input
              type="number"
              value={form.discountedPrice}
              onChange={e => setForm(p => ({ ...p, discountedPrice: e.target.value }))}
              placeholder="No discount"
            />
          </FormField>
        </div>

        {/* Price preview box */}
        {basePrice > 0 && (
          <div style={{
            marginTop: '16px', padding: '14px 18px',
            background: 'rgba(212,175,55,0.07)',
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: '10px',
          }}>
            <div style={{ color: '#F5D97A', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>
              💡 Price Rule Preview
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '2' }}>
              Base price: <strong style={{color:'#fff'}}>{basePrice}</strong> × sessions/week × weeks-blocks
              <br />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                5 wks (1 block) = <strong style={{color:'#86efac'}}>{(basePrice * Math.max(daysCount,1) * 1).toFixed(0)}</strong>
                {'  ·  '}
                10 wks (2 blocks) = <strong style={{color:'#86efac'}}>{(basePrice * Math.max(daysCount,1) * 2).toFixed(0)}</strong>
                {'  ·  '}
                15 wks (3 blocks) = <strong style={{color:'#86efac'}}>{(basePrice * Math.max(daysCount,1) * 3).toFixed(0)}</strong>
              </span>
              {form.monthOptions.length > 0 && (
                <>
                  <br />
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                    Your month options:{'  '}
                    {form.monthOptions.map((opt, i) => (
                      <span key={i}>
                        <strong style={{ color: '#F5D97A' }}>{opt.label || `Option ${i+1}`}</strong>
                        {opt.price ? <span style={{color:'#86efac'}}> → {opt.price}</span> : ''}
                        {i < form.monthOptions.length - 1 ? '  ·  ' : ''}
                      </span>
                    ))}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ── SECTION 5: Dates & Program Type ── */}
      <Section title="📅 Dates & Program Type">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <FormField label="Batch Type" required>
            <Select value={form.batchType} onChange={e => setForm(p => ({ ...p, batchType: e.target.value }))}>
              {BATCH_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
            </Select>
          </FormField>

          <FormField label="Registration Deadline">
            <Input
              type="date"
              value={form.registrationDeadline}
              onChange={e => setForm(p => ({ ...p, registrationDeadline: e.target.value }))}
            />
          </FormField>

          <FormField label="Start Date">
            <Input
              type="date"
              value={form.startDate}
              onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
            />
          </FormField>

          <FormField label="End Date">
            <Input
              type="date"
              value={form.endDate}
              onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
            />
          </FormField>
        </div>

        {/* ── Month Selection Options — only for REGULAR_WITH_MONTH ── */}
        {form.batchType === 'REGULAR_WITH_MONTH' && (
          <div style={{ marginTop: '20px' }}>
            <div style={{
              color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '600',
              marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              📆 Month Selection Options — shown to users on registration page
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '12px', lineHeight: '1.6' }}>
              Pick a <strong style={{color:'rgba(255,255,255,0.6)'}}>Month Start Date</strong> → <strong style={{color:'rgba(255,255,255,0.6)'}}>Month End Date</strong> — weeks &amp; label auto-fill. <strong style={{color:'#F5D97A'}}>Enter the price manually for each option.</strong>
              &nbsp;All dates must be within program start/end range.
            </div>

            {form.monthOptions.map((opt, idx) => {
              const outOfRange =
                (form.startDate && opt.startDate && opt.startDate < form.startDate) ||
                (form.endDate   && opt.endDate   && opt.endDate   > form.endDate);
              const weeksNum = parseInt(opt.weeks) || 0;
              const blocks   = weeksNum > 0 ? Math.ceil(weeksNum / 5) : 0;
              const isEnabled = !isDisabledFlag(opt.isEnabled);

              return (
                <div key={idx} style={{
                  background: isEnabled ? 'rgba(255,255,255,0.03)' : 'rgba(148,163,184,0.08)',
                  border: `1px solid ${outOfRange ? 'rgba(239,68,68,0.5)' : isEnabled ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.25)'}`,
                  opacity: isEnabled ? 1 : 0.72,
                  borderRadius: '10px', padding: '12px', marginBottom: '10px',
                }}>
                  {outOfRange && (
                    <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '8px' }}>
                      ⚠️ Dates are outside program range ({form.startDate} → {form.endDate})
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#e2e8f0', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={e => updateMonthOption(idx, 'isEnabled', e.target.checked)}
                      />
                      Enabled for registration
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', fontSize: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isTruthyFlag(opt.showInStartMonthOnly)}
                        onChange={e => updateMonthOption(idx, 'showInStartMonthOnly', e.target.checked)}
                      />
                      Only show during its start month
                    </label>
                    <span style={{
                      marginLeft: 'auto',
                      color: isEnabled ? '#86efac' : '#fca5a5',
                      background: isEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      border: `1px solid ${isEnabled ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      borderRadius: '999px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}>
                      {isEnabled ? 'Visible when rules match' : 'Hidden from frontend'}
                    </span>
                  </div>
                  {/* Row 1: Start Date + End Date */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '3px' }}>
                        Month Start Date <span style={{color:'#F5D97A'}}>*</span>
                      </div>
                      <Input type="date" value={opt.startDate}
                        min={form.startDate || undefined}
                        max={form.endDate   || undefined}
                        onChange={e => updateMonthOption(idx, 'startDate', e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '3px' }}>
                        Month End Date <span style={{color:'#F5D97A'}}>*</span>
                      </div>
                      <Input type="date" value={opt.endDate}
                        min={opt.startDate || form.startDate || undefined}
                        max={form.endDate  || undefined}
                        onChange={e => updateMonthOption(idx, 'endDate', e.target.value)} />
                    </div>
                  </div>
                  {/* Row 2: Weeks + Price + Label + Remove */}
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 130px 1fr auto', gap: '8px', alignItems: 'end' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '3px' }}>
                        Weeks <span style={{fontSize:'10px', color:'#6ee7b7'}}>(auto)</span>
                      </div>
                      <Input type="number" value={opt.weeks}
                        onChange={e => updateMonthOption(idx, 'weeks', e.target.value)}
                        placeholder="5" />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '3px' }}>
                        Price <span style={{fontSize:'10px', color:'#F5D97A'}}>(required)</span>
                      </div>
                      <Input type="number" value={opt.price}
                        onChange={e => updateMonthOption(idx, 'price', e.target.value)}
                        placeholder="Enter price"
                        style={!opt.price ? {borderColor:'rgba(245,217,122,0.5)'} : {}}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '3px' }}>
                        Label shown to user <span style={{fontSize:'10px', color:'#6ee7b7'}}>(auto)</span>
                      </div>
                      <Input value={opt.label}
                        onChange={e => updateMonthOption(idx, 'label', e.target.value)}
                        placeholder="e.g. May to June (5 Weeks)" />
                    </div>
                    <button type="button" onClick={() => removeMonthOption(idx)}
                      style={{
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171', borderRadius: '6px', padding: '6px 10px',
                        cursor: 'pointer', fontSize: '13px',
                      }}>
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}

            <button type="button" onClick={addMonthOption}
              style={{
                background: 'rgba(212,175,55,0.1)', border: '1px dashed rgba(212,175,55,0.4)',
                color: '#F5D97A', borderRadius: '8px', padding: '8px 16px',
                cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                width: '100%', marginTop: '4px',
              }}>
              + Add Month Option
            </button>
          </div>
        )}
      </Section>

      {/* ── SECTION 6: Schedule Days ── */}
      <Section title={form.batchType === 'WEEKLY'
        ? '🗓️ Weekly Batches'
        : '🗓️ Schedule — Days, Times & Ground Address'}>

        {form.batchType === 'WEEKLY' ? (
          <>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
              Create one or more Batches. Each Batch has its own Start Date, Start Time, End Date,
              End Time and Ground — plus which Age Group(s) and Level(s) it's open to.
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '18px', lineHeight: '1.6' }}>
              Age Group / Level choices here are pulled from the <strong style={{color:'rgba(255,255,255,0.6)'}}>Age Group</strong> and{' '}
              <strong style={{color:'rgba(255,255,255,0.6)'}}>Level</strong> chips selected above — pick those first.
              On the registration page, a parent selects one or more Batches and the price is{' '}
              <strong style={{color:'#F5D97A'}}>Base Price × number of Batches selected</strong>{' '}
              (e.g. 1 batch = ${form.price || 0}, 2 batches = ${(parseFloat(form.price)||0) * 2}).
            </div>

            {(form.ageGroups.length === 0 || form.skillLevels.length === 0) && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171', borderRadius: '8px', padding: '10px 14px',
                fontSize: '12px', marginBottom: '16px',
              }}>
                Select at least one Age Group and one Level in Section above before adding batches.
              </div>
            )}

            {form.weeklyBatches.map((batch, idx) => {
              if (batch.isSubWeek) return null; // rendered nested under its root below

              // Collect this root's trailing sub-weeks
              const subWeeks = [];
              let look = idx + 1;
              while (look < form.weeklyBatches.length && form.weeklyBatches[look].isSubWeek) {
                subWeeks.push({ batch: form.weeklyBatches[look], subIdx: look });
                look++;
              }

              return (
              <div key={idx} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', padding: '16px', marginBottom: '14px',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: '12px',
                }}>
                  <div style={{ color: '#F5D97A', fontWeight: '700', fontSize: '13px' }}>
                    Batch {idx + 1}{batch.label ? ` — ${batch.label}` : ''}
                  </div>
                  <button type="button" onClick={() => removeWeeklyBatch(idx)}
                    style={{
                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171', borderRadius: '6px', padding: '5px 10px',
                      cursor: 'pointer', fontSize: '13px',
                    }}>
                    ✕ Remove
                  </button>
                </div>

                {/* Age Group + Level chips — restricted to program-level selections */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>
                      Age Group(s) <span style={{color:'#F5D97A'}}>*</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {form.ageGroups.length === 0 && (
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>— none selected above —</span>
                      )}
                      {form.ageGroups.map(ag => (
                        <button key={ag} type="button"
                          onClick={() => toggleWeeklyBatchTag(idx, 'ageGroups', ag)}
                          style={chipStyle((batch.ageGroups || []).includes(ag))}>
                          {ag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>
                      Level(s) <span style={{color:'#F5D97A'}}>*</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {form.skillLevels.length === 0 && (
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>— none selected above —</span>
                      )}
                      {form.skillLevels.map(sl => (
                        <button key={sl} type="button"
                          onClick={() => toggleWeeklyBatchTag(idx, 'skillLevels', sl)}
                          style={chipStyle((batch.skillLevels || []).includes(sl), '#22c55e', 'rgba(34,197,94,0.15)')}>
                          {sl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Start / End date + time — Week 1 (the root) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px', marginBottom: '12px' }}>
                  <FormField label="Start Date" required>
                    <Input type="date" value={batch.startDate}
                      onChange={e => updateWeeklyBatch(idx, 'startDate', e.target.value)} />
                  </FormField>
                  <FormField label="Start Time" required>
                    <Input type="time" value={batch.startTime}
                      onChange={e => updateWeeklyBatch(idx, 'startTime', e.target.value)} />
                  </FormField>
                  <FormField label="End Date" required>
                    <Input type="date" value={batch.endDate} min={batch.startDate || undefined}
                      onChange={e => updateWeeklyBatch(idx, 'endDate', e.target.value)} />
                  </FormField>
                  <FormField label="End Time" required>
                    <Input type="time" value={batch.endTime}
                      onChange={e => updateWeeklyBatch(idx, 'endTime', e.target.value)} />
                  </FormField>
                </div>

                {/* Compact "Week N" rows — only Start/End Date+Time, no repeated
                    Age Group/Level/Ground (those are shared from the root above) */}
                {subWeeks.map(({ batch: wk, subIdx }, i) => (
                  <div key={subIdx} style={{
                    background: 'rgba(212,175,55,0.05)',
                    border: '1px solid rgba(212,175,55,0.2)',
                    borderRadius: '8px', padding: '10px 12px', marginBottom: '12px',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}>
                      <div style={{ color: '#F5D97A', fontWeight: '700', fontSize: '12px' }}>
                        Week {i + 2}
                      </div>
                      <button type="button" onClick={() => removeWeeklyBatch(subIdx)}
                        style={{
                          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                          color: '#f87171', borderRadius: '5px', padding: '3px 8px',
                          cursor: 'pointer', fontSize: '11px',
                        }}>
                        ✕
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                      <FormField label="Start Date" required>
                        <Input type="date" value={wk.startDate}
                          onChange={e => updateWeeklyBatch(subIdx, 'startDate', e.target.value)} />
                      </FormField>
                      <FormField label="Start Time" required>
                        <Input type="time" value={wk.startTime}
                          onChange={e => updateWeeklyBatch(subIdx, 'startTime', e.target.value)} />
                      </FormField>
                      <FormField label="End Date" required>
                        <Input type="date" value={wk.endDate} min={wk.startDate || undefined}
                          onChange={e => updateWeeklyBatch(subIdx, 'endDate', e.target.value)} />
                      </FormField>
                      <FormField label="End Time" required>
                        <Input type="time" value={wk.endTime}
                          onChange={e => updateWeeklyBatch(subIdx, 'endTime', e.target.value)} />
                      </FormField>
                    </div>
                  </div>
                ))}

                {/* + Add Week — appends the next compact Week N row */}
                <button type="button" onClick={() => addWeekToBatch(idx)}
                  title="Add another week (only Start/End Date & Time — Ground/Age Group/Level stay shared with this batch)"
                  style={{
                    background: 'rgba(212,175,55,0.1)', border: '1px dashed rgba(212,175,55,0.4)',
                    color: '#F5D97A', borderRadius: '8px', padding: '7px 16px',
                    cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                    width: '100%', marginBottom: '16px',
                  }}>
                  + Add Week
                </button>

                {/* Ground */}
                <FormField label="Ground Address" required>
                  <Select
                    value={batch.groundAddress || ''}
                    onChange={e => updateWeeklyBatch(idx, 'groundAddress', e.target.value)}
                  >
                    <option value="">— Select Location —</option>
                    {locations
                      .filter(l => l.isActive !== false)
                      .map(l => {
                        const formatted = formatLocationAddress(l);
                        return (
                          <option key={l._id} value={formatted}>
                            {formatted}
                          </option>
                        );
                      })}
                    {batch.groundAddress &&
                      !locations.some(l => l.isActive !== false && formatLocationAddress(l) === batch.groundAddress) && (
                        <option value={batch.groundAddress}>{batch.groundAddress} (saved)</option>
                    )}
                  </Select>
                </FormField>
              </div>
              );
            })}

            <button type="button" onClick={addWeeklyBatch}
              style={{
                background: 'rgba(212,175,55,0.1)', border: '1px dashed rgba(212,175,55,0.4)',
                color: '#F5D97A', borderRadius: '8px', padding: '10px 16px',
                cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                width: '100%', marginTop: '4px',
              }}>
              + Add Batch
            </button>

            {form.weeklyBatches.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '8px' }}>
                No batches yet — add at least one so parents can register for this Weekly program.
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
              Select which days this program runs. Enter time and ground address for each day.
              Price multiplies per day the user selects during registration.
            </div>

            {/* Day toggles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              {ALL_DAYS.map(day => {
                const selected = form.scheduleDays.some(d => d.day === day);
                return (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    style={chipStyle(selected)}>
                    {DAY_LABELS[day].slice(0, 3)}
                  </button>
                );
              })}
            </div>

            {/* Per-day time & address rows */}
            {ALL_DAYS.filter(day => form.scheduleDays.some(d => d.day === day)).map(day => {
              const dayData = form.scheduleDays.find(d => d.day === day);
              return (
                <div key={day} style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 130px 130px 1fr',
                  gap: '12px', alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(212,175,55,0.05)',
                  border: '1px solid rgba(212,175,55,0.12)',
                  borderRadius: '8px', marginBottom: '8px',
                }}>
                  <div style={{ color: '#F5D97A', fontWeight: '700', fontSize: '14px' }}>
                    {DAY_LABELS[day]}
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Start Time</div>
                    <Input
                      type="time"
                      value={dayData?.startTime || ''}
                      onChange={e => updateDayField(day, 'startTime', e.target.value)}
                      style={{ padding: '5px 8px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>End Time</div>
                    <Input
                      type="time"
                      value={dayData?.endTime || ''}
                      onChange={e => updateDayField(day, 'endTime', e.target.value)}
                      style={{ padding: '5px 8px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Ground Address</div>
                    <Select
                      value={dayData?.groundAddress || ''}
                      onChange={e => updateDayField(day, 'groundAddress', e.target.value)}
                      style={{ padding: '5px 8px', fontSize: '13px' }}
                    >
                      <option value="">— Select Location —</option>
                      {locations
                        .filter(l => l.isActive !== false)
                        .map(l => {
                          const formatted = formatLocationAddress(l);
                          return (
                            <option key={l._id} value={formatted}>
                              {formatted}
                            </option>
                          );
                        })}
                      {/* Preserve a previously saved address that no longer matches any active location
                          (e.g. location was edited/deactivated after this program was created) */}
                      {dayData?.groundAddress &&
                        !locations.some(l => l.isActive !== false && formatLocationAddress(l) === dayData.groundAddress) && (
                          <option value={dayData.groundAddress}>
                            {dayData.groundAddress} (saved)
                          </option>
                      )}
                    </Select>
                  </div>
                </div>
              );
            })}

            {daysCount === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                No days selected yet. Select days above to add time slots.
              </div>
            )}

            {daysCount > 0 && (
              <div style={{ marginTop: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                Sessions per week: <strong style={{ color: '#F5D97A' }}>{daysCount}×</strong>
                {'  '}—{'  '}
                Frequency label: <strong style={{ color: '#F5D97A' }}>{frequencyLabel(daysCount)}</strong>
              </div>
            )}
          </>
        )}
      </Section>

      {/* ── SECTION 7: Coach ── */}
      <Section title="🧑‍🏫 Coach">
        <FormField label="Assign Coach">
          <Select value={form.coachId} onChange={e => setForm(p => ({ ...p, coachId: e.target.value }))}>
            <option value="">— No Coach Assigned —</option>
            {coaches.map(c => (
              <option key={c._id} value={c._id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </Select>
        </FormField>
      </Section>

      {/* ── SECTION 8: Descriptions ── */}
      <Section title="📝 Description & Notes">
        <FormField label="Short Description">
          <Textarea
            value={form.shortDescription}
            rows={2}
            onChange={e => setForm(p => ({ ...p, shortDescription: e.target.value }))}
            placeholder="Displayed on program cards..."
          />
        </FormField>
        <FormField label="Detailed Description">
          <Textarea
            value={form.detailedDescription}
            rows={4}
            onChange={e => setForm(p => ({ ...p, detailedDescription: e.target.value }))}
            placeholder="Full program details shown on program page..."
          />
        </FormField>
        <FormField label="Special Note">
          <Input
            value={form.specialNote}
            onChange={e => setForm(p => ({ ...p, specialNote: e.target.value }))}
            placeholder="e.g. Bring water bottle and cricket shoes"
          />
        </FormField>
      </Section>

      {/* ── SECTION 9: Settings ── */}
      <Section title="⚙️ Settings">
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[
            { field: 'isFeatured', label: '⭐ Featured on homepage' },
            { field: 'isActive',   label: '✅ Active (visible on website)' },
          ].map(({ field, label }) => (
            <label key={field} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '14px',
            }}>
              <input
                type="checkbox"
                checked={form[field]}
                onChange={e => setForm(p => ({ ...p, [field]: e.target.checked }))}
                style={{ width: '16px', height: '16px', accentColor: '#D4AF37' }}
              />
              {label}
            </label>
          ))}
        </div>
      </Section>

      {/* ── Footer Buttons ── */}
      <div style={{
        display: 'flex', gap: '12px', justifyContent: 'flex-end',
        padding: '24px 0', borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Btn variant="ghost" onClick={() => navigate('/admin/programs')}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : (isEdit ? 'Update Program' : 'Create Program')}
        </Btn>
      </div>
    </div>
  );
}
