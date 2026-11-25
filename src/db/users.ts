import crypto from 'crypto';
import { desc, eq, sql } from 'drizzle-orm';
import type { UserRole } from '../shared/curriculum.ts';
import { db } from './index.ts';
import { users } from './schema.ts';

export interface CampusUserRecord {
  id: number;
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  classCode: string | null;
  trinomeNumber: number | null;
  subjectSpecialty: string | null;
  createdAt: Date;
}

function toCampusUserRecord(row: typeof users.$inferSelect): CampusUserRecord {
  return {
    id: row.id,
    uid: row.uid,
    fullName: row.fullName,
    email: row.email,
    role: row.role as UserRole,
    classCode: row.classCode,
    trinomeNumber: row.trinomeNumber,
    subjectSpecialty: row.subjectSpecialty,
    createdAt: row.createdAt,
  };
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  fullName?: string
): Promise<CampusUserRecord> {
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = fullName?.trim() || normalizedEmail.split('@')[0] || 'Étudiant CPGE';

  try {
    if (normalizedEmail) {
      const existingByEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existingByEmail.length > 0 && existingByEmail[0].uid.startsWith('pending:')) {
        const updated = await db
          .update(users)
          .set({ uid })
          .where(eq(users.id, existingByEmail[0].id))
          .returning();
        return toCampusUserRecord(updated[0]);
      }
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        fullName: displayName,
        role: 'etudiant',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
        },
      })
      .returning();

    return toCampusUserRecord(result[0]);
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserById(id: number): Promise<CampusUserRecord | null> {
  try {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ? toCampusUserRecord(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in getUserById:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserAuthRowByEmail(
  email: string
): Promise<(typeof users.$inferSelect) | null> {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getUserAuthRowByEmail:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function countAdminUsers(): Promise<number> {
  try {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'admin'));
    return rows[0]?.count ?? 0;
  } catch (error) {
    console.error('Database query failed in countAdminUsers:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getFirstAdminUser(): Promise<CampusUserRecord | null> {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'))
      .orderBy(users.id)
      .limit(1);
    return rows[0] ? toCampusUserRecord(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in getFirstAdminUser:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listAllUsers() {
  try {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    return rows.map((r) => ({
      id: r.id,
      full_name: r.fullName,
      email: r.email,
      role: r.role as UserRole,
      class_code: r.classCode,
      trinome_number: r.trinomeNumber,
      subject_specialty: r.subjectSpecialty,
      created_at: r.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('Database query failed in listAllUsers:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createCampusUser(input: {
  uid?: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  classCode?: string | null;
  trinomeNumber?: number | null;
  subjectSpecialty?: string | null;
}): Promise<CampusUserRecord> {
  try {
    const uid = input.uid ?? `pending:${crypto.randomUUID()}`;
    const inserted = await db
      .insert(users)
      .values({
        uid,
        fullName: input.fullName,
        email: input.email.trim().toLowerCase(),
        passwordHash: input.passwordHash,
        role: input.role,
        classCode: input.classCode ?? null,
        trinomeNumber: input.trinomeNumber ?? null,
        subjectSpecialty: input.subjectSpecialty ?? null,
      })
      .returning();
    return toCampusUserRecord(inserted[0]);
  } catch (error) {
    console.error('Database query failed in createCampusUser:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateUserRole(
  targetId: number,
  role: UserRole,
  classCode: string | null
): Promise<CampusUserRecord | null> {
  try {
    const updated = await db
      .update(users)
      .set({ role, classCode })
      .where(eq(users.id, targetId))
      .returning();
    return updated[0] ? toCampusUserRecord(updated[0]) : null;
  } catch (error) {
    console.error('Database query failed in updateUserRole:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteUserById(targetId: number): Promise<void> {
  try {
    await db.delete(users).where(eq(users.id, targetId));
  } catch (error) {
    console.error('Database query failed in deleteUserById:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
