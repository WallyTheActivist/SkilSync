import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET || (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be configured and contain at least 32 characters in production.');
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || !payload.userId || !payload.email || !payload.role) {
    throw new Error('Invalid token payload.');
  }
  return payload as JwtPayload;
};
