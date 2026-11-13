import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizePersonName,
  normalizeOrganizationName,
  normalizeRegistrationEmail,
  normalizeRegistrationIdentityFields,
} from '../src/utils/registrationIdentity.mjs';

test('trims valid international names and university values', () => {
  assert.deepEqual(
    normalizeRegistrationIdentityFields({
      firstName: '  José Anne-Marie  ',
      lastName: " O'Connor 李 ",
      university: '  École 42 — Paris  ',
    }),
    {
      firstName: 'José Anne-Marie',
      lastName: "O'Connor 李",
      university: 'École 42 — Paris',
    },
  );
});

test('omits an optional university when it is not provided', () => {
  assert.deepEqual(
    normalizeRegistrationIdentityFields({ firstName: 'Amara', lastName: 'Ndlovu' }),
    { firstName: 'Amara', lastName: 'Ndlovu' },
  );
  assert.deepEqual(
    normalizeRegistrationIdentityFields({ firstName: 'Amara', lastName: 'Ndlovu', university: '' }),
    { firstName: 'Amara', lastName: 'Ndlovu' },
  );
});

test('accepts names with two or more Unicode letters and permitted separators', () => {
  for (const name of ['Jo', 'Anne-Marie', "O'Neil", 'De la Cruz', 'Élodie', '李明']) {
    assert.equal(normalizePersonName(name, 'First name'), name);
  }
  assert.equal(normalizePersonName('  Jo  ', 'First name'), 'Jo');
});

test('rejects names with fewer than two letters or disallowed characters', () => {
  for (const firstName of ['A', '123', '!!!', '', '   ', 'A-1', 'Jo.Smith', 'a'.repeat(81)]) {
    assert.throws(
      () => normalizeRegistrationIdentityFields({ firstName, lastName: 'Ndlovu' }),
      /First name/i,
    );
  }
  assert.throws(() => normalizePersonName('A', 'Last name'), /at least two letters/i);
  assert.throws(() => normalizePersonName('!', 'Last name'), /at least two letters/i);
});

test('normalizes supported registration emails and rejects malformed syntax', () => {
  for (const email of [
    'wally@gmail.com',
    'john.smith@outlook.com',
    'person@university.ac.za',
    'student@company.co.za',
  ]) {
    assert.equal(normalizeRegistrationEmail(email), email);
  }
  assert.equal(normalizeRegistrationEmail('Wally@GMAIL.COM'), 'wally@gmail.com');

  for (const email of [
    'nathan@g.com',
    'wallygmail.com',
    'wally@@gmail.com',
    'wally@gmail',
    'wally gmail@gmail.com',
    'wally..makama@gmail.com',
    'wally@.com',
    'wally@gmail..com',
    '@gmail.com',
    'wally@',
    'wally@-gmail.com',
  ]) {
    assert.throws(() => normalizeRegistrationEmail(email), undefined, email);
  }
});

test('employer email validation blocks exact personal-provider domains only', () => {
  for (const domain of [
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
  ]) {
    assert.throws(
      () => normalizeRegistrationEmail(`person@${domain}`, 'EMPLOYER'),
      /organisation email address/i,
      domain,
    );
  }

  for (const email of [
    'person@gmail.com',
    'person@outlook.com',
    'person@company.co.za',
    'person@university.ac.za',
    'person@company.gmail.com',
    'person@outlook.example',
  ]) {
    const role = email.endsWith('@gmail.com') || email.endsWith('@outlook.com') ? 'STUDENT' : 'EMPLOYER';
    assert.equal(normalizeRegistrationEmail(email, role), email);
  }

  assert.throws(
    () => normalizeRegistrationEmail('person@GMAIL.COM', 'EMPLOYER'),
    /organisation email address/i,
  );
  assert.equal(normalizeRegistrationEmail('person@COMPANY.CO.ZA', 'EMPLOYER'), 'person@company.co.za');
});

test('organisation names are required, trimmed, and contain a letter or number', () => {
  assert.equal(normalizeOrganizationName('  Cape Digital Labs  '), 'Cape Digital Labs');
  assert.equal(normalizeOrganizationName('University 42'), 'University 42');
  for (const value of ['', '   ', '---...', 'O'.repeat(161)]) {
    assert.throws(() => normalizeOrganizationName(value), /Organisation name/i);
  }
});

test('rejects blank, punctuation-only, and overlong supplied universities', () => {
  for (const university of ['   ', '---...', 'U'.repeat(161)]) {
    assert.throws(
      () => normalizeRegistrationIdentityFields({ firstName: 'Amara', lastName: 'Ndlovu', university }),
      /University/i,
    );
  }
});
