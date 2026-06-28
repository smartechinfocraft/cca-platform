// ============================================================
//  pages/dashboard/ProfilePage.tsx
//  Lets the parent view and edit every piece of their own
//  account information: contact details, address, profile
//  photo, and password.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { HiOutlineCamera, HiOutlineCheckCircle } from "react-icons/hi2";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import {
  getParentProfile,
  updateParentProfile,
  updateParentPassword,
  uploadParentPhoto,
} from "../../services/parentDashboardService";
import type { ParentProfile } from "../../types/parentDashboard";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

function ProfilePage() {
  const { token, updateUser } = useAuth();
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    address: "", city: "", state: "", zip: "",
  });

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    getParentProfile(token)
      .then((p) => {
        setProfile(p);
        setForm({
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          email: p.email || "",
          phone: p.phone || "",
          address: p.address || "",
          city: p.city || "",
          state: p.state || "",
          zip: p.zip || "",
        });
      })
      .catch(() => setError("Couldn't load your profile. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("First name, last name, email and phone are required.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateParentProfile(token, form);
      setProfile(updated);
      updateUser({ firstName: updated.firstName, lastName: updated.lastName, email: updated.email, phone: updated.phone });
      toast.success("Profile updated successfully.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Couldn't update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      toast.error("Please upload a JPG or PNG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be smaller than 5MB.");
      return;
    }

    setUploading(true);
    try {
      const updated = await uploadParentPhoto(token, file);
      setProfile(updated);
      toast.success("Photo updated.");
    } catch {
      toast.error("Couldn't upload the photo. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }
    if (pwForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("New password and confirmation don't match.");
      return;
    }

    setPwSaving(true);
    try {
      await updateParentPassword(token, pwForm.currentPassword, pwForm.newPassword);
      toast.success("Password updated successfully.");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Couldn't update password.");
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-slate-200 rounded-full" />
        <div className="h-96 rounded-3xl bg-white ring-1 ring-slate-200/60" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">Manage Profile</h1>
        <p className="text-slate-500 mt-1">Update your contact information, address, and password.</p>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">{error}</div>
      )}

      {/* Photo */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 flex items-center gap-5">
        <div className="relative flex-shrink-0">
          {profile?.photoUrl ? (
            <img src={profile.photoUrl} alt="Profile" className="w-20 h-20 rounded-2xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center text-xl font-bold">
              {form.firstName[0]}{form.lastName[0]}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#A33B2B] text-white flex items-center justify-center shadow-md hover:bg-orange-600 transition disabled:opacity-60"
            aria-label="Change photo"
            title="Change photo"
          >
            <HiOutlineCamera className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>
        <div>
          <p className="font-bold text-[#0F172A]">{form.firstName} {form.lastName}</p>
          <p className="text-sm text-slate-500">{form.email}</p>
          <p className="text-xs text-slate-400 mt-1">JPG or PNG, up to 5MB.</p>
        </div>
      </div>

      {/* Profile info form */}
      <form onSubmit={handleSaveProfile} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 space-y-5">
        <h2 className="text-lg font-bold text-[#0F172A]">Personal Information</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="First Name" value={form.firstName} onChange={handleChange("firstName")} required />
          <Field label="Last Name" value={form.lastName} onChange={handleChange("lastName")} required />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Email" type="email" value={form.email} onChange={handleChange("email")} required />
          <Field label="Phone" type="tel" value={form.phone} onChange={handleChange("phone")} required />
        </div>

        <Field label="Address" value={form.address} onChange={handleChange("address")} />

        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="City" value={form.city} onChange={handleChange("city")} />
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">State</label>
            <select
              value={form.state}
              onChange={handleChange("state")}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#A33B2B] bg-white"
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Field label="ZIP Code" value={form.zip} onChange={handleChange("zip")} />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-[#A33B2B] text-white px-6 py-3 text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-60"
        >
          <HiOutlineCheckCircle className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* Password form */}
      <form onSubmit={handleChangePassword} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 space-y-5">
        <h2 className="text-lg font-bold text-[#0F172A]">Change Password</h2>

        <Field
          label="Current Password" type="password" value={pwForm.currentPassword}
          onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="New Password" type="password" value={pwForm.newPassword}
            onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
          />
          <Field
            label="Confirm New Password" type="password" value={pwForm.confirmPassword}
            onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          />
        </div>

        <button
          type="submit"
          disabled={pwSaving}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 text-[#0F172A] px-6 py-3 text-sm font-semibold hover:border-[#A33B2B] transition disabled:opacity-60"
        >
          {pwSaving ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required = false,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-[#A33B2B]"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#A33B2B]"
      />
    </div>
  );
}

export default ProfilePage;
