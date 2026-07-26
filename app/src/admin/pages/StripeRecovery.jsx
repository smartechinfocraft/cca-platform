import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { programsAPI, batchesAPI, registrationsAPI } from '../api/client';
import { PageHeader } from '../components/common/UI';

const EMPTY = {
  paymentIntentId: '', programId: '', batchId: '', sessionsPerWeek: '1',
  parentName: '', email: '', phone: '', address: '', city: '', state: 'CA', zip: '',
  studentFirstName: '', studentLastName: '', dob: '', gender: '', schoolName: '', medicalNotes: '',
  waiverSignature: '',
};

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);

  const point = event => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    };
  };
  const start = event => {
    drawing.current = true;
    const p = point(event);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = event => {
    if (!drawing.current) return;
    const p = point(event);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width="900"
        height="180"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        style={styles.canvas}
      />
      <button type="button" onClick={clear} style={styles.clear}>Clear signature</button>
    </div>
  );
}

export default function StripeRecovery() {
  const [form, setForm] = useState(EMPTY);
  const [programs, setPrograms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [drawnSignature, setDrawnSignature] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    Promise.all([programsAPI.getAll({ active: true }), batchesAPI.getAll({ active: true })])
      .then(([programResponse, batchResponse]) => {
        setPrograms(programResponse.data.data || []);
        setBatches(batchResponse.data.data || []);
      })
      .catch(() => toast.error('Could not load programs and batches.'));
  }, []);

  const selectedProgram = programs.find(item => item._id === form.programId);
  const availableBatches = batches.filter(item =>
    String(item.programId?._id || item.programId || '') === form.programId
  );
  const selectedBatch = availableBatches.find(item => item._id === form.batchId);
  const update = key => event => setForm(previous => ({ ...previous, [key]: event.target.value }));

  const submit = async event => {
    event.preventDefault();
    setResult(null);
    if (!form.paymentIntentId.trim().startsWith('pi_')) return toast.error('PaymentIntent must begin with pi_.');
    if (!selectedProgram || !selectedBatch) return toast.error('Select a program and batch.');
    if (!drawnSignature) return toast.error('Draw the waiver signature.');
    if (!confirmed) return toast.error('Confirm that you reviewed the recovery details.');
    if (!window.confirm(`Recover ${form.paymentIntentId.trim()} and send both confirmation emails?`)) return;

    setSaving(true);
    try {
      const response = await registrationsAPI.recoverStripe({
        paymentIntentId: form.paymentIntentId.trim(),
        selectedProgram: { _id: selectedProgram._id, title: selectedProgram.title },
        selectedBatch: {
          _id: selectedBatch._id,
          title: selectedBatch.title || selectedBatch.name,
          sessionsPerWeek: Number(form.sessionsPerWeek) || 1,
        },
        students: [{
          firstName: form.studentFirstName.trim(),
          lastName: form.studentLastName.trim(),
          dob: form.dob || undefined,
          gender: form.gender,
          schoolName: form.schoolName.trim(),
          medicalNotes: form.medicalNotes.trim(),
        }],
        parent: {
          parentName: form.parentName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zip: form.zip.trim(),
        },
        sessionsPerWeek: Number(form.sessionsPerWeek) || 1,
        waiverConsent: {
          accepted: true,
          signature: form.waiverSignature.trim(),
          drawnSignature,
          agreementVersion: 'CCA-WAIVER-2025-10-30',
        },
      });
      setResult(response.data);
      toast.success('Stripe registration recovered.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Recovery failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Stripe Recovery" subtitle="Recover a successful Stripe payment with no registration record." />
      <div style={styles.notice}>
        The payment is verified directly with Stripe. A confirmed registration is created and both customer and admin emails are sent.
      </div>

      {result && (
        <div style={styles.success}>
          <strong>Recovered registration {result.registrationNumber}</strong>
          <span>{result.paymentStatus} · ${Number(result.totalAmount || 0).toFixed(2)}</span>
          <span>
            Email: {result.confirmationEmailSent
              ? 'customer and admin copies sent'
              : `not sent — ${result.confirmationEmailError || 'check backend logs'}`}
          </span>
          <a href="/admin/registrations" style={styles.link}>Open registrations</a>
        </div>
      )}

      <form onSubmit={submit} style={styles.form}>
        <Section title="Stripe payment">
          <Field label="PaymentIntent ID" required>
            <input value={form.paymentIntentId} onChange={update('paymentIntentId')} placeholder="pi_..." style={styles.input} required />
          </Field>
        </Section>

        <Section title="Program and batch">
          <div style={styles.grid}>
            <Field label="Program" required>
              <select
                value={form.programId}
                onChange={event => setForm(previous => ({ ...previous, programId: event.target.value, batchId: '' }))}
                style={styles.input}
                required
              >
                <option value="">Select program</option>
                {programs.map(item => <option key={item._id} value={item._id}>{item.title}</option>)}
              </select>
            </Field>
            <Field label="Batch" required>
              <select value={form.batchId} onChange={update('batchId')} style={styles.input} disabled={!form.programId} required>
                <option value="">Select batch</option>
                {availableBatches.map(item => <option key={item._id} value={item._id}>{item.title || item.name}</option>)}
              </select>
            </Field>
            <TextField label="Sessions per week" name="sessionsPerWeek" type="number" form={form} update={update} />
          </div>
        </Section>

        <Section title="Parent details">
          <div style={styles.grid}>
            <TextField label="Parent name" name="parentName" form={form} update={update} />
            <TextField label="Email" name="email" type="email" form={form} update={update} />
            <TextField label="Phone" name="phone" form={form} update={update} />
            <TextField label="Street address" name="address" form={form} update={update} />
            <TextField label="City" name="city" form={form} update={update} />
            <TextField label="State" name="state" form={form} update={update} />
            <TextField label="ZIP" name="zip" form={form} update={update} />
          </div>
        </Section>

        <Section title="Student details">
          <div style={styles.grid}>
            <TextField label="First name" name="studentFirstName" form={form} update={update} />
            <TextField label="Last name" name="studentLastName" form={form} update={update} />
            <TextField label="Date of birth" name="dob" type="date" form={form} update={update} required={false} />
            <Field label="Gender">
              <select value={form.gender} onChange={update('gender')} style={styles.input}>
                <option value="">Not specified</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <TextField label="School" name="schoolName" form={form} update={update} required={false} />
            <TextField label="Medical notes" name="medicalNotes" form={form} update={update} required={false} />
          </div>
        </Section>

        <Section title="Waiver record">
          <Field label="Typed parent signature" required>
            <input value={form.waiverSignature} onChange={update('waiverSignature')} style={styles.input} required />
          </Field>
          <Field label="Drawn signature" required><SignaturePad onChange={setDrawnSignature} /></Field>
          <label style={styles.checkbox}>
            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
            I reviewed the Stripe payment and registration details and am authorized to recover this registration.
          </label>
        </Section>

        <button type="submit" disabled={saving} style={{ ...styles.submit, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Verifying and recovering…' : 'Recover Stripe registration'}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return <section style={styles.section}><h2 style={styles.heading}>{title}</h2>{children}</section>;
}
function Field({ label, required, children }) {
  return <label style={styles.field}><span style={styles.label}>{label}{required ? ' *' : ''}</span>{children}</label>;
}
function TextField({ label, name, type = 'text', form, update, required = true }) {
  return (
    <Field label={label} required={required}>
      <input type={type} min={type === 'number' ? 1 : undefined} value={form[name]} onChange={update(name)} style={styles.input} required={required} />
    </Field>
  );
}

const styles = {
  notice: { padding: 16, borderRadius: 10, background: '#2a2410', border: '1px solid #8a6d1d', color: '#f5d97a', marginBottom: 18, lineHeight: 1.5 },
  success: { display: 'grid', gap: 6, padding: 18, borderRadius: 10, background: '#12351c', border: '1px solid #2f855a', color: '#dcfce7', marginBottom: 18 },
  link: { color: '#f5d97a', fontWeight: 700, marginTop: 4 },
  form: { display: 'grid', gap: 18 },
  section: { background: '#142317', border: '1px solid #2c4430', borderRadius: 12, padding: 20 },
  heading: { color: '#f5d97a', fontSize: 17, margin: '0 0 16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  field: { display: 'grid', gap: 7, marginBottom: 12 },
  label: { color: '#d8e2d8', fontSize: 13, fontWeight: 600 },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #475569', background: '#f8fafc', color: '#0f172a', fontSize: 14 },
  canvas: { width: '100%', height: 130, background: '#fff', border: '1px solid #475569', borderRadius: 8, touchAction: 'none' },
  clear: { marginTop: 8, border: '1px solid #64748b', background: 'transparent', color: '#cbd5e1', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' },
  checkbox: { display: 'flex', gap: 10, alignItems: 'flex-start', color: '#d8e2d8', lineHeight: 1.5 },
  submit: { justifySelf: 'start', padding: '12px 20px', border: 0, borderRadius: 8, background: '#d4af37', color: '#0d1b0e', fontWeight: 800, cursor: 'pointer' },
};
