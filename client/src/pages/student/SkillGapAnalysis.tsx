import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, AlertCircle, CheckCircle2, BookOpen, Award,
  ArrowRight, RefreshCw, Zap, BarChart3, Brain, Briefcase, FileText,
  XCircle, AlertTriangle, Lightbulb, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { studentApi } from '../../services/api';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { SkillGapAnalysis, Recommendation, ReadinessBreakdown } from '../../types';
import {
  getReadinessLabel, getReadinessColor, PROFICIENCY_LABELS,
  SKILL_CATEGORY_COLORS, SKILL_CATEGORY_LABELS, getSafeExternalUrl,
} from '../../utils/helpers';
import clsx from 'clsx';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

const PRIORITY_LABELS: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' };
const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700',
  2: 'bg-amber-50 text-amber-700',
  3: 'bg-red-50 text-red-700',
};

const REC_ICON: Record<string, React.ElementType> = {
  course: BookOpen,
  certification: Award,
};

// Readiness tier config matching spec: 0-49 Not Ready, 50-69 Developing, 70-84 Ready, 85-100 Highly Ready
const READINESS_TIERS = [
  { min: 0,  max: 49, label: 'Not Ready',    color: 'bg-red-500',    text: 'text-red-600',    ring: 'ring-red-200',    bg: 'bg-red-50' },
  { min: 50, max: 69, label: 'Developing',   color: 'bg-amber-500',  text: 'text-amber-600',  ring: 'ring-amber-200',  bg: 'bg-amber-50' },
  { min: 70, max: 84, label: 'Ready',        color: 'bg-green-500',  text: 'text-green-600',  ring: 'ring-green-200',  bg: 'bg-green-50' },
  { min: 85, max: 100,label: 'Highly Ready', color: 'bg-emerald-500',text: 'text-emerald-600',ring: 'ring-emerald-200',bg: 'bg-emerald-50' },
];

const getTier = (score: number) =>
  READINESS_TIERS.find((t) => score >= t.min && score <= t.max) ?? READINESS_TIERS[0];

export const SkillGapAnalysisPage: React.FC = () => {
  const [analysis, setAnalysis] = useState<SkillGapAnalysis | null>(null);
  const [breakdown, setBreakdown] = useState<ReadinessBreakdown | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [gapRes, recRes, readinessRes] = await Promise.all([
        studentApi.getSkillGap(),
        studentApi.getRecommendations(),
        studentApi.getReadinessScore(),
      ]);
      setAnalysis(gapRes.data.data);
      setRecommendations(recRes.data.data);
      setBreakdown(readinessRes.data.data.breakdown);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleComplete = async (id: string) => {
    setCompletingId(id);
    try {
      await studentApi.markRecommendationComplete(id);
      setRecommendations((prev) => prev.map((r) => r.id === id ? { ...r, isCompleted: true } : r));
      toast.success('Marked as complete!');
    } catch {
      toast.error('Failed to update.');
    } finally {
      setCompletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!analysis) return null;

  const readiness = analysis.overallReadiness;

  // Radar chart data from top gaps
  const radarData = analysis.topGaps.slice(0, 6).map((gap) => ({
    skill: gap.skillName.length > 12 ? gap.skillName.substring(0, 10) + '…' : gap.skillName,
    Required: 5,
    Current: gap.currentLevel ? { BEGINNER: 1, ELEMENTARY: 2, INTERMEDIATE: 3, ADVANCED: 4, EXPERT: 5 }[gap.currentLevel] : 0,
  }));

  const activeRecs = recommendations.filter((r) => !r.isCompleted);
  const completedRecs = recommendations.filter((r) => r.isCompleted);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Skill Gap Analysis</h2>
          <p className="text-sm text-gray-500 mt-0.5">Understand your readiness and areas to improve</p>
        </div>
        <Button variant="outline" size="sm" leftIcon={<RefreshCw size={14} />} onClick={load} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {/* ─── Readiness Score Banner ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-500 rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-6">
          <div className="flex-1">
            <p className="text-primary-200 text-sm mb-1">Overall Readiness Score</p>
            <p className="text-5xl font-bold mb-2">{readiness}%</p>
            <p className="text-primary-100 text-lg font-semibold">{getReadinessLabel(readiness)}</p>
            <ProgressBar value={readiness} colorClass="bg-white/80" size="lg" className="mt-3 max-w-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{analysis.totalSkillsOwned}</p>
              <p className="text-primary-200 text-xs mt-1">Skills Owned</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{analysis.topGaps.length}</p>
              <p className="text-primary-200 text-xs mt-1">Skill Gaps</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{analysis.strongSkills.length}</p>
              <p className="text-primary-200 text-xs mt-1">Strong Skills</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{completedRecs.length}</p>
              <p className="text-primary-200 text-xs mt-1">Goals Complete</p>
            </div>
          </div>
        </div>

        {/* Tier indicators */}
        <div className="grid grid-cols-4 gap-2">
          {READINESS_TIERS.map((tier) => {
            const active = readiness >= tier.min && readiness <= tier.max;
            return (
              <div
                key={tier.label}
                className={clsx(
                  'rounded-xl p-3 text-center border-2 transition-all',
                  active
                    ? 'bg-white border-white'
                    : 'bg-white/10 border-transparent',
                )}
              >
                <p className={clsx('text-xs font-bold', active ? 'text-gray-900' : 'text-white/70')}>
                  {tier.label}
                </p>
                <p className={clsx('text-[10px] mt-0.5', active ? 'text-gray-500' : 'text-white/50')}>
                  {tier.min}–{tier.max}%
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Score Breakdown ────────────────────────────────────────────────── */}
      {breakdown && (
        <Card>
          <CardTitle className="mb-5">Readiness Score Breakdown</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {([
              {
                key: 'skillCount',
                icon: BarChart3,
                label: 'Skill Count',
                desc: 'Number of skills in your profile',
                iconColor: 'text-indigo-600',
                iconBg: 'bg-indigo-50',
                barColor: 'bg-indigo-500',
              },
              {
                key: 'skillProficiency',
                icon: Brain,
                label: 'Skill Proficiency',
                desc: 'Average proficiency across your skills',
                iconColor: 'text-purple-600',
                iconBg: 'bg-purple-50',
                barColor: 'bg-purple-500',
              },
              {
                key: 'internshipCompatibility',
                icon: Briefcase,
                label: 'Internship Compatibility',
                desc: 'Avg match score vs active listings',
                iconColor: 'text-emerald-600',
                iconBg: 'bg-emerald-50',
                barColor: 'bg-emerald-500',
              },
              {
                key: 'applicationHistory',
                icon: FileText,
                label: 'Application History',
                desc: 'Applications submitted & outcomes',
                iconColor: 'text-amber-600',
                iconBg: 'bg-amber-50',
                barColor: 'bg-amber-500',
              },
            ] as const).map(({ key, icon: Icon, label, desc, iconColor, iconBg, barColor }) => {
              const comp = breakdown.components[key];
              const tier = getTier(comp.score);
              return (
                <div key={key} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
                      <Icon size={17} className={iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">{label}</p>
                        <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', tier.bg, tier.text)}>
                          {comp.score}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <ProgressBar value={comp.score} size="md" colorClass={barColor} className="mb-2" />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{comp.label}</span>
                    <span className="text-gray-400 font-medium">{comp.weight}% weight</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ─── Missing / Weak / Recommended Skill sections ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Missing Skills */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle size={14} className="text-red-600" />
            </div>
            <CardTitle>Missing Skills</CardTitle>
            <span className="ml-auto text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {analysis.missingSkills.length}
            </span>
          </div>
          {analysis.missingSkills.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-sm text-gray-500">No missing required skills!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.missingSkills.map((gap) => (
                <div key={gap.skillId} className="p-3 bg-red-50 border border-red-100 rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{gap.skillName}</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        Not in profile · Required: {PROFICIENCY_LABELS[gap.requiredLevel]}
                      </p>
                    </div>
                    <Badge className="bg-red-100 text-red-700 shrink-0" size="sm">
                      {gap.frequency} role{gap.frequency > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <Badge className={clsx('mt-2', SKILL_CATEGORY_COLORS[gap.skillCategory])} size="sm">
                    {SKILL_CATEGORY_LABELS[gap.skillCategory]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Weak Skills */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={14} className="text-amber-600" />
            </div>
            <CardTitle>Weak Skills</CardTitle>
            <span className="ml-auto text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {analysis.weakSkills.length}
            </span>
          </div>
          {analysis.weakSkills.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-sm text-gray-500">All your skills meet requirements!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.weakSkills.map((gap) => {
                const currentScore = gap.currentLevel
                  ? { BEGINNER: 1, ELEMENTARY: 2, INTERMEDIATE: 3, ADVANCED: 4, EXPERT: 5 }[gap.currentLevel] : 0;
                const requiredScore = { BEGINNER: 1, ELEMENTARY: 2, INTERMEDIATE: 3, ADVANCED: 4, EXPERT: 5 }[gap.requiredLevel];
                return (
                  <div key={gap.skillId} className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-gray-900">{gap.skillName}</p>
                      <Badge className="bg-amber-100 text-amber-700 shrink-0" size="sm">
                        {gap.frequency} role{gap.frequency > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>Yours: <span className="text-amber-700 font-medium">{PROFICIENCY_LABELS[gap.currentLevel!]}</span></span>
                      <span>Need: <span className="text-gray-700 font-medium">{PROFICIENCY_LABELS[gap.requiredLevel]}</span></span>
                    </div>
                    <div className="relative h-2 bg-amber-100 rounded-full overflow-hidden">
                      <div className="absolute h-full bg-amber-200 rounded-full" style={{ width: `${(requiredScore / 5) * 100}%` }} />
                      <div className="absolute h-full bg-amber-500 rounded-full" style={{ width: `${(currentScore / 5) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recommended Skills */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
              <Lightbulb size={14} className="text-blue-600" />
            </div>
            <CardTitle>Recommended</CardTitle>
            <span className="ml-auto text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {analysis.recommendedSkills.length}
            </span>
          </div>
          {analysis.recommendedSkills.length === 0 ? (
            <div className="text-center py-6">
              <Award size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No additional recommendations.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.recommendedSkills.map((rec) => (
                <div key={rec.skillId} className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{rec.skillName}</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        Target: {PROFICIENCY_LABELS[rec.suggestedLevel]}
                      </p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 shrink-0" size="sm">
                      {rec.frequency} role{rec.frequency > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge className={clsx(SKILL_CATEGORY_COLORS[rec.skillCategory])} size="sm">
                      {SKILL_CATEGORY_LABELS[rec.skillCategory]}
                    </Badge>
                    <Link to="/skills" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      Add skill →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        {radarData.length > 0 && (
          <Card>
            <CardTitle className="mb-4">Skills Radar</CardTitle>
            <p className="text-xs text-gray-400 mb-3">Your skill levels vs required levels for top gaps</p>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#f0f0f0" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Radar name="Required" dataKey="Required" stroke="#e5e7eb" fill="#f3f4f6" fillOpacity={0.6} />
                <Radar name="Your Level" dataKey="Current" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
                <Tooltip formatter={(v, n) => [v, n]} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Strong Skills */}
        <Card>
          <CardTitle className="mb-4">Your Strong Skills</CardTitle>
          {analysis.strongSkills.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Award size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Add Intermediate+ skills to see your strengths.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.strongSkills.map((ss) => (
                <div key={ss.skillId} className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">{ss.skillName}</span>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-50 text-emerald-700" size="sm">{PROFICIENCY_LABELS[ss.level]}</Badge>
                        {ss.applicableInternships > 0 && (
                          <span className="text-xs text-gray-400">{ss.applicableInternships} roles</span>
                        )}
                      </div>
                    </div>
                    <ProgressBar
                      value={{ BEGINNER: 1, ELEMENTARY: 2, INTERMEDIATE: 3, ADVANCED: 4, EXPERT: 5 }[ss.level]}
                      max={5}
                      size="sm"
                      colorClass="bg-emerald-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recommendations */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Improvement Plan</CardTitle>
            <span className="text-xs text-gray-400">{completedRecs.length}/{recommendations.length} complete</span>
          </div>
          {activeRecs.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-gray-600 font-medium">All recommendations complete!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeRecs.map((rec) => {
                const RecIcon = REC_ICON[rec.type] ?? Zap;
                const resourceUrl = getSafeExternalUrl(rec.resourceUrl);
                return (
                  <div key={rec.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', PRIORITY_COLORS[rec.priority])}>
                      <RecIcon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 leading-snug">{rec.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{rec.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className={PRIORITY_COLORS[rec.priority]} size="sm">
                          {PRIORITY_LABELS[rec.priority]} Priority
                        </Badge>
                        {rec.type === 'certification' && (
                          <Badge className="bg-purple-50 text-purple-700" size="sm">Certification</Badge>
                        )}
                        {resourceUrl && (
                          <a
                            href={resourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-0.5"
                          >
                            View Resource <ExternalLink size={10} className="inline" />
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleComplete(rec.id)}
                      disabled={completingId === rec.id}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-emerald-50 text-gray-300 hover:text-emerald-500 transition-colors"
                      title="Mark as complete"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SkillGapAnalysisPage;
