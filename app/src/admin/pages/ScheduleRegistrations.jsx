import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { reportsAPI } from '../api/client';
import { Badge, Btn, Card, DataTable, PageHeader, SearchInput, Select } from '../components/common/UI';

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Unable to load the Excel export library'));
    document.head.appendChild(script);
  });
}

const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const normalized = value => String(value || '').trim().toLocaleLowerCase();
const matches = (actual, selected) => !selected || normalized(actual) === normalized(selected);
const EMPTY_FILTERS = { category: '', day: '', location: '', ageGroup: '', program: '', status: '', search: '' };

function filterScheduleGroups(groups, filters) {
  const needle = normalized(filters.search);
  return groups.map(group => {
    if (!matches(group.categoryTitle, filters.category)
      || !matches(group.day, filters.day)
      || !matches(group.location, filters.location)
      || !matches(group.ageGroup, filters.ageGroup)
      || !matches(group.programTitle, filters.program)) return null;

    const students = (group.students || []).filter(row => {
      if (!matches(row.status, filters.status)) return false;
      if (!needle) return true;
      return [row.studentName, row.studentId, row.registrationNumber, row.parentName, row.parentEmail, row.parentPhone]
        .some(value => normalized(value).includes(needle));
    });
    return students.length ? {
      ...group,
      students,
      studentCount: new Set(students.map(row => row.studentId || `${row.studentName}|${row.dob}`)).size,
    } : null;
  }).filter(Boolean);
}

export default function ScheduleRegistrations() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    reportsAPI.getScheduleRegistrations().then(response => setGroups(response.data.data || []))
      .catch(() => toast.error('Could not load the schedule registration report'))
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo(() => ({
    categories: unique(groups.map(group => group.categoryTitle)), days: unique(groups.map(group => group.day)),
    locations: unique(groups.map(group => group.location)), ageGroups: unique(groups.map(group => group.ageGroup)),
    programs: unique(groups.map(group => group.programTitle)),
  }), [groups]);

  const filtered = useMemo(() => filterScheduleGroups(groups, filters), [groups, filters]);

  const visibleStudents = filtered.reduce((total, group) => total + group.studentCount, 0);
  const setFilter = key => event => {
    const value = event.currentTarget.value;
    setFilters(current => ({ ...current, [key]: value }));
  };

  const printFiltered = () => {
    if (!filtered.length) return toast.error('There is no filtered data to print');
    const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
    const rows = filtered.map(group => `
      <section><h2>${escape(group.day)} · ${escape(group.startTime)}${group.endTime ? ` - ${escape(group.endTime)}` : ''} · ${escape(group.location)}</h2>
      <p>${escape(group.categoryTitle)} · ${escape(group.ageGroup)} · ${escape(group.programTitle)} · ${group.studentCount} students</p>
      <table><thead><tr><th>Student</th><th>Student ID</th><th>Registration #</th><th>Parent</th><th>Email</th><th>Status</th><th>Fee</th></tr></thead>
      <tbody>${group.students.map(row => `<tr><td>${escape(row.studentName)}</td><td>${escape(row.studentId)}</td><td>${escape(row.registrationNumber)}</td><td>${escape(row.parentName)}</td><td>${escape(row.parentEmail)}</td><td>${escape(row.status)}</td><td>${escape(money(row.feePerStudent))}</td></tr>`).join('')}</tbody></table></section>`).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error('Please allow pop-ups to print this report');
    printWindow.opener = null;
    printWindow.document.write(`<!doctype html><html><head><title>CCA Schedule Registrations</title><style>body{font:12px Arial,sans-serif;color:#111;margin:24px}h1{margin:0 0 6px}h2{font-size:15px;margin:22px 0 3px}p{margin:0 0 8px;color:#444}table{width:100%;border-collapse:collapse;page-break-inside:auto}th,td{border:1px solid #bbb;padding:6px;text-align:left}th{background:#eee}tr{page-break-inside:avoid}section{page-break-inside:avoid;margin-bottom:18px}@page{size:landscape;margin:12mm}</style></head><body><h1>CCA Schedule Registrations</h1><p>Filtered report · ${new Date().toLocaleString()}</p>${rows}</body></html>`);
    printWindow.document.close();
    window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 150);
  };

  const exportExcel = async () => {
    if (!filtered.length) return toast.error('There is no filtered data to export');
    try {
      const XLSX = await loadXLSX();
      const summary = filtered.map(group => ({ Category: group.categoryTitle, Day: group.day, Time: [group.startTime, group.endTime].filter(Boolean).join(' - '), Location: group.location, 'Age Group': group.ageGroup, Program: group.programTitle, Students: group.studentCount }));
      const details = filtered.flatMap(group => group.students.map(row => ({ Category: group.categoryTitle, Day: group.day, Time: [group.startTime, group.endTime].filter(Boolean).join(' - '), Location: group.location, 'Age Group': group.ageGroup, Program: group.programTitle, 'Registration #': row.registrationNumber, 'Student ID': row.studentId, Student: row.studentName, DOB: row.dob, Gender: row.gender, Parent: row.parentName, Email: row.parentEmail, Phone: row.parentPhone, Status: row.status, 'Payment Method': row.paymentMethod, 'Fee / Student': row.feePerStudent })));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Summary');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(details), 'Student Details');
      XLSX.writeFile(workbook, `CCA_Schedule_Registrations_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Filtered report exported');
    } catch (error) { toast.error(error.message || 'Export failed'); }
  };

  const columns = [
    { key: 'studentName', label: 'Student' }, { key: 'studentId', label: 'Student ID' },
    { key: 'registrationNumber', label: 'Registration #' }, { key: 'parentName', label: 'Parent' },
    { key: 'parentEmail', label: 'Email' }, { key: 'status', label: 'Status', render: value => <Badge label={value} /> },
    { key: 'feePerStudent', label: 'Fee', render: money },
  ];

  return <div>
    <PageHeader title="Schedule Registrations" subtitle="Students grouped by selected day, configured age group and program" action={<div style={{ display: 'flex', gap: 8 }}><Btn variant="ghost" onClick={printFiltered} disabled={!filtered.length}>Print filtered</Btn><Btn onClick={exportExcel} disabled={!filtered.length}>Export filtered Excel</Btn></div>} />
    <Card style={{ marginBottom: 18, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
        {[['category', 'All categories', options.categories], ['day', 'All days', options.days], ['location', 'All locations', options.locations], ['ageGroup', 'All age groups', options.ageGroups], ['program', 'All programs', options.programs]].map(([key, label, values]) =>
          <Select key={key} value={filters[key]} onChange={setFilter(key)}><option value="">{label}</option>{values.map(value => <option key={value} value={value}>{value}</option>)}</Select>)}
        <Select value={filters.status} onChange={setFilter('status')}><option value="">Operational statuses</option><option value="CONFIRMED">Confirmed</option><option value="AWAITING_PAYMENT">Awaiting check payment</option></Select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <SearchInput value={filters.search} onChange={setFilter('search')} placeholder="Student, parent, email or registration..." />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ color: 'rgba(255,255,255,.55)', fontSize: 13 }}>{filtered.length} groups · {visibleStudents} student placements</span><Btn small variant="ghost" onClick={() => setFilters({ ...EMPTY_FILTERS })}>Clear filters</Btn></div>
      </div>
    </Card>
    {loading ? <DataTable columns={columns} rows={[]} loading /> : !filtered.length ? <Card style={{ textAlign: 'center', color: 'rgba(255,255,255,.45)' }}>No registrations match these filters.</Card> : filtered.map(group =>
      <details key={group.key} open style={{ marginBottom: 14, border: '1px solid rgba(212,175,55,.16)', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,.02)' }}>
        <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '15px 18px', color: '#F5D97A', fontWeight: 650 }}>
          {group.day} · {group.startTime}{group.endTime ? ` - ${group.endTime}` : ''} · {group.location}
          <span style={{ display: 'block', color: 'rgba(255,255,255,.62)', fontSize: 13, fontWeight: 400, marginTop: 5 }}>{group.categoryTitle} · {group.ageGroup} · {group.programTitle} · {group.studentCount} students</span>
        </summary>
        <DataTable columns={columns} rows={group.students} />
      </details>)}
  </div>;
}
