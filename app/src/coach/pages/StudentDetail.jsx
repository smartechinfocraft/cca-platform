// ============================================================
//  pages/StudentDetail.js — Single student detail
// ============================================================
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { coachPortalAPI } from '../api/client';
import { Card, PageHeader, Spinner, EmptyState, Avatar, Badge } from '../components/UI';
import toast from 'react-hot-toast';

export default function StudentDetail() {
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coachPortalAPI.getStudentDetail(studentId)
      .then((res) => setStudent(res.data.data))
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to load student'))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <Spinner />;
  if (!student) return <EmptyState text="Student not found." />;

  return (
    <div>
      <PageHeader title="Student Details" />

      <Card style={{ textAlign: 'center', marginBottom: '16px' }}>
        <Avatar photoUrl={student.photoUrl} firstName={student.firstName} lastName={student.lastName} size={72} />
        <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginTop: '10px' }}>
          {student.firstName} {student.lastName}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
          {student.studentCode}
        </div>
        <div style={{ marginTop: '8px' }}>
          <Badge label={student.isActive === false ? 'INACTIVE' : 'ACTIVE'} />
        </div>
      </Card>

      <Card style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Batches</div>
        {(student.batches || []).length ? (
          student.batches.map((b) => (
            <div key={b._id} style={{ fontSize: '13.5px', color: '#cbd5e1', marginBottom: '6px' }}>
              📋 {b.title || b.dayOfWeek} · {b.startTime}–{b.endTime}
            </div>
          ))
        ) : (
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>Not assigned to any batch.</div>
        )}
      </Card>

      <Card>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Parent / Guardian</div>
        {student.parentId ? (
          <div>
            <div style={{ fontSize: '13.5px', color: '#fff' }}>{student.parentId.firstName} {student.parentId.lastName}</div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>{student.parentId.email}</div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>{student.parentId.phone}</div>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>No parent on file.</div>
        )}
      </Card>
    </div>
  );
}
