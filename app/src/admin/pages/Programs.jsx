// ============================================================
//  admin/pages/Programs.jsx — Super Admin Only
//  LIST page — create/edit navigates to full-page ProgramForm
//  REPLACE: app/src/admin/pages/Programs.jsx
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { programsAPI } from '../api/client';
import {
  PageHeader, DataTable, Btn, Badge, SearchInput
} from '../components/common/UI';
import toast from 'react-hot-toast';

const idOf = (value) => typeof value === 'string' ? value : value?._id || '';

const uniqueOptions = (options) => {
  const seen = new Set();
  return options
    .filter(option => option.value && option.label)
    .filter(option => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

const hasAny = (selected, values) => !selected.length || values.some(value => selected.includes(value));
const PROGRAM_FILTER_STORAGE_KEY = 'admin.programs.filters.v1';
const DEFAULT_PROGRAM_FILTERS = { categories: [], locations: [], ageGroups: [], levels: [], status: [] };

const normalizeSavedFilters = (value = {}) => ({
  categories: Array.isArray(value.categories) ? value.categories : [],
  locations: Array.isArray(value.locations) ? value.locations : [],
  ageGroups: Array.isArray(value.ageGroups) ? value.ageGroups : [],
  levels: Array.isArray(value.levels) ? value.levels : [],
  status: Array.isArray(value.status) ? value.status : [],
});

const loadSavedProgramFilters = () => {
  if (typeof window === 'undefined') return { search: '', filters: DEFAULT_PROGRAM_FILTERS };
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROGRAM_FILTER_STORAGE_KEY) || '{}');
    return {
      search: typeof saved.search === 'string' ? saved.search : '',
      filters: normalizeSavedFilters(saved.filters),
    };
  } catch {
    return { search: '', filters: DEFAULT_PROGRAM_FILTERS };
  }
};

const MultiSelectFilter = ({ id, label, options, selected, onChange, open, onOpen, onClose, width = '190px' }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open, onClose]);

  const toggle = (value) => {
    onChange(selected.includes(value)
      ? selected.filter(item => item !== value)
      : [...selected, value]);
  };

  return (
    <div ref={ref} style={{ position: 'relative', width }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => (open ? onClose() : onOpen(id))}
        style={{
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          background: '#0f3d22',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: '8px',
          padding: '10px 14px',
          color: '#fff',
          fontSize: '14px',
          userSelect: 'none',
        }}
      >
        {selected.length ? `${label}: ${selected.length}` : `All ${label}`}
      </button>
      {open && (
        <div id={`${id}-menu`} style={{
          position: 'absolute',
          zIndex: 20,
          top: '44px',
          left: 0,
          width: '260px',
          maxHeight: '260px',
          overflowY: 'auto',
          background: '#0f3d22',
          border: '1px solid rgba(212,175,55,0.25)',
          borderRadius: '8px',
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
          padding: '8px',
        }}>
          {options.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', padding: '8px' }}>No options</div>
          ) : options.map(option => (
            <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px', padding: '7px 8px', cursor: 'pointer', borderRadius: '6px' }}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Excel template column definitions (must match backend expectations) ───────
// v2: rowType-based — one program = multiple rows (one per schedule day, one per
// month option). Shared program fields repeat on every row. A BLANK ROW ends
// the current program and starts a new one on the next non-blank row.
const TEMPLATE_HEADERS_ROW1 = [
  'rowType','category','startDate','endDate','ageGroups','skillLevels','cities',
  'locationCity','batchType','price','maxCapacity','registrationDeadline',
  'discountedPrice','shortDescription','detailedDescription','specialNote',
  'coachName','isFeatured','isActive',
  'classDay','startTime','endTime','groundAddress',
  'monthLabel','monthStartDate','monthEndDate','monthWeeks','monthPrice',
];
const TEMPLATE_HEADERS_ROW2 = [
  'Row Type *','Category / Season *','Start Date *','End Date *','Age Groups *',
  'Skill Levels *','Cities (Title) *','Location City *','Batch Type *','Price *',
  'Max Capacity','Registration Deadline','Discounted Price','Short Description',
  'Detailed Description','Special Note','Coach Name','Is Featured','Is Active',
  'Class Day','Start Time','End Time','Ground Address',
  'Month Label','Month Start Date','Month End Date','Month Weeks','Month Price',
];
const TEMPLATE_HINTS = [
  'DAY or MONTH (one row per schedule-day or per month-option)',
  'e.g. Fall 2026 — repeat on every row of this program',
  'YYYY-MM-DD — repeat on every row','YYYY-MM-DD — repeat on every row',
  'e.g. U8 or U8,U10 — repeat on every row','e.g. Beginner Level 1 — repeat on every row',
  'e.g. Cupertino,Santa Clara — repeat on every row','Must match a location city — repeat on every row',
  'REGULAR_WITH_MONTH / REGULAR_WITHOUT_MONTH / WEEKLY / FIXED_DAYS / SPECIAL_CAMP',
  'Number only e.g. 430 — repeat on every row','Default 99 — repeat on every row',
  'YYYY-MM-DD — leave blank if none','Number only — leave blank if none',
  'Shown on program card — repeat on every row','Full program details — repeat on every row',
  'e.g. Bring water bottle — repeat on every row','First Last — must match a coach in admin',
  'TRUE or FALSE (default FALSE)','TRUE or FALSE (default TRUE)',
  'ONLY for rowType=DAY: Monday...Sunday','ONLY for rowType=DAY: HH:MM 24hr e.g. 17:00',
  'ONLY for rowType=DAY: HH:MM 24hr e.g. 18:30','ONLY for rowType=DAY: e.g. 10800 Torre Avenue, Cupertino',
  'ONLY for rowType=MONTH: e.g. August to September (5 Weeks)','ONLY for rowType=MONTH: YYYY-MM-DD',
  'ONLY for rowType=MONTH: YYYY-MM-DD','ONLY for rowType=MONTH: number of weeks e.g. 5',
  'ONLY for rowType=MONTH: leave blank to auto-calculate, or set a fixed price',
];
const SAMPLE_ROWS = [
  ['DAY','Fall 2026','2026-08-17','2026-10-26','U8,U10','Beginner Level 1',
   'Cupertino,Santa Clara','Cupertino','REGULAR_WITH_MONTH',430,99,'','',
   'Cricket training for beginners','Full season beginner program','Bring water bottle','',
   'FALSE','TRUE','Monday','17:00','18:30','10800 Torre Avenue, Cupertino','','','','',''],
  ['DAY','Fall 2026','2026-08-17','2026-10-26','U8,U10','Beginner Level 1',
   'Cupertino,Santa Clara','Cupertino','REGULAR_WITH_MONTH',430,99,'','',
   'Cricket training for beginners','Full season beginner program','Bring water bottle','',
   'FALSE','TRUE','Wednesday','17:00','18:30','10800 Torre Avenue, Cupertino','','','','',''],
  ['MONTH','Fall 2026','2026-08-17','2026-10-26','U8,U10','Beginner Level 1',
   'Cupertino,Santa Clara','Cupertino','REGULAR_WITH_MONTH',430,99,'','',
   'Cricket training for beginners','Full season beginner program','Bring water bottle','',
   'FALSE','TRUE','','','','','August to September (5 Weeks)','2026-08-17','2026-09-20',5,''],
  ['MONTH','Fall 2026','2026-08-17','2026-10-26','U8,U10','Beginner Level 1',
   'Cupertino,Santa Clara','Cupertino','REGULAR_WITH_MONTH',430,99,'','',
   'Cricket training for beginners','Full season beginner program','Bring water bottle','',
   'FALSE','TRUE','','','','','September to October (5 Weeks)','2026-09-21','2026-10-26',5,''],
  Array(28).fill(''), // ← blank row: ends the program above
  ['DAY','Fall 2026','2026-08-18','2026-10-27','U8','Beginner Level 1','San Jose',
   'San Jose','REGULAR_WITHOUT_MONTH',430,99,'','','','','','','FALSE','TRUE',
   'Tuesday','16:30','18:00','1460 Colt Way, San Jose, CA 95121','','','','',''],
];

// ── Download template using SheetJS (loaded from CDN via window.XLSX) ─────────
// We use a dynamic import approach: load XLSX from CDN if not already present.
async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function downloadTemplate() {
  const XLSX = await loadXLSX();

  const wb = XLSX.utils.book_new();

  // ── Programs sheet ──────────────────────────────────────────────────────────
  const wsData = [
    TEMPLATE_HEADERS_ROW1,   // row 0 — field keys (reference)
    TEMPLATE_HEADERS_ROW2,   // row 1 — human labels
    TEMPLATE_HINTS,           // row 2 — hints
    ...SAMPLE_ROWS,           // rows 3-5 — samples
    ...Array(100).fill(Array(TEMPLATE_HEADERS_ROW1.length).fill('')), // 100 blank rows
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths (28 columns: shared fields + DAY-only fields + MONTH-only fields)
  ws['!cols'] = [10,14,12,12,16,26,20,16,22,9,11,16,14,22,26,20,18,11,11,
                 12,11,11,30,26,16,16,12,12]
    .map(w => ({ wch: w }));

  // Freeze row 3 (below key + label + hint)
  ws['!freeze'] = { xSplit: 0, ySplit: 3 };

  XLSX.utils.book_append_sheet(wb, ws, 'Programs');

  // ── Instructions sheet ──────────────────────────────────────────────────────
  const instrData = [
    ['CCA BULK PROGRAM UPLOAD — INSTRUCTIONS (v2 — multi-day / multi-month)'],
    [],
    ['HOW PROGRAMS ARE GROUPED'],
    ['• Each PROGRAM can have MULTIPLE rows: one row per schedule day (rowType=DAY),'],
    ['  and one row per month option (rowType=MONTH).'],
    ['• All rows belonging to the same program must repeat the SAME shared values'],
    ['  (category, startDate, endDate, ageGroups, skillLevels, cities, locationCity,'],
    ['  batchType, price, maxCapacity, etc).'],
    ['• Leave ONE BLANK ROW between programs — it tells the system "this program is'],
    ['  finished, the next row starts a new program." Extra blank rows are fine too.'],
    [],
    ['FIELD', 'DESCRIPTION'],
    ['Row Type *', 'DAY = one schedule day/time/ground-address row. MONTH = one month-option row (only used when Batch Type = REGULAR_WITH_MONTH).'],
    ['Category / Season *', 'Must match an existing Category/Season name in admin (e.g. Fall 2026). Repeat on every row of the program.'],
    ['Start Date *', 'Program start date YYYY-MM-DD. Repeat on every row.'],
    ['End Date *', 'Program end date YYYY-MM-DD. Repeat on every row.'],
    ['Age Groups *', 'Comma-separated: U8,U10  or single: U10. Repeat on every row.'],
    ['Skill Levels *', 'Comma-separated: Beginner Level 1,Beginner Level 2. Repeat on every row.'],
    ['Cities (Title) *', 'Comma-separated city names used in the auto-generated title. Repeat on every row.'],
    ['Location City *', 'Must match a location city in admin. Repeat on every row.'],
    ['Batch Type *', 'REGULAR_WITH_MONTH / REGULAR_WITHOUT_MONTH / WEEKLY / FIXED_DAYS / SPECIAL_CAMP. Repeat on every row.'],
    ['Price *', 'Base price per session per week, number only e.g. 430. Repeat on every row.'],
    ['Max Capacity', 'Default 99 if blank. Repeat on every row.'],
    ['Registration Deadline', 'YYYY-MM-DD — leave blank for none.'],
    ['Discounted Price', 'Number only — leave blank for none.'],
    ['Short Description', 'Optional — shown on program card. Repeat on every row.'],
    ['Detailed Description', 'Optional — full program details. Repeat on every row.'],
    ['Special Note', 'Optional — e.g. Bring water bottle. Repeat on every row.'],
    ['Coach Name', 'First Last — must exactly match a coach in admin — leave blank for none.'],
    ['Is Featured', 'TRUE or FALSE  (default FALSE). Repeat on every row.'],
    ['Is Active', 'TRUE or FALSE  (default TRUE). Repeat on every row.'],
    ['Class Day (DAY rows only)', 'Monday / Tuesday / Wednesday / Thursday / Friday / Saturday / Sunday'],
    ['Start Time (DAY rows only)', 'HH:MM 24hr  e.g. 17:00'],
    ['End Time (DAY rows only)', 'HH:MM 24hr  e.g. 18:30'],
    ['Ground Address (DAY rows only)', 'Full address e.g. 10800 Torre Avenue, Cupertino'],
    ['Month Label (MONTH rows only)', 'e.g. August to September (5 Weeks)'],
    ['Month Start Date (MONTH rows only)', 'YYYY-MM-DD'],
    ['Month End Date (MONTH rows only)', 'YYYY-MM-DD'],
    ['Month Weeks (MONTH rows only)', 'Number of weeks, e.g. 5'],
    ['Month Price (MONTH rows only)', 'Leave blank to auto-calculate (price × number of DAY rows × ceil(weeks/5)), or enter a fixed price.'],
    [],
    ['EXAMPLE — ONE PROGRAM MEETING TWICE A WEEK WITH TWO MONTH OPTIONS'],
    ['Row 1: rowType=DAY,   classDay=Monday,    startTime=17:00, endTime=18:30, groundAddress=...'],
    ['Row 2: rowType=DAY,   classDay=Wednesday, startTime=17:00, endTime=18:30, groundAddress=...'],
    ['Row 3: rowType=MONTH, monthLabel=Aug-Sep (5 Weeks), monthStartDate=2026-08-17, monthEndDate=2026-09-20, monthWeeks=5'],
    ['Row 4: rowType=MONTH, monthLabel=Sep-Oct (5 Weeks), monthStartDate=2026-09-21, monthEndDate=2026-10-26, monthWeeks=5'],
    ['Row 5: <BLANK ROW>  ← this ends the program'],
    ['Row 6: next program starts here...'],
    [],
    ['IMPORTANT NOTES'],
    ['• Start entering data from Row 4 onwards (rows 1-3 are key/label/hint — do not delete)'],
    ['• Sample programs are in rows 4-9 — replace with your real data, or delete and start fresh'],
    ['• A program needs AT LEAST one DAY row. MONTH rows are only needed if Batch Type = REGULAR_WITH_MONTH'],
    ['• Required fields are marked with *'],
    ['• Upload the filled sheet using "Upload Excel" button on the Programs page'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr['!cols'] = [{ wch: 32 }, { wch: 75 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  XLSX.writeFile(wb, 'CCA_Programs_Upload_Template.xlsx');
}

// ── Parse uploaded Excel and call bulk API ────────────────────────────────────
// v2: groups consecutive rows into ONE program. A row with rowType=DAY becomes
// one entry in scheduleDays[]; a row with rowType=MONTH becomes one entry in
// monthOptions[]. A BLANK ROW ends the current program — the next non-blank
// row starts a new one.
async function parseAndUpload(file, onProgress) {
  const XLSX = await loadXLSX();

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('program')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

  if (!raw || raw.length < 4) throw new Error('Sheet has no data rows (need at least row 4+)');

  // Detect header row — look for row with 'rowType' or 'Row Type'
  let keyRow = -1;
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    const r = raw[i];
    if (r && (r[0] === 'rowType' || String(r[0]).toLowerCase().includes('row type'))) {
      keyRow = i;
      break;
    }
  }

  // Map columns by key (row 0 = field keys)
  const keys = keyRow >= 0 ? raw[keyRow] : TEMPLATE_HEADERS_ROW1;
  const colMap = {};
  keys.forEach((k, i) => { if (k) colMap[String(k).trim()] = i; });

  // Data rows start after: keyRow + 1 label row + 1 hint row = keyRow+3
  const dataStart = keyRow >= 0 ? keyRow + 3 : 3;

  const isRowBlank = (row) => {
    if (!row || !row.length) return true;
    return row.every(cell => String(cell ?? '').trim() === '');
  };

  const programs  = [];
  let current     = null; // program currently being built
  let rowNumStart = null; // first spreadsheet row number of current program (for error messages)

  const finishCurrent = () => {
    if (current && current.scheduleDays.length > 0) {
      programs.push(current);
    }
    current = null;
  };

  for (let i = dataStart; i < raw.length; i++) {
    const row = raw[i];
    const sheetRowNum = i + 1; // 1-indexed, matches what user sees in Excel

    if (isRowBlank(row)) {
      finishCurrent();
      continue;
    }

    const get = (key) => {
      const idx = colMap[key];
      return idx !== undefined ? String(row[idx] ?? '').trim() : '';
    };

    const rowType = get('rowType').toUpperCase();

    // Start a new program if one isn't open yet
    if (!current) {
      current = {
        category:             get('category'),
        startDate:            get('startDate'),
        endDate:              get('endDate'),
        ageGroups:            get('ageGroups').split(',').map(s => s.trim()).filter(Boolean),
        skillLevels:          get('skillLevels').split(',').map(s => s.trim()).filter(Boolean),
        cities:               get('cities').split(',').map(s => s.trim()).filter(Boolean),
        locationCity:         get('locationCity'),
        batchType:            get('batchType') || 'REGULAR_WITH_MONTH',
        price:                parseFloat(get('price')) || 0,
        maxCapacity:          parseInt(get('maxCapacity')) || 99,
        registrationDeadline: get('registrationDeadline') || null,
        discountedPrice:      parseFloat(get('discountedPrice')) || null,
        shortDescription:     get('shortDescription'),
        detailedDescription:  get('detailedDescription'),
        specialNote:          get('specialNote'),
        coachName:            get('coachName'),
        isFeatured:           get('isFeatured').toUpperCase() === 'TRUE',
        isActive:             get('isActive').toUpperCase() !== 'FALSE',
        scheduleDays:         [],
        monthOptions:         [],
      };
      rowNumStart = sheetRowNum;
    }

    if (rowType === 'MONTH') {
      // Price priority for a MONTH/week option row:
      //   1. monthPrice column (if the template still has it and it's filled in)
      //   2. the row's own "price" column — this is how admin now sets the
      //      week/option price directly (e.g. 430 for 11 sessions, 290 for 8)
      const rowPrice = get('monthPrice') ? parseFloat(get('monthPrice')) : parseFloat(get('price'));
      current.monthOptions.push({
        label:     get('monthLabel'),
        startDate: get('monthStartDate'),
        endDate:   get('monthEndDate'),
        weeks:     parseInt(get('monthWeeks')) || null,
        price:     !isNaN(rowPrice) ? rowPrice : null,
        isEnabled: true,
      });
    } else {
      // Default to DAY if rowType is blank/unrecognized but classDay is present
      const classDay = get('classDay');
      if (classDay) {
        current.scheduleDays.push({
          day:           classDay,
          startTime:     get('startTime'),
          endTime:       get('endTime'),
          groundAddress: get('groundAddress'),
        });
      } else if (rowType !== 'MONTH') {
        console.warn(`Row ${sheetRowNum}: no rowType/classDay recognized — skipped`);
      }
    }
  }
  finishCurrent(); // flush last program if file doesn't end with a blank row

  if (programs.length === 0) throw new Error('No valid programs found in the Excel file — check that each program has at least one DAY row');

  // Only auto-calculate a MONTH/week option's price if BOTH monthPrice and
  // price were left blank for that row. Since admin now pastes the price
  // directly into the shared "price" column for each week option, this
  // auto-calc almost never fires anymore — it's just a safety fallback.
  programs.forEach(p => {
    const spw = p.scheduleDays.length || 1;
    p.monthOptions = p.monthOptions.map(opt => {
      if (opt.price != null && !isNaN(opt.price) && opt.price > 0) return opt;
      const weeks  = opt.weeks || 0;
      const blocks = weeks > 0 ? Math.ceil(weeks / 5) : 1;
      return { ...opt, price: p.price * spw * blocks };
    });
  });

  onProgress(`Parsed ${programs.length} program${programs.length !== 1 ? 's' : ''} — uploading...`);
  return programs;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Programs() {
  const savedFilters = loadSavedProgramFilters();
  const [rows,         setRows]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState(savedFilters.search);
  const [filters,      setFilters]      = useState(savedFilters.filters);
  const [openFilter,   setOpenFilter]   = useState('');
  const [selectedIds,  setSelectedIds]  = useState([]);
  const [bulkSaving,   setBulkSaving]   = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef                   = useRef();
  const navigate                       = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const p = await programsAPI.getAll();
      setRows(p.data.data);
    } catch {
      toast.error('Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    window.localStorage.setItem(PROGRAM_FILTER_STORAGE_KEY, JSON.stringify({ search, filters }));
  }, [search, filters]);

  const filterOptions = {
    categories: uniqueOptions(rows.map(row => ({ value: idOf(row.category), label: row.category?.title || '' }))),
    locations: uniqueOptions(rows.map(row => ({ value: idOf(row.location), label: row.location?.city || row.location?.title || '' }))),
    ageGroups: uniqueOptions(rows.flatMap(row => (row.ageGroups || []).map(age => ({ value: age, label: age })))),
    levels: uniqueOptions(rows.flatMap(row => (row.skillLevels || []).map(level => ({ value: level, label: level })))),
    status: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  };

  const setFilterValue = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setSearch('');
    setFilters(DEFAULT_PROGRAM_FILTERS);
    setOpenFilter('');
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

  // ── Excel Upload handler ──────────────────────────────────────────────────
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';          // reset so same file can be re-selected
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setUploading(true);
    setUploadStatus('Reading Excel file...');
    try {
      const programs = await parseAndUpload(file, setUploadStatus);
      setUploadStatus(`Uploading ${programs.length} programs to server...`);
      const res = await programsAPI.bulkCreate({ programs });
      const { created = 0, errors = [] } = res.data;
      if (errors.length > 0) {
        toast.error(`${created} created, ${errors.length} failed. Check console for details.`);
        console.error('Bulk upload errors:', errors);
      } else {
        toast.success(`✅ ${created} program${created !== 1 ? 's' : ''} created successfully!`);
      }
      load();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed';
      toast.error(msg);
      console.error('Excel upload error:', err);
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };

  const filtered = rows.filter(r => {
    const q = search.trim().toLowerCase();
    const searchable = [
      r.title,
      r.sku,
      r.category?.title,
      r.location?.city,
      r.location?.title,
      ...(r.ageGroups || []),
      ...(r.skillLevels || []),
    ].filter(Boolean).join(' ').toLowerCase();

    if (q && !searchable.includes(q)) return false;
    if (!hasAny(filters.categories, [idOf(r.category)])) return false;
    if (!hasAny(filters.locations, [idOf(r.location)])) return false;
    if (!hasAny(filters.ageGroups, r.ageGroups || [])) return false;
    if (!hasAny(filters.levels, r.skillLevels || [])) return false;
    if (!hasAny(filters.status, [r.isActive ? 'active' : 'inactive'])) return false;
    return true;
  });

  const filteredIds = filtered.map(row => row._id);
  const selectedFilteredIds = filteredIds.filter(id => selectedIds.includes(id));
  const allFilteredSelected = filteredIds.length > 0 && selectedFilteredIds.length === filteredIds.length;

  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleSelectFiltered = () => {
    setSelectedIds(prev => {
      if (allFilteredSelected) return prev.filter(id => !filteredIds.includes(id));
      return [...new Set([...prev, ...filteredIds])];
    });
  };

  const handleBulkStatus = async (isActive) => {
    if (!selectedIds.length) {
      toast.error('Select at least one program');
      return;
    }
    const action = isActive ? 'activate' : 'deactivate';
    if (!window.confirm(`${action[0].toUpperCase() + action.slice(1)} ${selectedIds.length} selected program${selectedIds.length === 1 ? '' : 's'}?`)) return;

    setBulkSaving(true);
    try {
      if (isActive) {
        await Promise.all(selectedIds.map(id => programsAPI.update(id, { isActive: true })));
      } else {
        await Promise.all(selectedIds.map(id => programsAPI.remove(id)));
      }
      toast.success(`${selectedIds.length} program${selectedIds.length === 1 ? '' : 's'} ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedIds([]);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || `Bulk ${action} failed`);
    } finally {
      setBulkSaving(false);
    }
  };

  const columns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={allFilteredSelected}
          disabled={!filteredIds.length}
          onChange={toggleSelectFiltered}
          aria-label="Select all filtered programs"
        />
      ),
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row._id)}
          onChange={() => toggleSelection(row._id)}
          aria-label={`Select ${row.title}`}
        />
      ),
    },
    {
      key: 'coverImageUrl', label: 'Cover',
      render: v => v
        ? <img src={v} alt="cover" style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '4px' }} />
        : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '20px' }}>🖼️</span>,
    },
    { key: 'title',     label: 'Program Title' },
    { key: 'sku',       label: 'SKU',       render: v => <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#F5D97A' }}>{v}</span> },
    { key: 'category',  label: 'Category',  render: v => v?.title || '—' },
    { key: 'location',  label: 'Location',  render: v => v?.city  || '—' },
    { key: 'basePrice', label: 'Price',     render: v => `$${v}` },
    { key: 'ageGroups', label: 'Age Groups',render: v => (v || []).join(', ') || '—' },
    { key: 'isActive',  label: 'Status',    render: v => <Badge label={v ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'isFeatured',label: 'Featured',  render: v => v ? '⭐' : '—' },
    {
      key: '_id', label: 'Actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn small onClick={() => navigate(`/admin/programs/${row._id}/edit`)}>Edit</Btn>
          {row.isActive && (
            <Btn small variant="danger" onClick={() => handleDeactivate(row)}>Deactivate</Btn>
          )}
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
        action={<Btn onClick={() => navigate('/admin/programs/new')}>+ New Program</Btn>}
      />

      {/* ── Search + Excel buttons row ── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or SKU..."
          style={{ flex: 1, minWidth: '220px' }}
        />
        <MultiSelectFilter
          id="program-category-filter"
          label="Categories"
          selected={filters.categories}
          onChange={value => setFilterValue('categories', value)}
          open={openFilter === 'program-category-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={filterOptions.categories}
          width="190px"
        />
        <MultiSelectFilter
          id="program-location-filter"
          label="Locations"
          selected={filters.locations}
          onChange={value => setFilterValue('locations', value)}
          open={openFilter === 'program-location-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={filterOptions.locations}
          width="190px"
        />
        <MultiSelectFilter
          id="program-age-filter"
          label="Age Groups"
          selected={filters.ageGroups}
          onChange={value => setFilterValue('ageGroups', value)}
          open={openFilter === 'program-age-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={filterOptions.ageGroups}
          width="180px"
        />
        <MultiSelectFilter
          id="program-level-filter"
          label="Levels"
          selected={filters.levels}
          onChange={value => setFilterValue('levels', value)}
          open={openFilter === 'program-level-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={filterOptions.levels}
          width="190px"
        />
        <MultiSelectFilter
          id="program-status-filter"
          label="Status"
          selected={filters.status}
          onChange={value => setFilterValue('status', value)}
          open={openFilter === 'program-status-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={filterOptions.status}
          width="150px"
        />
        <Btn variant="ghost" onClick={clearFilters}>Clear Filters</Btn>

        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 10px', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '8px', background: 'rgba(212,175,55,0.08)' }}>
            <span style={{ color: '#F5D97A', fontSize: '12px', fontWeight: 700 }}>{selectedIds.length} selected</span>
            <Btn small variant="success" onClick={() => handleBulkStatus(true)} disabled={bulkSaving}>
              Activate
            </Btn>
            <Btn small variant="danger" onClick={() => handleBulkStatus(false)} disabled={bulkSaving}>
              Deactivate
            </Btn>
          </div>
        )}

        {/* Download Template */}
        <Btn
          variant="ghost"
          onClick={async () => {
            try {
              await downloadTemplate();
              toast.success('Template downloaded!');
            } catch (err) {
              toast.error('Failed to download template');
              console.error(err);
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.35)',
            color: '#F5D97A', fontSize: '13px', fontWeight: '600',
            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          ⬇ Download Excel Template
        </Btn>

        {/* Upload Excel — hidden file input + visible button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleExcelUpload}
        />
        <Btn
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: uploading ? 'rgba(60,120,60,0.3)' : 'rgba(60,160,60,0.15)',
            border: '1px solid rgba(60,180,60,0.5)',
            color: '#86efac', fontSize: '13px', fontWeight: '600',
            padding: '8px 16px', borderRadius: '8px', cursor: uploading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {uploading ? '⏳ Uploading...' : '⬆ Upload Excel'}
        </Btn>
      </div>

      {/* Upload progress message */}
      {uploadStatus && (
        <div style={{
          marginBottom: '16px', padding: '10px 16px',
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.25)',
          borderRadius: '8px', color: '#F5D97A', fontSize: '13px',
        }}>
          ⏳ {uploadStatus}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        emptyMsg="No programs found. Create one!"
      />
    </div>
  );
}
