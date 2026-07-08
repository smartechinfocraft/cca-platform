// ============================================================
//  pages/Dashboard.js — Coach Portal home screen
//  1. Total students under this coach
//  2. Batches (bar chart: students per batch)
//  3. Location(s) where the coach works
// ============================================================
import React, { useEffect, useState } from 'react';
import { coachPortalAPI } from '../api/client';
import { Card, PageHeader, Spinner, EmptyState } from '../components/UI';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coachPortalAPI.getDashboard()
      .then((res) => setData(res.data.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState text="Couldn't load your dashboard right now." />;

  const { totalStudents, totalBatches, batchChartData, locations } = data;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your students, batches, and work locations" />

      {/* ── Summary cards ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb' }}>{totalStudents}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Total Students</div>
        </Card>
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb' }}>{totalBatches}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Assigned Batches</div>
        </Card>
      </div>

      {/* ── Batch-wise students chart ─────────────────────── */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
          Students per Batch
        </div>
        {batchChartData?.length ? (
          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer>
              <BarChart data={batchChartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  labelStyle={{ color: '#2563eb' }}
                />
                <Bar dataKey="students" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon="📊" text="No batches assigned yet." />
        )}
      </Card>

      {/* ── Locations ──────────────────────────────────────── */}
      <Card>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
          Where You Work
        </div>
        {locations?.length ? (
          locations.map((loc) => (
            <div key={loc._id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px',
              paddingBottom: '10px', borderBottom: '1px solid #f1f5f9',
            }}>
              <span style={{ fontSize: '18px' }}>📍</span>
              <div>
                <div style={{ color: '#0f172a', fontSize: '13.5px', fontWeight: 600 }}>{loc.title}</div>
                <div style={{ color: '#94a3b8', fontSize: '12px' }}>{loc.address || loc.city}</div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon="📍" text="No location assigned yet." />
        )}
      </Card>
    </div>
  );
}