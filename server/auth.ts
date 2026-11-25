import { countAdminUsers } from '../src/db/users.ts';
import {
  authenticateBearerToken,
  hashPassword,
  optionalAuth,
  requireAuth,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
  type AuthRequest,
  type AuthUser,
} from '../src/middleware/auth.ts';

export {
  authenticateBearerToken,
  hashPassword,
  optionalAuth,
  requireAuth,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
};
export type { AuthUser, AuthRequest as AuthenticatedRequest };

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

export async function hasAdminConfigured(): Promise<{
  hasAdminUser: boolean;
  hasEnvPasscode: boolean;
}> {
  const adminCount = await countAdminUsers();
  const hasEnvPasscode = Boolean(
    process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0
  );
  return {
    hasAdminUser: adminCount > 0,
    hasEnvPasscode,
  };
}
