import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, MapPin, Wifi, Clock, DollarSign, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { applicationsApi } from '../../services/api';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { Application, ApplicationStatus } from '../../types';
import {
  APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS,
  formatDate, formatCurrency, getMatchScoreColor,
} from '../../utils/helpers';
import { isApplicationClosed } from '../../utils/applicationLifecycle.mjs';
import clsx from 'clsx';

const STATUS_STEPS: ApplicationStatus[] = [
  'PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED',
];

export const Applications: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    applicationsApi.getMyApplications().then(({ data }) => {
      setApplications(data.data);
    }).finally(() => setIsLoading(false));
  }, []);

  const handleWithdraw = async (id: string) => {
    if (!confirm('Withdraw this application?')) return;
    try {
      await applicationsApi.withdraw(id);
      setApplications((prev) => prev.map((a) => a.id === id ? { ...a, status: 'WITHDRAWN' } : a));
      toast.success('Application withdrawn.');
    } catch {
      toast.error('Failed to withdraw application.');
    }
  };

  const statusCounts = applications.reduce<Record<string, number>>((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {});

  const filtered = filter === 'ALL' ? applications : applications.filter((a) => a.status === filter);

  const getStepIndex = (status: ApplicationStatus) => STATUS_STEPS.indexOf(status);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Applications</h2>
          <p className="text-sm text-gray-500 mt-0.5">{applications.length} total applications</p>
        </div>
        <Link to="/internships">
          <Button variant="outline" size="sm">Browse More</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: applications.length, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: 'Shortlisted', count: statusCounts['SHORTLISTED'] || 0, color: 'text-indigo-700', bg: 'bg-indigo-50' },
          { label: 'Interview', count: statusCounts['INTERVIEW_SCHEDULED'] || 0, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Offered', count: statusCounts['OFFERED'] || 0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
        ].map((s) => (
          <div key={s.label} className={clsx('rounded-xl p-4 text-center', s.bg)}>
            <p className={clsx('text-3xl font-bold', s.color)}>{s.count}</p>
            <p className="text-sm text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED', 'WITHDRAWN'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === s ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {s === 'ALL' ? 'All' : APPLICATION_STATUS_LABELS[s as ApplicationStatus]}
            {s !== 'ALL' && statusCounts[s] ? ` (${statusCounts[s]})` : ''}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {filtered.length === 0 ? (
        <Card className="text-center py-12">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">No applications found</p>
          <p className="text-sm text-gray-400 mt-1">Start applying to internships to track them here.</p>
          <Link to="/internships" className="mt-4 inline-block">
            <Button>Browse Internships</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((app) => {
            const stepIdx = getStepIndex(app.status);
            const isActive = !['REJECTED', 'WITHDRAWN', 'ACCEPTED'].includes(app.status);
            return (
              <Card key={app.id} padding="none">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-lg shrink-0">
                      {app.internship.employer.companyName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="font-semibold text-gray-900">{app.internship.title}</h3>
                          <p className="text-sm text-gray-500">{app.internship.employer.companyName}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', APPLICATION_STATUS_COLORS[app.status])}>
                            {APPLICATION_STATUS_LABELS[app.status]}
                          </span>
                          <span className={clsx('text-sm font-bold', app.matchScore === null ? 'text-gray-500' : getMatchScoreColor(app.matchScore))}>
                            {app.matchScore === null ? 'Match unavailable at application' : `${app.matchScore}% match at application`}
                          </span>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-2">
                        <span>Applied {formatDate(app.appliedAt)}</span>
                        {app.internship.location && (
                          <span className="flex items-center gap-1"><MapPin size={11} />{app.internship.location.split(',')[0]}</span>
                        )}
                        {app.internship.isRemote && <Badge variant="success" size="sm">Remote</Badge>}
                        {app.internship.stipend && (
                          <span className="text-emerald-600">{formatCurrency(app.internship.stipend)}/mo</span>
                        )}
                      </div>
                      {isApplicationClosed(app.closedAt) && (
                        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          The employer has closed this application process. Your application and decision remain in your history.
                          {' '}Closed {formatDate(app.closedAt)}.
                        </p>
                      )}

                      {/* Progress timeline (active only) */}
                      {isActive && stepIdx >= 0 && (
                        <div className="mt-4">
                          <div className="flex items-center gap-0">
                            {STATUS_STEPS.map((step, i) => (
                              <React.Fragment key={step}>
                                <div className="flex flex-col items-center">
                                  <div className={clsx(
                                    'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                                    i <= stepIdx
                                      ? 'bg-primary-600 border-primary-600'
                                      : 'bg-white border-gray-200',
                                  )}>
                                    {i <= stepIdx && <div className="w-2 h-2 bg-white rounded-full" />}
                                  </div>
                                  <p className="text-[9px] text-gray-400 mt-1 text-center max-w-[52px] leading-tight">
                                    {APPLICATION_STATUS_LABELS[step]}
                                  </p>
                                </div>
                                {i < STATUS_STEPS.length - 1 && (
                                  <div className={clsx('flex-1 h-0.5 mt-[-9px]', i < stepIdx ? 'bg-primary-500' : 'bg-gray-100')} />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <Link to={`/internships/${app.internshipId}`} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                    <ExternalLink size={12} /> View Internship
                  </Link>
                  {['PENDING', 'UNDER_REVIEW'].includes(app.status) && (
                    <button
                      onClick={() => handleWithdraw(app.id)}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X size={12} /> Withdraw
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Applications;
