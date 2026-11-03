interface SeedAccountCredentials {
  email: string;
  password: string;
}

export interface SeedCredentials {
  employers: SeedAccountCredentials[];
  students: SeedAccountCredentials[];
  admin: SeedAccountCredentials;
}

const requiredValue = (env: NodeJS.ProcessEnv, key: string): string => {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Seed configuration requires ${key}.`);
  }
  return value;
};

const readAccount = (
  env: NodeJS.ProcessEnv,
  emailKey: string,
  passwordKey: string,
): SeedAccountCredentials => {
  const email = requiredValue(env, emailKey).toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Seed configuration requires a valid email in ${emailKey}.`);
  }

  const password = env[passwordKey];
  if (!password?.trim()) {
    throw new Error(`Seed configuration requires ${passwordKey}.`);
  }
  if (password.length < 12 || password.length > 72 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error(`${passwordKey} must be 12-72 characters and no more than 72 UTF-8 bytes.`);
  }

  return { email, password };
};

export const getSeedCredentials = (env: NodeJS.ProcessEnv): SeedCredentials => {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Seeding is allowed only when NODE_ENV is development.');
  }
  if (env.SKILLSYNC_ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Set SKILLSYNC_ALLOW_DEMO_SEED=true to explicitly enable demo seeding.');
  }
  if (
    !env.DATABASE_URL?.startsWith('file:') ||
    /^file:(?:\/\/|\\\\)/i.test(env.DATABASE_URL)
  ) {
    throw new Error('Demo seeding requires a local SQLite DATABASE_URL.');
  }

  const employers = Array.from({ length: 5 }, (_, index) => {
    const number = index + 1;
    return readAccount(
      env,
      `DEMO_EMPLOYER_${number}_EMAIL`,
      `DEMO_EMPLOYER_${number}_PASSWORD`,
    );
  });
  const students = Array.from({ length: 2 }, (_, index) => {
    const number = index + 1;
    return readAccount(env, `DEMO_STUDENT_${number}_EMAIL`, `DEMO_STUDENT_${number}_PASSWORD`);
  });
  const admin = readAccount(env, 'DEMO_ADMIN_EMAIL', 'DEMO_ADMIN_PASSWORD');
  const accounts = [...employers, ...students, admin];
  const uniqueEmails = new Set(accounts.map(({ email }) => email));
  if (uniqueEmails.size !== accounts.length) {
    throw new Error('Each seeded account must have a unique email address.');
  }
  const uniquePasswords = new Set(accounts.map(({ password }) => password));
  if (uniquePasswords.size !== accounts.length) {
    throw new Error('Each seeded account must have a unique password.');
  }

  return { employers, students, admin };
};
