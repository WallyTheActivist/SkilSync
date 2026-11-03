import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Briefcase, FileText, TrendingUp, ArrowRight,
  Star, Clock, MapPin, Wifi, CheckCircle2, AlertCircle,
  Zap, XCircle, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { studentApi, internshipsApi, applicationsApi, skillsApi } from '../../services/api';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { Internship, Application, Recommendation, StudentSkill, SkillGapAnalysis } from '../../types';
import {
  getReadinessLabel, getReadinessColor, getMatchScoreColor,
  formatCurrency, formatDate, truncate, PROFICIENCY_LABELS,
} from '../../utils/helpers';
import clsx from 'clsx';

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  link: string;
}

export const Dashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const profile = user?.profile as { firstName?: string; readinessScore?: number } | null;

  const [topMatches, setTopMatches] = useState<Internship[]>([]);
  const [recentApplications, setRecentApplications] = useState<Application[]>([]);
  const [applicationCount, setApplicationCount] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [readinessScore, setReadinessScore] = useState(profile?.readinessScore ?? 0);
  const [mySkills, setMySkills] = useState<StudentSkill[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<SkillGapAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [matchRes, appRes, recRes, readinessRes, skillsRes, gapRes] = await Promise.allSettled([
          internshipsApi.getRecommended(),
          applicationsApi.getMyApplicationsDashboard(),
          studentApi.getRecommendations(),
          studentApi.getReadinessScore(),
          skillsApi.getMySkills(),
          studentApi.getSkillGap(),
        ]);

        if (matchRes.status === 'fulfilled') setTopMatches(matchRes.value.data.data.slice(0, 3));
        if (appRes.status === 'fulfilled') {
          setRecentApplications(appRes.value.data.data.applications);
          setApplicationCount(appRes.value.data.data.total);
        }
        if (recRes.status === 'fulfilled') setRecommendations(recRes.value.data.data.filter((r) => !r.isCompleted).slice(0, 3));
        if (readinessRes.status === 'fulfilled') {
          setReadinessScore(readinessRes.value.data.data.readinessScore);
          refreshUser();
        }
        if (skillsRes.status === 'fulfilled') setMySkills(skillsRes.value.data.data);
        if (gapRes.status === 'fulfilled') setGapAnalysis(gapRes.value.data.data);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const stats: StatCard[] = [
    {
      label: 'Readiness Score',
      value: `${readinessScore}%`,
      icon: TrendingUp,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      link: '/skill-gap',
    },
    {
      label: 'Top Match Score',
      value: topMatches[0]?.matchScore != null ? `${topMatches[0].matchScore}%` : '—',
      icon: Star,
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-50',
      link: '/matches',
    },
    {
      label: 'Applications',
      value: applicationCount,
      icon: FileText,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      link: '/applications',
    },
    {
      label: 'Recommendations',
      value: recommendations.length,
      icon: Award,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      link: '/skill-gap',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-full opacity-10">
          <div className="absolute right-8 top-8 w-32 h-32 bg-white rounded-full" />
          <div className="absolute right-24 bottom-4 w-20 h-20 bg-white rounded-full" />
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-1">
            Good day, {profile?.firstName ?? 'Student'}! 👋
          </h2>
          <p className="text-primary-200 text-sm mb-4">
            {readinessScore >= 70
              ? "You're highly prepared for internships. Start applying now!"
              : "Complete your profile and add more skills to improve your match rate."}
          </p>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-primary-200 mb-1">Readiness Score</p>
              <div className="flex items-center gap-2">
                <ProgressBar value={readinessScore} colorClass="bg-white/80" size="md" className="w-32" />
                <span className="font-bold text-lg">{readinessScore}%</span>
              </div>
            </div>
            <Link to="/internships">
              <Button variant="secondary" size="sm" rightIcon={<ArrowRight size={14} />}>
                Browse Internships
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link to={stat.link} key={stat.label}>
            <Card hover className="transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                  <p className={clsx('text-2xl font-bold', stat.color)}>{stat.value}</p>
                </div>
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', stat.bgColor)}>
                  <stat.icon size={18} className={stat.color} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Skill Summary + Skill Gaps Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Skill Summary */}
        <Card padding="none">
          <div className="p-5 border-b border-gray-50 flex items-center justify-between">
            <CardTitle>Skill Summary</CardTitle>
            <Link to="/skills"><Button variant="ghost" size="sm" rightIcon={<ArrowRight size={13} />}>Manage</Button></Link>
          </div>
          <div className="p-5">
            {mySkills.length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                <Award size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No skills added yet.</p>
                <Link to="/skills" className="mt-2 inline-block"><Button size="sm">Add Skills</Button></Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary-600">{mySkills.length}</p>
                    <p className="text-xs text-gray-500">Total Skills</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {(['EXPERT','ADVANCED','INTERMEDIATE','ELEMENTARY','BEGINNER'] as const).map((level) => {
                      const count = mySkills.filter((s) => s.proficiency === level).length;
                      return count > 0 ? (
                        <div key={level} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 w-20 shrink-0">{PROFICIENCY_LABELS[level]}</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(count / mySkills.length) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-500 w-4 text-right">{count}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mySkills.slice(0, 6).map((s) => (
                    <Badge key={s.id} size="sm" className="bg-primary-50 text-primary-700">{s.skill.name}</Badge>
                  ))}
                  {mySkills.length > 6 && <Badge size="sm" className="bg-gray-100 text-gray-500">+{mySkills.length - 6} more</Badge>}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Skill Gaps Preview */}
        <Card padding="none">
          <div className="p-5 border-b border-gray-50 flex items-center justify-between">
            <CardTitle>Skill Gaps</CardTitle>
            <Link to="/skill-gap"><Button variant="ghost" size="sm" rightIcon={<ArrowRight size={13} />}>Full Analysis</Button></Link>
          </div>
          <div className="p-5">
            {!gapAnalysis || (gapAnalysis.missingSkills.length === 0 && gapAnalysis.weakSkills.length === 0) ? (
              <div className="text-center py-4">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-sm text-gray-500">No critical skill gaps!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {gapAnalysis.missingSkills.slice(0, 2).map((gap) => (
                  <div key={gap.skillId} className="flex items-center gap-3 p-2.5 bg-red-50 rounded-lg">
                    <XCircle size={14} className="text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{gap.skillName}</p>
                      <p className="text-xs text-red-600">Missing · Required: {PROFICIENCY_LABELS[gap.requiredLevel]}</p>
                    </div>
                    <Badge className="bg-red-100 text-red-700 shrink-0" size="sm">{gap.frequency} role{gap.frequency > 1 ? 's' : ''}</Badge>
                  </div>
                ))}
                {gapAnalysis.weakSkills.slice(0, 2).map((gap) => (
                  <div key={gap.skillId} className="flex items-center gap-3 p-2.5 bg-amber-50 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{gap.skillName}</p>
                      <p className="text-xs text-amber-600">
                        {PROFICIENCY_LABELS[gap.currentLevel!]} → need {PROFICIENCY_LABELS[gap.requiredLevel]}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 shrink-0" size="sm">{gap.frequency} role{gap.frequency > 1 ? 's' : ''}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Matches */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="p-6 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Top Matches For You</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">Based on your current skills</p>
                </div>
                <Link to="/matches">
                  <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>View All</Button>
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {topMatches.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Briefcase size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No matches yet. Add skills to see recommendations.</p>
                  <Link to="/skills" className="mt-3 inline-block">
                    <Button size="sm">Add Skills</Button>
                  </Link>
                </div>
              ) : (
                topMatches.map((internship) => (
                  <Link
                    key={internship.id}
                    to={`/internships/${internship.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* Company logo placeholder */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shrink-0 text-primary-700 font-bold text-sm">
                      {internship.employer.companyName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{internship.title}</p>
                      <p className="text-xs text-gray-500">{internship.employer.companyName}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin size={11} /> {internship.location ?? 'Remote'}
                        </span>
                        {internship.isRemote && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <Wifi size={11} /> Remote
                          </span>
                        )}
                        {internship.stipend && (
                          <span className="text-xs text-gray-400">
                            {formatCurrency(internship.stipend)}/mo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={clsx('text-lg font-bold', internship.matchScore == null ? 'text-gray-500' : getMatchScoreColor(internship.matchScore))}>
                        {internship.matchScore == null ? '—' : `${internship.matchScore}%`}
                      </p>
                      <p className="text-xs text-gray-400">{internship.matchScore == null ? 'Not enough information' : 'Match'}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Recommendations */}
          <Card padding="none">
            <div className="p-5 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle>Action Items</CardTitle>
                <Link to="/skill-gap">
                  <Button variant="ghost" size="sm">See All</Button>
                </Link>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {recommendations.length === 0 ? (
                <div className="text-center py-4">
                  <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm text-gray-500">All recommendations complete!</p>
                </div>
              ) : (
                recommendations.map((rec) => (
                  <div key={rec.id} className="flex items-start gap-3">
                    <div className={clsx(
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                      rec.priority === 3 ? 'bg-red-100' : rec.priority === 2 ? 'bg-amber-100' : 'bg-blue-100',
                    )}>
                      <AlertCircle size={12} className={rec.priority === 3 ? 'text-red-600' : rec.priority === 2 ? 'text-amber-600' : 'text-blue-600'} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 leading-snug">{truncate(rec.title, 50)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{rec.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Recent Applications */}
          <Card padding="none">
            <div className="p-5 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle>Recent Applications</CardTitle>
                <Link to="/applications">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {recentApplications.length === 0 ? (
                <div className="text-center py-4">
                  <FileText size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No applications yet.</p>
                  <Link to="/internships" className="mt-2 inline-block">
                    <Button size="sm">Browse Internships</Button>
                  </Link>
                </div>
              ) : (
                recentApplications.map((app) => (
                  <div key={app.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-700 font-bold text-xs shrink-0">
                      {app.internship.employer.companyName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{app.internship.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(app.appliedAt)}</p>
                    </div>
                    <Badge
                      className={clsx('text-xs', app.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700' : app.status === 'SHORTLISTED' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-50 text-gray-600')}
                    >
                      {app.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
