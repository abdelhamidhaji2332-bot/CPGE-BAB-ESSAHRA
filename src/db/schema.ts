import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull().default(''),
  role: text('role').notNull().default('etudiant'),
  classCode: text('class_code'),
  trinomeNumber: integer('trinome_number'),
  subjectSpecialty: text('subject_specialty'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const classes = pgTable('classes', {
  code: text('code').primaryKey(),
  level: text('level').notNull(),
  levelLabel: text('level_label').notNull(),
  filiere: text('filiere').notNull(),
  shortTrack: text('short_track').notNull(),
  description: text('description').notNull(),
});

export const classSubjects = pgTable(
  'class_subjects',
  {
    id: serial('id').primaryKey(),
    classCode: text('class_code')
      .notNull()
      .references(() => classes.code, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [uniqueIndex('idx_class_subjects_unique').on(table.classCode, table.slug)]
);

export const documents = pgTable(
  'documents',
  {
    id: serial('id').primaryKey(),
    classCode: text('class_code').references(() => classes.code, { onDelete: 'cascade' }),
    subjectSlug: text('subject_slug'),
    category: text('category').notNull(),
    title: text('title').notNull(),
    chapter: text('chapter').notNull().default(''),
    description: text('description').notNull().default(''),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size').notNull().default(0),
    uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_documents_class_cat').on(table.classCode, table.category)]
);

export const documentProgress = pgTable(
  'document_progress',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    documentId: integer('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.documentId] })]
);

export const classTimetables = pgTable(
  'class_timetables',
  {
    id: serial('id').primaryKey(),
    classCode: text('class_code')
      .notNull()
      .references(() => classes.code, { onDelete: 'cascade' }),
    semester: text('semester').notNull(),
    dayOfWeek: text('day_of_week').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    sessionType: text('session_type').notNull(),
    subjectSlug: text('subject_slug'),
    subjectName: text('subject_name').notNull(),
    room: text('room').notNull(),
    professorName: text('professor_name').notNull().default(''),
  },
  (table) => [index('idx_timetables_class').on(table.classCode, table.semester)]
);

export const classColloscopes = pgTable(
  'class_colloscopes',
  {
    id: serial('id').primaryKey(),
    classCode: text('class_code')
      .notNull()
      .references(() => classes.code, { onDelete: 'cascade' }),
    weekNumber: integer('week_number').notNull(),
    weekLabel: text('week_label').notNull(),
    trinomeNumber: integer('trinome_number').notNull(),
    subjectSlug: text('subject_slug').notNull(),
    subjectName: text('subject_name').notNull(),
    kholleurName: text('kholleur_name').notNull(),
    dayTime: text('day_time').notNull(),
    room: text('room').notNull(),
  },
  (table) => [index('idx_colloscopes_class_week').on(table.classCode, table.weekNumber)]
);

export const classAnnouncements = pgTable(
  'class_announcements',
  {
    id: serial('id').primaryKey(),
    classCode: text('class_code')
      .notNull()
      .references(() => classes.code, { onDelete: 'cascade' }),
    authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    authorRole: text('author_role').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    isPinned: integer('is_pinned').notNull().default(0),
    sourceMessageId: integer('source_message_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_announcements_class').on(table.classCode, table.isPinned, table.createdAt)]
);

export const classMessages = pgTable(
  'class_messages',
  {
    id: serial('id').primaryKey(),
    classCode: text('class_code')
      .notNull()
      .references(() => classes.code, { onDelete: 'cascade' }),
    authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    authorRole: text('author_role').notNull(),
    content: text('content').notNull(),
    isAnnouncement: integer('is_announcement').notNull().default(0),
    announcementId: integer('announcement_id').references(() => classAnnouncements.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_messages_class').on(table.classCode, table.createdAt)]
);

export const internatNotices = pgTable('internat_notices', {
  id: serial('id').primaryKey(),
  pavillon: text('pavillon').notNull(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  isPinned: integer('is_pinned').notNull().default(0),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  authorName: text('author_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const campusEvents = pgTable('campus_events', {
  id: serial('id').primaryKey(),
  organizerGroup: text('organizer_group').notNull(),
  eventType: text('event_type').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  content: text('content').notNull(),
  eventDate: text('event_date').notNull(),
  location: text('location').notNull(),
  capacity: integer('capacity').notNull().default(120),
  instagramUrl: text('instagram_url').notNull().default(''),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const eventRegistrations = pgTable(
  'event_registrations',
  {
    eventId: integer('event_id')
      .notNull()
      .references(() => campusEvents.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.userId] })]
);

export const infoAssignments = pgTable(
  'info_assignments',
  {
    id: serial('id').primaryKey(),
    classCode: text('class_code')
      .notNull()
      .references(() => classes.code, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    language: text('language').notNull().default('Python 3'),
    dueDate: text('due_date').notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    professorName: text('professor_name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_assignments_class').on(table.classCode)]
);

export const infoSubmissions = pgTable(
  'info_submissions',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => infoAssignments.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studentName: text('student_name').notNull(),
    fileName: text('file_name').notNull(),
    filePath: text('file_path'),
    codeContent: text('code_content').notNull(),
    professorFeedback: text('professor_feedback'),
    status: text('status').notNull().default('soumis'),
    submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('idx_submissions_unique').on(table.assignmentId, table.studentId)]
);

export const classActivityLog = pgTable(
  'class_activity_log',
  {
    id: serial('id').primaryKey(),
    classCode: text('class_code')
      .notNull()
      .references(() => classes.code, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    tabTarget: text('tab_target').notNull().default('bibliotheque'),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_class_activity_class').on(table.classCode, table.id)]
);

export const userClassSeen = pgTable(
  'user_class_seen',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classCode: text('class_code')
      .notNull()
      .references(() => classes.code, { onDelete: 'cascade' }),
    lastSeenActivityId: integer('last_seen_activity_id').notNull().default(0),
    seenAt: timestamp('seen_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.classCode] })]
);

export const adminAnnouncements = pgTable(
  'admin_announcements',
  {
    id: serial('id').primaryKey(),
    category: text('category').notNull(),
    targetAudience: text('target_audience').notNull().default('Toutes les classes'),
    title: text('title').notNull(),
    content: text('content').notNull(),
    isPinned: integer('is_pinned').notNull().default(0),
    authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_admin_announcements').on(table.isPinned, table.createdAt)]
);

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  progress: many(documentProgress),
  eventRegistrations: many(eventRegistrations),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  progress: many(documentProgress),
}));
