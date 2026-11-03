import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, Users, MoreVertical, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { employerApi } from '../../services/api';
import type { Internship } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatDate, formatCurrency } from '../../utils/helpers';
import clsx from 'clsx';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DRAFT:  'bg-gray-100 text-gray-600',
  CLOSED: 'bg-red-100 text-red-700',
  FILLED: 'bg-blue-100 text-blue-700',
};

const MyInternships: React.FC = () => {
  const navigate = useNavigate();
  const [internships, setInternships] = useState<Internship[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await employerApi.getMyInternships({ status: statusFilter || undefined });
      setInternships(r.data.data);
      setTotal(r.data.pagination.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this internship? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await employerApi.deleteInternship(id);
      toast.success('Internship deleted.');
      setInternships((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast.error('Failed to delete internship.');
    } finally {
      setDeleting(null);
    }
  };

  const statuses = ['', 'ACTIVE', 'DRAFT', 'CLOSED', 'FILLED'];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Internships</h2>
          <p className="text-sm text-gray-500">{total} total posting{total !== 1 ? 's' : ''}</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/employer/internships/new')}>
          Post Internship
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === s ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : internships.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={22} className="text-gray-400" />
          </div>
          <p className="font-semibold text-gray-900">No internships found</p>
          <p className="text-sm text-gray-500 mt-1">Post your first internship to start receiving applications.</p>
          <Button className="mt-4" leftIcon={<Plus size={16} />} onClick={() => navigate('/employer/internships/new')}>
            Post Internship
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {internships.map((internship) => (
            <Card key={internship.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{internship.title}</h3>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[internship.status] ?? 'bg-gray-100 text-gray-600')}>
                      {internship.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">{internship.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                    {internship.location && <span>{internship.location}</span>}
                    {internship.isRemote && <span className="text-emerald-600">Remote</span>}
                    {internship.stipend && <span>{formatCurrency(internship.stipend, internship.currency)}/mo</span>}
                    {internship.applicationDeadline && <span>Deadline: {formatDate(internship.applicationDeadline)}</span>}
                    <span className="flex items-center gap-1">
                      <Users size={11} /> {internship._count?.applications ?? 0} applicant{(internship._count?.applications ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/employer/applicants?internship=${internship.id}`}>
                    <Button variant="secondary" size="sm" leftIcon={<Users size={14} />}>
                      Applicants
                    </Button>
                  </Link>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === internship.id ? null : internship.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenu === internship.id && (
                      <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-gray-100 z-10 w-36">
                        <button
                          onClick={() => { navigate(`/employer/internships/${internship.id}/edit`); setOpenMenu(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-xl"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => { handleDelete(internship.id); setOpenMenu(null); }}
                          disabled={deleting === internship.id}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-xl"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyInternships;
