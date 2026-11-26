import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { RESOURCE_CATEGORIES } from '../shared/curriculum.ts';
import { db } from './index.ts';
import {
  adminAnnouncements,
  campusEvents,
  classActivityLog,
  classAnnouncements,
  classColloscopes,
  classMessages,
  classTimetables,
  documentProgress,
  documents,
  eventRegistrations,
  internatNotices,
  userClassSeen,
} from './schema.ts';

function serializeDocument(
  doc: typeof documents.$inferSelect,
  progressStatus: string | null = null
) {
  return {
    id: doc.id,
    class_code: doc.classCode,
    subject_slug: doc.subjectSlug,
    category: doc.category,
    title: doc.title,
    chapter: doc.chapter,
    description: doc.description,
    file_path: doc.filePath,
    file_size: doc.fileSize,
    uploaded_by: doc.uploadedBy,
    created_at: doc.createdAt.toISOString(),
    progress_status: progressStatus,
  };
}

function serializeTimetable(slot: typeof classTimetables.$inferSelect) {
  return {
    id: slot.id,
    class_code: slot.classCode,
    semester: slot.semester,
    day_of_week: slot.dayOfWeek,
    start_time: slot.startTime,
    end_time: slot.endTime,
    session_type: slot.sessionType,
    subject_slug: slot.subjectSlug,
    subject_name: slot.subjectName,
    room: slot.room,
    professor_name: slot.professorName,
  };
}

function serializeColloscope(entry: typeof classColloscopes.$inferSelect) {
  return {
    id: entry.id,
    class_code: entry.classCode,
    week_number: entry.weekNumber,
    week_label: entry.weekLabel,
    trinome_number: entry.trinomeNumber,
    subject_slug: entry.subjectSlug,
    subject_name: entry.subjectName,
    kholleur_name: entry.kholleurName,
    day_time: entry.dayTime,
    room: entry.room,
  };
}

function serializeAnnouncement(row: typeof classAnnouncements.$inferSelect) {
  return {
    id: row.id,
    class_code: row.classCode,
    author_id: row.authorId,
    author_name: row.authorName,
    author_role: row.authorRole,
    title: row.title,
    content: row.content,
    is_pinned: row.isPinned,
    source_message_id: row.sourceMessageId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function serializeMessage(row: typeof classMessages.$inferSelect) {
  return {
    id: row.id,
    class_code: row.classCode,
    author_id: row.authorId,
    author_name: row.authorName,
    author_role: row.authorRole,
    content: row.content,
    is_announcement: row.isAnnouncement,
    announcement_id: row.announcementId,
    created_at: row.createdAt.toISOString(),
  };
}

function serializeActivity(row: typeof classActivityLog.$inferSelect) {
  return {
    id: row.id,
    class_code: row.classCode,
    kind: row.kind,
    title: row.title,
    tab_target: row.tabTarget,
    actor_id: row.actorId,
    created_at: row.createdAt.toISOString(),
  };
}

function serializeInternat(row: typeof internatNotices.$inferSelect) {
  return {
    id: row.id,
    pavillon: row.pavillon,
    category: row.category,
    title: row.title,
    content: row.content,
    is_pinned: row.isPinned,
    author_id: row.authorId,
    author_name: row.authorName,
    created_at: row.createdAt.toISOString(),
  };
}

function serializeAdminAnnouncement(row: typeof adminAnnouncements.$inferSelect) {
  return {
    id: row.id,
    category: row.category,
    target_audience: row.targetAudience,
    title: row.title,
    content: row.content,
    is_pinned: row.isPinned,
    author_id: row.authorId,
    author_name: row.authorName,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

const DAY_ORDER: Record<string, number> = {
  Lundi: 1,
  Mardi: 2,
  Mercredi: 3,
  Jeudi: 4,
  Vendredi: 5,
  Samedi: 6,
};

function sortTimetables<T extends { semester: string; dayOfWeek: string; startTime: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    if (a.semester !== b.semester) return a.semester.localeCompare(b.semester);
    const dayDiff = (DAY_ORDER[a.dayOfWeek] ?? 99) - (DAY_ORDER[b.dayOfWeek] ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });
}

export async function getDocumentCountsByClass(): Promise<Map<string, number>> {
  try {
    const rows = await db
      .select({
        classCode: documents.classCode,
        count: sql<number>`count(*)::int`,
      })
      .from(documents)
      .where(isNotNull(documents.classCode))
      .groupBy(documents.classCode);

    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.classCode) map.set(row.classCode, row.count);
    }
    return map;
  } catch (error) {
    console.error('Database query failed in getDocumentCountsByClass:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listDocumentsWithProgress(params: {
  userId?: number;
  classCode?: string;
  isCampusOnly?: boolean;
  category?: string;
  scope?: string;
  subjectSlug?: string;
  q?: string;
}) {
  try {
    const filters: SQL[] = [];
    if (params.classCode) {
      filters.push(eq(documents.classCode, params.classCode));
    } else if (params.isCampusOnly) {
      filters.push(isNull(documents.classCode));
    }

    if (params.category) {
      filters.push(eq(documents.category, params.category));
    } else if (params.scope === 'ressources') {
      filters.push(inArray(documents.category, [...RESOURCE_CATEGORIES]));
    }

    if (params.subjectSlug) {
      filters.push(eq(documents.subjectSlug, params.subjectSlug));
    }

    if (params.q) {
      const pattern = `%${params.q}%`;
      filters.push(
        or(
          ilike(documents.title, pattern),
          ilike(documents.chapter, pattern),
          ilike(documents.description, pattern)
        )!
      );
    }

    const whereExpr = filters.length > 0 ? and(...filters) : undefined;
    const rows = await db
      .select({
        doc: documents,
        progressStatus: documentProgress.status,
      })
      .from(documents)
      .leftJoin(
        documentProgress,
        and(
          eq(documentProgress.documentId, documents.id),
          eq(documentProgress.userId, params.userId ?? -1)
        )
      )
      .where(whereExpr)
      .orderBy(desc(documents.createdAt), desc(documents.id))
      .limit(200);

    return rows.map((r) => serializeDocument(r.doc, r.progressStatus));
  } catch (error) {
    console.error('Database query failed in listDocumentsWithProgress:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function upsertDocumentProgress(
  userId: number,
  documentId: number,
  status: string
): Promise<boolean> {
  try {
    const existing = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    if (existing.length === 0) return false;

    await db
      .insert(documentProgress)
      .values({
        userId,
        documentId,
        status,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [documentProgress.userId, documentProgress.documentId],
        set: {
          status,
          updatedAt: new Date(),
        },
      });
    return true;
  } catch (error) {
    console.error('Database query failed in upsertDocumentProgress:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function insertDocument(input: {
  classCode: string | null;
  subjectSlug: string | null;
  category: string;
  title: string;
  chapter: string;
  description: string;
  filePath: string;
  fileSize: number;
  uploadedBy: number;
}) {
  try {
    const inserted = await db
      .insert(documents)
      .values({
        classCode: input.classCode,
        subjectSlug: input.subjectSlug,
        category: input.category,
        title: input.title,
        chapter: input.chapter,
        description: input.description,
        filePath: input.filePath,
        fileSize: input.fileSize,
        uploadedBy: input.uploadedBy,
      })
      .returning();
    return serializeDocument(inserted[0], null);
  } catch (error) {
    console.error('Database query failed in insertDocument:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteDocumentRecord(id: number): Promise<{ id: number; filePath: string } | null> {
  try {
    const rows = await db
      .select({ id: documents.id, filePath: documents.filePath })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (rows.length === 0) return null;

    await db.delete(documents).where(eq(documents.id, id));
    return rows[0];
  } catch (error) {
    console.error('Database query failed in deleteDocumentRecord:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getClassOverviewData(classCode: string, userId?: number) {
  try {
    const docRows = await db
      .select({
        doc: documents,
        progressStatus: documentProgress.status,
      })
      .from(documents)
      .leftJoin(
        documentProgress,
        and(
          eq(documentProgress.documentId, documents.id),
          eq(documentProgress.userId, userId ?? -1)
        )
      )
      .where(eq(documents.classCode, classCode))
      .orderBy(desc(documents.createdAt), desc(documents.id));

    const ttRows = await db
      .select()
      .from(classTimetables)
      .where(eq(classTimetables.classCode, classCode));

    const colloRows = await db
      .select()
      .from(classColloscopes)
      .where(eq(classColloscopes.classCode, classCode))
      .orderBy(asc(classColloscopes.weekNumber), asc(classColloscopes.trinomeNumber));

    return {
      documents: docRows.map((r) => serializeDocument(r.doc, r.progressStatus)),
      timetables: sortTimetables(ttRows).map(serializeTimetable),
      colloscopes: colloRows.map(serializeColloscope),
    };
  } catch (error) {
    console.error('Database query failed in getClassOverviewData:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getClassWorkspacePrivateData(classCode: string) {
  try {
    const ttRows = await db
      .select()
      .from(classTimetables)
      .where(eq(classTimetables.classCode, classCode));

    const colloRows = await db
      .select()
      .from(classColloscopes)
      .where(eq(classColloscopes.classCode, classCode))
      .orderBy(asc(classColloscopes.weekNumber), asc(classColloscopes.trinomeNumber));

    const announcementRows = await db
      .select()
      .from(classAnnouncements)
      .where(eq(classAnnouncements.classCode, classCode))
      .orderBy(
        desc(classAnnouncements.isPinned),
        desc(classAnnouncements.createdAt),
        desc(classAnnouncements.id)
      );

    const messageRows = await db
      .select()
      .from(classMessages)
      .where(eq(classMessages.classCode, classCode))
      .orderBy(desc(classMessages.id))
      .limit(100);

    return {
      timetables: sortTimetables(ttRows).map(serializeTimetable),
      colloscopes: colloRows.map(serializeColloscope),
      announcements: announcementRows.map(serializeAnnouncement),
      messages: messageRows.reverse().map(serializeMessage),
    };
  } catch (error) {
    console.error('Database query failed in getClassWorkspacePrivateData:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createClassAnnouncement(input: {
  classCode: string;
  authorId: number;
  authorName: string;
  authorRole: string;
  title: string;
  content: string;
  isPinned: boolean;
}) {
  try {
    const inserted = await db
      .insert(classAnnouncements)
      .values({
        classCode: input.classCode,
        authorId: input.authorId,
        authorName: input.authorName,
        authorRole: input.authorRole,
        title: input.title,
        content: input.content,
        isPinned: input.isPinned ? 1 : 0,
      })
      .returning();
    return serializeAnnouncement(inserted[0]);
  } catch (error) {
    console.error('Database query failed in createClassAnnouncement:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateClassAnnouncement(
  id: number,
  classCode: string,
  patch: { title?: string; content?: string; isPinned?: boolean }
) {
  try {
    const existingRows = await db
      .select()
      .from(classAnnouncements)
      .where(and(eq(classAnnouncements.id, id), eq(classAnnouncements.classCode, classCode)))
      .limit(1);
    if (existingRows.length === 0) return null;

    const existing = existingRows[0];
    const updated = await db
      .update(classAnnouncements)
      .set({
        title: patch.title && patch.title.trim() ? patch.title.trim() : existing.title,
        content: patch.content && patch.content.trim() ? patch.content.trim() : existing.content,
        isPinned:
          typeof patch.isPinned === 'boolean' ? (patch.isPinned ? 1 : 0) : existing.isPinned,
        updatedAt: new Date(),
      })
      .where(and(eq(classAnnouncements.id, id), eq(classAnnouncements.classCode, classCode)))
      .returning();
    return serializeAnnouncement(updated[0]);
  } catch (error) {
    console.error('Database query failed in updateClassAnnouncement:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteClassAnnouncement(id: number, classCode: string): Promise<void> {
  try {
    await db
      .delete(classAnnouncements)
      .where(and(eq(classAnnouncements.id, id), eq(classAnnouncements.classCode, classCode)));
  } catch (error) {
    console.error('Database query failed in deleteClassAnnouncement:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createClassMessageWithOptionalAnnouncement(input: {
  classCode: string;
  authorId: number;
  authorName: string;
  authorRole: string;
  content: string;
  isAnnouncement: boolean;
  announcementTitle?: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const msgInserted = await tx
        .insert(classMessages)
        .values({
          classCode: input.classCode,
          authorId: input.authorId,
          authorName: input.authorName,
          authorRole: input.authorRole,
          content: input.content,
          isAnnouncement: input.isAnnouncement ? 1 : 0,
        })
        .returning();

      let msgRow = msgInserted[0];
      let createdAnnouncement: ReturnType<typeof serializeAnnouncement> | null = null;

      if (input.isAnnouncement) {
        const autoTitle =
          input.announcementTitle?.trim() || `Annonce Modérateur — ${input.authorName}`;
        const annInserted = await tx
          .insert(classAnnouncements)
          .values({
            classCode: input.classCode,
            authorId: input.authorId,
            authorName: input.authorName,
            authorRole: input.authorRole,
            title: autoTitle,
            content: input.content,
            isPinned: 1,
            sourceMessageId: msgRow.id,
          })
          .returning();
        const annRow = annInserted[0];
        const msgUpdated = await tx
          .update(classMessages)
          .set({ announcementId: annRow.id })
          .where(eq(classMessages.id, msgRow.id))
          .returning();
        msgRow = msgUpdated[0];
        createdAnnouncement = serializeAnnouncement(annRow);
      }

      return {
        createdMessage: serializeMessage(msgRow),
        createdAnnouncement,
      };
    });
  } catch (error) {
    console.error('Database query failed in createClassMessageWithOptionalAnnouncement:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createTimetableSlot(input: {
  classCode: string;
  semester: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  sessionType: string;
  subjectSlug: string;
  subjectName: string;
  room: string;
  professorName: string;
}) {
  try {
    const inserted = await db
      .insert(classTimetables)
      .values(input)
      .returning();
    return serializeTimetable(inserted[0]);
  } catch (error) {
    console.error('Database query failed in createTimetableSlot:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createColloscopeSlot(input: {
  classCode: string;
  weekNumber: number;
  weekLabel: string;
  trinomeNumber: number;
  subjectSlug: string;
  subjectName: string;
  kholleurName: string;
  dayTime: string;
  room: string;
}) {
  try {
    const inserted = await db
      .insert(classColloscopes)
      .values(input)
      .returning();
    return serializeColloscope(inserted[0]);
  } catch (error) {
    console.error('Database query failed in createColloscopeSlot:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function insertClassActivity(input: {
  classCode: string;
  kind: string;
  title: string;
  tabTarget: string;
  actorId: number | null;
}) {
  try {
    const inserted = await db
      .insert(classActivityLog)
      .values({
        classCode: input.classCode,
        kind: input.kind,
        title: input.title.slice(0, 180),
        tabTarget: input.tabTarget,
        actorId: input.actorId,
      })
      .returning();
    return serializeActivity(inserted[0]);
  } catch (error) {
    console.error('Database query failed in insertClassActivity:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getClassNotifications(userId: number, classCode: string) {
  try {
    const seenRows = await db
      .select({ lastSeenActivityId: userClassSeen.lastSeenActivityId })
      .from(userClassSeen)
      .where(and(eq(userClassSeen.userId, userId), eq(userClassSeen.classCode, classCode)))
      .limit(1);
    const lastSeenId = seenRows[0]?.lastSeenActivityId ?? 0;

    const unreadRows = await db
      .select()
      .from(classActivityLog)
      .where(
        and(
          eq(classActivityLog.classCode, classCode),
          gt(classActivityLog.id, lastSeenId),
          or(isNull(classActivityLog.actorId), ne(classActivityLog.actorId, userId))
        )
      )
      .orderBy(desc(classActivityLog.id))
      .limit(30);

    const byTab: Record<string, number> = {
      bibliotheque: 0,
      colloscope: 0,
      'emploi-du-temps': 0,
      annonces: 0,
      chat: 0,
    };
    for (const row of unreadRows) {
      byTab[row.tabTarget] = (byTab[row.tabTarget] || 0) + 1;
    }

    return {
      classCode,
      unreadCount: unreadRows.length,
      lastSeenId,
      byTab,
      items: unreadRows.slice(0, 8).map(serializeActivity),
    };
  } catch (error) {
    console.error('Database query failed in getClassNotifications:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function markClassNotificationsRead(userId: number, classCode: string): Promise<number> {
  try {
    const maxRows = await db
      .select({ maxId: sql<number>`coalesce(max(${classActivityLog.id}), 0)::int` })
      .from(classActivityLog)
      .where(eq(classActivityLog.classCode, classCode));
    const maxId = maxRows[0]?.maxId ?? 0;

    await db
      .insert(userClassSeen)
      .values({
        userId,
        classCode,
        lastSeenActivityId: maxId,
        seenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userClassSeen.userId, userClassSeen.classCode],
        set: {
          lastSeenActivityId: sql`GREATEST(${userClassSeen.lastSeenActivityId}, ${maxId})`,
          seenAt: new Date(),
        },
      });

    return maxId;
  } catch (error) {
    console.error('Database query failed in markClassNotificationsRead:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listInternatNotices() {
  try {
    const rows = await db
      .select()
      .from(internatNotices)
      .orderBy(desc(internatNotices.isPinned), desc(internatNotices.createdAt), desc(internatNotices.id));
    return rows.map(serializeInternat);
  } catch (error) {
    console.error('Database query failed in listInternatNotices:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createInternatNotice(input: {
  pavillon: string;
  category: string;
  title: string;
  content: string;
  isPinned: boolean;
  authorId: number;
  authorName: string;
}) {
  try {
    const inserted = await db
      .insert(internatNotices)
      .values({
        pavillon: input.pavillon,
        category: input.category,
        title: input.title,
        content: input.content,
        isPinned: input.isPinned ? 1 : 0,
        authorId: input.authorId,
        authorName: input.authorName,
      })
      .returning();
    return serializeInternat(inserted[0]);
  } catch (error) {
    console.error('Database query failed in createInternatNotice:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteInternatNotice(id: number): Promise<void> {
  try {
    await db.delete(internatNotices).where(eq(internatNotices.id, id));
  } catch (error) {
    console.error('Database query failed in deleteInternatNotice:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listCampusEvents(userId?: number) {
  try {
    const rows = await db
      .select()
      .from(campusEvents)
      .orderBy(desc(campusEvents.createdAt), desc(campusEvents.id));

    const regs = await db
      .select({
        eventId: eventRegistrations.eventId,
        userId: eventRegistrations.userId,
      })
      .from(eventRegistrations);

    const counts = new Map<number, number>();
    const registeredByUser = new Set<number>();
    for (const r of regs) {
      counts.set(r.eventId, (counts.get(r.eventId) ?? 0) + 1);
      if (userId && r.userId === userId) {
        registeredByUser.add(r.eventId);
      }
    }

    return rows.map((e) => ({
      id: e.id,
      organizer_group: e.organizerGroup,
      event_type: e.eventType,
      title: e.title,
      summary: e.summary,
      content: e.content,
      event_date: e.eventDate,
      location: e.location,
      capacity: e.capacity,
      instagram_url: e.instagramUrl,
      author_id: e.authorId,
      created_at: e.createdAt.toISOString(),
      registered_count: counts.get(e.id) ?? 0,
      is_registered: registeredByUser.has(e.id) ? 1 : 0,
    }));
  } catch (error) {
    console.error('Database query failed in listCampusEvents:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createCampusEvent(input: {
  organizerGroup: string;
  eventType: string;
  title: string;
  summary: string;
  content: string;
  eventDate: string;
  location: string;
  capacity: number;
  instagramUrl: string;
  authorId: number;
}) {
  try {
    const inserted = await db.insert(campusEvents).values(input).returning();
    const e = inserted[0];
    return {
      id: e.id,
      organizer_group: e.organizerGroup,
      event_type: e.eventType,
      title: e.title,
      summary: e.summary,
      content: e.content,
      event_date: e.eventDate,
      location: e.location,
      capacity: e.capacity,
      instagram_url: e.instagramUrl,
      author_id: e.authorId,
      created_at: e.createdAt.toISOString(),
      registered_count: 0,
      is_registered: 0,
    };
  } catch (error) {
    console.error('Database query failed in createCampusEvent:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteCampusEvent(id: number): Promise<void> {
  try {
    await db.delete(campusEvents).where(eq(campusEvents.id, id));
  } catch (error) {
    console.error('Database query failed in deleteCampusEvent:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function toggleEventRegistration(
  eventId: number,
  userId: number
): Promise<{ status: 'not_found' | 'full' | 'ok'; event?: unknown }> {
  try {
    const evRows = await db
      .select()
      .from(campusEvents)
      .where(eq(campusEvents.id, eventId))
      .limit(1);
    if (evRows.length === 0) return { status: 'not_found' };
    const ev = evRows[0];

    const existing = await db
      .select()
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)))
      .limit(1);

    let isNowRegistered = false;
    if (existing.length > 0) {
      await db
        .delete(eventRegistrations)
        .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)));
      isNowRegistered = false;
    } else {
      const countRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.eventId, eventId));
      if ((countRows[0]?.count ?? 0) >= ev.capacity) {
        return { status: 'full' };
      }
      await db.insert(eventRegistrations).values({ eventId, userId });
      isNowRegistered = true;
    }

    const updatedCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId));

    return {
      status: 'ok',
      event: {
        id: ev.id,
        organizer_group: ev.organizerGroup,
        event_type: ev.eventType,
        title: ev.title,
        summary: ev.summary,
        content: ev.content,
        event_date: ev.eventDate,
        location: ev.location,
        capacity: ev.capacity,
        instagram_url: ev.instagramUrl,
        author_id: ev.authorId,
        created_at: ev.createdAt.toISOString(),
        registered_count: updatedCountRows[0]?.count ?? 0,
        is_registered: isNowRegistered ? 1 : 0,
      },
    };
  } catch (error) {
    console.error('Database query failed in toggleEventRegistration:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function listAdminAnnouncements() {
  try {
    const rows = await db
      .select()
      .from(adminAnnouncements)
      .orderBy(
        desc(adminAnnouncements.isPinned),
        desc(adminAnnouncements.createdAt),
        desc(adminAnnouncements.id)
      );
    return rows.map(serializeAdminAnnouncement);
  } catch (error) {
    console.error('Database query failed in listAdminAnnouncements:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createAdminAnnouncement(input: {
  category: string;
  targetAudience: string;
  title: string;
  content: string;
  isPinned: boolean;
  authorId: number;
  authorName: string;
}) {
  try {
    const inserted = await db
      .insert(adminAnnouncements)
      .values({
        category: input.category,
        targetAudience: input.targetAudience,
        title: input.title,
        content: input.content,
        isPinned: input.isPinned ? 1 : 0,
        authorId: input.authorId,
        authorName: input.authorName,
      })
      .returning();
    return serializeAdminAnnouncement(inserted[0]);
  } catch (error) {
    console.error('Database query failed in createAdminAnnouncement:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateAdminAnnouncement(
  id: number,
  patch: {
    category?: string;
    targetAudience?: string;
    title?: string;
    content?: string;
    isPinned?: boolean;
  }
) {
  try {
    const existingRows = await db
      .select()
      .from(adminAnnouncements)
      .where(eq(adminAnnouncements.id, id))
      .limit(1);
    if (existingRows.length === 0) return null;

    const existing = existingRows[0];
    const updated = await db
      .update(adminAnnouncements)
      .set({
        category: patch.category ?? existing.category,
        targetAudience: patch.targetAudience ?? existing.targetAudience,
        title: patch.title ?? existing.title,
        content: patch.content ?? existing.content,
        isPinned:
          typeof patch.isPinned === 'boolean' ? (patch.isPinned ? 1 : 0) : existing.isPinned,
        updatedAt: new Date(),
      })
      .where(eq(adminAnnouncements.id, id))
      .returning();
    return serializeAdminAnnouncement(updated[0]);
  } catch (error) {
    console.error('Database query failed in updateAdminAnnouncement:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteAdminAnnouncement(id: number): Promise<void> {
  try {
    await db.delete(adminAnnouncements).where(eq(adminAnnouncements.id, id));
  } catch (error) {
    console.error('Database query failed in deleteAdminAnnouncement:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
