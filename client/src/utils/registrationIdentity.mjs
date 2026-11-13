const PERSON_NAME_MAX_LENGTH = 80;
const UNIVERSITY_MAX_LENGTH = 160;
const NAME_PATTERN = /^\p{L}[\p{L}\p{M}]*(?:(?: +|[-'’])\p{L}[\p{L}\p{M}]*)*$/u;
const LETTERS = /\p{L}/gu;
const MEANINGLESS_TEXT = /^[\p{N}\p{P}\p{S}\p{Zs}\s]+$/u;
const UNIVERSITY_CONTENT_PATTERN = /[\p{L}\p{N}]/u;
const LOCAL_PART_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'yandex.com',
  'mail.com',
]);

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
  if ([...trimmed.matchAll(LETTERS)].length < 2 || !NAME_PATTERN.test(trimmed)) {
    throw new Error(`${label} must contain at least two letters and may contain only letters, spaces, apostrophes, or hyphens.`);
  }

  return trimmed;
};

export const normalizePersonName = (value, label) => normalizeNameValue(value, label);

export const normalizeRegistrationEmail = (value, role = 'STUDENT') => {
  if (typeof value !== 'string') {
    throw new Error('Email must be text.');
  }
  if (!value) {
    throw new Error('Email is required.');
  }
  if (/\s/u.test(value)) {
    throw new Error('Email cannot contain whitespace.');
  }

  const atIndex = value.indexOf('@');
  if (atIndex === -1 || atIndex !== value.lastIndexOf('@')) {
    throw new Error('Email must contain exactly one @ symbol.');
  }

  const localPart = value.slice(0, atIndex);
  const emailDomain = value.slice(atIndex + 1);
  if (!localPart) {
    throw new Error('Email must include a local part before @.');
  }
  if (!emailDomain) {
    throw new Error('Email must include a domain after @.');
  }
  if (localPart.length > 64 || !LOCAL_PART_PATTERN.test(localPart)) {
    throw new Error('Email local part is malformed.');
  }

  const labels = emailDomain.split('.');
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL_PATTERN.test(label))) {
    throw new Error('Email domain must use valid dot-separated labels.');
  }
  if (labels[labels.length - 2].length < 2 || labels.slice(-2).some((label) => label.length < 2)) {
    throw new Error('Email domain and extension labels must contain at least two characters.');
  }
  if (value.length > 254) {
    throw new Error('Email must be no more than 254 characters.');
  }

  const normalized = value.toLowerCase();
  const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
  if (role === 'EMPLOYER' && PERSONAL_EMAIL_DOMAINS.has(domain)) {
    throw new Error('Employers must register with an organisation email address, not a personal email provider.');
  }

  return normalized;
};

export const normalizeOrganizationName = (value) => {
  if (typeof value !== 'string') {
    throw new Error('Organisation name must be text.');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Organisation name is required.');
  }
  if (trimmed.length > UNIVERSITY_MAX_LENGTH) {
    throw new Error(`Organisation name must be no more than ${UNIVERSITY_MAX_LENGTH} characters.`);
  }
  if (!UNIVERSITY_CONTENT_PATTERN.test(trimmed) || MEANINGLESS_TEXT.test(trimmed)) {
    throw new Error('Organisation name must include at least one letter or number.');
  }
  return trimmed;
};

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
