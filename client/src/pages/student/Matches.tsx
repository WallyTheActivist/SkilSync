import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin, Wifi, Clock, DollarSign, ArrowRight, RefreshCw } from 'lucide-react';
import { internshipsApi } from '../../services/api';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Badge } from '../../components/ui/Badge';
import type { Internship } from '../../types';
import {
  formatCurrency, getMatchScoreColor, getMatchScoreBg, truncate,
} from '../../utils/helpers';
import clsx from 'clsx';

export const Matches: React.FC = () => {
  const [matches, setMatches] = useState<Internship[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data } = await internshipsApi.getRecommended();
      setMatches(data.data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const hasMatchScore = (internship: Internship): internship is Internship & { matchScore: number } =>
    typeof internship.matchScore === 'number';
  const scoredMatches = matches.filter(hasMatchScore);
  const notScored = matches.filter((m) => m.matchScore === null || m.matchScore === undefined);
  const excellent = scoredMatches.filter((m) => m.matchScore >= 70);
  const good = scoredMatches.filter((m) => m.matchScore >= 40 && m.matchScore < 70);
  const developing = scoredMatches.filter((m) => m.matchScore < 40);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const MatchCard: React.FC<{ internship: Internship; rank: number }> = ({ internship, rank }) => {
    const score = internship.matchScore ?? null;
    const scoreValue = score ?? 0;
    return (
      <Link to={`/internships/${internship.id}`}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
          {/* Top bar */}
          <div className={clsx('h-1.5', score === null ? 'bg-gray-200' : getMatchScoreBg(score))} style={{ width: `${scoreValue}%` }} />
          <div className="p-5">
            <div className="flex items-start gap-3">
              {/* Rank badge */}
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                rank === 1 ? 'bg-amber-100 text-amber-700' :
                rank === 2 ? 'bg-gray-200 text-gray-600' :
                rank === 3 ? 'bg-orange-100 text-orange-600' :
                'bg-gray-100 text-gray-500',
              )}>
                #{rank}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug">{internship.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{internship.employer.companyName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={clsx('text-2xl font-bold', score === null ? 'text-gray-500' : getMatchScoreColor(score))}>
                      {score === null ? '—' : `${score}%`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {score === null ? 'Not enough information' : internship.matchLabel}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  {truncate(internship.description, 90)}
                </p>

                {score !== null && <ProgressBar value={score} size="sm" className="mt-3" />}

                <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-400">
                  {internship.location && (
                    <span className="flex items-center gap-1"><MapPin size={11} />{internship.location.split(',')[0]}</span>
                  )}
                  {internship.isRemote && <Badge variant="success" size="sm">Remote</Badge>}
                  {internship.stipend && (
                    <span className="text-emerald-600 font-medium">{formatCurrency(internship.stipend)}/mo</span>
                  )}
                  {internship.durationMonths && (
                    <span className="flex items-center gap-1"><Clock size={11} />{internship.durationMonths}mo</span>
                  )}
                </div>

                {/* Top required skills */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {internship.requiredSkills.slice(0, 3).map((rs) => (
                    <Badge key={rs.id} size="sm" className="bg-gray-100 text-gray-600">{rs.skill.name}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button size="sm" rightIcon={<ArrowRight size={13} />}>View & Apply</Button>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Recommended Matches</h2>
          <p className="text-sm text-gray-500 mt-0.5">Internships ranked by how well your skills match</p>
        </div>
        <Button variant="outline" size="sm" leftIcon={<RefreshCw size={14} />} onClick={load} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {/* Tier stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Strong Matches', count: excellent.length, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: '70%+ match' },
          { label: 'Good Matches', count: good.length, color: 'text-indigo-600', bg: 'bg-indigo-50', desc: '40-70% match' },
          { label: 'Developing', count: developing.length, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Under 40%' },
        ].map((t) => (
          <div key={t.label} className={clsx('rounded-xl p-4 text-center', t.bg)}>
            <p className={clsx('text-3xl font-bold', t.color)}>{t.count}</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">{t.label}</p>
            <p className="text-xs text-gray-400">{t.desc}</p>
          </div>
        ))}
      </div>

      {matches.length === 0 ? (
        <Card className="text-center py-16">
          <Star size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">No matches yet</p>
          <p className="text-sm text-gray-400 mt-1">Add skills to your profile to see personalised recommendations.</p>
          <Link to="/skills" className="mt-4 inline-block">
            <Button>Add Skills</Button>
          </Link>
        </Card>
      ) : (
        <>
          {excellent.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> Strong Matches
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {excellent.map((m, i) => <MatchCard key={m.id} internship={m} rank={i + 1} />)}
              </div>
            </div>
          )}

          {good.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-500" /> Good Matches
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {good.map((m, i) => <MatchCard key={m.id} internship={m} rank={excellent.length + i + 1} />)}
              </div>
            </div>
          )}

          {developing.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" /> Still Developing
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {developing.map((m, i) => <MatchCard key={m.id} internship={m} rank={excellent.length + good.length + i + 1} />)}
              </div>
            </div>
          )}

          {notScored.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-300" /> Not Enough Information
              </h3>
              <p className="text-sm text-gray-500 mb-4">These internships have no required skills, so a skill match score cannot be calculated.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {notScored.map((m, i) => (
                  <MatchCard key={m.id} internship={m} rank={scoredMatches.length + i + 1} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Matches;
