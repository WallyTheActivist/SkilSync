export const loadInternshipDetail = async (id, internshipsApi) => {
  const [internshipResult, matchScoreResult] = await Promise.allSettled([
    internshipsApi.getById(id),
    internshipsApi.getMatchScore(id),
  ]);

  if (internshipResult.status === 'rejected') {
    throw internshipResult.reason;
  }

  return {
    internship: internshipResult.value.data.data,
    matchScore: matchScoreResult.status === 'fulfilled' ? matchScoreResult.value.data.data : null,
    matchScoreFailed: matchScoreResult.status === 'rejected',
  };
};
