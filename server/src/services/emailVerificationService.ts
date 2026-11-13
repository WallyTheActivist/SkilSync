import nodemailer, { Transporter } from 'nodemailer';

export class EmailDeliveryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryConfigurationError';
  }
}

interface EmailVerificationConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  requireTLS: boolean;
  rejectUnauthorized: true;
  from: string;
  frontendUrl: string;
  expiresInHours: number;
}

export const getEmailVerificationConfig = (
  env: NodeJS.ProcessEnv = process.env,
): EmailVerificationConfig => {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'FRONTEND_URL'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new EmailDeliveryConfigurationError(
      `Email verification is not configured. Set ${missing.join(', ')} in the server environment.`,
    );
  }

  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailDeliveryConfigurationError('SMTP_PORT must be a valid TCP port.');
  }
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) {
    throw new EmailDeliveryConfigurationError('Set both SMTP_USER and SMTP_PASS, or leave both empty.');
  }
  if (env.SMTP_SECURE !== undefined && !['true', 'false'].includes(env.SMTP_SECURE)) {
    throw new EmailDeliveryConfigurationError('SMTP_SECURE must be either true or false.');
  }

  let frontendUrl: URL;
  try {
    frontendUrl = new URL(env.FRONTEND_URL as string);
  } catch {
    throw new EmailDeliveryConfigurationError('FRONTEND_URL must be an absolute HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(frontendUrl.protocol) || frontendUrl.username || frontendUrl.password) {
    throw new EmailDeliveryConfigurationError('FRONTEND_URL must be an absolute HTTP or HTTPS URL.');
  }
  if (env.NODE_ENV === 'production' && frontendUrl.protocol !== 'https:') {
    throw new EmailDeliveryConfigurationError('FRONTEND_URL must use HTTPS in production.');
  }

  const secure = env.SMTP_SECURE === 'true';

  const expiresInHours = Number(env.EMAIL_VERIFICATION_TTL_HOURS ?? '24');
  if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 168) {
    throw new EmailDeliveryConfigurationError('EMAIL_VERIFICATION_TTL_HOURS must be an integer from 1 to 168.');
  }

  return {
    host: env.SMTP_HOST as string,
    port,
    secure,
    requireTLS: env.NODE_ENV === 'production' && !secure,
    rejectUnauthorized: true,
    ...(env.SMTP_USER ? { user: env.SMTP_USER } : {}),
    ...(env.SMTP_PASS ? { password: env.SMTP_PASS } : {}),
    from: env.SMTP_FROM as string,
    frontendUrl: frontendUrl.toString(),
    expiresInHours,
  };
};

const createTransport = (config: EmailVerificationConfig): Transporter => nodemailer.createTransport({
  host: config.host,
  port: config.port,
  secure: config.secure,
  requireTLS: config.requireTLS,
  tls: { rejectUnauthorized: config.rejectUnauthorized },
  ...(config.user && config.password
    ? { auth: { user: config.user, pass: config.password } }
    : {}),
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

export const getEmailVerificationExpiry = (now = new Date()): Date => {
  const { expiresInHours } = getEmailVerificationConfig();
  return new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);
};

export const sendVerificationEmail = async (email: string, rawToken: string): Promise<void> => {
  const config = getEmailVerificationConfig();
  const verificationUrl = new URL('/verify-email', config.frontendUrl);
  verificationUrl.searchParams.set('token', rawToken);

  const transporter = createTransport(config);
  try {
    await transporter.sendMail({
      from: config.from,
      to: email,
      subject: 'Verify your SkillSync organisation email',
      text: [
        'Thank you for registering as an organisation on SkillSync.',
        `Verify your email address within ${config.expiresInHours} hours:`,
        verificationUrl.toString(),
        'If you did not create this account, you can ignore this message.',
      ].join('\n\n'),
      html: `<p>Thank you for registering as an organisation on SkillSync.</p><p><a href="${verificationUrl.toString()}">Verify your email address</a> within ${config.expiresInHours} hours.</p><p>If you did not create this account, you can ignore this message.</p>`,
    });
  } finally {
    transporter.close();
  }
};
