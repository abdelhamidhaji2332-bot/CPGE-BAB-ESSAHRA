import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser, getUserById } from '../db/users.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { UserRole } from '../shared/curriculum.ts';

const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_SESSION_SECRET;
}

export interface AuthUser {
  id: number;
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  classCode: string | null;
  trinomeNumber: number | null;
  subjectSpecialty: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  firebaseUser?: DecodedIdToken;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

interface TokenPayload {
  uid: number;
  exp: number;
}

export function signAuthToken(userId: number): string {
  const payload: TokenPayload = {
    uid: userId,
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12h
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed || typeof parsed.uid !== 'number' || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

export async function authenticateBearerToken(
  token: string
): Promise<{ user: AuthUser; firebaseUser?: DecodedIdToken } | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // Firebase ID Tokens are standard 3-segment JWTs
  if (trimmed.split('.').length === 3) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(trimmed);
      const record = await getOrCreateUser(
        decodedToken.uid,
        decodedToken.email || '',
        typeof decodedToken.name === 'string' ? decodedToken.name : undefined
      );
      return {
        user: {
          id: record.id,
          uid: record.uid,
          fullName: record.fullName,
          email: record.email,
          role: record.role,
          classCode: record.classCode,
          trinomeNumber: record.trinomeNumber,
          subjectSpecialty: record.subjectSpecialty,
        },
        firebaseUser: decodedToken,
      };
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      return null;
    }
  }

  // Fallback for internal Dev-Team / campus credential tokens (2-segment HMAC)
  const userId = verifyAuthToken(trimmed);
  if (!userId) return null;
  const record = await getUserById(userId);
  if (!record) return null;
  return {
    user: {
      id: record.id,
      uid: record.uid,
      fullName: record.fullName,
      email: record.email,
      role: record.role,
      classCode: record.classCode,
      trinomeNumber: record.trinomeNumber,
      subjectSpecialty: record.subjectSpecialty,
    },
  };
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const verified = await authenticateBearerToken(token);
        if (verified) {
          req.user = verified.user;
          req.firebaseUser = verified.firebaseUser;
        }
      } catch (error) {
        console.error('Optional auth verification failed:', error);
      }
    }
  }
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const verified = await authenticateBearerToken(token);
    if (!verified) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
      return;
    }
    req.user = verified.user;
    req.firebaseUser = verified.firebaseUser;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
