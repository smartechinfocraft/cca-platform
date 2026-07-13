// ============================================================
//  pages/Registrations.jsx
//  Normal Admin: view, filter, update status, add notes
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import { registrationsAPI, batchesAPI, programsAPI } from '../api/client';
import { useAdminAuth } from '../context/AuthContext';
import { PageHeader, DataTable, Modal, Btn, Badge, FormField, Select, Textarea, SearchInput } from '../components/common/UI';
import toast from 'react-hot-toast';

const STATUSES = ['PENDING','AWAITING_PAYMENT','PAID','CONFIRMED','CANCELLED','REFUNDED','WAITLISTED'];

const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;
const ACADEMY_NAME = 'California Cricket Academy';

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

const splitScheduleItems = (value) =>
  String(value || '')
    .split(/\s*(?:\n|;|\s+\|\s+|,\s*(?=[A-Z][a-z]+day\b))\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

const text = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  return str || fallback;
};

const dateText = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleDateString();
};

const dateTimeText = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleString();
};

const fullName = (person) => text(`${person?.firstName || ''} ${person?.lastName || ''}`);

const parseStudentsFromNote = (note) => {
  if (!note) return [];
  return String(note).split(';').map(part => {
    const segments = part.trim().split('|').map(s => s.trim());
    const [firstName, ...lastParts] = (segments[0] || '').split(' ');
    const dobPart = segments.find(s => s.toLowerCase().startsWith('dob:'));
    const genderPart = segments.find(s => s.toLowerCase().startsWith('gender:'));
    return {
      firstName: firstName || '',
      lastName: lastParts.join(' '),
      dob: dobPart ? dobPart.replace(/dob:/i, '').trim().replace(/^N\/A$/i, '') : '',
      gender: genderPart ? genderPart.replace(/gender:/i, '').trim().replace(/^N\/A$/i, '') : '',
    };
  }).filter(s => s.firstName || s.lastName);
};

const topLevelStudents = (row) => {
  const embedded = (row.students || []).filter(s => s?.firstName || s?.lastName || s?.studentCode);
  return embedded.length ? embedded : parseStudentsFromNote(row.customerNote);
};

const batchLabel = (batch) => {
  if (!batch) return '';
  const day = batch.dayOfWeek === 'MULTI' && Array.isArray(batch.multiDays)
    ? batch.multiDays.join('/')
    : text(batch.dayOfWeek);
  const time = [batch.startTime, batch.endTime].filter(Boolean).join('-');
  const location = [batch.location?.title, batch.location?.city, batch.location?.address].filter(Boolean).join(', ');
  return [batch.title, day, time, location].filter(Boolean).join(' | ');
};

const scheduleText = (item) => splitScheduleItems(item?.selectedDays).join('; ');

const monthText = (item) => {
  const month = item?.selectedMonth || {};
  return text(item?.selectedMonthLabel || month.label);
};

const itemStudents = (row, item) => {
  const students = (item?.students || []).filter(s => s?.firstName || s?.lastName || s?.studentCode);
  return students.length ? students : topLevelStudents(row);
};

const idOf = (value) => typeof value === 'string' ? value : value?._id || '';

const valueList = (value) => Array.isArray(value) ? value.filter(Boolean).map(String) : [];

const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

const hasAny = (selected, values) => !selected.length || values.some(value => selected.includes(value));

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

const findProgramForRow = (row, programs = []) => {
  const programId = idOf(row.programId);
  return programs.find(program => idOf(program) === programId);
};

const findProgramById = (programId, programs = []) =>
  programs.find(program => idOf(program) === String(programId || ''));

const mergeProgramDetails = (rowProgram, catalogProgram) => {
  if (!rowProgram && !catalogProgram) return {};
  if (typeof rowProgram === 'string') return catalogProgram || { _id: rowProgram };
  return {
    ...(catalogProgram || {}),
    ...(rowProgram || {}),
    category: rowProgram?.category || catalogProgram?.category,
    location: rowProgram?.location || catalogProgram?.location,
    ageGroups: valueList(rowProgram?.ageGroups).length ? rowProgram.ageGroups : catalogProgram?.ageGroups,
    skillLevels: valueList(rowProgram?.skillLevels).length ? rowProgram.skillLevels : catalogProgram?.skillLevels,
  };
};

const tagRegistrationRow = (row, programs = []) => {
  const program = mergeProgramDetails(row.programId, findProgramForRow(row, programs));
  const orderPrograms = registrationOrderItems(row)
    .map(item => mergeProgramDetails(item.programId, findProgramById(item.programId, programs)))
    .filter(programItem => idOf(programItem) || programItem?.title);
  const allPrograms = [program, ...orderPrograms].filter(programItem => idOf(programItem) || programItem?.title);
  const programLocationIds = allPrograms.map(programItem => idOf(programItem.location)).filter(Boolean);
  const weeklyAgeGroups = (row.selectedWeeklyBatches || []).flatMap(batch => valueList(batch.ageGroups));
  const weeklyLevels = (row.selectedWeeklyBatches || []).flatMap(batch => valueList(batch.skillLevels));
  const categoryOptions = uniqueOptions(allPrograms.map(programItem => ({
    value: idOf(programItem.category),
    label: programItem.category?.title || '',
  })));
  const locationOptions = uniqueOptions(allPrograms.map(programItem => ({
    value: idOf(programItem.location),
    label: programItem.location?.city || programItem.location?.title || '',
  })));
  return {
    ...row,
    programId: program,
    _filterMeta: {
      categoryIds: categoryOptions.map(option => option.value),
      categoryTitle: categoryOptions.map(option => option.label).join(', '),
      locationIds: uniqueValues(programLocationIds),
      locationTitle: locationOptions.map(option => option.label).join(', '),
      categoryOptions,
      locationOptions,
      ageGroups: uniqueValues([...allPrograms.flatMap(programItem => valueList(programItem.ageGroups)), ...weeklyAgeGroups]),
      levels: uniqueValues([...allPrograms.flatMap(programItem => valueList(programItem.skillLevels)), ...weeklyLevels]),
    },
  };
};

const buildRegisteredProgramFilterOptions = (taggedRows) => ({
  categories: uniqueOptions(taggedRows.flatMap(row => row._filterMeta?.categoryOptions || [])),
  locations: uniqueOptions(taggedRows.flatMap(row => row._filterMeta?.locationOptions || [])),
  ageGroups: uniqueValues(taggedRows.flatMap(row => row._filterMeta?.ageGroups || []))
    .sort((a, b) => a.localeCompare(b))
    .map(value => ({ value, label: value })),
  levels: uniqueValues(taggedRows.flatMap(row => row._filterMeta?.levels || []))
    .sort((a, b) => a.localeCompare(b))
    .map(value => ({ value, label: value })),
});

const rowCategoryTitle = (row) => row._filterMeta?.categoryTitle || row.programId?.category?.title || '';

const rowLocationTitle = (row) => row._filterMeta?.locationTitle || row.programId?.location?.title || row.programId?.location?.city || '';

const rowAgeGroups = (row) => row._filterMeta?.ageGroups || valueList(row.programId?.ageGroups);

const rowLevels = (row) => row._filterMeta?.levels || valueList(row.programId?.skillLevels);

const rowLocationIds = (row) => row._filterMeta?.locationIds || [
  idOf(row.programId?.location),
  ...(row.batches || []).map(batch => idOf(batch.location)),
].filter(Boolean);

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

const registrationOrderItems = (row) => {
  if (Array.isArray(row.orderItems) && row.orderItems.length) return row.orderItems;
  return [{
    programTitle: row.programId?.title,
    selectedMonth: row.selectedMonth,
    selectedMonthLabel: row.selectedMonth?.label,
    selectedDays: (row.batches || []).map(batchLabel).filter(Boolean).join('; '),
    feePerStudent: row.students?.length ? Number(row.totalAmount || 0) / row.students.length : row.totalAmount,
    studentCount: row.students?.length || 1,
    itemTotal: row.totalAmount,
    students: topLevelStudents(row),
  }];
};

const SUMMARY_HEADERS = [
  'Registration #',
  'Date',
  'Status',
  'Payment Status',
  'Payment Method',
  'Check #',
  'Transaction ID',
  'Parent Name',
  'Parent Email',
  'Parent Phone',
  'Category',
  'Location',
  'Age Group(s)',
  'Level(s)',
  'Line Item #',
  'Program',
  'Batch',
  'Selected Month',
  'Schedule Days',
  'Sessions / Week',
  'Student Count',
  'Student Name(s)',
  'Fee Per Student',
  'Line Total',
  'Registration Subtotal',
  'Registration Discount',
  'Registration Total',
  'Coupon',
  'WhatsApp Opt In',
  'WhatsApp Joined',
  'Waiver Accepted',
  'Waiver Signature',
  'Waiver Accepted At',
  'Media Consent',
  'Medical Consent',
  'Customer Note',
  'Admin Note',
];

const SUMMARY_SCHEDULE_COL = SUMMARY_HEADERS.indexOf('Schedule Days');

const buildRegistrationExport = (rows) => {
  const summaryRows = [];
  const summaryMerges = [];
  const summaryGroupRows = [];

  rows.forEach((row, registrationIndex) => {
    registrationOrderItems(row).forEach((item, itemIndex) => {
      const students = itemStudents(row, item);
      const scheduleDays = splitScheduleItems(item.selectedDays);
      const displayScheduleDays = scheduleDays.length ? scheduleDays : [''];
      const base = {
        'Registration #': row.registrationNumber || '',
        'Date': dateText(row.createdAt),
        'Status': row.status || '',
        'Payment Status': row.paymentStatus || '',
        'Payment Method': row.paymentMethod || '',
        'Check #': row.checkNumber || '',
        'Transaction ID': row.transactionId || '',
        'Parent Name': fullName(row.parentId),
        'Parent Email': row.parentId?.email || '',
        'Parent Phone': row.parentId?.phone || '',
        'Category': rowCategoryTitle(row),
        'Location': rowLocationTitle(row),
        'Age Group(s)': rowAgeGroups(row).join(', '),
        'Level(s)': rowLevels(row).join(', '),
        'Line Item #': itemIndex + 1,
        'Program': item.programTitle || row.programId?.title || '',
        'Batch': item.batchName || '',
        'Selected Month': monthText(item),
        'Sessions / Week': item.sessionsPerWeek || '',
        'Student Count': Number(item.studentCount || students.length || 1),
        'Student Name(s)': students.map(fullName).filter(Boolean).join('; '),
        'Fee Per Student': Number(item.feePerStudent || 0),
        'Line Total': Number(item.itemTotal || 0),
        'Registration Subtotal': Number(row.subtotal || 0),
        'Registration Discount': Number(row.discountAmount || 0),
        'Registration Total': Number(row.totalAmount || 0),
        'Coupon': row.couponCode || '',
        'WhatsApp Opt In': row.whatsappOptIn ? 'Yes' : 'No',
        'WhatsApp Joined': row.isWhatsappJoined ? 'Yes' : 'No',
        'Waiver Accepted': row.waiverAccepted ? 'Yes' : 'No',
        'Waiver Signature': row.waiverSignature || '',
        'Waiver Accepted At': dateTimeText(row.waiverAcceptedAt),
        'Media Consent': row.mediaConsent ? 'Yes' : 'No',
        'Medical Consent': row.medicalConsent ? 'Yes' : 'No',
        'Customer Note': row.customerNote || '',
        'Admin Note': row.adminNote || '',
      };
      const startRow = summaryRows.length + 1; // +1 because header row is row 0

      displayScheduleDays.forEach(day => {
        summaryRows.push(SUMMARY_HEADERS.map(header => (header === 'Schedule Days' ? day : base[header])));
        summaryGroupRows.push(registrationIndex % 2);
      });

      const endRow = summaryRows.length;
      if (endRow > startRow) {
        SUMMARY_HEADERS.forEach((_, colIndex) => {
          if (colIndex !== SUMMARY_SCHEDULE_COL) {
            summaryMerges.push({ s: { r: startRow, c: colIndex }, e: { r: endRow, c: colIndex } });
          }
        });
      }
    });
  });

  const detailRows = [];
  rows.forEach(row => {
    registrationOrderItems(row).forEach((item, itemIndex) => {
      const students = itemStudents(row, item);
      const displayStudents = students.length ? students : [{}];
      displayStudents.forEach((student, studentIndex) => {
        detailRows.push({
          'Registration #': row.registrationNumber || '',
          'Registration Date': dateText(row.createdAt),
          'Status': row.status || '',
          'Payment Status': row.paymentStatus || '',
          'Payment Method': row.paymentMethod || '',
          'Check #': row.checkNumber || '',
          'Transaction ID': row.transactionId || '',
          'Parent Name': fullName(row.parentId),
          'Parent Email': row.parentId?.email || '',
          'Parent Phone': row.parentId?.phone || '',
          'Category': rowCategoryTitle(row),
          'Location': rowLocationTitle(row),
          'Age Group(s)': rowAgeGroups(row).join(', '),
          'Level(s)': rowLevels(row).join(', '),
          'Program': item.programTitle || row.programId?.title || '',
          'Line Item #': itemIndex + 1,
          'Batch': item.batchName || '',
          'Selected Month': monthText(item),
          'Schedule Days': scheduleText(item),
          'Sessions / Week': item.sessionsPerWeek || '',
          'Student #': studentIndex + 1,
          'Student Name': fullName(student),
          'Student ID': student.studentCode || '',
          'DOB': student.dob || '',
          'Gender': student.gender || '',
          'School': student.schoolName || '',
          'Medical Notes': student.medicalNotes || '',
          'Fee Per Student': Number(item.feePerStudent || 0),
          'Line Student Count': Number(item.studentCount || students.length || 1),
          'Line Total': Number(item.itemTotal || 0),
          'Registration Total': Number(row.totalAmount || 0),
          'Coupon': row.couponCode || '',
          'Admin Note': row.adminNote || '',
          'Customer Note': row.customerNote || '',
        });
      });
    });
  });

  return { summaryHeaders: SUMMARY_HEADERS, summaryRows, summaryMerges, summaryGroupRows, detailRows };
};

const buildPrintHtml = (rows) => {
  const cards = rows.map(row => {
    const items = registrationOrderItems(row);
    const itemHtml = items.map((item, index) => {
      const students = itemStudents(row, item);
      const studentRows = (students.length ? students : [{}]).map(student => `
        <tr>
          <td>${escapeHtml(fullName(student) || 'Student')}</td>
          <td>${escapeHtml(student.studentCode || '')}</td>
          <td>${escapeHtml(student.dob || '')}</td>
          <td>${escapeHtml(student.gender || '')}</td>
          <td>${escapeHtml(student.schoolName || '')}</td>
          <td>${escapeHtml(student.medicalNotes || '')}</td>
          <td class="right">${escapeHtml(money(item.feePerStudent))}</td>
        </tr>
      `).join('');
      return `
        <section class="item">
          <h3>${escapeHtml(index + 1)}. ${escapeHtml(item.programTitle || row.programId?.title || 'Program')}</h3>
          <div class="grid">
            <div><span>Batch</span>${escapeHtml(item.batchName || '')}</div>
            <div><span>Month</span>${escapeHtml(monthText(item))}</div>
            <div><span>Schedule Days</span>${escapeHtml(scheduleText(item))}</div>
            <div><span>Sessions / Week</span>${escapeHtml(item.sessionsPerWeek || '')}</div>
            <div><span>Students</span>${escapeHtml(item.studentCount || students.length || 0)}</div>
            <div><span>Line Total</span>${escapeHtml(money(item.itemTotal))}</div>
          </div>
          <table>
            <thead>
              <tr><th>Student</th><th>ID</th><th>DOB</th><th>Gender</th><th>School</th><th>Medical Notes</th><th class="right">Fee</th></tr>
            </thead>
            <tbody>${studentRows}</tbody>
          </table>
        </section>
      `;
    }).join('');

    return `
      <article class="card">
        <header>
          <div>
            <h2>${escapeHtml(row.registrationNumber || 'Registration')}</h2>
            <p>${escapeHtml(dateTimeText(row.createdAt))}</p>
          </div>
          <div class="total">${escapeHtml(money(row.totalAmount))}</div>
        </header>
        <div class="grid main">
          <div><span>Status</span>${escapeHtml(row.status || '')}</div>
          <div><span>Payment</span>${escapeHtml([row.paymentMethod, row.paymentStatus].filter(Boolean).join(' / '))}</div>
          <div><span>Check / Transaction</span>${escapeHtml(row.checkNumber || row.transactionId || '')}</div>
          <div><span>Parent</span>${escapeHtml(fullName(row.parentId))}</div>
          <div><span>Email</span>${escapeHtml(row.parentId?.email || '')}</div>
          <div><span>Phone</span>${escapeHtml(row.parentId?.phone || '')}</div>
          <div><span>Category</span>${escapeHtml(rowCategoryTitle(row))}</div>
          <div><span>Location</span>${escapeHtml(rowLocationTitle(row))}</div>
          <div><span>Age / Level</span>${escapeHtml([rowAgeGroups(row).join(', '), rowLevels(row).join(', ')].filter(Boolean).join(' / '))}</div>
          <div><span>Coupon</span>${escapeHtml(row.couponCode || '')}</div>
          <div><span>Waiver / Media / Medical</span>${escapeHtml([row.waiverAccepted ? 'Waiver' : '', row.mediaConsent ? 'Media' : '', row.medicalConsent ? 'Medical' : ''].filter(Boolean).join(', '))}</div>
        </div>
        ${itemHtml}
        ${(row.customerNote || row.adminNote) ? `
          <div class="notes">
            ${row.customerNote ? `<div><span>Customer Note</span>${escapeHtml(row.customerNote)}</div>` : ''}
            ${row.adminNote ? `<div><span>Admin Note</span>${escapeHtml(row.adminNote)}</div>` : ''}
          </div>
        ` : ''}
      </article>
    `;
  }).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <title>CCA Registration Details</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 28px; color: #172016; font-family: Arial, sans-serif; background: #fff; }
          .report-header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 3px solid #c9a227; padding-bottom: 14px; margin-bottom: 20px; }
          h1 { margin: 0; font-size: 22px; color: #0f3d22; }
          h2 { margin: 0; font-size: 18px; color: #0f3d22; }
          h3 { margin: 0 0 10px; font-size: 14px; color: #0f3d22; }
          p { margin: 4px 0 0; color: #555; font-size: 12px; }
          .card { page-break-inside: avoid; border: 1px solid #d8dfd3; border-radius: 8px; padding: 16px; margin-bottom: 18px; }
          header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
          .total { font-size: 18px; font-weight: 700; color: #0f3d22; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 14px; }
          .main { padding: 10px; background: #f7f7f1; border-radius: 6px; margin-bottom: 12px; }
          .grid div, .notes div { font-size: 12px; line-height: 1.35; }
          span { display: block; color: #6f766b; text-transform: uppercase; font-size: 9px; font-weight: 700; letter-spacing: .04em; margin-bottom: 2px; }
          .item { border-top: 1px solid #e4e7df; padding-top: 12px; margin-top: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { text-align: left; background: #0f3d22; color: #fff; padding: 7px; }
          td { border: 1px solid #dfe4d9; padding: 7px; vertical-align: top; }
          .right { text-align: right; }
          .notes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e4e7df; }
          @media print {
            body { padding: 14px; }
            .card { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div>
            <h1>${escapeHtml(ACADEMY_NAME)}</h1>
            <p>Registration Details Report</p>
          </div>
          <p>Generated: ${escapeHtml(new Date().toLocaleString())}<br/>Registrations: ${escapeHtml(rows.length)}</p>
        </div>
        ${cards || '<p>No registrations found.</p>'}
      </body>
    </html>
  `;
};

const MultiSelectFilter = ({ id, label, options, selected, onChange, open, onOpen, onClose, width = '190px' }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onClose();
      }
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
      }}>
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

export default function Registrations() {
  const { isSuperAdmin } = useAdminAuth();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filters, setFilters] = useState({
    statuses: [],
    paymentTypes: [],
    categories: [],
    locations: [],
    ageGroups: [],
    levels: [],
  });
  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    locations: [],
    ageGroups: [],
    levels: [],
  });
  const [selected, setSelected]   = useState(null);
  const [statusForm, setStatusForm] = useState({ status: '', adminNote: '' });
  const [confirmingId, setConfirmingId] = useState(null); // tracks which row is being confirmed
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [openFilter, setOpenFilter] = useState('');

  // Super-admin-only batch reassignment
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [reassigning, setReassigning] = useState(false);
  const [lastEmailResult, setLastEmailResult] = useState(null);
  const [programCatalog, setProgramCatalog] = useState([]);
  const detailRequestRef = useRef(0);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 10000 };
      const res = await registrationsAPI.getAll(params);
      const taggedRows = (res.data.data || []).map(row => tagRegistrationRow(row, programCatalog));
      setRows(taggedRows);
      setFilterOptions(buildRegisteredProgramFilterOptions(taggedRows));
    } catch (e) {
      toast.error('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      programsAPI.getAll(),
      registrationsAPI.getAll({ limit: 10000 }),
    ]).then(([programsRes, registrationsRes]) => {
      const programs = programsRes.data.data || [];
      const taggedRows = (registrationsRes.data.data || []).map(row => tagRegistrationRow(row, programs));
      setProgramCatalog(programs);
      setRows(taggedRows);
      setFilterOptions(buildRegisteredProgramFilterOptions(taggedRows));
    }).catch(() => {
      toast.error('Failed to load registration filters');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const hydrateSelectedRegistration = (row) => {
    const hydrated = tagRegistrationRow(row, programCatalog);
    setSelected(hydrated);
    setStatusForm({ status: hydrated.status, adminNote: hydrated.adminNote || '' });
    setSelectedBatchIds((hydrated.batches || []).map(b => (typeof b === 'string' ? b : b._id)));
    return hydrated;
  };

  const openEdit = async (row) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    const initial = hydrateSelectedRegistration(row);
    setLastEmailResult(null);

    if (isSuperAdmin && initial.programId?._id) {
      batchesAPI.getAll({ program: initial.programId._id, active: 'true' })
        .then(res => setAvailableBatches(res.data.data || []))
        .catch(() => setAvailableBatches([]));
    }

    setLoadingDetails(true);
    try {
      const res = await registrationsAPI.getOne(row._id);
      if (detailRequestRef.current === requestId) {
        hydrateSelectedRegistration(res.data.data);
      }
    } catch (e) {
      if (detailRequestRef.current === requestId) {
        toast.error('Failed to load full registration details');
      }
    } finally {
      if (detailRequestRef.current === requestId) {
        setLoadingDetails(false);
      }
    }
  };

  const closeEdit = () => {
    detailRequestRef.current += 1;
    setLoadingDetails(false);
    setSelected(null);
  };

  const toggleBatchSelection = (batchId) => {
    setSelectedBatchIds(prev =>
      prev.includes(batchId) ? prev.filter(id => id !== batchId) : [...prev, batchId]
    );
  };

  const handleReassignBatch = async () => {
    setReassigning(true);
    try {
      const res = await registrationsAPI.superAdminEdit(selected._id, { batches: selectedBatchIds });
      if (res.data.changes?.length) {
        toast.success(`Batch updated — ${res.data.emailSent ? 'parent notified by email' : 'parent email could not be sent, check SMTP settings'}`);
        setLastEmailResult(res.data.emailSent);
      } else {
        toast('No batch change detected.', { icon: 'ℹ️' });
      }
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Batch reassignment failed');
    } finally {
      setReassigning(false);
    }
  };

  const handleSave = async () => {
    try {
      await registrationsAPI.updateStatus(selected._id, statusForm);
      toast.success('Registration updated');
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    }
  };

  const handleWhatsapp = async (row) => {
    try {
      await registrationsAPI.toggleWhatsapp(row._id);
      toast.success('WhatsApp status updated');
      load();
    } catch (e) {
      toast.error('Failed');
    }
  };

  // ── Check payment confirm ────────────────────────────────────
  // Marks paymentStatus=SUCCESS, status=CONFIRMED in one click
  const handleConfirmCheck = async (row) => {
    setConfirmingId(row._id);
    try {
      await registrationsAPI.confirmCheck(row._id);
      toast.success(`✅ Check confirmed — ${row.registrationNumber} marked as CONFIRMED`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to confirm check');
    } finally {
      setConfirmingId(null);
    }
  };

  const setFilterValue = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setSearch('');
    setFilters({ statuses: [], paymentTypes: [], categories: [], locations: [], ageGroups: [], levels: [] });
    setOpenFilter('');
  };

  const matchesFilters = (r) => {
    const q = search.trim().toLowerCase();
    const studentsText = registrationOrderItems(r)
      .flatMap(item => itemStudents(r, item))
      .map(student => [fullName(student), student.studentCode, student.dob, student.gender].filter(Boolean).join(' '))
      .join(' ')
      .toLowerCase();
    const searchableText = [
      r.registrationNumber,
      r.programId?.title,
      r.parentId?.email,
      r.parentId?.phone,
      fullName(r.parentId),
      rowCategoryTitle(r),
      rowLocationTitle(r),
      rowAgeGroups(r).join(' '),
      rowLevels(r).join(' '),
      studentsText,
    ].filter(Boolean).join(' ').toLowerCase();

    if (q && !searchableText.includes(q)) return false;
    if (!hasAny(filters.statuses, [r.status])) return false;
    if (!hasAny(filters.paymentTypes, [r.paymentMethod])) return false;
    if (!hasAny(filters.categories, r._filterMeta?.categoryIds || [])) return false;
    if (!hasAny(filters.locations, rowLocationIds(r))) return false;
    if (!hasAny(filters.ageGroups, rowAgeGroups(r))) return false;
    if (!hasAny(filters.levels, rowLevels(r))) return false;
    return true;
  };

  const filtered = rows.filter(matchesFilters);

  const getReportRows = async () => {
    const params = { limit: 10000 };
    const res = await registrationsAPI.getAll(params);
    return (res.data.data || [])
      .map(row => tagRegistrationRow(row, programCatalog))
      .filter(matchesFilters);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const reportRows = await getReportRows();
      if (!reportRows.length) {
        toast.error('No registrations to export');
        return;
      }

      const XLSX = await loadXLSX();
      const { summaryHeaders, summaryRows, summaryMerges, summaryGroupRows, detailRows } = buildRegistrationExport(reportRows);
      const wb = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
      const detailSheet = XLSX.utils.json_to_sheet(detailRows);
      summarySheet['!merges'] = summaryMerges;

      summarySheet['!cols'] = [
        18, 12, 16, 16, 16, 14, 26, 22, 28, 16, 18, 22, 20, 24, 10, 34, 22, 28, 36, 14, 14, 34, 16, 14, 18, 18, 18, 14, 14, 14, 14, 22, 22, 14, 14, 35, 35,
      ].map(wch => ({ wch }));
      summarySheet['!rows'] = [{ hpt: 22 }, ...summaryRows.map(() => ({ hpt: 28 }))];
      summarySheet['!freeze'] = { xSplit: 0, ySplit: 1 };

      const range = XLSX.utils.decode_range(summarySheet['!ref']);
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = summarySheet[XLSX.utils.encode_cell({ r: 0, c })];
        if (cell) {
          cell.s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '0F3D22' } },
            alignment: { vertical: 'center', wrapText: true },
          };
        }
      }
      for (let r = 1; r <= summaryRows.length; r++) {
        const fill = summaryGroupRows[r - 1] === 0 ? 'FFFFFF' : 'F4F7F0';
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = summarySheet[XLSX.utils.encode_cell({ r, c })];
          if (cell) {
            cell.s = {
              fill: { fgColor: { rgb: fill } },
              alignment: { vertical: 'center', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: 'D9E0D2' } },
                bottom: { style: 'thin', color: { rgb: 'D9E0D2' } },
              },
            };
          }
        }
      }
      detailSheet['!cols'] = [
        18, 14, 16, 16, 16, 14, 26, 22, 28, 16, 34, 10, 22, 28, 36, 14, 10, 24, 18, 12, 12, 24, 34, 16, 16, 14, 16, 14, 34, 34,
      ].map(wch => ({ wch }));

      XLSX.utils.book_append_sheet(wb, summarySheet, 'Registration Summary');
      XLSX.utils.book_append_sheet(wb, detailSheet, 'Student Schedule Details');
      XLSX.writeFile(wb, `CCA_Registration_Details_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Exported ${reportRows.length} registrations`);
    } catch (e) {
      toast.error('Excel export failed');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print registrations');
      return;
    }

    setPrinting(true);
    printWindow.document.write('<p style="font-family: Arial, sans-serif; padding: 24px;">Preparing registration report...</p>');
    try {
      const reportRows = await getReportRows();
      const html = buildPrintHtml(reportRows);
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 400);
      toast.success(`Prepared ${reportRows.length} registrations for print`);
    } catch (e) {
      printWindow.close();
      toast.error('Print report failed');
    } finally {
      setPrinting(false);
    }
  };

  const columns = [
    {
      key: 'registrationNumber',
      label: 'Reg #',
      render: (v, row) => (
        <button
          type="button"
          onClick={() => openEdit(row)}
          style={{ background: 'transparent', border: 0, color: '#F5D97A', cursor: 'pointer', fontWeight: 700, padding: 0 }}
        >
          {v}
        </button>
      ),
    },
    { key: 'parentId',    label: 'Parent',  render: (v) => v ? `${v.firstName} ${v.lastName}` : '—' },
    { key: 'parentEmail', label: 'Email',   render: (_, row) => row.parentId?.email || '—' },
    {
      key: 'programId',
      label: 'Program',
      render: (v, row) => (
        <button
          type="button"
          onClick={() => openEdit(row)}
          style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer', padding: 0, textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'rgba(245,217,122,0.65)', textUnderlineOffset: '3px' }}
        >
          {v?.title || '—'}
        </button>
      ),
    },
    { key: 'category', label: 'Category', render: (_, row) => rowCategoryTitle(row) || '—' },
    { key: 'totalAmount', label: 'Amount',  render: (v) => `$${(v || 0).toLocaleString()}` },
    { key: 'status',      label: 'Status',  render: (v) => <Badge label={v} /> },
    { key: 'paymentMethod', label: 'Payment' },
    {
      key: 'checkNumber', label: 'Check #',
      render: (v) => v || '—',
    },
    {
      // ── Confirm Check button — only shows for CHECK + not yet CONFIRMED ──
      key: 'confirmCheck', label: 'Confirm Check',
      render: (_, row) => {
        if (row.paymentMethod !== 'CHECK') return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>—</span>;
        if (row.status === 'CONFIRMED' && row.paymentStatus === 'SUCCESS') {
          return (
            <span style={{ color: '#86efac', fontSize: '12px', fontWeight: 600 }}>
              ✅ Received
            </span>
          );
        }
        return (
          <button
            disabled={confirmingId === row._id}
            onClick={() => handleConfirmCheck(row)}
            style={{
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.4)',
              color: '#86efac',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: confirmingId === row._id ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              opacity: confirmingId === row._id ? 0.5 : 1,
            }}
          >
            {confirmingId === row._id ? 'Confirming…' : '✓ Mark Received'}
          </button>
        );
      },
    },
    {
      key: 'isWhatsappJoined', label: 'WhatsApp',
      render: (v, row) => (
        <button
          onClick={() => handleWhatsapp(row)}
          style={{
            background: v ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${v ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: v ? '#86efac' : 'rgba(255,255,255,0.4)',
            borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px',
          }}
        >
          {v ? '✅ Joined' : '⬜ Not joined'}
        </button>
      ),
    },
    { key: 'createdAt', label: 'Date', render: (v) => new Date(v).toLocaleDateString() },
    {
      key: '_id', label: 'Actions',
      render: (_, row) => (
        <Btn small onClick={() => openEdit(row)}>View Details</Btn>
      ),
    },
  ];

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader
        title="Registrations"
        subtitle="View and manage parent registrations"
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reg #, parent, student..." />
        <MultiSelectFilter
          id="status-filter"
          label="Statuses"
          selected={filters.statuses}
          onChange={value => setFilterValue('statuses', value)}
          open={openFilter === 'status-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={STATUSES.map(status => ({ value: status, label: status }))}
          width="175px"
        />
        <MultiSelectFilter
          id="payment-filter"
          label="Payments"
          selected={filters.paymentTypes}
          onChange={value => setFilterValue('paymentTypes', value)}
          open={openFilter === 'payment-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={['PAYPAL', 'STRIPE', 'CHECK', 'PENDING'].map(method => ({ value: method, label: method }))}
          width="175px"
        />
        <MultiSelectFilter
          id="category-filter"
          label="Categories"
          selected={filters.categories}
          onChange={value => setFilterValue('categories', value)}
          open={openFilter === 'category-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={filterOptions.categories}
          width="190px"
        />
        <MultiSelectFilter
          id="location-filter"
          label="Locations"
          selected={filters.locations}
          onChange={value => setFilterValue('locations', value)}
          open={openFilter === 'location-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={filterOptions.locations}
          width="190px"
        />
        <MultiSelectFilter
          id="age-filter"
          label="Age Groups"
          selected={filters.ageGroups}
          onChange={value => setFilterValue('ageGroups', value)}
          open={openFilter === 'age-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={filterOptions.ageGroups}
          width="180px"
        />
        <MultiSelectFilter
          id="level-filter"
          label="Levels"
          selected={filters.levels}
          onChange={value => setFilterValue('levels', value)}
          open={openFilter === 'level-filter'}
          onOpen={setOpenFilter}
          onClose={() => setOpenFilter('')}
          options={filterOptions.levels}
          width="190px"
        />
        <Btn variant="ghost" onClick={load}>Refresh</Btn>
        <Btn variant="ghost" onClick={clearFilters}>Clear Filters</Btn>
        <Btn variant="success" onClick={handleExportExcel} disabled={exporting || loading}>
          {exporting ? 'Exporting...' : 'Export Excel'}
        </Btn>
        <Btn variant="ghost" onClick={handlePrint} disabled={printing || loading}>
          {printing ? 'Preparing...' : 'Print'}
        </Btn>
      </div>

      <DataTable columns={columns} rows={filtered} loading={loading} emptyMsg="No registrations found" />

      {/* Edit modal */}
      <Modal open={!!selected} onClose={closeEdit} title={`Edit: ${selected?.registrationNumber}`}>
        {selected && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
              <div><strong style={{ color: '#F5D97A' }}>Program:</strong> {selected.programId?.title || '—'}</div>
              <div style={{ marginTop: '4px' }}><strong style={{ color: '#F5D97A' }}>Amount:</strong> ${selected.totalAmount}</div>
              <div style={{ marginTop: '4px' }}><strong style={{ color: '#F5D97A' }}>Payment:</strong> {selected.paymentMethod} {selected.checkNumber ? `— Check #${selected.checkNumber}` : ''}</div>
            </div>

            {loadingDetails && (
              <div style={{ background: 'rgba(245,217,122,0.1)', border: '1px solid rgba(245,217,122,0.2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', color: '#F5D97A', fontSize: '12px', fontWeight: 700 }}>
                Loading full registration details...
              </div>
            )}

            {/* ── Inline check confirm banner inside modal ── */}
            {Array.isArray(selected.orderItems) && selected.orderItems.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#F5D97A', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Registration Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                  {selected.orderItems.map((item, index) => {
                    const students = item.students || [];
                    const schedule = splitScheduleItems(item.selectedDays);
                    const itemTotal = item.itemTotal || ((Number(item.feePerStudent) || 0) * (Number(item.studentCount) || students.length || 1));
                    return (
                      <div key={`${item.programTitle || 'program'}-${index}`} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '14px', background: 'rgba(255,255,255,0.035)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ color: '#FFFFFF', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Program</div>
                            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 800, marginTop: '3px' }}>{item.programTitle || selected.programId?.title || '—'}</div>
                          </div>
                          <div style={{ textAlign: 'right', color: '#F5D97A', fontWeight: 800, fontSize: '15px', whiteSpace: 'nowrap' }}>{money(itemTotal)}</div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                          <div style={{ background: 'rgba(15,23,42,0.45)', borderRadius: '8px', padding: '8px 10px' }}>
                            <div style={{ color: '#FFFFFF', fontSize: '10px', textTransform: 'uppercase' }}>Batch</div>
                            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>{item.batchName || '—'}</div>
                          </div>
                          <div style={{ background: 'rgba(15,23,42,0.45)', borderRadius: '8px', padding: '8px 10px' }}>
                            <div style={{ color: '#FFFFFF', fontSize: '10px', textTransform: 'uppercase' }}>Month</div>
                            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>{item.selectedMonthLabel || item.selectedMonth?.label || '—'}</div>
                          </div>
                          <div style={{ background: 'rgba(15,23,42,0.45)', borderRadius: '8px', padding: '8px 10px', minWidth: '220px' }}>
                            <div style={{ color: '#FFFFFF', fontSize: '10px', textTransform: 'uppercase' }}>Schedule</div>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#fff', fontSize: '12px', fontWeight: 700 }}>
                              {schedule.length ? schedule.map(day => <li key={day}>{day}</li>) : <li style={{ listStyle: 'none', marginLeft: '-16px' }}>—</li>}
                            </ul>
                          </div>
                        </div>
                        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                          <div style={{ color: '#FFFFFF', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                            Students ({item.studentCount || students.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {students.map((student, studentIndex) => (
                              <div key={`${student.firstName || ''}-${student.lastName || ''}-${studentIndex}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', background: 'rgba(245,217,122,0.12)', borderRadius: '8px', padding: '8px 10px', color: '#fff', fontSize: '12px' }}>
                                <div>
                                  <strong>{`${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student'}</strong>
                                  <span style={{ color: '#FFFFFF', marginLeft: '8px' }}>{student.dob ? `DOB: ${student.dob}` : ''}{student.gender ? ` · ${student.gender}` : ''}</span>
                                </div>
                                <strong>{money(item.feePerStudent)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selected.paymentMethod === 'CHECK' && selected.status !== 'CONFIRMED' && (
              <div style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div>
                  <div style={{ color: '#86efac', fontWeight: 600, fontSize: '13px' }}>💵 Check Payment Pending</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
                    Once you physically receive the check, click confirm to mark this registration as paid.
                  </div>
                </div>
                <button
                  disabled={confirmingId === selected._id}
                  onClick={() => handleConfirmCheck(selected)}
                  style={{
                    background: '#16a34a',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    opacity: confirmingId === selected._id ? 0.6 : 1,
                  }}
                >
                  {confirmingId === selected._id ? 'Confirming…' : '✓ Confirm Check Received'}
                </button>
              </div>
            )}

            <FormField label="Update Status" required>
              <Select value={statusForm.status} onChange={e => setStatusForm(p => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>

            <FormField label="Admin Note">
              <Textarea
                value={statusForm.adminNote}
                onChange={e => setStatusForm(p => ({ ...p, adminNote: e.target.value }))}
                placeholder="Internal note visible only to admins..."
              />
            </FormField>

            {isSuperAdmin && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F5D97A', marginBottom: '8px' }}>
                  🔐 Super Admin — Reassign Batch
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
                  Changing the batch sends an automatic email to the parent showing exactly what changed.
                </p>
                {availableBatches.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>No active batches found for this program.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                    {availableBatches.map(b => (
                      <label key={b._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedBatchIds.includes(b._id)}
                          onChange={() => toggleBatchSelection(b._id)}
                        />
                        {b.title} — {b.dayOfWeek} {b.startTime}-{b.endTime}
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '10px' }}>
                  <Btn small variant="ghost" onClick={handleReassignBatch} disabled={reassigning}>
                    {reassigning ? 'Saving & emailing parent…' : 'Save Batch Change'}
                  </Btn>
                </div>
                {lastEmailResult === false && (
                  <p style={{ fontSize: '12px', color: '#fca5a5', marginTop: '8px' }}>
                    ⚠️ The change saved, but the notification email could not be sent. Check SMTP settings in the backend .env.
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Btn variant="ghost" onClick={closeEdit}>Cancel</Btn>
              <Btn onClick={handleSave}>Save Changes</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
