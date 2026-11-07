import type { Internship, MatchScoreResult } from '../types';

interface InternshipDetailApi {
  getById: (id: string) => Promise<{ data: { data: Internship } }>;
  getMatchScore: (id: string) => Promise<{ data: { data: MatchScoreResult } }>;
}

export function loadInternshipDetail(
  id: string,
  internshipsApi: InternshipDetailApi,
): Promise<{
  internship: Internship;
  matchScore: MatchScoreResult | null;
  matchScoreFailed: boolean;
}>;
