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

export default function ScheduleRegistrations() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: '', day: '', location: '', ageGroup: '', program: '', status: '', search: '' });

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

  const filtered = useMemo(() => groups.map(group => {
    if (filters.category && group.categoryTitle !== filters.category) return null;
    if (filters.day && group.day !== filters.day) return null;
    if (filters.location && group.location !== filters.location) return null;
    if (filters.ageGroup && group.ageGroup !== filters.ageGroup) return null;
    if (filters.program && group.programTitle !== filters.program) return null;
    const needle = filters.search.trim().toLowerCase();
    const students = group.students.filter(row => {
      if (filters.status && row.status !== filters.status) return false;
      if (!needle) return true;
      return [row.studentName, row.studentId, row.registrationNumber, row.parentName, row.parentEmail, row.parentPhone]
        .some(value => String(value || '').toLowerCase().includes(needle));
    });
    return students.length ? { ...group, students, studentCount: new Set(students.map(row => row.studentId || `${row.studentName}|${row.dob}`)).size } : null;
  }).filter(Boolean), [groups, filters]);

  const visibleStudents = filtered.reduce((total, group) => total + group.studentCount, 0);
  const setFilter = key => event => setFilters(current => ({ ...current, [key]: event.target.value }));

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
    <PageHeader title="Schedule Registrations" subtitle="Students grouped by selected day, configured age group and program" action={<Btn onClick={exportExcel} disabled={!filtered.length}>Export filtered Excel</Btn>} />
    <Card style={{ marginBottom: 18, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
        {[['category', 'All categories', options.categories], ['day', 'All days', options.days], ['location', 'All locations', options.locations], ['ageGroup', 'All age groups', options.ageGroups], ['program', 'All programs', options.programs]].map(([key, label, values]) =>
          <Select key={key} value={filters[key]} onChange={setFilter(key)}><option value="">{label}</option>{values.map(value => <option key={value}>{value}</option>)}</Select>)}
        <Select value={filters.status} onChange={setFilter('status')}><option value="">Operational statuses</option><option value="CONFIRMED">Confirmed</option><option value="AWAITING_PAYMENT">Awaiting check payment</option></Select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <SearchInput value={filters.search} onChange={setFilter('search')} placeholder="Student, parent, email or registration..." />
        <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 13 }}>{filtered.length} groups · {visibleStudents} student placements</span>
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
