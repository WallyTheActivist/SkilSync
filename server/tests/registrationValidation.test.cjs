const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  normalizeRegistrationEmail,
  normalizeRegistrationPersonName,
} = require('../dist/utils/registrationValidation');

test('registration names require two letters and accept Unicode letters and allowed separators', () => {
  for (const name of ['Jo', 'Wally', 'Anne-Marie', "O'Neil", 'De la Cruz', 'Élodie', '李明']) {
    assert.equal(normalizeRegistrationPersonName(name, 'First name'), name);
  }
  assert.equal(normalizeRegistrationPersonName('  Jo  ', 'First name'), 'Jo');

  for (const name of ['A', '', '   ', '!!!', '123', 'A-1', 'Jo.Smith']) {
    assert.throws(() => normalizeRegistrationPersonName(name, 'First name'), /First name/i, name);
  }
});

test('registration email syntax supports common and multi-part domains and lowercases addresses', () => {
  for (const email of [
    'wally@gmail.com',
    'john.smith@outlook.com',
    'person@university.ac.za',
    'student@company.co.za',
  ]) {
    assert.equal(normalizeRegistrationEmail(email), email);
  }
  assert.equal(normalizeRegistrationEmail('Wally@GMAIL.COM'), 'wally@gmail.com');
});

test('registration email syntax rejects malformed local and domain parts', () => {
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

  for (const email of ['person@gmail.com', 'person@outlook.com']) {
    assert.equal(normalizeRegistrationEmail(email, 'STUDENT'), email);
  }
  for (const email of [
    'person@company.co.za',
    'person@university.ac.za',
    'person@company.gmail.com',
    'person@outlook.example',
  ]) {
    assert.equal(normalizeRegistrationEmail(email, 'EMPLOYER'), email);
  }
  assert.throws(
    () => normalizeRegistrationEmail('person@GMAIL.COM', 'EMPLOYER'),
    /organisation email address/i,
  );
  assert.equal(normalizeRegistrationEmail('person@COMPANY.CO.ZA', 'EMPLOYER'), 'person@company.co.za');
});
