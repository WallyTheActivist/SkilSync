import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { adminApi } from '../../services/api';
import type { AdminAnalytics } from '../../types';
import { Card } from '../../components/ui/Card';

const Analytics: React.FC = () => {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getAnalytics()
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-gray-200 rounded-xl" />)}
      </div>
    );
  }

  const topInternshipsData = data?.topInternships.slice(0, 8).map((i) => ({
    name: i.title.length > 20 ? i.title.slice(0, 20) + '…' : i.title,
    applications: i._count.applications,
    company: i.employer?.companyName,
  })) ?? [];

  const topSkillsData = data?.topSkills.slice(0, 10).map((s) => ({
    name: s.name,
    students: s._count.studentSkills,
  })) ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Platform Analytics</h2>
        <p className="text-sm text-gray-500">Insights into platform activity and engagement</p>
      </div>

      {/* Application Trend */}
      {(data?.applicationTrend?.length ?? 0) > 0 && (
        <Card>
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Applications – Last 30 Days</h3>
          </div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data!.applicationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(v) => `Date: ${v}`} />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Applications" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Top Internships */}
      <Card>
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Top Internships by Applications</h3>
        </div>
        <div className="p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topInternshipsData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
              <Tooltip formatter={(v, n) => [v, 'Applications']} />
              <Bar dataKey="applications" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top Skills */}
      <Card>
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Most Popular Skills</h3>
        </div>
        <div className="p-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSkillsData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="students" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

export default Analytics;
