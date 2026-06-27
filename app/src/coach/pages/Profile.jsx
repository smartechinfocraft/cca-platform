// ============================================================
//  pages/Profile.js — Manage Profile
//  Coach can update phone/bio/experience/speciality/photo,
//  change their password, and log out. Username/coachUid are
//  shown read-only — only the admin can change those.
// ============================================================
import React, { useEffect, useState } from 'react';
import { coachPortalAPI } from '../api/client';
import { useCoachAuth } from '../context/AuthContext';
import { Card, PageHeader, Btn, Input, FormField, Spinner, Avatar } from '../components/UI';
import toast from 'react-hot-toast';

export default function Profile() {
  const { logout, refreshCoach } = useCoachAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ phone: '', bio: '', experience: '', speciality: '' });

  const [showPwForm, setShowPwForm] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    coachPortalAPI.getProfile()
      .then((res) => {
        setProfile(res.data.data);
        setForm({
          phone: res.data.data.phone || '',
          bio: res.data.data.bio || '',
          experience: res.data.data.experience || '',
          speciality: res.data.data.speciality || '',
        });
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const f = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  const pf = (field) => (e) => setPwForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await coachPortalAPI.updateProfile(form);
      toast.success('Profile updated');
      await refreshCoach();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      toast.error('Fill in both password fields');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setChangingPw(true);
    try {
      await coachPortalAPI.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPwForm(false);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your contact info and login" />

      <Card style={{ marginBottom: '16px', textAlign: 'center' }}>
        <Avatar photoUrl={profile.photoUrl} firstName={profile.firstName} lastName={profile.lastName} size={72} />
        <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginTop: '10px' }}>
          {profile.firstName} {profile.lastName}
        </div>
        <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>{profile.email}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '10px', fontSize: '12px' }}>
          <div>
            <span style={{ color: '#64748b' }}>Username: </span>
            <span style={{ color: '#F5D97A', fontFamily: 'monospace' }}>{profile.username}</span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Coach ID: </span>
            <span style={{ color: '#F5D97A', fontFamily: 'monospace' }}>{profile.coachUid}</span>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>Edit Details</div>
        <FormField label="Phone">
          <Input value={form.phone} onChange={f('phone')} placeholder="+1 408 555 0101" />
        </FormField>
        <FormField label="Speciality">
          <Input value={form.speciality} onChange={f('speciality')} placeholder="Batting, Fielding" />
        </FormField>
        <FormField label="Experience">
          <Input value={form.experience} onChange={f('experience')} placeholder="10 years" />
        </FormField>
        <FormField label="Bio">
          <textarea
            value={form.bio}
            onChange={f('bio')}
            rows={3}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.25)',
              borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical',
            }}
          />
        </FormField>
        <Btn full onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Btn>
      </Card>

      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Password</div>
          <Btn variant="ghost" onClick={() => setShowPwForm((s) => !s)}>
            {showPwForm ? 'Cancel' : 'Change'}
          </Btn>
        </div>
        {showPwForm && (
          <div style={{ marginTop: '14px' }}>
            <FormField label="Current Password" required>
              <Input type="password" value={pwForm.currentPassword} onChange={pf('currentPassword')} />
            </FormField>
            <FormField label="New Password" required>
              <Input type="password" value={pwForm.newPassword} onChange={pf('newPassword')} />
            </FormField>
            <FormField label="Confirm New Password" required>
              <Input type="password" value={pwForm.confirmPassword} onChange={pf('confirmPassword')} />
            </FormField>
            <Btn full onClick={handleChangePassword} disabled={changingPw}>
              {changingPw ? 'Updating...' : 'Update Password'}
            </Btn>
          </div>
        )}
      </Card>

      <Btn full variant="danger" onClick={logout}>Log Out</Btn>
    </div>
  );
}
