/**
 * Configurable Grading Rules for AI-Powered Smart Campus Assistant
 *
 * NOTE: Institutions use different grading schemes. These default thresholds
 * are configurable via the GRADING_RULES_JSON environment variable in
 * backend/.env rather than hardcoding official university grading rules.
 */

const DEFAULT_GRADING_RULES = {
  passPercentage: 40,
  requireAllSubjectsPassed: true,
  scale: [
    { minPercentage: 90, grade: 'O', label: 'Outstanding' },
    { minPercentage: 80, grade: 'A+', label: 'Excellent' },
    { minPercentage: 70, grade: 'A', label: 'Very Good' },
    { minPercentage: 60, grade: 'B+', label: 'Good' },
    { minPercentage: 50, grade: 'B', label: 'Above Average' },
    { minPercentage: 40, grade: 'C', label: 'Pass' },
    { minPercentage: 0, grade: 'F', label: 'Fail' },
  ],
};

function getGradingRules() {
  if (process.env.GRADING_RULES_JSON) {
    try {
      const parsed = JSON.parse(process.env.GRADING_RULES_JSON);
      if (
        parsed &&
        typeof parsed.passPercentage === 'number' &&
        Array.isArray(parsed.scale) &&
        parsed.scale.length > 0
      ) {
        return {
          passPercentage: parsed.passPercentage,
          requireAllSubjectsPassed:
            parsed.requireAllSubjectsPassed !== undefined
              ? Boolean(parsed.requireAllSubjectsPassed)
              : true,
          scale: [...parsed.scale].sort(
            (a, b) => b.minPercentage - a.minPercentage
          ),
        };
      }
    } catch {
      console.warn(
        'Invalid GRADING_RULES_JSON in environment; falling back to default configurable grading rules.'
      );
    }
  }
  return DEFAULT_GRADING_RULES;
}

/**
 * Computes percentage, grade, and pass/fail status from approved subject marks.
 * @param {Array<{ obtained_marks: number, max_marks: number, passing_marks: number }>} subjectMarks
 */
function calculateExamResult(subjectMarks) {
  const rules = getGradingRules();

  let totalObtained = 0;
  let totalMax = 0;
  let passedAllSubjects = true;

  for (const item of subjectMarks) {
    const obtained = Number(item.obtained_marks || 0);
    const max = Number(item.max_marks || 0);
    const passing = Number(item.passing_marks || 0);
    totalObtained += obtained;
    totalMax += max;
    if (obtained < passing) {
      passedAllSubjects = false;
    }
  }

  const percentage =
    totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;

  const meetsOverall = percentage >= rules.passPercentage;
  const passed = rules.requireAllSubjectsPassed
    ? meetsOverall && passedAllSubjects
    : meetsOverall;

  let grade = 'F';
  if (passed) {
    const matched = rules.scale.find((band) => percentage >= band.minPercentage);
    grade = matched ? matched.grade : 'C';
  }

  return {
    totalObtained: Number(totalObtained.toFixed(2)),
    totalMax: Number(totalMax.toFixed(2)),
    percentage,
    grade,
    passStatus: passed ? 'pass' : 'fail',
  };
}

module.exports = {
  DEFAULT_GRADING_RULES,
  getGradingRules,
  calculateExamResult,
};
