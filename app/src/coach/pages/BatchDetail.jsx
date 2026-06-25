// ============================================================
//  pages/BatchDetail.js — Single batch roster + today's attendance
// ============================================================
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { coachPortalAPI } from '../api/client';
import { Card, PageHeader, Spinner, EmptyState, Avatar, Btn, Badge } from '../components/UI';
import toast from 'react-hot-toast';

const dayLabel = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun', MULTI: 'Multi-day' };

export default function BatchDetail() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [detailRes, attRes] = await Promise.all([
        coachPortalAPI.getBatchDetail(batchId),
        coachPortalAPI.getAttendance({ batchId }),
      ]);
      setData(detailRes.data.data);
      setAttendance(attRes.data.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load batch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [batchId]);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState text="Batch not found." />;

  const { batch, students } = data;
  const presentIds = new Set(attendance.map((a) => a.studentId?._id));

  return (
    <div>
      <PageHeader
        title={batch.title || `${dayLabel[batch.dayOfWeek]} Batch`}
        subtitle={`${batch.program?.title || ''} · ${dayLabel[batch.dayOfWeek]} ${batch.startTime}–${batch.endTime}`}
      />

      <Btn full onClick={() => navigate('/coach/scan', { state: { batchId } })} style={{ marginBottom: '16px' }}>
        📷 Scan ID Cards for This Batch
      </Btn>

      <Card style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          ✅ {attendance.length} of {students.length} marked present today
        </div>
      </Card>

      <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>
        Student Roster
      </div>

      {students.length === 0 ? (
        <EmptyState icon="🧒" text="No students assigned to this batch yet." />
      ) : (
        students.map((s) => (
          <Card key={s._id} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar photoUrl={s.photoUrl} firstName={s.firstName} lastName={s.lastName} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{s.firstName} {s.lastName}</div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', fontFamily: 'monospace' }}>{s.studentCode}</div>
            </div>
            <Badge label={presentIds.has(s._id) ? 'PRESENT' : 'NOT MARKED'} tone={presentIds.has(s._id) ? 'success' : 'neutral'} />
          </Card>
        ))
      )}
    </div>
  );
}
