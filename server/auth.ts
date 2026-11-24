import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from './db.ts';
import type { UserRole } from '../src/shared/curriculum.ts';

const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_SESSION_SECRET;
}

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  classCode: string | null;
  trinomeNumber: number | null;
  subjectSpecialty: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
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

export function loadUserById(userId: number): AuthUser | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, full_name, email, role, class_code, trinome_number, subject_specialty
       FROM users WHERE id = ?`
    )
    .get(userId) as
    | {
        id: number;
        full_name: string;
        email: string;
        role: UserRole;
        class_code: string | null;
        trinome_number: number | null;
        subject_specialty: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    classCode: row.class_code,
    trinomeNumber: row.trinome_number,
    subjectSpecialty: row.subject_specialty,
  };
}

export function extractBearerUser(req: Request): AuthUser | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const uid = verifyAuthToken(token);
  if (!uid) return null;
  return loadUserById(uid);
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const user = extractBearerUser(req);
  if (user) {
    req.user = user;
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const user = extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentification requise pour accéder à cette ressource.' });
    return;
  }
  req.user = user;
  next();
}

export function canAccessClassWorkspace(user: AuthUser, classCode: string): boolean {
  if (user.role === 'admin' || user.role === 'professeur') return true;
  if (user.role === 'maitre_internat' || user.role === 'bde' || user.role === 'groupe_media') {
    return user.classCode === classCode;
  }
  return user.classCode === classCode;
}

export function isClassModerator(user: AuthUser, classCode: string): boolean {
  if (user.role === 'admin' || user.role === 'professeur') return true;
  if (user.role === 'delegue' && user.classCode === classCode) return true;
  return false;
}

export function canManageInternat(user: AuthUser): boolean {
  return user.role === 'admin' || user.role === 'maitre_internat';
}

export function canManageCampusLife(user: AuthUser): boolean {
  return user.role === 'admin' || user.role === 'bde' || user.role === 'groupe_media';
}

export function canManageProfTools(user: AuthUser): boolean {
  return user.role === 'admin' || user.role === 'professeur';
}

export function canManageAdministration(user: AuthUser): boolean {
  return user.role === 'admin';
}

export function hasAdminConfigured(): { hasAdminUser: boolean; hasEnvPasscode: boolean } {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`).get() as { count: number };
  const hasEnvPasscode = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
  return {
    hasAdminUser: row.count > 0,
    hasEnvPasscode,
  };
}
