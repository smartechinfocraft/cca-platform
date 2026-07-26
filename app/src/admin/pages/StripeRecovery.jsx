import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { programsAPI, batchesAPI, registrationsAPI } from '../api/client';
import { PageHeader } from '../components/common/UI';

const EMPTY = {
  gateway: 'Stripe', paymentIntentId: '', programId: '', batchId: '', sessionsPerWeek: '1',
  parentName: '', email: '', phone: '', address: '', city: '', state: 'CA', zip: '',
  adminOrderNote: '',
};
const EMPTY_STUDENT = { firstName: '', lastName: '', dob: '', gender: '', schoolName: '', medicalNotes: '' };

export default function StripeRecovery() {
  const [form, setForm] = useState(EMPTY);
  const [programs, setPrograms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([{ ...EMPTY_STUDENT }]);
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
    String(item.program?._id || item.program || item.programId?._id || item.programId || '') === form.programId
  );
  const selectedBatch = availableBatches.find(item => item._id === form.batchId);
  const update = key => event => setForm(previous => ({ ...previous, [key]: event.target.value }));
  const updateStudent = (index, key, value) => setStudents(previous =>
    previous.map((student, position) => position === index ? { ...student, [key]: value } : student)
  );
  const addStudent = () => setStudents(previous => [...previous, { ...EMPTY_STUDENT }]);
  const removeStudent = index => setStudents(previous => previous.filter((_, position) => position !== index));

  const submit = async event => {
    event.preventDefault();
    setResult(null);
    if (form.gateway === 'Stripe' && !form.paymentIntentId.trim().startsWith('pi_')) return toast.error('PaymentIntent must begin with pi_.');
    if (!form.paymentIntentId.trim()) return toast.error('Enter the payment reference.');
    if (!selectedProgram || !selectedBatch) return toast.error('Select a program and batch.');
    if (students.some(student => !student.firstName.trim() || !student.lastName.trim())) return toast.error('Every student needs a first and last name.');
    if (!form.adminOrderNote.trim()) return toast.error('Enter the incident and recovery reason.');
    if (!confirmed) return toast.error('Confirm that you reviewed the recovery details.');
    if (!window.confirm(`Recover ${form.paymentIntentId.trim()} and send both confirmation emails?`)) return;

    setSaving(true);
    try {
      const payload = {
        ...(form.gateway === 'Stripe'
          ? { paymentIntentId: form.paymentIntentId.trim() }
          : { captureId: form.paymentIntentId.trim() }),
        selectedProgram: { _id: selectedProgram._id, title: selectedProgram.title },
        selectedBatch: {
          _id: selectedBatch._id,
          title: selectedBatch.title || selectedBatch.name,
          sessionsPerWeek: Number(form.sessionsPerWeek) || 1,
        },
        students: students.map(student => ({
          ...student,
          firstName: student.firstName.trim(),
          lastName: student.lastName.trim(),
          dob: student.dob || undefined,
        })),
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
        adminOrderNote: form.adminOrderNote.trim(),
      };
      const response = form.gateway === 'Stripe'
        ? await registrationsAPI.recoverStripe(payload)
        : await registrationsAPI.recoverPayPal(payload);
      setResult(response.data);
      toast.success(`${form.gateway} registration recovered.`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Recovery failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Payment Recovery" subtitle="Recover a successful Stripe or PayPal payment with no registration record." />
      <div style={styles.notice}>
        The payment is verified directly with its gateway. A confirmed registration is created and both customer and admin emails are sent.
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
        <Section title="Payment reference">
          <div style={styles.grid}>
            <Field label="Gateway" required>
              <select value={form.gateway} onChange={update('gateway')} style={styles.input}>
                <option value="Stripe">Stripe</option>
                <option value="PayPal">PayPal</option>
              </select>
            </Field>
            <Field label={form.gateway === 'Stripe' ? 'PaymentIntent ID' : 'PayPal capture ID'} required>
              <input value={form.paymentIntentId} onChange={update('paymentIntentId')} placeholder={form.gateway === 'Stripe' ? 'pi_...' : 'PayPal capture ID'} style={styles.input} required />
            </Field>
          </div>
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
            <Field label="Number of batch days" required>
              <select value={form.sessionsPerWeek} onChange={update('sessionsPerWeek')} style={styles.input}>
                {Array.from({ length: selectedBatch?.sessionsPerWeek || 3 }, (_, index) => index + 1).map(value => (
                  <option key={value} value={value}>
                    {value === 1 ? 'Once a week' : value === 2 ? 'Twice a week' : value === 3 ? 'Three times a week' : `${value} times a week`}
                  </option>
                ))}
              </select>
            </Field>
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
          {students.map((student, index) => (
            <div key={index} style={styles.studentCard}>
              <div style={styles.studentHeader}>
                <strong>Student {index + 1}</strong>
                {students.length > 1 && <button type="button" onClick={() => removeStudent(index)} style={styles.remove}>Remove</button>}
              </div>
              <div style={styles.grid}>
                <StudentField label="First name" value={student.firstName} onChange={value => updateStudent(index, 'firstName', value)} />
                <StudentField label="Last name" value={student.lastName} onChange={value => updateStudent(index, 'lastName', value)} />
                <StudentField label="Date of birth" type="date" value={student.dob} onChange={value => updateStudent(index, 'dob', value)} required={false} />
                <Field label="Gender">
                  <select value={student.gender} onChange={event => updateStudent(index, 'gender', event.target.value)} style={styles.input}>
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
                <StudentField label="School" value={student.schoolName} onChange={value => updateStudent(index, 'schoolName', value)} required={false} />
                <StudentField label="Medical notes" value={student.medicalNotes} onChange={value => updateStudent(index, 'medicalNotes', value)} required={false} />
              </div>
            </div>
          ))}
          <button type="button" onClick={addStudent} style={styles.add}>+ Add another student</button>
        </Section>

        <Section title="Admin backend order">
          <Field label="Incident and recovery reason" required>
            <textarea
              value={form.adminOrderNote}
              onChange={update('adminOrderNote')}
              style={{ ...styles.input, minHeight: 110, resize: 'vertical' }}
              placeholder="Explain what happened, why the original order was missing, and why this back order is being created."
              required
            />
          </Field>
          <label style={styles.checkbox}>
            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
            I reviewed the payment and registration details and authorize this Admin Backend Order. No customer waiver is being recorded.
          </label>
        </Section>

        <button type="submit" disabled={saving} style={{ ...styles.submit, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Verifying and recovering…' : `Recover ${form.gateway} registration`}
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
function StudentField({ label, type = 'text', value, onChange, required = true }) {
  return <Field label={label} required={required}><input type={type} value={value} onChange={event => onChange(event.target.value)} style={styles.input} required={required} /></Field>;
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
  checkbox: { display: 'flex', gap: 10, alignItems: 'flex-start', color: '#d8e2d8', lineHeight: 1.5 },
  studentCard: { border: '1px solid #36533b', borderRadius: 10, padding: 14, marginBottom: 14 },
  studentHeader: { display: 'flex', justifyContent: 'space-between', color: '#f5d97a', marginBottom: 10 },
  add: { border: '1px solid #d4af37', background: 'transparent', color: '#f5d97a', borderRadius: 7, padding: '8px 12px', cursor: 'pointer' },
  remove: { border: 0, background: 'transparent', color: '#fca5a5', cursor: 'pointer' },
  submit: { justifySelf: 'start', padding: '12px 20px', border: 0, borderRadius: 8, background: '#d4af37', color: '#0d1b0e', fontWeight: 800, cursor: 'pointer' },
};
