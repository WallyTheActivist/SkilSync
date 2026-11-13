import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, ChevronDown, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { employerApi } from '../../services/api';
import type { ApplicationWithStudent, Internship } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS, formatDate, getInitials } from '../../utils/helpers';
import { getApplicationStatusUpdateError, persistApplicationStatus } from '../../utils/applicationStatusUpdate.mjs';
import { isApplicationClosed } from '../../utils/applicationLifecycle.mjs';
import type { ApplicationStatus } from '../../types';
import clsx from 'clsx';

const STATUS_OPTIONS: ApplicationStatus[] = ['PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'ACCEPTED', 'REJECTED'];

const Applicants: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('internship') ?? '';
  const [internships, setInternships] = useState<Internship[]>([]);
  const [selectedInternship, setSelectedInternship] = useState<string>('');
  const [applicants, setApplicants] = useState<ApplicationWithStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState<'open' | 'closed'>('open');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    employerApi.getMyInternships({ limit: 100 }).then((r) => {
      setInternships(r.data.data);
      if (preselectedId && r.data.data.some((i) => i.id === preselectedId)) {
        setSelectedInternship(preselectedId);
      } else if (r.data.data.length > 0) {
        setSelectedInternship(r.data.data[0].id);
      }
    });
  }, [preselectedId]);

  useEffect(() => {
    if (!selectedInternship) return;
    setLoading(true);
    employerApi.getApplicants(selectedInternship, statusFilter || undefined, lifecycleFilter)
      .then((r) => setApplicants(r.data.data))
      .catch(() => toast.error('Failed to load applicants.'))
      .finally(() => setLoading(false));
  }, [selectedInternship, statusFilter, lifecycleFilter]);

  const handleCloseApplication = async (appId: string) => {
    const confirmation = 'Close and archive this application? It will be archived for your employer account but will remain visible to the student with its decision and application history.';
    if (!window.confirm(confirmation)) return;

    setUpdatingId(appId);
    try {
      await employerApi.closeApplication(appId);
      setApplicants((prev) => prev.filter((app) => app.id !== appId));
      toast.success('Application archived.');
    } catch {
      toast.error('Failed to archive application.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusUpdate = async (appId: string, status: ApplicationStatus) => {
    setUpdatingId(appId);
    try {
      await persistApplicationStatus(
        appId,
        status,
        employerApi.updateApplicationStatus,
        (savedStatus) => setApplicants((prev) => prev.map((a) => a.id === appId ? { ...a, status: savedStatus } : a)),
      );
      toast.success('Status updated!');
    } catch (error) {
      toast.error(getApplicationStatusUpdateError(error));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-gray-900 flex-1">Applicants</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-2" role="tablist" aria-label="Application lifecycle">
        {([
          { value: 'open', label: 'Open applications' },
          { value: 'closed', label: 'Archived applications' },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={lifecycleFilter === value}
            onClick={() => setLifecycleFilter(value)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              lifecycleFilter === value ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <label className="text-xs text-gray-500 mb-1 block">Internship</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={selectedInternship}
            onChange={(e) => setSelectedInternship(e.target.value)}
          >
            {internships.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Decision status</label>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s as keyof typeof APPLICATION_STATUS_LABELS] ?? s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : applicants.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={22} className="text-gray-400" />
          </div>
          <p className="font-semibold text-gray-900">
            {lifecycleFilter === 'closed' ? 'No archived applications' : 'No open applicants'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {lifecycleFilter === 'closed'
              ? 'Applications you archive will remain available here.'
              : 'Open applications will appear here once students apply.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{applicants.length} applicant{applicants.length !== 1 ? 's' : ''} — ranked by application-time match score</p>
          {applicants.map((app, idx) => {
            const sp = app.studentProfile;
            const initials = getInitials(sp?.firstName, sp?.lastName);
            const isExpanded = expandedId === app.id;

            return (
              <Card key={app.id} className="overflow-hidden">
                <div className="p-4 flex items-start gap-4">
                  {/* Rank */}
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                    {idx + 1}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm shrink-0">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{sp?.firstName} {sp?.lastName}</p>
                      <Badge
                        variant={APPLICATION_STATUS_COLORS[app.status as keyof typeof APPLICATION_STATUS_COLORS] as 'success' | 'warning' | 'info' | 'danger' | 'default'}
                        size="sm"
                      >
                        {APPLICATION_STATUS_LABELS[app.status as keyof typeof APPLICATION_STATUS_LABELS] ?? app.status}
                      </Badge>
                    </div>
                    {sp?.university && <p className="text-xs text-gray-500">{sp.university} · {sp.degree}</p>}
                    <div className="mt-2 flex items-center gap-3">
                      {app.matchScore !== null && (
                        <div className="flex-1 max-w-32">
                          <ProgressBar value={app.matchScore} max={100} size="sm" animated />
                        </div>
                      )}
                      <span className="text-sm font-bold text-gray-700">
                        {app.matchScore === null ? 'Unavailable at application' : `${app.matchScore.toFixed(0)}% at application`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Applied {formatDate(app.appliedAt)}</p>
                    {isApplicationClosed(app.closedAt) && (
                      <p className="text-xs text-gray-500 mt-1">
                        {app.internship?.title} · Archived {formatDate(app.closedAt)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {!isApplicationClosed(app.closedAt) && (
                      <>
                        <select
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          value={app.status}
                          disabled={updatingId === app.id}
                          onChange={(e) => handleStatusUpdate(app.id, e.target.value as ApplicationStatus)}
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s as keyof typeof APPLICATION_STATUS_LABELS] ?? s}</option>)}
                        </select>
                        <button
                          type="button"
                          disabled={updatingId === app.id}
                          onClick={() => void handleCloseApplication(app.id)}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <Archive size={12} /> Close / Archive
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : app.id)}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 justify-center"
                    >
                      <ChevronDown size={12} className={clsx('transition-transform', isExpanded && 'rotate-180')} />
                      {isExpanded ? 'Less' : 'More'}
                    </button>
                  </div>
                </div>

                {/* Expanded cover letter + skills */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
                    {app.coverLetter && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Cover Letter</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{app.coverLetter}</p>
                      </div>
                    )}
                    {sp?.studentSkills && sp.studentSkills.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Skills</p>
                        <div className="flex flex-wrap gap-2">
                          {sp.studentSkills.map((ss) => (
                            <span key={ss.id} className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-700">
                              {ss.skill?.name} · {ss.proficiency}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Applicants;
