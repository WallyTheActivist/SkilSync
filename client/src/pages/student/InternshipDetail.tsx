import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Wifi, Clock, DollarSign, Calendar,
  Building2, Users, CheckCircle, XCircle, Zap, Star,
  TrendingUp, AlertTriangle, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { internshipsApi, applicationsApi } from '../../services/api';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { Internship, MatchScoreResult } from '../../types';
import {
  formatCurrency, formatDate, getMatchScoreColor, getMatchScoreBg,
  PROFICIENCY_LABELS, SKILL_CATEGORY_COLORS, SKILL_CATEGORY_LABELS,
} from '../../utils/helpers';
import clsx from 'clsx';

export const InternshipDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [internship, setInternship] = useState<Internship | null>(null);
  const [matchScore, setMatchScore] = useState<MatchScoreResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      internshipsApi.getById(id),
      internshipsApi.getMatchScore(id),
    ]).then(([intRes, matchRes]) => {
      setInternship(intRes.data.data);
      setMatchScore(matchRes.data.data);
    }).catch(() => {
      toast.error('Failed to load internship.');
      navigate('/internships');
    }).finally(() => setIsLoading(false));
  }, [id]);

  const handleApply = async () => {
    if (!id) return;
    setIsApplying(true);
    try {
      await applicationsApi.apply(id, coverLetter || undefined);
      setHasApplied(true);
      setIsApplyOpen(false);
      toast.success('Application submitted successfully!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to apply.');
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!internship) return null;

  const score = matchScore?.overall ?? null;
  const scoreValue = score ?? 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={16} /> Back to Internships
      </button>

      {/* Hero Card */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-300 flex items-center justify-center text-primary-700 font-bold text-2xl shrink-0">
            {internship.employer.companyName[0]}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{internship.title}</h1>
                <p className="text-gray-500 mt-0.5">{internship.employer.companyName}</p>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500">
                  {internship.location && (
                    <span className="flex items-center gap-1.5"><MapPin size={14} />{internship.location}</span>
                  )}
                  {internship.isRemote && (
                    <Badge variant="success"><Wifi size={12} className="mr-1" />Remote Available</Badge>
                  )}
                  {internship.durationMonths && (
                    <span className="flex items-center gap-1.5"><Clock size={14} />{internship.durationMonths} months</span>
                  )}
                  {internship.stipend && (
                    <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <DollarSign size={14} />{formatCurrency(internship.stipend, internship.currency)}/month
                    </span>
                  )}
                </div>
              </div>

              {/* Match Score */}
              <div className="flex flex-col items-center bg-gray-50 rounded-2xl px-6 py-4 min-w-[120px]">
                <p className="text-xs text-gray-500 mb-1">Your Match</p>
                <p className={clsx('text-4xl font-bold', score === null ? 'text-gray-500' : getMatchScoreColor(score))}>
                  {score === null ? '—' : `${score}%`}
                </p>
                <p className={clsx('text-xs font-medium mt-1', score === null ? 'text-gray-500' : getMatchScoreColor(score))}>
                  {matchScore?.label}
                </p>
                {score !== null && <ProgressBar value={score} size="sm" className="mt-2 w-full" />}
                {matchScore && score !== null && (
                  <div className="mt-2 flex gap-1 text-[10px]">
                    <span className="text-emerald-600 font-semibold">{matchScore.stats.fullMatches}✓</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-amber-600 font-semibold">{matchScore.stats.partialMatches}~</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-red-500 font-semibold">{matchScore.stats.missingCount}✗</span>
                  </div>
                )}
              </div>
            </div>

            {/* Deadline */}
            {internship.applicationDeadline && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-amber-500" />
                <span className="text-amber-700 font-medium">Application Deadline: {formatDate(internship.applicationDeadline)}</span>
              </div>
            )}

            {/* Apply CTA */}
            <div className="mt-5">
              {hasApplied ? (
                <div className="flex items-center gap-2 text-emerald-600 font-medium">
                  <CheckCircle size={18} />
                  Application submitted! <Link to="/applications" className="underline">View status</Link>
                </div>
              ) : (
                <Button size="lg" onClick={() => setIsApplyOpen(true)} leftIcon={<Zap size={16} />}>
                  Apply Now
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardTitle className="mb-4">About the Role</CardTitle>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{internship.description}</p>
          </Card>

          {internship.responsibilities && (
            <Card>
              <CardTitle className="mb-4">Responsibilities</CardTitle>
              <ul className="space-y-2">
                {internship.responsibilities.split('\n').filter(Boolean).map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {internship.requirements && (
            <Card>
              <CardTitle className="mb-4">Requirements</CardTitle>
              <ul className="space-y-2">
                {internship.requirements.split('\n').filter(Boolean).map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <Star size={14} className="text-primary-400 mt-0.5 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* ─── Skills Match Analysis ─────────────────────────── */}
          <Card>
            <CardTitle className="mb-4">Skills Match Analysis</CardTitle>

            {/* Score ring + stat pills */}
            <div className="flex items-center gap-4 mb-5">
              {/* Circular score display */}
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - scoreValue / 100)}`}
                    className={clsx('transition-all duration-700', {
                      'stroke-emerald-500': score !== null && score >= 70,
                      'stroke-indigo-500': score !== null && score >= 40 && score < 70,
                      'stroke-amber-400': score !== null && score >= 20 && score < 40,
                      'stroke-red-400': score !== null && score < 20,
                    })}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={clsx('text-xl font-bold leading-none', score === null ? 'text-gray-500' : getMatchScoreColor(score))}>
                    {score === null ? '—' : `${score}%`}
                  </span>
                  <span className="text-[9px] text-gray-400 mt-0.5">{score === null ? 'unavailable' : 'match'}</span>
                </div>
              </div>

              <div className="flex-1 space-y-1.5">
                <p className={clsx('text-sm font-semibold', score === null ? 'text-gray-500' : getMatchScoreColor(score))}>
                  {matchScore?.label}
                </p>
                {matchScore && score !== null && (
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="bg-emerald-50 rounded-lg py-1.5">
                      <p className="text-sm font-bold text-emerald-700">{matchScore.stats.fullMatches}</p>
                      <p className="text-[9px] text-emerald-600 leading-tight">Full</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg py-1.5">
                      <p className="text-sm font-bold text-amber-700">{matchScore.stats.partialMatches}</p>
                      <p className="text-[9px] text-amber-600 leading-tight">Partial</p>
                    </div>
                    <div className="bg-red-50 rounded-lg py-1.5">
                      <p className="text-sm font-bold text-red-600">{matchScore.stats.missingCount}</p>
                      <p className="text-[9px] text-red-500 leading-tight">Missing</p>
                    </div>
                  </div>
                )}
                {matchScore && score !== null && (
                  <p className="text-[10px] text-gray-400">
                    {matchScore.stats.earnedPoints} / {matchScore.stats.maxPoints} pts
                  </p>
                )}
              </div>
            </div>

            {/* Overall progress bar */}
            {score !== null && <ProgressBar value={score} size="md" showLabel className="mb-5" />}

            {/* Per-skill breakdown */}
            {internship.requiredSkills.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Skill Breakdown</p>

                {/* Full & Partial Matches */}
                {matchScore?.breakdown.matched.map((m) => (
                  <div key={m.skillId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {m.matchType === 'full' ? (
                          <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                        )}
                        <span className="text-xs font-medium text-gray-800 truncate">{m.skillName}</span>
                      </div>
                      <span className={clsx(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ml-1',
                        m.matchType === 'full'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700',
                      )}>
                        {m.matchType === 'full' ? 'Full' : 'Partial'} {m.pct}%
                      </span>
                    </div>
                    <div className="ml-5">
                      <div className="flex gap-1 text-[10px] text-gray-400 mb-1">
                        <span>Need: <span className="text-gray-600 font-medium">{PROFICIENCY_LABELS[m.requiredLevel]}</span></span>
                        <span>·</span>
                        <span>Yours: <span className={clsx('font-medium', m.matchType === 'full' ? 'text-emerald-600' : 'text-amber-600')}>{PROFICIENCY_LABELS[m.studentLevel]}</span></span>
                      </div>
                      <ProgressBar
                        value={m.pct}
                        size="sm"
                        colorClass={m.matchType === 'full' ? 'bg-emerald-500' : 'bg-amber-400'}
                      />
                    </div>
                  </div>
                ))}

                {/* Missing skills */}
                {matchScore?.breakdown.missing.map((m) => (
                  <div key={m.skillId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <XCircle size={13} className="text-red-400 shrink-0" />
                        <span className="text-xs font-medium text-gray-500 truncate">{m.skillName}</span>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-500 shrink-0 ml-1">
                        Missing
                      </span>
                    </div>
                    <div className="ml-5">
                      <p className="text-[10px] text-gray-400 mb-1">
                        Need: <span className="text-gray-600 font-medium">{PROFICIENCY_LABELS[m.requiredLevel]}</span>
                        {m.importance >= 4 && <span className="ml-1 text-red-500">· Required</span>}
                      </p>
                      <ProgressBar value={0} size="sm" colorClass="bg-red-400" />
                    </div>
                  </div>
                ))}

                {/* Bonus skills */}
                {matchScore && matchScore.breakdown.bonus.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Sparkles size={10} /> Bonus Skills (+{Math.min(matchScore.breakdown.bonus.length * 2, 6)}pts)
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {matchScore.breakdown.bonus.map((b) => (
                        <span key={b.skillId} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                          {b.skillName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Company */}
          <Card>
            <CardTitle className="mb-4">About the Company</CardTitle>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-700 font-bold">
                {internship.employer.companyName[0]}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{internship.employer.companyName}</p>
                {internship.employer.industry && (
                  <p className="text-xs text-gray-500">{internship.employer.industry}</p>
                )}
              </div>
            </div>
            {internship.employer.description && (
              <p className="text-xs text-gray-600 leading-relaxed">{internship.employer.description}</p>
            )}
            {internship.employer.city && (
              <p className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                <Building2 size={12} /> {internship.employer.city}, {internship.employer.country}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Apply Modal */}
      <Modal
        isOpen={isApplyOpen}
        onClose={() => setIsApplyOpen(false)}
        title={`Apply for ${internship.title}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsApplyOpen(false)}>Cancel</Button>
            <Button onClick={handleApply} isLoading={isApplying} leftIcon={<Zap size={15} />}>
              Submit Application
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Match Score</span>
              <span className={clsx('font-bold text-lg', score === null ? 'text-gray-500' : getMatchScoreColor(score))}>
                {score === null ? 'Not enough information' : `${score}%`}
              </span>
            </div>
            {score !== null && <ProgressBar value={score} size="sm" className="mt-2" />}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cover Letter <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={6}
              placeholder="Tell the employer why you're a great fit for this role..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{coverLetter.length}/1000 characters</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InternshipDetail;
