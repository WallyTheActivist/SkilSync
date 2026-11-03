import React, { useEffect, useState, useCallback } from 'react';
import { Briefcase, Search, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import type { Internship } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatDate } from '../../utils/helpers';
import clsx from 'clsx';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DRAFT:  'bg-gray-100 text-gray-600',
  CLOSED: 'bg-red-100 text-red-700',
  FILLED: 'bg-blue-100 text-blue-700',
};

const AdminInternships: React.FC = () => {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const r = await adminApi.getInternships({ search: query || undefined, status: statusFilter || undefined, page, limit: LIMIT });
      setInternships(r.data.data);
      setTotal(r.data.pagination.total);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setQuery(search); setPage(1); };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await adminApi.updateInternship(id, { status });
      if (statusFilter && status !== statusFilter) {
        const remainingTotal = Math.max(0, total - 1);
        const lastPage = Math.max(1, Math.ceil(remainingTotal / LIMIT));
        setInternships((prev) => prev.filter((internship) => internship.id !== id));
        setTotal(remainingTotal);
        if (page > lastPage) setPage(lastPage);
      } else {
        setInternships((prev) => prev.map((internship) => (
          internship.id === id ? { ...internship, status: status as Internship['status'] } : internship
        )));
      }
      toast.success('Status updated.');
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this internship? All applications will also be deleted.')) return;
    setDeletingId(id);
    try {
      await adminApi.deleteInternship(id);
      toast.success('Internship deleted.');
      setInternships((prev) => prev.filter((i) => i.id !== id));
      setTotal((t) => t - 1);
    } catch {
      toast.error('Failed to delete internship.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const statuses = ['', 'ACTIVE', 'DRAFT', 'CLOSED', 'FILLED'];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Internships</h2>
          <p className="text-sm text-gray-500">{total} total</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 w-52"
              aria-label="Search internships"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">Search</Button>
        </form>
      </div>

      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            aria-pressed={statusFilter === s}
            className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', statusFilter === s ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <Card>
        {loadError ? (
          <div className="p-8 text-center" role="alert">
            <p className="text-sm text-red-700">Internships could not be loaded. Please try again.</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => { void load(); }}>
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="p-8 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : internships.length === 0 ? (
          <div className="p-12 text-center"><Briefcase size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500">No internships found.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Applicants</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Posted</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {internships.map((internship) => (
                  <tr key={internship.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-48 truncate">{internship.title}</td>
                    <td className="px-4 py-3 text-gray-600">{internship.employer?.companyName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={internship.status}
                        onChange={(e) => handleStatusChange(internship.id, e.target.value)}
                        aria-label={`Status for ${internship.title}`}
                        className={clsx('text-xs px-2 py-1 rounded-full font-medium border-0 focus:ring-1 focus:ring-violet-500 cursor-pointer', STATUS_COLORS[internship.status] ?? 'bg-gray-100 text-gray-600')}
                      >
                        {['ACTIVE', 'DRAFT', 'CLOSED', 'FILLED'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{internship._count?.applications ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(internship.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(internship.id)} disabled={deletingId === internship.id} className="text-red-400 hover:text-red-600 p-1 rounded" aria-label={`Delete internship ${internship.title}`}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={14} /></Button>
              <Button size="sm" variant="ghost" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={14} /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminInternships;
