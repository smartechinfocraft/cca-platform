// ============================================================
//  pages/Students.js — View Assigned Students
// ============================================================
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { coachPortalAPI } from '../api/client';
import { Card, PageHeader, Spinner, EmptyState, Avatar, Input } from '../components/UI';
import toast from 'react-hot-toast';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    coachPortalAPI.getMyStudents()
      .then((res) => setStudents(res.data.data))
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const filtered = students.filter((s) =>
    !search ||
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    s.studentCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="My Students" subtitle={`${students.length} students across all your batches`} />

      <div style={{ marginBottom: '14px' }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or student ID..." />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🧒" text="No students found." />
      ) : (
        filtered.map((s) => (
          <Link key={s._id} to={`/coach/students/${s._id}`} style={{ textDecoration: 'none' }}>
            <Card style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Avatar photoUrl={s.photoUrl} firstName={s.firstName} lastName={s.lastName} size={42} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{s.firstName} {s.lastName}</div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                  {(s.batches || []).map((b) => b.title || b.dayOfWeek).join(', ') || 'No batch'}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{s.studentCode}</div>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
