import React, { useCallback, useEffect, useState } from 'react';
import { Users, Building2, Briefcase, Award, FileText, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { adminApi } from '../../services/api';
import type { AdminStats, AdminAnalytics } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import clsx from 'clsx';

const StatCard: React.FC<{ label: string; value: number; icon: React.ElementType; tone: string }> = ({
  label, value, icon: Icon, tone,
}) => (
  <Card padding="none" className="h-full border-gray-200 shadow-sm">
    <div className="flex h-full min-h-28 items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-sm leading-5 text-gray-600">{label}</p>
        <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-gray-900">{value.toLocaleString()}</p>
      </div>
      <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon size={20} aria-hidden="true" />
      </div>
    </div>
  </Card>
);

const PIE_COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#64748b'];

const EmptyChartMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-gray-500">
    {children}
  </div>
);

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [statsRes, analyticsRes] = await Promise.all([adminApi.getStats(), adminApi.getAnalytics()]);
      setStats(statsRes.data.data);
      setAnalytics(analyticsRes.data.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboardData(); }, [loadDashboardData]);

  const appStatusData = stats?.applicationsByStatus.map((item) => ({
    name: item.status.replace(/_/g, ' '),
    value: item._count,
  })) ?? [];

  const internshipStatusData = stats?.internshipsByStatus.map((item) => ({
    name: item.status,
    value: item._count,
  })) ?? [];

  const topRequestedSkills = stats?.topRequestedSkills ?? [];
  const readinessDistribution = stats?.readinessDistribution ?? [];
  const applicationTrend = analytics?.applicationTrend ?? [];
  const recentRegistrations = stats?.recentRegistrations ?? [];
  const hasReadinessData = readinessDistribution.some((tier) => tier.count > 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">SkillSync Admin</p>
          <h2 className="text-xl font-semibold leading-7 text-gray-900">Platform overview</h2>
          <p className="mt-1 text-sm text-gray-600">Key platform totals and recent activity.</p>
        </div>
        {error && (
          <Button size="sm" variant="outline" onClick={() => { void loadDashboardData(); }}>
            Try again
          </Button>
        )}
      </header>

      {error ? (
        <div role="alert">
          <Card className="border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-red-800">Dashboard data could not be loaded.</p>
            <p className="mt-1 text-sm text-red-700">Check your connection and try again.</p>
          </Card>
        </div>
      ) : loading ? (
        <div className="space-y-5" role="status" aria-label="Loading dashboard">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-6">
            {[...Array(6)].map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />)}
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {[...Array(2)].map((_, index) => <div key={index} className="h-72 animate-pulse rounded-xl border border-gray-200 bg-white" />)}
          </div>
          <span className="sr-only">Loading dashboard data.</span>
        </div>
      ) : (
        <div className="space-y-5">
      <section aria-label="Platform statistics" className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total Students" value={stats?.totalStudents ?? 0} icon={Users} tone="bg-blue-50 text-blue-700" />
        <StatCard label="Total Employers" value={stats?.totalEmployers ?? 0} icon={Building2} tone="bg-emerald-50 text-emerald-700" />
        <StatCard label="Internships" value={stats?.totalInternships ?? 0} icon={Briefcase} tone="bg-indigo-50 text-indigo-700" />
        <StatCard label="Active Postings" value={stats?.activeInternships ?? 0} icon={TrendingUp} tone="bg-amber-50 text-amber-700" />
        <StatCard label="Applications" value={stats?.totalApplications ?? 0} icon={FileText} tone="bg-sky-50 text-sky-700" />
        <StatCard label="Skills Catalogue" value={stats?.totalSkills ?? 0} icon={Award} tone="bg-slate-100 text-slate-700" />
      </section>

      <section aria-label="Application and internship status" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padding="none" className="overflow-hidden border-gray-200 shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">Applications by status</h3>
            <p className="mt-1 text-xs text-gray-500">Current distribution of submitted applications.</p>
          </div>
          <div className="h-64 p-4">
            {appStatusData.length === 0 ? (
              <EmptyChartMessage>No application status data available yet.</EmptyChartMessage>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={appStatusData} cx="50%" cy="46%" outerRadius={78} dataKey="value" nameKey="name">
                    {appStatusData.map((item, index) => <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card padding="none" className="overflow-hidden border-gray-200 shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">Internships by status</h3>
            <p className="mt-1 text-xs text-gray-500">Current count by posting status.</p>
          </div>
          <div className="h-64 p-4">
            {internshipStatusData.length === 0 ? (
              <EmptyChartMessage>No internship status data available yet.</EmptyChartMessage>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={internshipStatusData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} name="Internships" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>

      <section aria-label="Skills and student readiness" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padding="none" className="overflow-hidden border-gray-200 shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">Most requested skills</h3>
            <p className="mt-1 text-xs text-gray-500">Skills most requested across internship postings.</p>
          </div>
          <div className="h-64 p-4">
            {topRequestedSkills.length === 0 ? (
              <EmptyChartMessage>No requested skill data available yet.</EmptyChartMessage>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topRequestedSkills.map((skill) => ({ name: skill.skillName, count: skill.count }))}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#4b5563' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card padding="none" className="overflow-hidden border-gray-200 shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">Student readiness distribution</h3>
            <p className="mt-1 text-xs text-gray-500">Student profile counts by readiness tier.</p>
          </div>
          <div className="flex h-64 items-center gap-3 p-4">
            {!hasReadinessData ? (
              <EmptyChartMessage>No student readiness data available yet.</EmptyChartMessage>
            ) : (
              <>
                <div className="h-full min-w-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={readinessDistribution}
                        cx="50%" cy="50%"
                        innerRadius={42} outerRadius={68}
                        dataKey="count" nameKey="tier"
                      >
                        {readinessDistribution.map((entry) => (
                          <Cell key={entry.tier} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {readinessDistribution.map((tier) => (
                    <div key={tier.tier} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tier.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-gray-700">{tier.tier}</span>
                          <span className="tabular-nums text-gray-600">{tier.count}</span>
                        </div>
                        <p className="text-xs text-gray-500">{tier.range}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </section>

      <section aria-label="Recent activity" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padding="none" className="overflow-hidden border-gray-200 shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">Application activity</h3>
            <p className="mt-1 text-xs text-gray-500">Applications per day over the last 30 days.</p>
          </div>
          <div className="h-64 p-4">
            {applicationTrend.length === 0 ? (
              <EmptyChartMessage>No applications recorded in the last 30 days.</EmptyChartMessage>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={applicationTrend} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(date: string) => date.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip labelFormatter={(date) => `Date: ${date}`} />
                  <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} name="Applications" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card padding="none" className="overflow-hidden border-gray-200 shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">Recent registrations</h3>
            <p className="mt-1 text-xs text-gray-500">Latest student and employer accounts.</p>
          </div>
          {recentRegistrations.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center px-4 text-center text-sm text-gray-500">
              No recent registrations available.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentRegistrations.map((user) => (
                <div key={user.id} className="flex min-w-0 items-center gap-3 px-5 py-3">
                  <div className={clsx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    user.role === 'STUDENT' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700',
                  )}>
                    {user.role === 'STUDENT' ? 'S' : 'E'}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm text-gray-800">{user.email}</p>
                  <span className="shrink-0 text-xs text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                  <span className={clsx(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    user.role === 'STUDENT' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700',
                  )}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
