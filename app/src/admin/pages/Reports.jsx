// ============================================================
//  pages/Reports.js
//  Revenue graphs + custom report builder + CSV/Excel download
// ============================================================
import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { reportsAPI, programsAPI, categoriesAPI, batchesAPI, locationsAPI, levelsAPI } from '../api/client';
import { PageHeader, Btn, Card, FormField, Select, Input } from '../components/common/UI';
import toast from 'react-hot-toast';

const COLORS = ['#D4AF37','#22c55e','#3b82f6','#A33B2B','#a855f7','#ec4899'];

export default function Reports() {
  const [revenue, setRevenue]       = useState(null);
  const [programs, setPrograms]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [batches, setBatches]       = useState([]);
  const [locations, setLocations]   = useState([]);
  const [levels, setLevels]         = useState([]);
  const [loading, setLoading]       = useState(true);

  // Custom report state
  const [customFilters, setCustomFilters] = useState({
    from: '', to: '', program: '', status: '', batch: '', location: '', level: ''
  });
  const [customData, setCustomData]       = useState(null);
  const [customLoading, setCustomLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      reportsAPI.getRevenue(),
      programsAPI.getAll({ active: true }),
      categoriesAPI.getAll(),
      batchesAPI.getAll(),
      locationsAPI.getAll(),
      levelsAPI.getAll(),
    ]).then(([rev, progs, cats, bats, locs, lvls]) => {
      setRevenue(rev.data.data);
      setPrograms(progs.data.data);
      setCategories(cats.data.data);
      setBatches(bats.data.data);
      setLocations(locs.data.data);
      setLevels(lvls.data.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const runCustomReport = async () => {
    setCustomLoading(true);
    try {
      const res = await reportsAPI.buildCustom({ filters: customFilters });
      setCustomData(res.data.data);
    } catch (e) {
      toast.error('Report generation failed');
    } finally {
      setCustomLoading(false);
    }
  };

  // Download as CSV — uses the backend export endpoint
  const downloadCSV = async () => {
    try {
      const params = {};
      if (customFilters.program)  params.program  = customFilters.program;
      if (customFilters.status)   params.status   = customFilters.status;
      if (customFilters.batch)    params.batch    = customFilters.batch;
      if (customFilters.location) params.location = customFilters.location;
      if (customFilters.level)    params.level    = customFilters.level;

      const res = await reportsAPI.exportCSV(params);

      // Create a temporary link to trigger browser download
      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      // Auto-generate filename with date and filters
      const date = new Date().toISOString().split('T')[0];
      const prog = programs.find(p => p._id === customFilters.program)?.title || 'All';
      link.href  = url;
      link.download = `CCA_Report_${prog.replace(/\s+/g,'_')}_${date}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded!');
    } catch (e) {
      toast.error('Download failed');
    }
  };

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.5)', padding: '40px' }}>Loading reports...</div>;

  const { totals, revenueByPeriod, revenueByProgram, paymentBreakdown } = revenue || {};

  return (
    <div style={{ color: '#fff' }}>
      <PageHeader
        title="Reports & Revenue"
        subtitle="Analytics, trends, and custom report builder"
        action={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Btn onClick={downloadCSV} variant="success">⬇️ Download CSV</Btn>
          </div>
        }
      />

      {/* ── Summary totals ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Revenue',       value: `$${(totals?.totalRevenue || 0).toLocaleString()}`,       color: '#D4AF37' },
          { label: 'Total Registrations', value: totals?.totalRegistrations || 0,                          color: '#22c55e' },
          { label: 'Avg Order Value',     value: `$${(totals?.avgOrderValue || 0).toFixed(2)}`,             color: '#3b82f6' },
          { label: 'Total Discounts',     value: `$${(totals?.totalDiscount || 0).toLocaleString()}`,       color: '#A33B2B' },
        ].map(item => (
          <Card key={item.label} style={{ borderColor: item.color + '33', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ color: item.color, fontSize: '22px', fontWeight: '700' }}>{item.value}</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>{item.label}</div>
          </Card>
        ))}
      </div>

      {/* ── Revenue by period + by program ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <Card>
          <div style={{ color: '#F5D97A', fontWeight: '600', marginBottom: '16px' }}>Revenue by Month</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByPeriod || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="_id.month" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
              <Tooltip contentStyle={{ background: '#0f3d22', border: '1px solid #D4AF37', borderRadius: '8px', color: '#fff' }} />
              <Bar dataKey="revenue" fill="#D4AF37" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div style={{ color: '#F5D97A', fontWeight: '600', marginBottom: '16px' }}>Payment Method Split</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={paymentBreakdown || []} cx="50%" cy="50%" outerRadius={80} dataKey="total" nameKey="_id">
                {(paymentBreakdown || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f3d22', border: '1px solid #D4AF37', borderRadius: '8px', color: '#fff' }}
                formatter={(v) => [`$${v.toLocaleString()}`, '']} />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Revenue by program bar */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ color: '#F5D97A', fontWeight: '600', marginBottom: '16px' }}>Revenue by Program (Top 10)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={revenueByProgram || []} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
            <YAxis dataKey="programTitle" type="category" width={120} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0f3d22', border: '1px solid #D4AF37', borderRadius: '8px', color: '#fff' }} />
            <Bar dataKey="revenue" fill="#22c55e" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Custom Report Builder ───────────────────── */}
      <Card>
        <div style={{ color: '#F5D97A', fontWeight: '600', marginBottom: '20px', fontSize: '16px' }}>
          🔧 Custom Report Builder
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <FormField label="Program">
            <Select value={customFilters.program} onChange={e => setCustomFilters(p => ({ ...p, program: e.target.value }))}>
              <option value="">All Programs</option>
              {programs.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
            </Select>
          </FormField>

          <FormField label="Batch">
            <Select value={customFilters.batch} onChange={e => setCustomFilters(p => ({ ...p, batch: e.target.value }))}>
              <option value="">All Batches</option>
              {batches.map(b => <option key={b._id} value={b._id}>{b.title}</option>)}
            </Select>
          </FormField>

          <FormField label="Location">
            <Select value={customFilters.location} onChange={e => setCustomFilters(p => ({ ...p, location: e.target.value }))}>
              <option value="">All Locations</option>
              {locations.map(l => <option key={l._id} value={l._id}>{l.title}</option>)}
            </Select>
          </FormField>

          <FormField label="Level">
            <Select value={customFilters.level} onChange={e => setCustomFilters(p => ({ ...p, level: e.target.value }))}>
              <option value="">All Levels</option>
              {levels.map(l => <option key={l._id} value={l._id}>{l.title}</option>)}
            </Select>
          </FormField>

          <FormField label="Status">
            <Select value={customFilters.status} onChange={e => setCustomFilters(p => ({ ...p, status: e.target.value }))}>
              <option value="">All Statuses</option>
              {['PENDING','AWAITING_PAYMENT','PAID','CONFIRMED','CANCELLED','REFUNDED'].map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </Select>
          </FormField>

          <FormField label="From Date">
            <Input type="date" value={customFilters.from} onChange={e => setCustomFilters(p => ({ ...p, from: e.target.value }))} />
          </FormField>

          <FormField label="To Date">
            <Input type="date" value={customFilters.to} onChange={e => setCustomFilters(p => ({ ...p, to: e.target.value }))} />
          </FormField>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: customData ? '20px' : '0' }}>
          <Btn onClick={runCustomReport} disabled={customLoading}>
            {customLoading ? 'Generating...' : '📊 Generate Report'}
          </Btn>
          {customData && <Btn onClick={downloadCSV} variant="success">⬇️ Download CSV</Btn>}
        </div>

        {/* Custom report results */}
        {customData && (
          <div>
            {/* Totals summary */}
            <div style={{ display: 'flex', gap: '24px', padding: '12px 16px', background: 'rgba(212,175,55,0.06)', borderRadius: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Total Revenue: </span>
                <span style={{ color: '#D4AF37', fontWeight: '700' }}>${customData.totals.revenue.toLocaleString()}</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Registrations: </span>
                <span style={{ color: '#22c55e', fontWeight: '700' }}>{customData.totals.count}</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Total Discounts: </span>
                <span style={{ color: '#A33B2B', fontWeight: '700' }}>${customData.totals.discount.toLocaleString()}</span></div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr>
                    {['Program','Revenue','Count','Avg Value','Discount'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customData.rows.map(row => (
                    <tr key={row._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.75)' }}>{row.name || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#D4AF37', fontWeight: '600' }}>${row.revenue.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', color: '#22c55e' }}>{row.count}</td>
                      <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>${row.avgValue.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', color: '#A33B2B' }}>${row.discount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '12px', textAlign: 'right' }}>
              Generated: {new Date(customData.generatedAt).toLocaleString()}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}