import React, { useEffect, useState, useCallback } from 'react';
import { Users, Search, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import type { AdminUser } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatDate, getInitials } from '../../utils/helpers';

const Students: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const r = await adminApi.getStudents({ search: query || undefined, page, limit: LIMIT });
      setUsers(r.data.data);
      setTotal(r.data.pagination.total);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search);
    setPage(1);
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete student ${email}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await adminApi.deleteUser(id);
      toast.success('Student deleted.');
      const remainingTotal = Math.max(0, total - 1);
      const lastPage = Math.max(1, Math.ceil(remainingTotal / LIMIT));
      setTotal(remainingTotal);
      if (page > lastPage) {
        setPage(lastPage);
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      }
    } catch {
      toast.error('Failed to delete user.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Students</h2>
          <p className="text-sm text-gray-500">{total} registered students</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 w-52"
              aria-label="Search students by name or email"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">Search</Button>
        </form>
      </div>

      <Card>
        {loadError ? (
          <div className="p-8 text-center" role="alert">
            <p className="text-sm text-red-700">Students could not be loaded. Please try again.</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => { void load(); }}>
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No students found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">University</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Skills</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Applications</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => {
                  const sp = u.studentProfile;
                  const initials = getInitials(sp?.firstName, sp?.lastName);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{sp?.firstName} {sp?.lastName}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{sp?.university ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{sp?._count?.studentSkills ?? 0}</td>
                      <td className="px-4 py-3 text-gray-600">{sp?._count?.applications ?? 0}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(u.id, u.email)}
                          disabled={deletingId === u.id}
                          className="text-red-400 hover:text-red-600 p-1 rounded"
                          aria-label={`Delete student ${u.email}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Students;
