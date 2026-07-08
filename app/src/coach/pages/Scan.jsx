// ============================================================
//  pages/Scan.jsx — Attendance
//  Flow: 1) Coach selects a Batch  2) Coach selects a Date
//        3) Coach taps "Apply" to load that batch's roster +
//           whatever attendance already exists for that date.
//  Then, for each student (found by typing their name / manual
//  Student ID, or by scanning their QR ID card) the coach has
//  three actions: ✅ Present · ❌ Absent · ✏️ Edit
//  "Edit" lets the coach set any status PLUS a remark, e.g.
//  "Late 5 min" or change an Absent to Present with a note.
// ============================================================
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { coachPortalAPI } from '../api/client';
import { Card, PageHeader, Btn, Input, Select, FormField, EmptyState, Avatar, Badge, Spinner } from '../components/UI';
import toast from 'react-hot-toast';

const SCANNER_ID = 'qr-reader-region';

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT',  label: 'Absent' },
  { value: 'LATE',    label: 'Late' },
  { value: 'EXCUSED', label: 'Excused' },
];

const REMARK_SUGGESTIONS = ['Late 5 min', 'Late 10 min', 'Absent → Present', 'Left early'];

function todayLocalDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Scan() {
  const location = useLocation();

  // ── Step 1 & 2: batch + date pickers (not yet "applied") ──
  const [batches, setBatches]   = useState([]);
  const [batchId, setBatchId]   = useState(location.state?.batchId || '');
  const [date, setDate]         = useState(location.state?.date || todayLocalDateString());

  // ── Step 3: applied selection that the roster is actually loaded for ──
  const [applied, setApplied]         = useState(null); // { batchId, date }
  const [students, setStudents]       = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // studentId -> { status, note }
  const [loadingRoster, setLoadingRoster] = useState(false);

  // ── Manual search / entry ──
  const [query, setQuery] = useState('');
  const [submittingId, setSubmittingId] = useState('');

  // ── Edit panel ──
  const [editingId, setEditingId] = useState('');
  const [editStatus, setEditStatus] = useState('PRESENT');
  const [editNote, setEditNote] = useState('');

  // ── Camera scan (optional secondary mode) ──
  const [mode, setMode] = useState('manual');
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef(null);

  // ── Load the coach's batches for the dropdown ──
  useEffect(() => {
    coachPortalAPI.getMyBatches()
      .then((res) => {
        const data = res.data.data || [];
        setBatches(data);
        if (!batchId && data.length === 1) setBatchId(data[0]._id);
      })
      .catch(() => toast.error('Failed to load batches'));
  }, []);

  // ── Apply: lock in batch + date, load roster + existing attendance ──
  const handleApply = useCallback(async () => {
    if (!batchId) { toast.error('Please select a batch first'); return; }
    if (!date)    { toast.error('Please select a date first'); return; }
    setLoadingRoster(true);
    try {
      const [studentsRes, attRes] = await Promise.all([
        coachPortalAPI.getMyStudents({ batchId }),
        coachPortalAPI.getAttendance({ batchId, date }),
      ]);
      setStudents(studentsRes.data.data || []);
      const map = {};
      (attRes.data.data || []).forEach((a) => {
        if (a.studentId?._id) map[a.studentId._id] = { status: a.status, note: a.note };
      });
      setAttendanceMap(map);
      setApplied({ batchId, date });
      setQuery('');
      setEditingId('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load roster for this batch/date');
    } finally {
      setLoadingRoster(false);
    }
  }, [batchId, date]);

  // Auto-apply once if we arrived here from "Take Attendance for This Batch"
  useEffect(() => {
    if (location.state?.batchId && !applied) {
      handleApply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mark / edit attendance for one student ──
  const markAttendance = useCallback(async (student, status, note, method = 'MANUAL') => {
    if (!applied) return;
    setSubmittingId(student._id);
    try {
      const res = await coachPortalAPI.scanAttendance({
        studentCode: student.studentCode,
        batchId: applied.batchId,
        date: applied.date,
        status,
        note,
        method,
      });
      setAttendanceMap((m) => ({ ...m, [student._id]: { status, note: res.data.data?.attendance?.note || note || '' } }));
      toast.success(res.data.message);
      setEditingId('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not update attendance');
    } finally {
      setSubmittingId('');
    }
  }, [applied]);

  // Used by the camera scanner (matches by scanned code against the roster)
  const markByCode = useCallback(async (studentCode) => {
    const student = students.find((s) => (s.studentCode || '').toUpperCase() === studentCode.trim().toUpperCase());
    if (!student) {
      toast.error('This ID card does not match anyone in the selected batch.');
      return;
    }
    await markAttendance(student, 'PRESENT', '', 'QR_SCAN');
  }, [students, markAttendance]);

  // ── Camera scanner — lazy load html5-qrcode ───────────────
  useEffect(() => {
    if (mode !== 'camera' || !applied) return;

    let html5QrCode = null;
    let cancelled   = false;

    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        html5QrCode = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            markByCode(decodedText.trim());
            try { html5QrCode.pause(true); } catch (_) {}
            setTimeout(() => {
              try { if (scannerRef.current) scannerRef.current.resume(); } catch (_) {}
            }, 2500);
          },
          () => {} // ignore per-frame "no QR" noise
        );
        setCameraError('');
      } catch (err) {
        if (cancelled) return;
        const msg = err?.message || 'Camera not accessible';
        setCameraError(msg);
        toast.error('Camera unavailable — use Manual Entry instead.');
        setMode('manual');
      }
    };

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => {}).finally(() => {
          try { scanner.clear(); } catch (_) {}
          scannerRef.current = null;
        });
      }
    };
  }, [mode, applied, markByCode]);

  // ── Filtered roster (manual search by name or Student ID) ──
  const filteredStudents = useMemo(() => {
    if (!query) return students;
    const q = query.toLowerCase();
    return students.filter((s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      (s.studentCode || '').toLowerCase().includes(q)
    );
  }, [students, query]);

  const openEdit = (student) => {
    const existing = attendanceMap[student._id];
    setEditingId(student._id);
    setEditStatus(existing?.status || 'PRESENT');
    setEditNote(existing?.note && !existing.note.startsWith('Marked ') ? existing.note : '');
  };

  const saveEdit = (student) => {
    markAttendance(student, editStatus, editNote.trim());
  };

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Select a batch and date, then apply to mark students" />

      {/* ── Step 1: Batch ── */}
      <FormField label="Step 1 · Batch" required>
        <Select
          value={batchId}
          onChange={(e) => { setBatchId(e.target.value); setApplied(null); }}
        >
          <option value="">Select a batch...</option>
          {batches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.title || `${b.dayOfWeek} ${b.startTime}–${b.endTime}`}
            </option>
          ))}
        </Select>
      </FormField>

      {/* ── Step 2: Date ── */}
      <FormField label="Step 2 · Date" required>
        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setApplied(null); }}
          style={{
            width: '100%', background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: '10px', padding: '12px 14px', color: '#0f172a', fontSize: '14.5px', outline: 'none',
          }}
        />
      </FormField>

      {/* ── Step 3: Apply ── */}
      <Btn full onClick={handleApply} disabled={!batchId || !date || loadingRoster} style={{ marginBottom: '18px' }}>
        {loadingRoster ? 'Loading…' : '✔ Apply'}
      </Btn>

      {!applied ? (
        <EmptyState icon="📋" text="Choose a batch and date, then tap Apply to load the roster." />
      ) : loadingRoster ? (
        <Spinner />
      ) : (
        <>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <Btn variant={mode === 'manual' ? 'primary' : 'dark'} onClick={() => setMode('manual')} style={{ flex: 1 }}>
              ⌨️ Manual Entry
            </Btn>
            <Btn variant={mode === 'camera' ? 'primary' : 'dark'} onClick={() => setMode('camera')} style={{ flex: 1 }}>
              📷 Camera Scan
            </Btn>
          </div>

          {mode === 'camera' && (
            <Card style={{ marginBottom: '16px' }}>
              {cameraError ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                  <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>
                    Camera not available: {cameraError}
                  </div>
                  <Btn variant="primary" onClick={() => setMode('manual')}>Switch to Manual Entry</Btn>
                </div>
              ) : (
                <>
                  <div id={SCANNER_ID} style={{ width: '100%', minHeight: '260px' }} />
                  <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '10px', marginBottom: 0 }}>
                    Point the camera at the QR code on the student's ID card. Marks them Present for {applied.date}.
                  </p>
                </>
              )}
            </Card>
          )}

          {/* ── Manual entry: search / enter Student ID, then Present / Absent / Edit ── */}
          <Card style={{ marginBottom: '16px' }}>
            <FormField label="Search or enter Student ID">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a name or student ID..."
                autoFocus
              />
            </FormField>

            {filteredStudents.length === 0 ? (
              <EmptyState icon="🔍" text="No students found in this batch." />
            ) : (
              filteredStudents.map((s) => {
                const record = attendanceMap[s._id];
                const isSubmitting = submittingId === s._id;
                const isEditing = editingId === s._id;

                return (
                  <div key={s._id} style={{ borderBottom: '1px solid #f1f5f9', padding: '10px 6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar photoUrl={s.photoUrl} firstName={s.firstName} lastName={s.lastName} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', color: '#0f172a', fontWeight: 600 }}>
                          {s.firstName} {s.lastName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {s.studentCode}
                        </div>
                      </div>
                      {record && <Badge label={record.status} />}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <Btn
                        variant="success"
                        disabled={isSubmitting}
                        onClick={() => markAttendance(s, 'PRESENT', '')}
                        style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }}
                      >
                        ✅ Present
                      </Btn>
                      <Btn
                        variant="danger"
                        disabled={isSubmitting}
                        onClick={() => markAttendance(s, 'ABSENT', '')}
                        style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }}
                      >
                        ❌ Absent
                      </Btn>
                      <Btn
                        variant="dark"
                        disabled={isSubmitting}
                        onClick={() => (isEditing ? setEditingId('') : openEdit(s))}
                        style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }}
                      >
                        ✏️ Edit
                      </Btn>
                    </div>

                    {isEditing && (
                      <div style={{ marginTop: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                        <FormField label="Status">
                          <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                            {STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </Select>
                        </FormField>
                        <FormField label="Remark (optional)">
                          <Input
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="e.g. Late 5 min"
                          />
                        </FormField>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                          {REMARK_SUGGESTIONS.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setEditNote(chip)}
                              style={{
                                background: '#eff6ff', border: '1px solid rgba(37,99,235,0.25)', color: '#2563eb',
                                borderRadius: '999px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
                              }}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Btn variant="dark" onClick={() => setEditingId('')} style={{ flex: 1 }}>Cancel</Btn>
                          <Btn disabled={isSubmitting} onClick={() => saveEdit(s)} style={{ flex: 1 }}>
                            {isSubmitting ? 'Saving…' : 'Save'}
                          </Btn>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </Card>
        </>
      )}
    </div>
  );
}