// ============================================================
//  pages/PaymentStudents.jsx
// ============================================================
import React, { useEffect, useState } from 'react';
import { registrationsAPI, locationsAPI, programsAPI, categoriesAPI } from '../api/client';
import { PageHeader, DataTable, Badge, Select, SearchInput, Btn } from '../components/common/UI';
import toast from 'react-hot-toast';

const ACADEMY_NAME = 'California Cricket Academy';

// ── Helpers ─────────────────────────────────────────────────

/** Format "HH:mm" → "5:00 PM" */
function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const DAY_FULL = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday',
  THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

/** Build full batch label: "Tuesday/Thursday 5:00 PM–6:30 PM | Foster City | Jun–Aug 2026" */
function batchLabel(b) {
  if (!b) return '—';
  let dayStr = '';
  if (b.dayOfWeek === 'MULTI' && b.multiDays?.length) {
    dayStr = b.multiDays.map(d => DAY_FULL[d] || d).join('/');
  } else if (b.dayOfWeek && b.dayOfWeek !== 'MULTI') {
    dayStr = DAY_FULL[b.dayOfWeek] || b.dayOfWeek;
  }
  const timeStr = b.startTime && b.endTime
    ? `${fmt12(b.startTime)}–${fmt12(b.endTime)}`
    : b.startTime ? fmt12(b.startTime) : '';
  const locStr   = b.location?.title || '';
  const monthStr = b.monthOptions?.length
    ? b.monthOptions.map(m => m.label).join(' / ')
    : '';
  const line1 = b.title || [dayStr, timeStr].filter(Boolean).join(' ');
  return [line1, locStr, monthStr].filter(Boolean).join(' | ') || '—';
}

/**
 * Parse students from customerNote fallback.
 * Format: "John Smith | DOB: 2018-05-10 | Gender: Male; Jane Smith | DOB: N/A | Gender: Female"
 */
function parseStudentsFromNote(note) {
  if (!note) return [];
  return note.split(';').map(part => {
    const segments = part.trim().split('|').map(s => s.trim());
    const fullName = segments[0] || '';
    const [firstName, ...rest] = fullName.split(' ');
    const lastName = rest.join(' ');
    const dobPart = segments.find(s => s.startsWith('DOB:'));
    const genderPart = segments.find(s => s.startsWith('Gender:'));
    const dob = dobPart ? dobPart.replace('DOB:', '').trim() : '';
    const gender = genderPart ? genderPart.replace('Gender:', '').trim() : '';
    return {
      firstName: firstName || '',
      lastName:  lastName  || '',
      dob:       dob === 'N/A' ? '' : dob,
      gender:    gender === 'N/A' ? '' : gender,
      studentCode: '',
    };
  }).filter(s => s.firstName);
}

/** Resolve students — prefer embedded array, fall back to customerNote */
function resolveStudents(row) {
  const embedded = (row.students || []).filter(s => s.firstName || s.lastName);
  if (embedded.length > 0) return embedded;
  return parseStudentsFromNote(row.customerNote);
}

/** Safe student name */
function studentName(s) {
  if (!s) return '—';
  return (`${s.firstName || ''} ${s.lastName || ''}`).trim() || '—';
}

/** Student age from dob string or Date */
function studentAge(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d) / (365.25 * 24 * 60 * 60 * 1000));
}

// ── Professional PDF builder ─────────────────────────────────
async function buildPDF(filtered, { filterMethod, filterProgram, filterLocation, filterBatch, filterAgeUnder, search, programs, locations }) {
  const { jsPDF } = await import('jspdf');

  const DARK   = '#1A2E1A';
  const GOLD   = '#C9A227';
  const WHITE  = '#FFFFFF';
  const LIGHT  = '#F7F5EE';
  const BORDER = '#D4C89A';
  const TEXT   = '#1A1A1A';
  const MUTED  = '#666666';
  const GREEN  = '#1A6B1A';
  const AMBER  = '#8B6914';
  const RED    = '#8B1A1A';

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const PW  = doc.internal.pageSize.getWidth();
  const PH  = doc.internal.pageSize.getHeight();
  const ML  = 24;
  const MR  = 24;
  const MB  = 28;
  const TW  = PW - ML - MR;

  // ── Column definitions (widths sum to TW = 793.89) ──────────
  const COLS = [
    { key: 'reg',     label: 'Reg #',        w: 72  },
    { key: 'student', label: 'Student Name',  w: 88  },
    { key: 'stuId',   label: 'Student ID',    w: 70  },
    { key: 'dob',     label: 'DOB / Age',     w: 68  },
    { key: 'gender',  label: 'Gender',        w: 44  },
    { key: 'parent',  label: 'Parent',        w: 82  },
    { key: 'email',   label: 'Email',         w: 110 },
    { key: 'program', label: 'Program',       w: 90  },
    { key: 'batch',   label: 'Batch / Schedule', w: 115 },
    { key: 'amount',  label: 'Amount',        w: 50  },
    { key: 'method',  label: 'Method',        w: 44  },
    { key: 'txn',     label: 'Check/Txn',     w: 58  },
    { key: 'status',  label: 'Status',        w: 46  },
    { key: 'date',    label: 'Date',          w: 50  },
  ];

  // Auto-adjust last column so widths sum to TW exactly
  const sumW = COLS.reduce((a, c) => a + c.w, 0);
  COLS[COLS.length - 1].w += (TW - sumW);

  let y       = 0;
  let pageNum = 1;

  // ── Page header ──────────────────────────────────────────────
  const drawPageHeader = () => {
    // Dark banner
    doc.setFillColor(DARK);
    doc.rect(0, 0, PW, 54, 'F');
    // Gold accent line
    doc.setFillColor(GOLD);
    doc.rect(0, 54, PW, 2.5, 'F');

    // CCA badge
    doc.setFillColor(GOLD);
    doc.roundedRect(ML, 10, 34, 34, 4, 4, 'F');
    doc.setTextColor(DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CCA', ML + 17, 31, { align: 'center' });

    // Title
    doc.setTextColor(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(ACADEMY_NAME, ML + 44, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Payment Students Report', ML + 44, 40);

    // Right side
    doc.setTextColor(GOLD);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`Page ${pageNum}`, PW - MR, 26, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#AAAAAA');
    doc.setFontSize(7);
    doc.text(`Generated: ${new Date().toLocaleString()}`, PW - MR, 40, { align: 'right' });

    y = 66;

    // Filter summary bar (page 1 only)
    if (pageNum === 1) {
      const fp = [];
      if (filterMethod)   fp.push(`Method: ${filterMethod}`);
      if (filterProgram)  fp.push(`Program: ${programs.find(p => p._id === filterProgram)?.title || filterProgram}`);
      if (filterLocation) fp.push(`Location: ${locations.find(l => l._id === filterLocation)?.title || filterLocation}`);
      if (filterAgeUnder) fp.push(`Age: Under ${filterAgeUnder}`);
      if (filterBatch)    fp.push(`Batch: "${filterBatch}"`);
      if (search)         fp.push(`Search: "${search}"`);
      const filterLine = fp.length ? `Filters: ${fp.join('  ·  ')}` : 'Filters: None (all records)';

      doc.setFillColor('#EDE9D8');
      doc.roundedRect(ML, y, TW, 17, 2, 2, 'F');
      doc.setDrawColor(GOLD);
      doc.setLineWidth(0.5);
      doc.roundedRect(ML, y, TW, 17, 2, 2, 'S');

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor('#444444');
      doc.text(filterLine, ML + 6, y + 11);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(AMBER);
      doc.setFontSize(7);
      doc.text(`Total: ${filtered.length} records`, PW - MR - 4, y + 11, { align: 'right' });

      y += 21;
    }
  };

  // ── Table header row ─────────────────────────────────────────
  const drawTableHeader = () => {
    doc.setFillColor(DARK);
    doc.rect(ML, y, TW, 16, 'F');
    doc.setTextColor(GOLD);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    let x = ML;
    COLS.forEach(col => {
      doc.text(col.label, x + 3, y + 11);
      x += col.w;
    });
    y += 16;
    // Thin gold separator
    doc.setFillColor(GOLD);
    doc.rect(ML, y, TW, 0.75, 'F');
    y += 0.75;
  };

  // ── Add new page ─────────────────────────────────────────────
  const addPage = () => {
    doc.addPage();
    pageNum++;
    drawPageHeader();
    drawTableHeader();
  };

  // ── Wrap text to fit column ──────────────────────────────────
  const wrap = (text, colW) => doc.splitTextToSize(String(text ?? '—'), colW - 6);

  // ── Build all table data rows ────────────────────────────────
  const tableData = [];

  filtered.forEach(r => {
    // Resolve students from embedded array OR customerNote fallback
    const students = resolveStudents(r);
    const displayStudents = students.length ? students : [{}];

    const batches = r.batches || [];
    const batchText = batches.length
      ? batches.map(b => batchLabel(b)).join('\n')
      : '—';

    const parentName = r.parentId
      ? `${r.parentId.firstName || ''} ${r.parentId.lastName || ''}`.trim() || '—'
      : '—';

    displayStudents.forEach(s => {
      const name = studentName(s);
      const dob = s.dob ? new Date(s.dob).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '—';
      const age = s.dob ? studentAge(s.dob) : null;
      const dobAge = s.dob ? `${dob}${age !== null ? `\n(${age} yrs)` : ''}` : '—';

      tableData.push({
        cells: [
          r.registrationNumber || '—',
          name,
          s.studentCode || '—',
          dobAge,
          s.gender || '—',
          parentName,
          r.parentId?.email || '—',
          r.programId?.title || '—',
          batchText,
          `$${(r.totalAmount || 0).toLocaleString()}`,
          r.paymentMethod || '—',
          r.checkNumber || r.transactionId || '—',
          r.status || '—',
          new Date(r.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }),
        ],
        reg: r,
      });
    });
  });

  // ── Render ───────────────────────────────────────────────────
  drawPageHeader();
  drawTableHeader();

  tableData.forEach(({ cells, reg }, rowIdx) => {
    // Pre-calculate all line arrays to know row height
    doc.setFontSize(6.5);
    const lineSets = cells.map((cell, ci) => wrap(cell, COLS[ci].w));
    const maxLines = Math.max(...lineSets.map(ls => ls.length));
    const ROW_H    = Math.max(15, maxLines * 8 + 5);

    if (y + ROW_H > PH - MB - 12) addPage();

    // Alternating row background
    if (rowIdx % 2 === 0) {
      doc.setFillColor(LIGHT);
      doc.rect(ML, y, TW, ROW_H, 'F');
    }

    // Render each cell
    let x = ML;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);

    lineSets.forEach((lines, ci) => {
      const col = COLS[ci];

      // Per-column styling
      switch (col.key) {
        case 'amount':
          doc.setTextColor(GREEN);
          doc.setFont('helvetica', 'bold');
          break;
        case 'method':
          doc.setTextColor(reg.paymentMethod === 'CHECK' ? AMBER : '#1A5080');
          doc.setFont('helvetica', 'bold');
          break;
        case 'status': {
          const s = String(cells[ci]).toUpperCase();
          doc.setTextColor(
            s === 'CONFIRMED' || s === 'PAID' ? GREEN :
            s === 'CANCELLED' || s === 'REFUNDED' ? RED : AMBER
          );
          doc.setFont('helvetica', 'bold');
          break;
        }
        case 'reg':
          doc.setTextColor('#1A3A6A');
          doc.setFont('helvetica', 'bold');
          break;
        case 'student':
          doc.setTextColor(TEXT);
          doc.setFont('helvetica', 'bold');
          break;
        default:
          doc.setTextColor(TEXT);
          doc.setFont('helvetica', 'normal');
      }

      lines.forEach((line, li) => {
        doc.text(line, x + 3, y + 9 + li * 8);
      });

      // Vertical column separator
      doc.setDrawColor('#E8E0C8');
      doc.setLineWidth(0.3);
      doc.line(x + col.w, y, x + col.w, y + ROW_H);

      x += col.w;
    });

    // Horizontal row border
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.3);
    doc.line(ML, y + ROW_H, ML + TW, y + ROW_H);

    y += ROW_H;
  });

  // ── Summary footer ───────────────────────────────────────────
  if (y + 36 > PH - MB) { doc.addPage(); pageNum++; drawPageHeader(); }
  y += 8;

  doc.setFillColor(DARK);
  doc.roundedRect(ML, y, TW, 26, 3, 3, 'F');
  doc.setFillColor(GOLD);
  doc.rect(ML, y, 4, 26, 'F');

  const totalAmt = filtered.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  doc.setTextColor(WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Total Records: ${filtered.length}`, ML + 14, y + 17);

  doc.setTextColor(GOLD);
  doc.setFontSize(9);
  doc.text(`Total Amount: $${totalAmt.toLocaleString()}`, PW - MR - 8, y + 17, { align: 'right' });

  // Page numbers on all pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor('#AAAAAA');
    doc.text(
      `Page ${i} of ${pageCount}`,
      PW - MR,
      PH - 10,
      { align: 'right' }
    );
  }

  return doc;
}

// ── Main Component ───────────────────────────────────────────
export default function PaymentStudents() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch]                 = useState('');
  const [filterMethod, setFilterMethod]     = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterProgram, setFilterProgram]   = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAgeUnder, setFilterAgeUnder] = useState('');
  const [filterBatch, setFilterBatch]       = useState('');

  const [locations, setLocations]   = useState([]);
  const [programs, setPrograms]     = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    locationsAPI.getAll().then(r => setLocations(r.data.data || [])).catch(() => {});
    programsAPI.getAll().then(r => setPrograms(r.data.data || [])).catch(() => {});
    categoriesAPI.getAll().then(r => setCategories(r.data.data || [])).catch(() => {});
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [checkRes, paypalRes, stripeRes] = await Promise.all([
        registrationsAPI.getAll({ paymentMethod: 'CHECK',  limit: 500 }),
        registrationsAPI.getAll({ paymentMethod: 'PAYPAL', limit: 500 }),
        registrationsAPI.getAll({ paymentMethod: 'STRIPE', limit: 500 }),
      ]);
      const combined = [
        ...(checkRes.data.data  || []),
        ...(paypalRes.data.data || []),
        ...(stripeRes.data.data || []),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRows(combined);
    } catch {
      toast.error('Failed to load payment records');
    } finally {
      setLoading(false);
    }
  };

  // ── Client-side filters ──────────────────────────────────────
  const filtered = rows.filter(r => {
    if (filterMethod  && r.paymentMethod !== filterMethod) return false;
    if (filterProgram && r.programId?._id !== filterProgram) return false;

    if (filterLocation) {
      const hasLoc = (r.batches || []).some(b =>
        (b.location?._id || b.location) === filterLocation
      );
      if (!hasLoc) return false;
    }

    if (filterBatch) {
      const hasBatch = (r.batches || []).some(b =>
        batchLabel(b).toLowerCase().includes(filterBatch.toLowerCase())
      );
      if (!hasBatch) return false;
    }

    if (filterAgeUnder) {
      const maxAge = parseInt(filterAgeUnder);
      const students = resolveStudents(r);
      const hasMatch = students.some(s => {
        const age = studentAge(s.dob);
        return age !== null && age < maxAge;
      });
      if (!hasMatch) return false;
    }

    if (search) {
      const q = search.toLowerCase();
      const parentName   = `${r.parentId?.firstName || ''} ${r.parentId?.lastName || ''}`.toLowerCase();
      const students     = resolveStudents(r);
      const studentNames = students.map(s => studentName(s).toLowerCase()).join(' ');
      if (
        !r.registrationNumber?.toLowerCase().includes(q) &&
        !parentName.includes(q) &&
        !r.parentId?.email?.toLowerCase().includes(q) &&
        !studentNames.includes(q) &&
        !r.programId?.title?.toLowerCase().includes(q) &&
        !(r.customerNote || '').toLowerCase().includes(q)
      ) return false;
    }

    return true;
  });

  // ── PDF Download ─────────────────────────────────────────────
  const downloadPDF = async () => {
    if (filtered.length === 0) {
      toast.error('No records to download');
      return;
    }
    try {
      const doc = await buildPDF(filtered, {
        filterMethod, filterProgram, filterLocation,
        filterBatch, filterAgeUnder, search,
        programs, locations,
      });
      const programLabel = filterProgram
        ? (programs.find(p => p._id === filterProgram)?.title || 'program').replace(/\s+/g, '_')
        : 'all-programs';
      const methodLabel = filterMethod ? filterMethod.toLowerCase() : 'all-methods';
      doc.save(`CCA_Payment_Students_${programLabel}_${methodLabel}_${Date.now()}.pdf`);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('PDF generation failed: ' + err.message);
    }
  };

  // ── Table columns ────────────────────────────────────────────
  const columns = [
    { key: 'registrationNumber', label: 'Reg #' },
    {
      key: 'studentNames', label: 'Student(s)',
      render: (_, row) => {
        const students = resolveStudents(row);
        const names = students.map(s => studentName(s)).filter(n => n !== '—');
        return names.length ? names.join(', ') : '—';
      },
    },
    {
      key: 'studentIds', label: 'Student ID(s)',
      render: (_, row) => {
        const students = resolveStudents(row);
        return students.map(s => s.studentCode || '—').join(', ') || '—';
      },
    },
    {
      key: 'studentDob', label: 'DOB / Age',
      render: (_, row) => {
        const students = resolveStudents(row);
        return students.map(s => {
          if (!s.dob) return '—';
          const age = studentAge(s.dob);
          return `${new Date(s.dob).toLocaleDateString()} ${age !== null ? `(${age}y)` : ''}`;
        }).join(', ') || '—';
      },
    },
    {
      key: 'studentGender', label: 'Gender',
      render: (_, row) => {
        const students = resolveStudents(row);
        return students.map(s => s.gender || '—').join(', ') || '—';
      },
    },
    {
      key: 'parentName', label: 'Parent',
      render: (_, row) => row.parentId
        ? `${row.parentId.firstName || ''} ${row.parentId.lastName || ''}`.trim() || '—'
        : '—',
    },
    {
      key: 'parentEmail', label: 'Email',
      render: (_, row) => row.parentId?.email || '—',
    },
    {
      key: 'programTitle', label: 'Program',
      render: (_, row) => row.programId?.title || '—',
    },
    {
      key: 'batchTitles', label: 'Batch(es)',
      render: (_, row) => {
        const batches = row.batches || [];
        if (!batches.length) return '—';
        return (
          <div style={{ lineHeight: '1.5', fontSize: '12px' }}>
            {batches.map((b, i) => (
              <div key={i} style={{ marginBottom: i < batches.length - 1 ? 4 : 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {b.title || [
                    b.dayOfWeek === 'MULTI' && b.multiDays?.length
                      ? b.multiDays.map(d => d.charAt(0) + d.slice(1,3).toLowerCase()).join('/')
                      : DAY_FULL[b.dayOfWeek] || b.dayOfWeek || '',
                    b.startTime ? fmt12(b.startTime) : '',
                  ].filter(Boolean).join(' ')}
                </div>
                {b.location?.title && (
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>📍 {b.location.title}</div>
                )}
                {b.monthOptions?.length > 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                    📅 {b.monthOptions.map(m => m.label).join(' / ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'batchLocation', label: 'Location',
      render: (_, row) => {
        const locs = [...new Set((row.batches || []).map(b => b.location?.title || '').filter(Boolean))];
        return locs.length ? locs.join(', ') : '—';
      },
    },
    { key: 'totalAmount',   label: 'Amount',  render: (_, row) => `$${(row.totalAmount || 0).toLocaleString()}` },
    { key: 'paymentMethod', label: 'Method',  render: (_, row) => <Badge label={row.paymentMethod} /> },
    { key: 'checkNumber',   label: 'Check #', render: (_, row) => row.checkNumber || '—' },
    { key: 'transactionId', label: 'Txn ID',  render: (_, row) => row.transactionId || '—' },
    { key: 'status',        label: 'Status',  render: (_, row) => <Badge label={row.status} /> },
    { key: 'createdAt',     label: 'Date',    render: (_, row) => new Date(row.createdAt).toLocaleDateString() },
  ];

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader
        title="Payment Students"
        subtitle="Students who registered via Check, PayPal, or Stripe"
      />

      {/* ── Filter Bar ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, reg #..."
          style={{ width: '210px' }}
        />
        <Select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} style={{ width: '140px' }}>
          <option value="">All Methods</option>
          <option value="CHECK">Check</option>
          <option value="PAYPAL">PayPal</option>
          <option value="STRIPE">Stripe</option>
        </Select>
        <Select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={{ width: '160px' }}>
          <option value="">All Programs</option>
          {programs.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
        </Select>
        <Select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ width: '160px' }}>
          <option value="">All Locations</option>
          {locations.map(l => <option key={l._id} value={l._id}>{l.title}</option>)}
        </Select>
        <Select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: '150px' }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
        </Select>
        <Select value={filterAgeUnder} onChange={e => setFilterAgeUnder(e.target.value)} style={{ width: '130px' }}>
          <option value="">Any Age</option>
          <option value="8">Under 8</option>
          <option value="10">Under 10</option>
          <option value="12">Under 12</option>
          <option value="14">Under 14</option>
          <option value="16">Under 16</option>
          <option value="18">Under 18</option>
        </Select>
        <SearchInput
          value={filterBatch}
          onChange={e => setFilterBatch(e.target.value)}
          placeholder="Batch name..."
          style={{ width: '140px' }}
        />
        <Btn variant="ghost" onClick={load}>Refresh</Btn>
        <Btn
          onClick={downloadPDF}
          style={{ marginLeft: 'auto', background: '#C9A227', color: '#1F2E1E', fontWeight: 700 }}
        >
          ⬇ Download PDF
        </Btn>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
          {filtered.length} records
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        emptyMsg="No records found. Try changing filters or check if registrations exist with paymentMethod=CHECK, PAYPAL, or STRIPE."
      />
    </div>
  );
}
