// ============================================================
//  pages/Batches.js — View Assigned Batches
// ============================================================
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { coachPortalAPI } from '../api/client';
import { Card, PageHeader, Spinner, EmptyState, Badge } from '../components/UI';
import toast from 'react-hot-toast';

const dayLabel = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun', MULTI: 'Multi-day' };

export default function Batches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coachPortalAPI.getMyBatches()
      .then((res) => setBatches(res.data.data))
      .catch(() => toast.error('Failed to load batches'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="My Batches" subtitle={`${batches.length} batch${batches.length === 1 ? '' : 'es'} assigned to you`} />

      {batches.length === 0 ? (
        <EmptyState icon="📋" text="No batches assigned to you yet. Contact your admin." />
      ) : (
        batches.map((b) => (
          <Link key={b._id} to={`/coach/batches/${b._id}`} style={{ textDecoration: 'none' }}>
            <Card style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                    {b.title || `${dayLabel[b.dayOfWeek]} Batch`}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '2px' }}>
                    {b.program?.title}
                  </div>
                </div>
                <Badge label={`${b.studentCount} students`} tone="neutral" />
              </div>
              <div style={{ display: 'flex', gap: '14px', marginTop: '12px', fontSize: '12.5px', color: '#cbd5e1' }}>
                <span>🗓 {dayLabel[b.dayOfWeek]}</span>
                <span>⏰ {b.startTime}–{b.endTime}</span>
              </div>
              {b.location && (
                <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '6px' }}>
                  📍 {b.location.title}
                </div>
              )}
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
