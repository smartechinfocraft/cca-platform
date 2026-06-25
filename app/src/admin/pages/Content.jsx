// ============================================================
//  pages/Content.js — Both Admins
//  FIXED: Gallery — shows existing images when editing, proper
//         cover selection, delete individual images, full grid
//  ISSUE 7: All URL fields → real file uploads
// ============================================================
import React, { useEffect, useState, useRef } from 'react';
import { contentAPI } from '../api/client';
import {
  PageHeader, Modal, Btn, Badge,
  FormField, Input, Textarea, Select
} from '../components/common/UI';
import toast from 'react-hot-toast';

// ── Constants ──────────────────────────────────────────────
const ALLOWED_IMG_EXT  = ['.jpg', '.jpeg', '.png'];
const ALLOWED_IMG_MIME = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_IMG_SIZE     = 2 * 1024 * 1024;   // 2 MB per image
const MAX_PDF_SIZE     = 20 * 1024 * 1024;  // 20 MB

// ── Reusable: single image upload field ───────────────────
function ImageUploadField({ label, currentUrl, onFileSelect, required, hint }) {
  const inputRef = useRef();
  const [preview,  setPreview]  = useState(currentUrl || null);
  const [fileName, setFileName] = useState('');

  useEffect(() => { setPreview(currentUrl || null); setFileName(''); }, [currentUrl]);

  const validate = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_IMG_EXT.includes(ext) || !ALLOWED_IMG_MIME.includes(file.type)) {
      toast.error('Only JPG, JPEG, PNG allowed'); return false;
    }
    if (file.size > MAX_IMG_SIZE) { toast.error('Image must be under 2 MB'); return false; }
    return true;
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (!file || !validate(file)) { e.target.value = ''; return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
    onFileSelect(file);
  };

  return (
    <FormField label={label} required={required}>
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png"
        style={{ display: 'none' }} onChange={handleChange} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
        {/* Preview box */}
        <div onClick={() => inputRef.current.click()} style={{
          width: '110px', height: '80px', borderRadius: '8px', cursor: 'pointer',
          border: '2px dashed rgba(212,175,55,0.4)',
          background: preview ? 'transparent' : 'rgba(255,255,255,0.03)',
          overflow: 'hidden', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0, position: 'relative',
        }}>
          {preview
            ? <img src={preview} alt="preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <span style={{ fontSize: '24px', color: 'rgba(255,255,255,0.2)' }}>🖼️</span>}
          <div style={{
            position:'absolute', bottom:0, left:0, right:0,
            background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:'10px',
            textAlign:'center', padding:'3px',
          }}>{preview ? 'Change' : 'Upload'}</div>
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <Btn variant="ghost" small onClick={() => inputRef.current.click()}
            style={{ marginBottom: '6px' }}>📁 Choose Image</Btn>
          <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', lineHeight:'1.5' }}>
            {fileName
              ? <span style={{ color:'#86efac' }}>✔ {fileName}</span>
              : (hint || 'No file chosen')}
            <br/>JPG, JPEG or PNG — max 2 MB
          </div>
        </div>
      </div>
    </FormField>
  );
}

// ── Reusable: PDF upload field ─────────────────────────────
function PdfUploadField({ label, currentName, onFileSelect, required }) {
  const inputRef = useRef();
  const [fileName, setFileName] = useState(currentName || '');

  useEffect(() => { setFileName(currentName || ''); }, [currentName]);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (ext !== '.pdf') { toast.error('Only PDF files allowed'); e.target.value = ''; return; }
    if (file.size > MAX_PDF_SIZE) { toast.error('PDF must be under 20 MB'); e.target.value = ''; return; }
    setFileName(file.name);
    onFileSelect(file);
  };

  return (
    <FormField label={label} required={required}>
      <input ref={inputRef} type="file" accept=".pdf"
        style={{ display: 'none' }} onChange={handleChange} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <Btn variant="ghost" small onClick={() => inputRef.current.click()}>📄 Choose PDF</Btn>
        <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)' }}>
          {fileName
            ? <span style={{ color:'#86efac' }}>✔ {fileName}</span>
            : 'No file chosen — PDF only, max 20 MB'}
        </div>
      </div>
    </FormField>
  );
}

// ── FIXED: multi-image picker with existing images support ─
// Props:
//   existingImages: [{ url, isCover }]  – from DB when editing
//   onFilesSelect(newFiles, coverIdx)
//   onExistingCoverChange(idx)  – when cover changed among existing
function MultiImageField({ label, existingImages = [], onFilesSelect, onExistingCoverChange, maxCount = 100 }) {
  const inputRef = useRef();
  const [newPreviews, setNewPreviews]   = useState([]);  // DataURLs for new files
  const [newFiles, setNewFiles]         = useState([]);
  const [newCoverIdx, setNewCoverIdx]   = useState(0);
  const [existCoverIdx, setExistCoverIdx] = useState(
    () => Math.max(0, existingImages.findIndex(i => i.isCover))
  );
  // Which pool is active: 'existing' | 'new'
  const [coverPool, setCoverPool]       = useState(existingImages.length > 0 ? 'existing' : 'new');

  // Reset when existingImages prop changes (e.g. new edit session)
  useEffect(() => {
    setNewPreviews([]);
    setNewFiles([]);
    setNewCoverIdx(0);
    const ci = Math.max(0, existingImages.findIndex(i => i.isCover));
    setExistCoverIdx(ci);
    setCoverPool(existingImages.length > 0 ? 'existing' : 'new');
  }, [existingImages]);

  const validateFile = (f) => {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_IMG_EXT.includes(ext) || !ALLOWED_IMG_MIME.includes(f.type)) {
      toast.error(`${f.name} skipped — only JPG/JPEG/PNG`); return false;
    }
    if (f.size > MAX_IMG_SIZE) {
      toast.error(`${f.name} skipped — exceeds 2 MB`); return false;
    }
    return true;
  };

  const handleChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > maxCount) { toast.error(`Max ${maxCount} images`); return; }
    const valid = files.filter(validateFile);
    if (valid.length === 0) return;

    const previews = new Array(valid.length);
    let loaded = 0;
    valid.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        previews[i] = ev.target.result;
        loaded++;
        if (loaded === valid.length) {
          setNewPreviews(previews);
          setNewFiles(valid);
          setNewCoverIdx(0);
          setCoverPool('new');
          onFilesSelect(valid, 0);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleNewCover = (idx) => {
    setNewCoverIdx(idx);
    setCoverPool('new');
    onFilesSelect(null, idx);
  };

  const handleExistCover = (idx) => {
    setExistCoverIdx(idx);
    setCoverPool('existing');
    onExistingCoverChange(idx);
  };

  const totalNew = newPreviews.length;
  const totalExist = existingImages.length;

  return (
    <FormField label={label}>
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png"
        multiple style={{ display: 'none' }} onChange={handleChange} />

      <Btn variant="ghost" small onClick={() => inputRef.current.click()}
        style={{ marginBottom: '10px' }}>
        🖼️ {totalNew > 0 ? `Replace images (${totalNew} chosen)` : `Choose Images (up to ${maxCount})`}
      </Btn>
      <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.35)', marginBottom:'10px' }}>
        JPG / JPEG / PNG — max 2 MB each — up to {maxCount} photos.
        Click any photo to set it as the <strong style={{ color:'#F5D97A' }}>cover image</strong>.
      </div>

      {/* EXISTING images (when editing) */}
      {totalExist > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', marginBottom:'6px', letterSpacing:'0.05em', textTransform:'uppercase' }}>
            Saved photos ({totalExist}) — click to set cover
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
            gap: '6px', maxHeight: '200px', overflowY: 'auto',
            padding: '8px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px',
          }}>
            {existingImages.map((img, i) => {
              const isCover = coverPool === 'existing' && i === existCoverIdx;
              return (
                <div key={i} onClick={() => handleExistCover(i)} style={{
                  position: 'relative', cursor: 'pointer',
                  border: `2px solid ${isCover ? '#D4AF37' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '6px', overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}>
                  <img
                    src={img.url}
                    alt={`saved-${i}`}
                    style={{ width:'100%', height:'60px', objectFit:'cover', display:'block' }}
                    onError={e => { e.target.style.display='none'; }}
                  />
                  {isCover && (
                    <div style={{
                      position:'absolute', top:'2px', left:'2px',
                      background:'#D4AF37', color:'#000', fontSize:'8px',
                      fontWeight:'700', padding:'1px 4px', borderRadius:'3px',
                    }}>COVER</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NEW images preview */}
      {totalNew > 0 && (
        <div>
          <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', marginBottom:'6px', letterSpacing:'0.05em', textTransform:'uppercase' }}>
            New uploads ({totalNew}) — will replace saved photos on save
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
            gap: '6px', maxHeight: '240px', overflowY: 'auto',
            padding: '8px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px',
          }}>
            {newPreviews.map((src, i) => {
              const isCover = coverPool === 'new' && i === newCoverIdx;
              return (
                <div key={i} onClick={() => handleNewCover(i)} style={{
                  position: 'relative', cursor: 'pointer',
                  border: `2px solid ${isCover ? '#D4AF37' : 'transparent'}`,
                  borderRadius: '6px', overflow: 'hidden',
                }}>
                  <img src={src} alt={`new-${i}`}
                    style={{ width:'100%', height:'60px', objectFit:'cover', display:'block' }} />
                  {isCover && (
                    <div style={{
                      position:'absolute', top:'2px', left:'2px',
                      background:'#D4AF37', color:'#000', fontSize:'8px',
                      fontWeight:'700', padding:'1px 4px', borderRadius:'3px',
                    }}>COVER</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </FormField>
  );
}

// ═══════════════════════════════════════════════════════════
//  FAQ Section
// ═══════════════════════════════════════════════════════════
function FAQSection() {
  const [faqs, setFaqs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState({ question:'', answer:'', category:'General', sortOrder:'0', isActive:true });
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await contentAPI.getFAQs(); setFaqs(r.data.data); }
    catch { toast.error('Failed to load FAQs'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ question:'', answer:'', category:'General', sortOrder:'0', isActive:true });
    setModalOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ question: row.question||'', answer: row.answer||'', category: row.category||'General', sortOrder: String(row.sortOrder||0), isActive: row.isActive!==false });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.question || !form.answer) { toast.error('Question and answer required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, sortOrder: parseInt(form.sortOrder)||0 };
      if (editing) { await contentAPI.updateFAQ(editing._id, payload); toast.success('FAQ updated!'); }
      else         { await contentAPI.createFAQ(payload); toast.success('FAQ added!'); }
      setModalOpen(false); load();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this FAQ?')) return;
    try { await contentAPI.deleteFAQ(id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <h2 style={{ color:'#F5D97A', fontSize:'16px', fontWeight:'600', margin:0 }}>Frequently Asked Questions</h2>
        <Btn small onClick={openCreate}>+ Add FAQ</Btn>
      </div>

      {loading ? (
        <div style={{ color:'rgba(255,255,255,0.4)', padding:'20px', textAlign:'center' }}>Loading...</div>
      ) : faqs.length === 0 ? (
        <div style={{ color:'rgba(255,255,255,0.3)', padding:'20px', textAlign:'center', background:'rgba(255,255,255,0.02)', borderRadius:'8px' }}>No FAQs yet. Add one!</div>
      ) : faqs.map((faq, i) => (
        <div key={faq._id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'16px', marginBottom:'10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
                <span style={{ color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>#{faq.sortOrder||i+1}</span>
                <span style={{ background:'rgba(212,175,55,0.1)', color:'#F5D97A', fontSize:'11px', padding:'2px 8px', borderRadius:'10px' }}>{faq.category}</span>
                {!faq.isActive && <Badge label="INACTIVE" />}
              </div>
              <div style={{ color:'#fff', fontWeight:'600', fontSize:'14px', marginBottom:'4px' }}>Q: {faq.question}</div>
              <div style={{ color:'rgba(255,255,255,0.55)', fontSize:'13px' }}>A: {faq.answer}</div>
            </div>
            <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
              <Btn small onClick={() => openEdit(faq)}>Edit</Btn>
              <Btn small variant="danger" onClick={() => handleDelete(faq._id)}>Delete</Btn>
            </div>
          </div>
        </div>
      ))}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit FAQ' : 'Add New FAQ'} width="560px">
        <FormField label="Question" required>
          <Input value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} placeholder="What age groups are eligible?" />
        </FormField>
        <FormField label="Answer" required>
          <Textarea value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))} rows={4} placeholder="We accept students from age 6 to 16." />
        </FormField>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <FormField label="Category">
            <Select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {['General','Registration','Payments','Programs','Coaches','Schedule'].map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormField>
          <FormField label="Sort Order">
            <Input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))} placeholder="1" />
          </FormField>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', color:'rgba(255,255,255,0.7)', fontSize:'14px', marginBottom:'20px' }}>
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
            style={{ width:'16px', height:'16px', accentColor:'#D4AF37' }} />
          Active (shown on website)
        </label>
        <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:'16px' }}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update FAQ' : 'Add FAQ')}</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Sponsors Section
// ═══════════════════════════════════════════════════════════
function SponsorsSection() {
  const [sponsors, setSponsors]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState({ name:'', websiteUrl:'', sortOrder:'0', isActive:true });
  const [logoFile, setLogoFile]   = useState(null);
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await contentAPI.getSponsors(); setSponsors(r.data.data); }
    catch { toast.error('Failed to load sponsors'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name:'', websiteUrl:'', sortOrder:'0', isActive:true });
    setLogoFile(null);
    setModalOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ name: row.name||'', websiteUrl: row.websiteUrl||'', sortOrder: String(row.sortOrder||0), isActive: row.isActive!==false });
    setLogoFile(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name',       form.name);
      fd.append('websiteUrl', form.websiteUrl);
      fd.append('sortOrder',  parseInt(form.sortOrder)||0);
      fd.append('isActive',   form.isActive);
      if (logoFile) fd.append('coverImage', logoFile);

      if (editing) { await contentAPI.updateSponsor(editing._id, fd); toast.success('Sponsor updated!'); }
      else         { await contentAPI.createSponsor(fd); toast.success('Sponsor added!'); }
      setModalOpen(false); load();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove sponsor?')) return;
    try { await contentAPI.deleteSponsor(id); toast.success('Removed'); load(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div style={{ marginTop:'36px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <h2 style={{ color:'#F5D97A', fontSize:'16px', fontWeight:'600', margin:0 }}>Sponsors</h2>
        <Btn small onClick={openCreate}>+ Add Sponsor</Btn>
      </div>

      {loading ? (
        <div style={{ color:'rgba(255,255,255,0.4)', padding:'20px', textAlign:'center' }}>Loading...</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'12px' }}>
          {sponsors.map(s => (
            <div key={s._id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'16px', textAlign:'center' }}>
              {s.coverImageUrl && <img src={s.coverImageUrl} alt={s.name} style={{ maxWidth:'100px', maxHeight:'50px', objectFit:'contain', marginBottom:'8px', filter:'brightness(0.8)' }} />}
              <div style={{ color:'#fff', fontWeight:'600', fontSize:'14px' }}>{s.name}</div>
              {s.websiteUrl && <a href={s.websiteUrl} target="_blank" rel="noreferrer" style={{ color:'#3b82f6', fontSize:'12px' }}>Website ↗</a>}
              <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginTop:'10px' }}>
                <Btn small onClick={() => openEdit(s)}>Edit</Btn>
                <Btn small variant="danger" onClick={() => handleDelete(s._id)}>Remove</Btn>
              </div>
            </div>
          ))}
          {sponsors.length === 0 && (
            <div style={{ gridColumn:'1 / -1', color:'rgba(255,255,255,0.3)', padding:'20px', textAlign:'center', background:'rgba(255,255,255,0.02)', borderRadius:'8px' }}>No sponsors yet.</div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Sponsor' : 'Add Sponsor'} width="480px">
        <FormField label="Sponsor Name" required>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Cricket World" />
        </FormField>
        <ImageUploadField
          label="Sponsor Logo (JPG/PNG)"
          currentUrl={editing?.coverImageUrl || ''}
          onFileSelect={(file) => setLogoFile(file)}
          hint="Upload sponsor logo"
        />
        <FormField label="Website URL">
          <Input value={form.websiteUrl} onChange={e => setForm(p => ({ ...p, websiteUrl: e.target.value }))} placeholder="https://..." />
        </FormField>
        <FormField label="Sort Order">
          <Input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))} placeholder="1" style={{ width:'100px' }} />
        </FormField>
        <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:'16px', marginTop:'4px' }}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update' : 'Add Sponsor')}</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Media Section — Gallery / Magazine / Newsletter
//  FIXED: Gallery shows existing images on edit; cover logic
// ═══════════════════════════════════════════════════════════
const MEDIA_TABS = [
  { key: 'MAGAZINE',   label: 'CCF Magazine' },
  { key: 'GALLERY',    label: 'Gallery'       },
  { key: 'NEWSLETTER', label: 'Newsletter'    },
];

const EMPTY_MEDIA = {
  title:'', album:'', description:'', publishDate:'', sortOrder:'0', isActive:true,
};

function MediaSection() {
  const [tab, setTab]             = useState('MAGAZINE');
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_MEDIA);
  const [saving, setSaving]       = useState(false);

  // File states
  const [coverFile, setCoverFile]               = useState(null);
  const [galleryFiles, setGalleryFiles]         = useState([]);
  const [galleryCoverIdx, setGalleryCoverIdx]   = useState(0);
  const [galleryCoverPool, setGalleryCoverPool] = useState('existing'); // 'existing' | 'new'
  const [existCoverIdx, setExistCoverIdx]       = useState(0);
  const [pdfFile, setPdfFile]                   = useState(null);

  // Derived: existing gallery images when editing
  const existingImages = (editing?.galleryImages ?? []).map(g => ({
    url: g.url,
    isCover: g.isCover,
  }));

  const load = async (type) => {
    setLoading(true);
    try { const r = await contentAPI.getMedia({ type }); setItems(r.data.data); }
    catch { toast.error('Failed to load media'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(tab); }, [tab]);

  const resetFiles = () => {
    setCoverFile(null); setGalleryFiles([]); setGalleryCoverIdx(0);
    setGalleryCoverPool('existing'); setExistCoverIdx(0); setPdfFile(null);
  };

  const openCreate = () => {
    setEditing(null); setForm(EMPTY_MEDIA); resetFiles(); setModalOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      title:       row.title       || '',
      album:       row.album       || '',
      description: row.description || '',
      publishDate: row.publishDate ? row.publishDate.split('T')[0] : '',
      sortOrder:   String(row.sortOrder||0),
      isActive:    row.isActive !== false,
    });
    resetFiles();
    // Pre-select existing cover index
    const ci = Math.max(0, (row.galleryImages ?? []).findIndex(g => g.isCover));
    setExistCoverIdx(ci);
    setGalleryCoverPool('existing');
    setModalOpen(true);
  };

  // Called from MultiImageField when new files chosen
  const handleGalleryFiles = (files, coverIdx) => {
    if (files !== null) { setGalleryFiles(files); setGalleryCoverPool('new'); }
    setGalleryCoverIdx(coverIdx);
  };

  // Called when user clicks an existing image to set as cover
  const handleExistingCover = (idx) => {
    setExistCoverIdx(idx);
    setGalleryCoverPool('existing');
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('type',        tab);
      fd.append('title',       form.title);
      fd.append('album',       form.album);
      fd.append('description', form.description);
      fd.append('sortOrder',   parseInt(form.sortOrder)||0);
      fd.append('isActive',    form.isActive);
      if (form.publishDate) fd.append('publishDate', form.publishDate);

      if (tab === 'GALLERY') {
        if (galleryFiles.length > 0) {
          galleryFiles.forEach(f => fd.append('galleryImages', f));
          // If cover is from new uploads, pass index; else -1 (backend keeps existing logic)
          const cidx = galleryCoverPool === 'new' ? galleryCoverIdx : 0;
          fd.append('galleryCoverIndex', cidx);
        } else if (editing && galleryCoverPool === 'existing') {
          // Only cover changed among existing — send special field
          fd.append('existingCoverIndex', existCoverIdx);
        }
        if (coverFile) fd.append('coverImage', coverFile);
      } else {
        if (coverFile) fd.append('coverImage', coverFile);
        if (pdfFile)   fd.append('pdfFile',    pdfFile);
      }

      if (editing) { await contentAPI.updateMedia(editing._id, fd); toast.success('Updated!'); }
      else         { await contentAPI.createMedia(fd); toast.success('Added!'); }
      setModalOpen(false); load(tab);
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try { await contentAPI.deleteMedia(id); toast.success('Deleted'); load(tab); }
    catch { toast.error('Failed'); }
  };

  const currentLabel = MEDIA_TABS.find(t => t.key === tab)?.label;

  return (
    <div style={{ marginTop:'36px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
        <h2 style={{ color:'#F5D97A', fontSize:'16px', fontWeight:'600', margin:0 }}>Media</h2>
        <Btn small onClick={openCreate}>+ Add {currentLabel}</Btn>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
        {MEDIA_TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
            padding:'6px 16px', borderRadius:'20px', border:'1px solid',
            cursor:'pointer', fontSize:'13px', fontWeight:'600',
            borderColor: tab===t.key ? '#D4AF37' : 'rgba(255,255,255,0.15)',
            background:  tab===t.key ? 'rgba(212,175,55,0.15)' : 'transparent',
            color:       tab===t.key ? '#F5D97A' : 'rgba(255,255,255,0.5)',
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color:'rgba(255,255,255,0.4)', padding:'20px', textAlign:'center' }}>Loading...</div>
      ) : tab === 'GALLERY' ? (
        /* ── FIXED Gallery grid ── */
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:'14px' }}>
          {items.map(m => {
            const coverImg = m.galleryImages?.find(g => g.isCover)?.url
              || m.galleryImages?.[0]?.url
              || m.coverImageUrl || null;
            const photoCount = m.galleryImages?.length || 0;
            return (
              <div key={m._id} style={{
                background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.09)',
                borderRadius:'12px', padding:'12px',
                display:'flex', flexDirection:'column', gap:'8px',
              }}>
                {/* Cover image */}
                <div style={{ position:'relative', borderRadius:'8px', overflow:'hidden', aspectRatio:'16/10' }}>
                  {coverImg ? (
                    <img
                      src={coverImg}
                      alt={m.title}
                      style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                      onError={e => { e.target.replaceWith(Object.assign(document.createElement('div'), {
                        style: 'width:100%;height:100%;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:24px;color:rgba(255,255,255,0.2)',
                        innerText: '🖼️'
                      })); }}
                    />
                  ) : (
                    <div style={{ width:'100%', height:'100%', background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', color:'rgba(255,255,255,0.2)' }}>
                      🖼️
                    </div>
                  )}
                  {/* Photo count badge */}
                  {photoCount > 0 && (
                    <div style={{
                      position:'absolute', bottom:'6px', right:'6px',
                      background:'rgba(0,0,0,0.65)', color:'#fff',
                      fontSize:'10px', fontWeight:'600', padding:'2px 7px',
                      borderRadius:'20px', backdropFilter:'blur(4px)',
                    }}>
                      📷 {photoCount}
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div style={{ flex:1 }}>
                  <div style={{ color:'#fff', fontWeight:'600', fontSize:'13px', lineHeight:'1.4' }}>{m.title}</div>
                  {m.album && (
                    <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'11px', marginTop:'2px' }}>
                      📂 {m.album}
                    </div>
                  )}
                  {m.publishDate && (
                    <div style={{ color:'rgba(255,255,255,0.3)', fontSize:'11px', marginTop:'2px' }}>
                      📅 {new Date(m.publishDate).toLocaleDateString()}
                    </div>
                  )}
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'4px', flexWrap:'wrap' }}>
                    {photoCount === 0 && (
                      <span style={{ color:'#fbbf24', fontSize:'11px' }}>⚠ No photos</span>
                    )}
                    {!m.isActive && <Badge label="INACTIVE" />}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:'8px' }}>
                  <Btn small onClick={() => openEdit(m)} style={{ flex:1 }}>Edit</Btn>
                  <Btn small variant="danger" onClick={() => handleDelete(m._id)}>🗑</Btn>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ gridColumn:'1 / -1', color:'rgba(255,255,255,0.3)', padding:'32px', textAlign:'center', background:'rgba(255,255,255,0.02)', borderRadius:'10px', border:'1px dashed rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>🖼️</div>
              <div style={{ fontWeight:'600', marginBottom:'4px' }}>No gallery photos yet</div>
              <div style={{ fontSize:'12px' }}>Click "+ Add Gallery" to create your first gallery album.</div>
            </div>
          )}
        </div>
      ) : (
        /* ── Magazine / Newsletter list ── */
        items.length === 0 ? (
          <div style={{ color:'rgba(255,255,255,0.3)', padding:'20px', textAlign:'center', background:'rgba(255,255,255,0.02)', borderRadius:'8px' }}>
            No {tab==='MAGAZINE' ? 'magazine issues' : 'newsletters'} yet.
          </div>
        ) : items.map((m, i) => (
          <div key={m._id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'16px', marginBottom:'10px', display:'flex', gap:'14px', alignItems:'center' }}>
            {m.coverImageUrl
              ? <img src={m.coverImageUrl} alt={m.title} style={{ width:'60px', height:'60px', objectFit:'cover', borderRadius:'6px', flexShrink:0 }} />
              : <div style={{ width:'60px', height:'60px', background:'rgba(255,255,255,0.05)', borderRadius:'6px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', color:'rgba(255,255,255,0.2)' }}>📄</div>
            }
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                <span style={{ color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>#{m.sortOrder??i+1}</span>
                {!m.isActive && <Badge label="INACTIVE" />}
              </div>
              <div style={{ color:'#fff', fontWeight:'600', fontSize:'14px' }}>{m.title}</div>
              {m.publishDate && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'12px' }}>{new Date(m.publishDate).toLocaleDateString()}</div>}
              {m.description && <div style={{ color:'rgba(255,255,255,0.55)', fontSize:'13px', marginTop:'4px' }}>{m.description}</div>}
              {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noreferrer" style={{ color:'#3b82f6', fontSize:'12px' }}>📄 Open PDF ↗</a>}
            </div>
            <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
              <Btn small onClick={() => openEdit(m)}>Edit</Btn>
              <Btn small variant="danger" onClick={() => handleDelete(m._id)}>Delete</Btn>
            </div>
          </div>
        ))
      )}

      {/* ── Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${currentLabel}` : `Add ${currentLabel}`}
        width={tab === 'GALLERY' ? '640px' : '520px'}>

        <FormField label="Title" required>
          <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder={
              tab==='GALLERY'    ? 'e.g. Summer Camp Day 1'        :
              tab==='MAGAZINE'   ? 'e.g. CCF Magazine — Issue 12'  :
                                   'e.g. June 2026 Newsletter'
            } />
        </FormField>

        {/* ── GALLERY ── */}
        {tab === 'GALLERY' && (
          <>
            {/* FIXED: passes existing images so they render when editing */}
            <MultiImageField
              label="Gallery Photos (up to 100) — click to set cover"
              existingImages={existingImages}
              onFilesSelect={handleGalleryFiles}
              onExistingCoverChange={handleExistingCover}
              maxCount={100}
            />
            <div style={{ marginTop:'4px', marginBottom:'4px', color:'rgba(255,255,255,0.25)', fontSize:'12px', textAlign:'center' }}>
              — or upload a separate cover image below —
            </div>
            <ImageUploadField
              label="Cover Image (optional)"
              currentUrl={editing?.coverImageUrl || ''}
              onFileSelect={(f) => setCoverFile(f)}
            />
            <FormField label="Album (optional)">
              <Input value={form.album} onChange={e => setForm(p => ({ ...p, album: e.target.value }))}
                placeholder="e.g. Summer 2026 Camp" />
            </FormField>
          </>
        )}

        {/* ── MAGAZINE / NEWSLETTER ── */}
        {(tab === 'MAGAZINE' || tab === 'NEWSLETTER') && (
          <>
            <ImageUploadField
              label="Cover Image"
              currentUrl={editing?.coverImageUrl || ''}
              onFileSelect={(f) => setCoverFile(f)}
              hint="Upload cover image for this issue"
            />
            <PdfUploadField
              label="PDF File"
              currentName={editing?.filePath ? editing.filePath.split('/').pop() : ''}
              onFileSelect={(f) => setPdfFile(f)}
            />
          </>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <FormField label="Publish Date">
            <Input type="date" value={form.publishDate} onChange={e => setForm(p => ({ ...p, publishDate: e.target.value }))} />
          </FormField>
          <FormField label="Sort Order">
            <Input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))} placeholder="0" />
          </FormField>
        </div>

        {tab !== 'GALLERY' && (
          <FormField label="Description (optional)">
            <Textarea value={form.description} rows={2} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Short summary..." />
          </FormField>
        )}

        <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', color:'rgba(255,255,255,0.7)', fontSize:'14px', marginBottom:'20px' }}>
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
            style={{ width:'16px', height:'16px', accentColor:'#D4AF37' }} />
          Active (shown on website)
        </label>

        <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:'16px' }}>
          <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update' : 'Add')}</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Main Content page
// ═══════════════════════════════════════════════════════════
export default function Content() {
  return (
    <div style={{ color:'#fff' }}>
      <PageHeader title="Content Management" subtitle="Manage FAQs, Sponsors, Gallery, Magazine and Newsletter" />
      <FAQSection />
      <SponsorsSection />
      <MediaSection />
    </div>
  );
}