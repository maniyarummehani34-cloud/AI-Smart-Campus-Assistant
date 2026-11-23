import { ChevronLeft, ChevronRight } from 'lucide-react';

function PaginationBar({ page, totalPages, total, pageSize, onPageChange }) {
  if (!total || total <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.85rem',
        flexWrap: 'wrap',
        padding: '0.95rem 1.25rem',
        borderTop: '1px solid var(--border-light)',
        backgroundColor: '#fafcff',
        fontSize: '0.84rem',
        color: 'var(--text-secondary)',
      }}
    >
      <span>
        Showing <strong>{start}</strong>–<strong>{end}</strong> of{' '}
        <strong>{total}</strong> records
      </span>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>
        <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default PaginationBar;
