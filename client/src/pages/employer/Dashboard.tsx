import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Users, Clock, CheckCircle, ArrowRight, Building2, Star, TrendingUp } from 'lucide-react';
import { employerApi } from '../../services/api';
import type { EmployerDashboardStats } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS, formatDate, getInitials, getMatchScoreColor } from '../../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import clsx from 'clsx';

const StatCard: React.FC<{ label: string; value: number; icon: React.ElementType; color: string }> = ({
  label, value, icon: Icon, color,
}) => (
  <Card className="p-5">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', color)}>
        <Icon size={22} className="text-white" />
      </div>
    </div>
  </Card>
);

const EmployerDashboard: React.FC = () => {
  const [stats, setStats] = useState<EmployerDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employerApi.getDashboardStats()
      .then((r) => setStats(r.data.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold">Welcome back!</h2>
        <p className="text-emerald-100 mt-1">Manage your internship opportunities and review applicants.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Internships" value={stats?.activeInternships ?? 0} icon={Briefcase} color="bg-emerald-500" />
        <StatCard label="Total Applicants" value={stats?.totalApplications ?? 0} icon={Users} color="bg-blue-500" />
        <StatCard label="Pending Review" value={stats?.pendingApplications ?? 0} icon={Clock} color="bg-amber-500" />
        <StatCard label="Shortlisted" value={stats?.shortlistedApplications ?? 0} icon={CheckCircle} color="bg-purple-500" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/employer/internships/new" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-card-hover transition-shadow group">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Briefcase size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Post Internship</p>
            <p className="text-xs text-gray-500">Create a new opportunity</p>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:text-emerald-600 transition-colors" />
        </Link>
        <Link to="/employer/internships" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-card-hover transition-shadow group">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Briefcase size={18} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Manage Internships</p>
            <p className="text-xs text-gray-500">View & edit your postings</p>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
        </Link>
        <Link to="/employer/profile" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-card-hover transition-shadow group">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Building2 size={18} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Company Profile</p>
            <p className="text-xs text-gray-500">Update your details</p>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:text-purple-600 transition-colors" />
        </Link>
      </div>

      {/* Top Candidates + Hiring Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Candidates by match score */}
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Star size={16} className="text-amber-500" /> Top Candidates
            </h3>
            <Link to="/employer/applicants" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              View all
            </Link>
          </div>
          {(stats?.topCandidates?.length ?? 0) === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <Users size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No candidates yet. Post an internship to receive applications.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stats!.topCandidates.map((app, i) => {
                const sp = app.studentProfile;
                return (
                  <div key={app.id} className="flex items-center gap-3 p-3">
                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold shrink-0">
                      #{i + 1}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {getInitials(sp.firstName, sp.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{sp.firstName} {sp.lastName}</p>
                      <p className="text-xs text-gray-400 truncate">{app.internship.title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={clsx('text-base font-bold', app.matchScore === null ? 'text-gray-500' : getMatchScoreColor(app.matchScore))}>
                        {app.matchScore === null ? '—' : `${app.matchScore}%`}
                      </p>
                      <p className="text-[10px] text-gray-400">at application</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Hiring Statistics */}
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-600" />
            <h3 className="font-semibold text-gray-900">Hiring Statistics</h3>
          </div>
          {(stats?.applicationsByStatus?.length ?? 0) === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <p className="text-sm">No application data yet.</p>
            </div>
          ) : (
            <div className="p-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats!.applicationsByStatus.map((s) => ({
                    name: s.status.replace(/_/g, ' '),
                    count: s._count,
                  }))}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={40} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats!.applicationsByStatus.map((s, i) => (
                      <Cell key={i} fill={
                        s.status === 'ACCEPTED' ? '#10b981' :
                        s.status === 'SHORTLISTED' ? '#6366f1' :
                        s.status === 'OFFERED' ? '#22c55e' :
                        s.status === 'REJECTED' ? '#ef4444' :
                        s.status === 'PENDING' ? '#f59e0b' : '#94a3b8'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Applications */}
      {(stats?.recentApplications?.length ?? 0) > 0 && (
        <Card>
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Applications</h3>
            <Link to="/employer/applicants" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats!.recentApplications.map((app) => {
              const sp = app.studentProfile;
              const initials = getInitials(sp?.firstName, sp?.lastName);
              return (
                <div key={app.id} className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{sp?.firstName} {sp?.lastName}</p>
                    <p className="text-xs text-gray-500 truncate">{(app as unknown as { internship?: { title?: string } }).internship?.title}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">{formatDate(app.appliedAt)}</span>
                    <Badge
                      variant={APPLICATION_STATUS_COLORS[app.status as keyof typeof APPLICATION_STATUS_COLORS] as 'success' | 'warning' | 'info' | 'danger' | 'default'}
                      size="sm"
                    >
                      {APPLICATION_STATUS_LABELS[app.status as keyof typeof APPLICATION_STATUS_LABELS] ?? app.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default EmployerDashboard;
