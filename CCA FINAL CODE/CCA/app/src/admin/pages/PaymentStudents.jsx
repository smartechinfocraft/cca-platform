// ============================================================
//  pages/PaymentStudents.jsx
// ============================================================
import React, { useEffect, useState } from 'react';
import { registrationsAPI, locationsAPI, programsAPI, categoriesAPI } from '../api/client';
import { PageHeader, DataTable, Badge, Select, SearchInput, Btn } from '../components/common/UI';
import toast from 'react-hot-toast';

const ACADEMY_NAME = 'California Cricket Academy';

// ── PDF table builder (no jspdf-autotable, pure jsPDF) ──────
function drawTable(doc, headers, rows, startY) {
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL    = 20;
  const marginR    = 20;
  const tableWidth = pageWidth - marginL - marginR;
  const colW       = tableWidth / headers.length;
  const rowH       = 14;
  const headerH    = 16;

  let y = startY;

  const checkPage = (needed) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 20;
      // Redraw header on new page
      doc.setFillColor('#1F2E1E');
      doc.rect(marginL, y, tableWidth, headerH, 'F');
      doc.setTextColor('#C9A227');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      headers.forEach((h, i) => {
        doc.text(String(h), marginL + i * colW + 3, y + 11);
      });
      y += headerH;
    }
  };

  // Draw header
  doc.setFillColor('#1F2E1E');
  doc.rect(marginL, y, tableWidth, headerH, 'F');
  doc.setTextColor('#C9A227');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  headers.forEach((h, i) => {
    doc.text(String(h), marginL + i * colW + 3, y + 11);
  });
  y += headerH;

  // Draw rows
  doc.setFont('helvetica', 'normal');
  rows.forEach((row, rowIdx) => {
    checkPage(rowH);
    if (rowIdx % 2 === 0) {
      doc.setFillColor('#F5F5F0');
      doc.rect(marginL, y, tableWidth, rowH, 'F');
    }
    doc.setTextColor('#222222');
    doc.setFontSize(6.5);
    row.forEach((cell, i) => {
      const text = String(cell ?? '—');
      // Truncate if too long
      const maxChars = Math.floor(colW / 3.2);
      const display  = text.length > maxChars ? text.slice(0, maxChars) + '…' : text;
      doc.text(display, marginL + i * colW + 3, y + 9);
    });
    // Row border
    doc.setDrawColor('#DDDDDD');
    doc.line(marginL, y + rowH, marginL + tableWidth, y + rowH);
    y += rowH;
  });

  return y;
}

export default function PaymentStudents() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch]             = useState('');
  const [filterMethod, setFilterMethod] = useState('');
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
      const [checkRes, paypalRes] = await Promise.all([
        registrationsAPI.getAll({ paymentMethod: 'CHECK',  limit: 500 }),
        registrationsAPI.getAll({ paymentMethod: 'PAYPAL', limit: 500 }),
      ]);
      const combined = [
        ...(checkRes.data.data  || []),
        ...(paypalRes.data.data || []),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRows(combined);
    } catch {
      toast.error('Failed to load payment records');
    } finally {
      setLoading(false);
    }
  };

  // ── Client-side filters ─────────────────────────────────────
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
        b.title?.toLowerCase().includes(filterBatch.toLowerCase())
      );
      if (!hasBatch) return false;
    }

    if (filterAgeUnder) {
      const maxAge  = parseInt(filterAgeUnder);
      const hasMatch = (r.students || []).some(s => {
        if (!s.dob) return false;
        const age = Math.floor((Date.now() - new Date(s.dob)) / (365.25 * 24 * 60 * 60 * 1000));
        return age < maxAge;
      });
      if (!hasMatch) return false;
    }

    if (search) {
      const q = search.toLowerCase();
      const parentName   = `${r.parentId?.firstName} ${r.parentId?.lastName}`.toLowerCase();
      const studentNames = (r.students || [])
        .map(s => `${s.firstName} ${s.lastName}`.toLowerCase()).join(' ');
      if (
        !r.registrationNumber?.toLowerCase().includes(q) &&
        !parentName.includes(q) &&
        !r.parentId?.email?.toLowerCase().includes(q) &&
        !studentNames.includes(q) &&
        !r.programId?.title?.toLowerCase().includes(q)
      ) return false;
    }

    return true;
  });

  // ── PDF Download (pure jsPDF, no autoTable) ─────────────────
  const downloadPDF = async () => {
    if (filtered.length === 0) {
      toast.error('No records to download');
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header bar
      doc.setFillColor('#1F2E1E');
      doc.rect(0, 0, pageWidth, 70, 'F');
      doc.setFillColor('#C9A227');
      doc.rect(0, 70, pageWidth, 3, 'F');

      doc.setTextColor('#FFFFFF');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(ACADEMY_NAME, 40, 30);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Payment Students Report', 40, 50);

      // Active filters summary
      const filterParts = [];
      if (filterMethod)   filterParts.push(`Method: ${filterMethod}`);
      if (filterProgram)  filterParts.push(`Program: ${programs.find(p => p._id === filterProgram)?.title || filterProgram}`);
      if (filterLocation) filterParts.push(`Location: ${locations.find(l => l._id === filterLocation)?.title || filterLocation}`);
      if (filterAgeUnder) filterParts.push(`Under ${filterAgeUnder} yrs`);
      if (filterBatch)    filterParts.push(`Batch: ${filterBatch}`);
      if (search)         filterParts.push(`Search: "${search}"`);

      doc.setTextColor('#C9A227');
      doc.setFontSize(9);
      doc.text(
        filterParts.length ? `Filters: ${filterParts.join('  |  ')}` : 'Filters: None (all records)',
        40, 62
      );

      doc.setTextColor('#888888');
      doc.setFontSize(8);
      doc.text(
        `Generated: ${new Date().toLocaleString()}  |  Total: ${filtered.length} records`,
        pageWidth - 40, 62, { align: 'right' }
      );

      // Build table rows — one row per student
      const tableHeaders = [
        'Reg #', 'Stu ID', 'Student Name', 'DOB/Age', 'Gender',
        'Parent', 'Email', 'Program', 'Batch(es)', 'Location',
        'Amount', 'Method', 'Txn/Check#', 'Status', 'Date',
      ];

      const tableRows = [];
      filtered.forEach(r => {
        const students = r.students?.length ? r.students : [{}];
        students.forEach(s => {
          const age = s.dob
            ? Math.floor((Date.now() - new Date(s.dob)) / (365.25 * 24 * 60 * 60 * 1000))
            : '—';
          const dobStr = s.dob ? `${new Date(s.dob).toLocaleDateString()} (${age}y)` : '—';
          const batchTitles = (r.batches || [])
            .map(b => b.title || `${b.dayOfWeek} ${b.startTime}`).join(', ') || '—';
          const locationTitles = [...new Set(
            (r.batches || []).map(b => b.location?.title || '—')
          )].join(', ');

          tableRows.push([
            r.registrationNumber || '—',
            s.studentCode || '—',
            s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : '—',
            dobStr,
            s.gender || '—',
            `${r.parentId?.firstName || ''} ${r.parentId?.lastName || ''}`.trim() || '—',
            r.parentId?.email || '—',
            r.programId?.title || '—',
            batchTitles,
            locationTitles,
            `$${(r.totalAmount || 0).toLocaleString()}`,
            r.paymentMethod || '—',
            r.checkNumber || r.transactionId || '—',
            r.status || '—',
            new Date(r.createdAt).toLocaleDateString(),
          ]);
        });
      });

      drawTable(doc, tableHeaders, tableRows, 85);

      // Page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#aaaaaa');
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth - 40,
          doc.internal.pageSize.getHeight() - 15,
          { align: 'right' }
        );
      }

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

  // ── Table columns (unique keys) ─────────────────────────────
  const columns = [
    { key: 'registrationNumber', label: 'Reg #' },
    {
      key: 'studentNames', label: 'Student(s)',
      render: (_, row) =>
        (row.students || []).map(s => `${s.firstName} ${s.lastName}`).join(', ') || '—',
    },
    {
      key: 'studentIds', label: 'Student ID(s)',
      render: (_, row) => (row.students || []).map(s => s.studentCode || '—').join(', ') || '—',
    },
    {
      key: 'studentDob', label: 'DOB / Age',
      render: (_, row) =>
        (row.students || []).map(s => {
          if (!s.dob) return '—';
          const age = Math.floor((Date.now() - new Date(s.dob)) / (365.25 * 24 * 60 * 60 * 1000));
          return `${new Date(s.dob).toLocaleDateString()} (${age}y)`;
        }).join(', ') || '—',
    },
    {
      key: 'studentGender', label: 'Gender',
      render: (_, row) => (row.students || []).map(s => s.gender || '—').join(', ') || '—',
    },
    {
      key: 'parentName', label: 'Parent',
      render: (_, row) => row.parentId ? `${row.parentId.firstName} ${row.parentId.lastName}` : '—',
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
      render: (_, row) =>
        (row.batches || []).map(b => b.title || `${b.dayOfWeek} ${b.startTime}`).join(', ') || '—',
    },
    {
      key: 'batchLocation', label: 'Location',
      render: (_, row) =>
        [...new Set((row.batches || []).map(b => b.location?.title || '—'))].join(', '),
    },
    { key: 'totalAmount',   label: 'Amount',   render: (_, row) => `$${(row.totalAmount || 0).toLocaleString()}` },
    { key: 'paymentMethod', label: 'Method',   render: (_, row) => <Badge label={row.paymentMethod} /> },
    { key: 'checkNumber',   label: 'Check #',  render: (_, row) => row.checkNumber || '—' },
    { key: 'transactionId', label: 'Txn ID',   render: (_, row) => row.transactionId || '—' },
    { key: 'status',        label: 'Status',   render: (_, row) => <Badge label={row.status} /> },
    { key: 'createdAt',     label: 'Date',     render: (_, row) => new Date(row.createdAt).toLocaleDateString() },
  ];

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader
        title="Payment Students"
        subtitle="Students who registered via Check or PayPal"
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
        emptyMsg="No records found. Try changing filters or check if registrations exist with paymentMethod=CHECK or PAYPAL."
      />
    </div>
  );
}