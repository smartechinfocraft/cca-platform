// ============================================================
//  pages/Dashboard.js
//  Main dashboard: stat cards + 4 charts + recent registrations
//  Charts: Monthly Revenue (Bar), Status Breakdown (Pie),
//          Batch Fill Rate (Bar), Registrations Trend (Line)
// ============================================================
import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { dashboardAPI } from '../api/client';
import { useAdminAuth }      from '../context/AuthContext';

// Color palette for charts (gold/green/cricket themed)
const COLORS = ['#D4AF37','#22c55e','#3b82f6','#A33B2B','#a855f7','#ec4899','#14b8a6'];

// ─── Stat card component ──────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, sub, color = '#D4AF37' }) => (
  <div style={{ ...cardStyles.card, borderColor: color + '33' }}>
    <div style={{ ...cardStyles.icon, background: color + '22', color }}>
      {icon}
    </div>
    <div>
      <div style={cardStyles.value}>{value}</div>
      <div style={cardStyles.label}>{label}</div>
      {sub && <div style={cardStyles.sub}>{sub}</div>}
    </div>
  </div>
);

const cardStyles = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  icon: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    flexShrink: 0,
  },
  value: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: '700',
    lineHeight: 1.2,
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    marginTop: '2px',
  },
  sub: {
    color: '#D4AF37',
    fontSize: '12px',
    marginTop: '4px',
  },
};

// ─── Chart container wrapper ──────────────────────────────────────────────────
const ChartBox = ({ title, children, action }) => (
  <div style={chartStyles.box}>
    <div style={chartStyles.header}>
      <span style={chartStyles.title}>{title}</span>
      {action}
    </div>
    {children}
  </div>
);

const chartStyles = {
  box: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(212,175,55,0.12)',
    borderRadius: '12px',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    color: '#F5D97A',
    fontSize: '15px',
    fontWeight: '600',
  },
};

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  CONFIRMED: '#22c55e', PAID: '#3b82f6', PENDING: '#A33B2B',
  CANCELLED: '#ef4444', REFUNDED: '#8b5cf6', WAITLISTED: '#6b7280',
  AWAITING_PAYMENT: '#eab308',
};

const Badge = ({ status }) => (
  <span style={{
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    background: (STATUS_COLORS[status] || '#6b7280') + '22',
    color: STATUS_COLORS[status] || '#6b7280',
    border: `1px solid ${(STATUS_COLORS[status] || '#6b7280')}44`,
  }}>
    {status}
  </span>
);

// ─── Main Dashboard component ─────────────────────────────────────────────────
export default function Dashboard() {
  const { isSuperAdmin, user } = useAdminAuth();
  const [data, setData]        = useState(null);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    dashboardAPI.getStats()
      .then(res => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingTop: '80px' }}>
      Loading dashboard...
    </div>
  );

  const { cards, charts, recentRegistrations } = data || {};

  return (
    <div style={{ color: '#fff' }}>
      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: '#F5D97A', fontSize: '24px', fontWeight: '700', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '4px 0 0' }}>
          Welcome back, {user?.firstName}!
          {isSuperAdmin ? ' — Full system access.' : ' — Managing operations.'}
        </p>
      </div>

      {/* ── Stat cards ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <StatCard
          label="Total Registrations"
          value={cards?.totalRegistrations || 0}
          icon="📋"
          color="#D4AF37"
          sub={`${cards?.pendingCount || 0} pending action`}
        />
        <StatCard
          label="Total Revenue"
          value={`$${(cards?.totalRevenue || 0).toLocaleString()}`}
          icon="💰"
          color="#22c55e"
        />
        <StatCard
          label="Active Programs"
          value={cards?.totalPrograms || 0}
          icon="🏏"
          color="#3b82f6"
        />
        <StatCard
          label="Active Coaches"
          value={cards?.totalCoaches || 0}
          icon="🧑‍🏫"
          color="#a855f7"
        />
      </div>

      {/* ── Charts row 1 ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Chart 1: Monthly Revenue (Bar) */}
        <ChartBox title="Monthly Revenue (Last 6 Months)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={charts?.monthlyRevenue || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                tickFormatter={v => `$${v.toLocaleString()}`} />
              <Tooltip
                contentStyle={{ background: '#0f3d22', border: '1px solid #D4AF37', borderRadius: '8px', color: '#fff' }}
                formatter={(v) => [`$${v.toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#D4AF37" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        {/* Chart 2: Registration Status Pie */}
        <ChartBox title="Registration Status Breakdown">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={charts?.statusBreakdown || []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {(charts?.statusBreakdown || []).map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f3d22', border: '1px solid #D4AF37', borderRadius: '8px', color: '#fff' }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      {/* ── Charts row 2 ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>

        {/* Chart 3: Registration trend (Line) */}
        <ChartBox title="Registrations Trend">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={charts?.monthlyRevenue || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0f3d22', border: '1px solid #D4AF37', borderRadius: '8px', color: '#fff' }}
              />
              <Line type="monotone" dataKey="registrations" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartBox>

        {/* Chart 4: Batch fill rate */}
        <ChartBox title="Batch Fill Rate (%)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts?.batchCapacity || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                tickFormatter={v => `${v}%`} />
              <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0f3d22', border: '1px solid #D4AF37', borderRadius: '8px', color: '#fff' }}
                formatter={(v) => [`${v.toFixed(1)}%`, 'Fill Rate']}
              />
              <Bar dataKey="fillRate" fill="#3b82f6" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      {/* ── Recent Registrations table ────────────────── */}
      <ChartBox title="Recent Registrations">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr>
                {['Reg #','Program','Amount','Status','Payment','Date'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 12px',
                    color: 'rgba(255,255,255,0.4)', fontSize: '12px',
                    fontWeight: '500', letterSpacing: '0.5px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentRegistrations || []).map(reg => (
                <tr key={reg._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={td}>{reg.registrationNumber}</td>
                  <td style={td}>{reg.programId?.title || '—'}</td>
                  <td style={{ ...td, color: '#22c55e' }}>${reg.totalAmount?.toLocaleString()}</td>
                  <td style={td}><Badge status={reg.status} /></td>
                  <td style={td}>{reg.paymentMethod}</td>
                  <td style={{ ...td, color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(reg.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {!recentRegistrations?.length && (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '32px' }}>
                    No registrations yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartBox>
    </div>
  );
}

const td = {
  padding: '12px',
  color: 'rgba(255,255,255,0.75)',
  verticalAlign: 'middle',
};
