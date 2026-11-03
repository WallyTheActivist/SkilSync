import { normalizePersonName } from './registrationIdentity.mjs';

const numericFields = {
  yearOfStudy: 'Year of study',
  gpa: 'GPA',
};

export const normalizeStudentProfileUpdate = (form) => {
  const payload = { ...form };

  for (const [field, label] of [['firstName', 'First name'], ['lastName', 'Last name']]) {
    if (payload[field] !== undefined && payload[field] !== null) {
      payload[field] = normalizePersonName(payload[field], label);
    }
  }

  for (const [field, label] of Object.entries(numericFields)) {
    const value = payload[field];
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        payload[field] = null;
        continue;
      }
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
        throw new Error(`${label} must be a valid number.`);
      }
      const numericValue = Number(trimmed);
      const mantissa = trimmed.split(/[eE]/, 1)[0].replace(/[+\-.]/g, '');
      if (!Number.isFinite(numericValue) || (numericValue === 0 && /[1-9]/.test(mantissa))) {
        throw new Error(`${label} must be a valid number.`);
      }
      payload[field] = numericValue;
    }

    if (typeof payload[field] !== 'number' || !Number.isFinite(payload[field])) {
      throw new Error(`${label} must be a valid number.`);
    }
  }

  return payload;
};
