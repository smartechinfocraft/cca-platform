// ============================================================
//  pages/Scan.jsx — Scan ID Card to Mark Attendance
//  Fixed: lazy-loads html5-qrcode so a camera/import error
//  never crashes the whole page (blank white screen bug).
//  India-safe: defaults to Manual mode so coaches can always
//  mark attendance even without camera access.
// ============================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { coachPortalAPI } from '../api/client';
import { Card, PageHeader, Btn, Input, FormField, EmptyState, Avatar } from '../components/UI';
import toast from 'react-hot-toast';

const SCANNER_ID = 'qr-reader-region';

export default function Scan() {
  const location = useLocation();
  const [batches, setBatches]           = useState([]);
  const [batchId, setBatchId]           = useState(location.state?.batchId || '');
  // Default to 'manual' — camera is unreliable on desktop/Windows/India
  const [mode, setMode]                 = useState('manual');
  const [lastResult, setLastResult]     = useState(null);
  const [manualQuery, setManualQuery]   = useState('');
  const [manualResults, setManualResults] = useState([]);
  const [submitting, setSubmitting]     = useState(false);
  const [cameraError, setCameraError]   = useState('');

  const scannerRef = useRef(null);

  // ── Load batches ──────────────────────────────────────────
  useEffect(() => {
    coachPortalAPI.getMyBatches()
      .then((res) => {
        const data = res.data.data || [];
        setBatches(data);
        if (!batchId && data.length === 1) setBatchId(data[0]._id);
      })
      .catch(() => toast.error('Failed to load batches'));
  }, []);

  // ── Submit attendance ─────────────────────────────────────
  const submitAttendance = useCallback(async (studentCode, method) => {
    if (!batchId) { toast.error('Please select a batch first'); return; }
    setSubmitting(true);
    try {
      const res = await coachPortalAPI.scanAttendance({ studentCode, batchId, method });
      setLastResult({ success: true, message: res.data.message, student: res.data.data?.student });
      toast.success(res.data.message);
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not mark attendance';
      setLastResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [batchId]);

  // ── Camera scanner — lazy load html5-qrcode ───────────────
  useEffect(() => {
    if (mode !== 'camera' || !batchId) return;

    let html5QrCode = null;
    let cancelled   = false;

    const start = async () => {
      try {
        // Lazy import so a missing/crashing module never blanks the page
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        html5QrCode = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            submitAttendance(decodedText.trim(), 'QR_SCAN');
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
  }, [mode, batchId, submitAttendance]);

  // ── Manual search ─────────────────────────────────────────
  const handleManualSearch = useCallback(async (q) => {
    setManualQuery(q);
    if (!batchId) return;
    try {
      const res = await coachPortalAPI.getMyStudents({ batchId });
      const list = (res.data.data || []).filter((s) =>
        !q ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q.toLowerCase()) ||
        (s.studentCode || '').toLowerCase().includes(q.toLowerCase())
      );
      setManualResults(list);
    } catch {
      setManualResults([]);
    }
  }, [batchId]);

  useEffect(() => {
    if (mode === 'manual' && batchId) handleManualSearch('');
  }, [mode, batchId, handleManualSearch]);

  return (
    <div>
      <PageHeader title="Scan ID Card" subtitle="Mark attendance by scanning or searching" />

      {/* Batch selector */}
      <FormField label="Batch" required>
        <select
          value={batchId}
          onChange={(e) => { setBatchId(e.target.value); setLastResult(null); setManualQuery(''); }}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(212,175,55,0.25)',
            borderRadius: '10px', padding: '12px 14px',
            color: '#fff', fontSize: '15px', outline: 'none',
          }}
        >
          <option value="">Select a batch...</option>
          {batches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.title || `${b.dayOfWeek} ${b.startTime}–${b.endTime}`}
            </option>
          ))}
        </select>
      </FormField>

      {!batchId ? (
        <EmptyState icon="📋" text="Select a batch above to start marking attendance." />
      ) : (
        <>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <Btn
              variant={mode === 'manual' ? 'primary' : 'dark'}
              onClick={() => setMode('manual')}
              style={{ flex: 1 }}
            >
              ⌨️ Manual Entry
            </Btn>
            <Btn
              variant={mode === 'camera' ? 'primary' : 'dark'}
              onClick={() => setMode('camera')}
              style={{ flex: 1 }}
            >
              📷 Camera Scan
            </Btn>
          </div>

          {/* Manual entry panel */}
          {mode === 'manual' && (
            <Card style={{ marginBottom: '16px' }}>
              <FormField label="Search student by name or ID">
                <Input
                  value={manualQuery}
                  onChange={(e) => handleManualSearch(e.target.value)}
                  placeholder="Type a name or student ID..."
                  autoFocus
                />
              </FormField>

              {manualResults.length === 0 ? (
                <EmptyState icon="🔍" text="No students found in this batch." />
              ) : (
                manualResults.map((s) => (
                  <div
                    key={s._id}
                    onClick={() => !submitting && submitAttendance(s.studentCode, 'MANUAL')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 6px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    <Avatar photoUrl={s.photoUrl} firstName={s.firstName} lastName={s.lastName} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13.5px', color: '#fff', fontWeight: 600 }}>
                        {s.firstName} {s.lastName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {s.studentCode}
                      </div>
                    </div>
                    <Btn
                      variant="ghost"
                      disabled={submitting}
                      style={{ padding: '6px 14px', fontSize: '12px' }}
                    >
                      Mark Present
                    </Btn>
                  </div>
                ))
              )}
            </Card>
          )}

          {/* Camera scanner panel */}
          {mode === 'camera' && (
            <Card style={{ marginBottom: '16px' }}>
              {cameraError ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                  <div style={{ color: '#fca5a5', fontSize: '13px', marginBottom: '12px' }}>
                    Camera not available: {cameraError}
                  </div>
                  <Btn variant="primary" onClick={() => setMode('manual')}>
                    Switch to Manual Entry
                  </Btn>
                </div>
              ) : (
                <>
                  <div id={SCANNER_ID} style={{ width: '100%', minHeight: '260px' }} />
                  <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '10px', marginBottom: 0 }}>
                    Point the camera at the QR code on the student's ID card.
                  </p>
                </>
              )}
            </Card>
          )}

          {/* Last result banner */}
          {lastResult && (
            <Card style={{
              borderColor: lastResult.success ? 'rgba(34,197,94,0.4)' : 'rgba(220,38,38,0.4)',
              background:  lastResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(220,38,38,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>{lastResult.success ? '✅' : '⚠️'}</span>
                <div style={{ fontSize: '13.5px', color: lastResult.success ? '#86efac' : '#fca5a5' }}>
                  {lastResult.message}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}