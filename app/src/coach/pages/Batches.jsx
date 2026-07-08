// ============================================================
//  pages/Batches.js — View Assigned Batches
//  Filters: Location, Age Group, Ground, Day of Week, Date
//  (picking a Date auto-selects that date's weekday, so e.g.
//  choosing a Monday date + Monday day shows only Monday batches)
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { coachPortalAPI } from '../api/client';
import { Card, PageHeader, Spinner, EmptyState, Badge, Select, FormField, Btn } from '../components/UI';
import toast from 'react-hot-toast';

const dayLabel = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun', MULTI: 'Multi-day' };
const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Weekday of a "YYYY-MM-DD" date string, in MON/TUE/... form.
// Built from local date parts so it isn't shifted by timezone parsing.
function weekdayFromDateString(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const jsDay = new Date(y, m - 1, d).getDay(); // 0 = Sun ... 6 = Sat
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][jsDay];
}

const emptyFilters = { location: '', ageGroup: '', ground: '', day: '', date: '' };

export default function Batches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);

  useEffect(() => {
    coachPortalAPI.getMyBatches()
      .then((res) => setBatches(res.data.data || []))
      .catch(() => toast.error('Failed to load batches'))
      .finally(() => setLoading(false));
  }, []);

  // ── Build filter dropdown options from the coach's own batches ──
  const locationOptions = useMemo(() => {
    const map = new Map();
    batches.forEach((b) => {
      if (b.location?._id) map.set(String(b.location._id), b.location.title);
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [batches]);

  const ageGroupOptions = useMemo(() => {
    const set = new Set();
    batches.forEach((b) => (b.ageGroups || []).forEach((a) => a && set.add(a)));
    return Array.from(set).sort();
  }, [batches]);

  const groundOptions = useMemo(() => {
    const set = new Set();
    batches.forEach((b) => {
      const g = b.ground || b.groundLocationNote;
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [batches]);

  const dayOptions = useMemo(() => {
    const set = new Set();
    batches.forEach((b) => {
      if (b.dayOfWeek === 'MULTI') (b.multiDays || []).forEach((d) => set.add(d));
      else if (b.dayOfWeek) set.add(b.dayOfWeek);
    });
    return DAY_ORDER.filter((d) => set.has(d));
  }, [batches]);

  const handleDateChange = (value) => {
    const day = weekdayFromDateString(value);
    setFilters((f) => ({ ...f, date: value, day: day || f.day }));
  };

  const clearFilters = () => setFilters(emptyFilters);

  const filtered = batches.filter((b) => {
    if (filters.location && String(b.location?._id || '') !== filters.location) return false;
    if (filters.ageGroup && !(b.ageGroups || []).includes(filters.ageGroup)) return false;
    if (filters.ground && (b.ground || b.groundLocationNote || '') !== filters.ground) return false;
    if (filters.day) {
      const days = b.dayOfWeek === 'MULTI' ? (b.multiDays || []) : [b.dayOfWeek];
      if (!days.includes(filters.day)) return false;
    }
    return true;
  });

  const hasActiveFilters = Object.values(filters).some(Boolean);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="My Batches" subtitle={`${filtered.length} of ${batches.length} batch${batches.length === 1 ? '' : 'es'} shown`} />

      {/* ── Filters ──────────────────────────────────────────── */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
          Filter Batches
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <FormField label="Location">
            <Select value={filters.location} onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}>
              <option value="">All locations</option>
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Age Group">
            <Select value={filters.ageGroup} onChange={(e) => setFilters((f) => ({ ...f, ageGroup: e.target.value }))}>
              <option value="">All age groups</option>
              {ageGroupOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Ground">
            <Select value={filters.ground} onChange={(e) => setFilters((f) => ({ ...f, ground: e.target.value }))}>
              <option value="">All grounds</option>
              {groundOptions.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Day">
            <Select value={filters.day} onChange={(e) => setFilters((f) => ({ ...f, day: e.target.value }))}>
              <option value="">All days</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>{dayLabel[d]}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Date (auto-picks that day of the week)">
          <input
            type="date"
            value={filters.date}
            onChange={(e) => handleDateChange(e.target.value)}
            style={{
              width: '100%', background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: '10px', padding: '12px 14px', color: '#0f172a', fontSize: '14.5px', outline: 'none',
            }}
          />
        </FormField>

        {hasActiveFilters && (
          <Btn variant="ghost" onClick={clearFilters} style={{ width: '100%' }}>
            Clear Filters
          </Btn>
        )}
      </Card>

      {batches.length === 0 ? (
        <EmptyState icon="📋" text="No batches assigned to you yet. Contact your admin." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔍" text="No batches match these filters." />
      ) : (
        filtered.map((b) => (
          <Link key={b._id} to={`/coach/batches/${b._id}`} style={{ textDecoration: 'none' }}>
            <Card style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    {b.title || `${dayLabel[b.dayOfWeek]} Batch`}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '2px' }}>
                    {b.program?.title}
                  </div>
                </div>
                <Badge label={`${b.studentCount} students`} tone="neutral" />
              </div>
              <div style={{ display: 'flex', gap: '14px', marginTop: '12px', fontSize: '12.5px', color: '#475569', flexWrap: 'wrap' }}>
                <span>🗓 {dayLabel[b.dayOfWeek]}</span>
                <span>⏰ {b.startTime}–{b.endTime}</span>
                {(b.ageGroups || []).length > 0 && <span>🎯 {b.ageGroups.join(', ')}</span>}
              </div>
              {b.location && (
                <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '6px' }}>
                  📍 {b.location.title}
                </div>
              )}
              {(b.ground || b.groundLocationNote) && (
                <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
                  🏟 {b.ground || b.groundLocationNote}
                </div>
              )}
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}