import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { siteSettingsAPI } from '../api/client';
import { PageHeader } from '../components/common/UI';

const defaults = { maintenanceEnabled: false, maintenanceTitle: 'We are improving your experience', maintenanceMessage: 'Our website is temporarily unavailable while we make a few improvements. Please check back shortly.', maintenanceContactEmail: 'calcricket_academy@yahoo.com' };

export default function SiteSettings() {
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { siteSettingsAPI.get().then(({ data }) => setForm({ ...defaults, ...data.data })).catch(error => toast.error(error.response?.data?.message || 'Could not load site settings.')).finally(() => setLoading(false)); }, []);
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const save = async event => {
    event.preventDefault(); setSaving(true);
    try {
      const { data } = await siteSettingsAPI.update({ maintenanceEnabled: Boolean(form.maintenanceEnabled), maintenanceTitle: form.maintenanceTitle, maintenanceMessage: form.maintenanceMessage, maintenanceContactEmail: form.maintenanceContactEmail });
      setForm({ ...defaults, ...data.data });
      toast.success(form.maintenanceEnabled ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.');
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save site settings.'); }
    finally { setSaving(false); }
  };
  if (loading) return <div style={{ color: '#F5D97A', padding: 24 }}>Loading site settings...</div>;
  return <div>
    <PageHeader title="Site Maintenance" subtitle="Temporarily replace public and customer-facing pages with a maintenance notice." />
    <form onSubmit={save} style={styles.card}>
      <div style={{ ...styles.status, ...(form.maintenanceEnabled ? styles.statusOn : styles.statusOff) }}>
        <div><strong>{form.maintenanceEnabled ? 'Maintenance mode is ON' : 'Website is LIVE'}</strong><div style={styles.help}>{form.maintenanceEnabled ? 'Visitors currently see the maintenance page.' : 'Visitors can access the website normally.'}</div></div>
        <label style={styles.switchLabel}><input type="checkbox" checked={form.maintenanceEnabled} onChange={event => setForm(current => ({ ...current, maintenanceEnabled: event.target.checked }))} /><span>{form.maintenanceEnabled ? 'Enabled' : 'Disabled'}</span></label>
      </div>
      <label style={styles.field}>Page title<input style={styles.input} name="maintenanceTitle" maxLength={120} required value={form.maintenanceTitle} onChange={update} /></label>
      <label style={styles.field}>Message<textarea style={{ ...styles.input, minHeight: 130, resize: 'vertical' }} name="maintenanceMessage" maxLength={1000} required value={form.maintenanceMessage} onChange={update} /></label>
      <label style={styles.field}>Contact email<input style={styles.input} name="maintenanceContactEmail" type="email" maxLength={254} value={form.maintenanceContactEmail} onChange={update} /></label>
      <div style={styles.notice}><strong>Safe access:</strong> /login and every /admin page remain available while maintenance mode is enabled.</div>
      <button type="submit" disabled={saving} style={{ ...styles.button, opacity: saving ? .65 : 1 }}>{saving ? 'Saving...' : 'Save Maintenance Settings'}</button>
    </form>
  </div>;
}

const styles = {
  card: { maxWidth: 760, padding: 28, borderRadius: 16, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(212,175,55,.18)', color: '#fff' },
  status: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: 18, borderRadius: 12, marginBottom: 24 },
  statusOn: { background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.35)' }, statusOff: { background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)' },
  help: { marginTop: 4, color: 'rgba(255,255,255,.55)', fontSize: 13 }, switchLabel: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#F5D97A', fontWeight: 700 },
  field: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18, fontSize: 13, fontWeight: 700, color: '#F5D97A' }, input: { width: '100%', boxSizing: 'border-box', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(0,0,0,.2)', color: '#fff', padding: '11px 12px', font: 'inherit', fontWeight: 400 },
  notice: { padding: 14, borderRadius: 9, background: 'rgba(212,175,55,.08)', color: 'rgba(255,255,255,.65)', fontSize: 13, marginBottom: 20 }, button: { border: 0, borderRadius: 9, padding: '12px 18px', cursor: 'pointer', background: 'linear-gradient(135deg,#D4AF37,#F5D97A)', color: '#0a2416', fontWeight: 800 },
};
