import React, { useEffect, useState, useCallback } from 'react';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '../../services/api';
import type { AdminApplication } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS, formatDate, getInitials } from '../../utils/helpers';
import clsx from 'clsx';

const STATUS_OPTIONS = ['', 'PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'];

const AdminApplications: React.FC = () => {
  const [apps, setApps] = useState<AdminApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const r = await adminApi.getApplications({ status: statusFilter || undefined, page, limit: LIMIT });
      setApps(r.data.data);
      setTotal(r.data.pagination.total);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Applications</h2>
        <p className="text-sm text-gray-500">{total} total applications</p>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            aria-pressed={statusFilter === s}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', statusFilter === s ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}
          >
            {s ? (APPLICATION_STATUS_LABELS[s as keyof typeof APPLICATION_STATUS_LABELS] ?? s) : 'All'}
          </button>
        ))}
      </div>

      <Card>
        {loadError ? (
          <div className="p-8 text-center" role="alert">
            <p className="text-sm text-red-700">Applications could not be loaded. Please try again.</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => { void load(); }}>
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="p-8 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : apps.length === 0 ? (
          <div className="p-12 text-center"><FileText size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500">No applications found.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Internship</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Match at application</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {apps.map((app) => {
                  const sp = app.studentProfile;
                  return (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold shrink-0">
                            {getInitials(sp?.firstName, sp?.lastName)}
                          </div>
                          <span className="font-medium text-gray-900">{sp?.firstName} {sp?.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-36 truncate">{app.internship?.title}</td>
                      <td className="px-4 py-3 text-gray-600">{app.internship?.employer?.companyName}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-800">
                          {app.matchScore === null ? 'Unavailable' : `${app.matchScore.toFixed(0)}%`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={APPLICATION_STATUS_COLORS[app.status as keyof typeof APPLICATION_STATUS_COLORS] as 'success' | 'warning' | 'info' | 'danger' | 'default'}
                          size="sm"
                        >
                          {APPLICATION_STATUS_LABELS[app.status as keyof typeof APPLICATION_STATUS_LABELS] ?? app.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(app.appliedAt)}</td>
                    </tr>
                  );
                })}
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

export default AdminApplications;
