const PERSON_NAME_MAX_LENGTH = 80;
const UNIVERSITY_MAX_LENGTH = 160;
const HAS_LETTER = /\p{L}/u;
const MEANINGLESS_TEXT = /^[\p{N}\p{P}\p{S}\p{Zs}\s]+$/u;
const UNIVERSITY_CONTENT_PATTERN = /[\p{L}\p{N}]/u;

const normalizeNameValue = (value, label) => {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be text.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Please enter your ${label.toLowerCase()}.`);
  }
  if (trimmed.length > PERSON_NAME_MAX_LENGTH) {
    throw new Error(`${label} must be no more than ${PERSON_NAME_MAX_LENGTH} characters.`);
  }
  if (!HAS_LETTER.test(trimmed) || MEANINGLESS_TEXT.test(trimmed)) {
    throw new Error(`${label} must include letters and may contain spaces, apostrophes, hyphens, or periods.`);
  }

  return trimmed;
};

export const normalizePersonName = (value, label) => normalizeNameValue(value, label);

export const normalizeRegistrationIdentityFields = ({ firstName, lastName, university, requireUniversity = false }) => {
  const normalized = {
    firstName: normalizePersonName(firstName, 'First name'),
    lastName: normalizePersonName(lastName, 'Last name'),
  };

  if (requireUniversity) {
    if (typeof university !== 'string') {
      throw new Error('University is required.');
    }
    const trimmedUniversity = university.trim();
    if (!trimmedUniversity) {
      throw new Error('University is required.');
    }
    if (trimmedUniversity.length > UNIVERSITY_MAX_LENGTH) {
      throw new Error(`University must be no more than ${UNIVERSITY_MAX_LENGTH} characters.`);
    }
    if (!UNIVERSITY_CONTENT_PATTERN.test(trimmedUniversity) || MEANINGLESS_TEXT.test(trimmedUniversity)) {
      throw new Error('University must include at least one letter or number.');
    }
    return { ...normalized, university: trimmedUniversity };
  }

  if (university === undefined || university === '') {
    return normalized;
  }
  if (typeof university !== 'string') {
    throw new Error('University must be text.');
  }

  const trimmedUniversity = university.trim();
  if (!trimmedUniversity) {
    throw new Error('University cannot be blank. Leave it empty if you prefer not to provide one.');
  }
  if (trimmedUniversity.length > UNIVERSITY_MAX_LENGTH) {
    throw new Error(`University must be no more than ${UNIVERSITY_MAX_LENGTH} characters.`);
  }
  if (!UNIVERSITY_CONTENT_PATTERN.test(trimmedUniversity) || MEANINGLESS_TEXT.test(trimmedUniversity)) {
    throw new Error('University must include at least one letter or number.');
  }

  return { ...normalized, university: trimmedUniversity };
};
