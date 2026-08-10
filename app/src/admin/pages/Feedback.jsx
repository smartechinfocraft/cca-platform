import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { feedbackAPI } from '../api/client';
import { DataTable, PageHeader } from '../components/common/UI';

const formatDate = value => value
  ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

export default function Feedback() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    setLoading(true);
    feedbackAPI.getAll({ page, limit: 50 })
      .then(({ data }) => {
        setRows(data.data || []);
        setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
      })
      .catch(error => toast.error(error.response?.data?.message || 'Could not load feedback.'))
      .finally(() => setLoading(false));
  }, [page]);

  const columns = [
    { key: 'parentName', label: 'Parent' },
    { key: 'parentEmail', label: 'Email' },
    { key: 'registrationNumber', label: 'Order #' },
    {
      key: 'rating',
      label: 'Rating',
      render: value => value ? <span style={styles.rating} aria-label={`${value} out of 5`}>{'★'.repeat(value)}<span style={styles.emptyStars}>{'★'.repeat(5 - value)}</span> <small>{value}/5</small></span> : '—',
    },
    {
      key: 'feedback',
      label: 'Feedback',
      // React renders this as text, not HTML. Never use dangerouslySetInnerHTML here.
      render: value => value ? <div style={styles.feedback}>{value}</div> : '—',
    },
    { key: 'createdAt', label: 'Submitted', render: formatDate },
  ];

  return (
    <div>
      <PageHeader title="Feedback" subtitle="Parent feedback submitted after registration." />
      <div style={styles.summary}>{loading ? 'Loading…' : `${pagination.total} feedback submission${pagination.total === 1 ? '' : 's'}`}</div>
      <DataTable columns={columns} rows={rows} loading={loading} emptyMsg="No parent feedback has been submitted yet." />
      {pagination.pages > 1 && <div style={styles.pagination}>
        <button style={styles.pageButton} type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Previous</button>
        <span>Page {pagination.page} of {pagination.pages}</span>
        <button style={styles.pageButton} type="button" disabled={page >= pagination.pages || loading} onClick={() => setPage(value => value + 1)}>Next</button>
      </div>}
    </div>
  );
}

const styles = {
  summary: { marginBottom: 14, color: 'rgba(255,255,255,.5)', fontSize: 13 },
  rating: { color: '#F5D97A', whiteSpace: 'nowrap', letterSpacing: 1 },
  emptyStars: { color: 'rgba(255,255,255,.15)' },
  feedback: { minWidth: 220, maxWidth: 440, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5 },
  pagination: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16, color: 'rgba(255,255,255,.6)', fontSize: 13 },
  pageButton: { border: '1px solid rgba(212,175,55,.25)', borderRadius: 8, padding: '8px 14px', background: 'rgba(212,175,55,.1)', color: '#F5D97A', cursor: 'pointer' },
};
