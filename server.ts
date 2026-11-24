import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';
import {
  canAccessClassWorkspace,
  canManageAdministration,
  canManageCampusLife,
  canManageInternat,
  canManageProfTools,
  hasAdminConfigured,
  hashPassword,
  isClassModerator,
  loadUserById,
  optionalAuth,
  requireAuth,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { getDb, seedCampusDatabase } from './server/db.ts';
import {
  RESSOURCES_ROOT,
  ensureRessourcesDirectories,
  syncRessourcesFolderToDb,
} from './server/ressourcesSync.ts';
import {
  CAMPUS_CLASSES,
  CLASS_CODES,
  DOCUMENT_CATEGORY_LABELS,
  RESOURCE_CATEGORIES,
  getClassDefinition,
  isValidClassCode,
  type DocumentCategory,
  type ResourceCategory,
  type UserRole,
} from './src/shared/curriculum.ts';

const PORT = 3000;
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DOCS_ROOT = path.resolve(PUBLIC_DIR, 'documents');

const ALLOWED_ROLES: UserRole[] = [
  'etudiant',
  'delegue',
  'professeur',
  'maitre_internat',
  'bde',
  'groupe_media',
  'admin',
];

const ALLOWED_DOC_CATEGORIES: DocumentCategory[] = [
  'td',
  'ds',
  'resume',
  'cnc',
  'cf',
  'cours',
  'concours-blancs',
  'corriges',
  'colloscopes',
  'guides',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

function sanitizeFileSegment(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'document';
}

function resolveInside(baseDir: string, ...segments: string[]): string | null {
  const target = path.resolve(baseDir, ...segments);
  const normalizedBase = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
  if (!target.startsWith(normalizedBase)) {
    return null;
  }
  return target;
}

interface WsClientMeta {
  ws: WebSocket;
  userId: number;
  classCode: string;
}

async function startServer(): Promise<void> {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  ensureRessourcesDirectories();

  const db = getDb();
  await seedCampusDatabase(PUBLIC_DIR);
  syncRessourcesFolderToDb(db, true);

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Serve generated/uploaded static documents safely
  app.use('/documents', express.static(DOCS_ROOT));
  app.use('/ressources', express.static(RESSOURCES_ROOT, { dotfiles: 'ignore', index: false }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const classRooms = new Map<string, Set<WsClientMeta>>();

  function broadcastToClass(classCode: string, event: string, payload: unknown): void {
    const clients = classRooms.get(classCode);
    if (!clients) return;
    const serialized = JSON.stringify({ event, payload });
    for (const client of clients) {
      if (client.ws.readyState === 1) {
        client.ws.send(serialized);
      }
    }
  }

  function broadcastPresence(classCode: string): void {
    const clients = classRooms.get(classCode);
    const uniqueUsers = new Set<number>();
    if (clients) {
      for (const c of clients) uniqueUsers.add(c.userId);
    }
    broadcastToClass(classCode, 'presence:update', {
      classCode,
      onlineCount: uniqueUsers.size,
    });
  }

  function recordClassActivity(
    classCode: string,
    kind: 'document' | 'announcement' | 'message' | 'timetable' | 'colloscope' | 'assignment',
    title: string,
    tabTarget: string,
    actorId: number | null
  ): void {
    if (!isValidClassCode(classCode)) return;
    const res = db
      .prepare(
        `INSERT INTO class_activity_log (class_code, kind, title, tab_target, actor_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(classCode, kind, title.slice(0, 180), tabTarget, actorId);
    const created = db
      .prepare('SELECT * FROM class_activity_log WHERE id = ?')
      .get(Number(res.lastInsertRowid));
    if (created) {
      broadcastToClass(classCode, 'workspace:activity', created);
    }
  }

  server.on('upgrade', (request, socket, head) => {
    const urlPath = request.url?.split('?')[0];
    if (urlPath !== '/ws') {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    let joinedClient: WsClientMeta | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString('utf8')) as {
          type?: string;
          token?: string;
          classCode?: string;
        };
        if (msg.type === 'auth' && typeof msg.token === 'string' && typeof msg.classCode === 'string') {
          const uid = verifyAuthToken(msg.token);
          const user = uid ? loadUserById(uid) : null;
          const code = msg.classCode.toUpperCase();
          if (!user || !isValidClassCode(code) || !canAccessClassWorkspace(user, code)) {
            ws.send(JSON.stringify({ event: 'error', payload: { message: 'Accès WebSocket refusé pour cette classe.' } }));
            ws.close(4003, 'Forbidden');
            return;
          }

          if (joinedClient) {
            classRooms.get(joinedClient.classCode)?.delete(joinedClient);
            broadcastPresence(joinedClient.classCode);
          }

          joinedClient = { ws, userId: user.id, classCode: code };
          if (!classRooms.has(code)) classRooms.set(code, new Set());
          classRooms.get(code)!.add(joinedClient);
          ws.send(JSON.stringify({ event: 'auth:ok', payload: { classCode: code } }));
          broadcastPresence(code);
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      if (joinedClient) {
        const room = classRooms.get(joinedClient.classCode);
        room?.delete(joinedClient);
        broadcastPresence(joinedClient.classCode);
      }
    });
  });

  // ─── Health & Auth Status ────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'site-prepa' });
  });

  app.get('/api/auth/status', (_req, res) => {
    res.json(hasAdminConfigured());
  });

  const bootstrapAdminSchema = z.object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    password: z.string().min(8).max(128),
  });

  app.post('/api/auth/bootstrap-admin', (req, res) => {
    const status = hasAdminConfigured();
    if (status.hasAdminUser || status.hasEnvPasscode) {
      res.status(409).json({ error: 'Un compte administrateur est déjà configuré sur ce campus.' });
      return;
    }
    const parsed = bootstrapAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Veuillez renseigner un nom, un email valide et un mot de passe (8 caractères min.).' });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'Cette adresse email est déjà enregistrée.' });
      return;
    }

    const pwHash = hashPassword(parsed.data.password);
    const result = db
      .prepare(
        `INSERT INTO users (full_name, email, password_hash, role, class_code)
         VALUES (?, ?, ?, 'admin', NULL)`
      )
      .run(parsed.data.fullName, email, pwHash);

    const userId = Number(result.lastInsertRowid);
    const user = loadUserById(userId)!;
    const token = signAuthToken(userId);
    res.status(201).json({ token, user });
  });

  const adminPasscodeSchema = z.object({
    passcode: z.string().min(1).max(128),
    fullName: z.string().trim().min(2).max(80).optional(),
    email: z.string().trim().email().max(120).optional(),
  });

  app.post('/api/auth/admin-passcode', (req, res) => {
    const configured = process.env.ADMIN_PASSCODE?.trim();
    if (!configured) {
      res.status(404).json({ error: 'Connexion par code administrateur non activée.' });
      return;
    }
    const parsed = adminPasscodeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Code administrateur invalide.' });
      return;
    }

    const a = Buffer.from(parsed.data.passcode, 'utf8');
    const b = Buffer.from(configured, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(401).json({ error: 'Code administrateur incorrect.' });
      return;
    }

    const existingAdmin = db
      .prepare(`SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`)
      .get() as { id: number } | undefined;

    let userId: number;
    if (existingAdmin) {
      userId = existingAdmin.id;
    } else {
      const email = (parsed.data.email ?? 'admin@siteprepa.ma').toLowerCase();
      const name = parsed.data.fullName ?? 'Direction Campus';
      const result = db
        .prepare(
          `INSERT INTO users (full_name, email, password_hash, role, class_code)
           VALUES (?, ?, ?, 'admin', NULL)`
        )
        .run(name, email, hashPassword(crypto.randomBytes(24).toString('hex')));
      userId = Number(result.lastInsertRowid);
    }

    const user = loadUserById(userId)!;
    const token = signAuthToken(userId);
    res.json({ token, user });
  });

  app.post('/api/auth/register', (_req, res) => {
    res.status(403).json({
      error: 'L’inscription publique est désactivée. Seule l’Équipe Dev peut créer des comptes.',
    });
  });

  const loginSchema = z.object({
    email: z.string().trim().email().max(120),
    password: z.string().min(1).max(128),
  });

  app.post('/api/auth/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Identifiants incomplets.' });
      return;
    }
    const email = parsed.data.email.toLowerCase();
    const row = db
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .get(email) as { id: number; password_hash: string } | undefined;

    if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
      return;
    }

    const user = loadUserById(row.id)!;
    const token = signAuthToken(row.id);
    res.json({ token, user });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // ─── Dev Team (Admin) Account & RBAC Management ──────────────────────────
  app.get('/api/admin/users', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Accès réservé exclusivement à l’Équipe Dev.' });
      return;
    }
    const users = db
      .prepare(
        `SELECT id, full_name, email, role, class_code, trinome_number, subject_specialty, created_at
         FROM users ORDER BY created_at DESC`
      )
      .all();
    res.json({ users });
  });

  const createAdminUserSchema = z.object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    password: z.string().min(8).max(128),
    role: z.enum(['etudiant', 'delegue', 'professeur', 'maitre_internat', 'bde', 'groupe_media', 'admin']),
    classCode: z.enum(['MPSI', 'PCSI1', 'PCSI2', 'ECS', 'MP', 'PSI1', 'PSI2', '2ECS']).nullable().optional(),
    trinomeNumber: z.number().int().min(1).max(20).nullable().optional(),
    subjectSpecialty: z.string().trim().max(80).nullable().optional(),
  });

  app.post('/api/admin/users', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Seule l’Équipe Dev a le droit de créer des comptes.' });
      return;
    }
    const parsed = createAdminUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données utilisateur invalides.' });
      return;
    }
    const email = parsed.data.email.toLowerCase();
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      res.status(409).json({ error: 'Email déjà utilisé.' });
      return;
    }
    const result = db
      .prepare(
        `INSERT INTO users (full_name, email, password_hash, role, class_code, trinome_number, subject_specialty)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        parsed.data.fullName,
        email,
        hashPassword(parsed.data.password),
        parsed.data.role,
        parsed.data.classCode ?? null,
        parsed.data.trinomeNumber ?? null,
        parsed.data.subjectSpecialty ?? null
      );
    res.status(201).json({ user: loadUserById(Number(result.lastInsertRowid)) });
  });

  const updateRoleSchema = z.object({
    role: z.enum(['etudiant', 'delegue', 'professeur', 'maitre_internat', 'bde', 'groupe_media', 'admin']),
    classCode: z.enum(['MPSI', 'PCSI1', 'PCSI2', 'ECS', 'MP', 'PSI1', 'PSI2', '2ECS']).nullable().optional(),
  });

  app.patch('/api/admin/users/:id/role', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Modification des rôles réservée à l’Équipe Dev.' });
      return;
    }
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      res.status(400).json({ error: 'Identifiant utilisateur invalide.' });
      return;
    }
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success || !ALLOWED_ROLES.includes(parsed.data.role)) {
      res.status(400).json({ error: 'Rôle invalide.' });
      return;
    }
    db.prepare(`UPDATE users SET role = ?, class_code = ? WHERE id = ?`).run(
      parsed.data.role,
      parsed.data.classCode !== undefined ? parsed.data.classCode : null,
      targetId
    );
    const updated = loadUserById(targetId);
    if (!updated) {
      res.status(404).json({ error: 'Utilisateur introuvable.' });
      return;
    }
    res.json({ user: updated });
  });

  app.delete('/api/admin/users/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Suppression réservée à l’Équipe Dev.' });
      return;
    }
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      res.status(400).json({ error: 'Identifiant utilisateur invalide.' });
      return;
    }
    if (targetId === req.user!.id) {
      res.status(400).json({ error: 'Impossible de supprimer votre propre compte actif.' });
      return;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    res.json({ ok: true });
  });

  // ─── Classes & Public Academic Library ───────────────────────────────────
  app.get('/api/classes', (_req, res) => {
    const docCounts = db
      .prepare(`SELECT class_code, COUNT(*) as count FROM documents WHERE class_code IS NOT NULL GROUP BY class_code`)
      .all() as Array<{ class_code: string; count: number }>;
    const countMap = new Map(docCounts.map((d) => [d.class_code, d.count]));

    const classes = CAMPUS_CLASSES.map((c) => ({
      ...c,
      documentCount: countMap.get(c.code) ?? 0,
      subjectCount: c.subjects.length,
    }));
    res.json({ classes });
  });

  app.get('/api/documents', optionalAuth, (req: AuthenticatedRequest, res) => {
    syncRessourcesFolderToDb(db);
    const classCode = typeof req.query.classCode === 'string' ? req.query.classCode.toUpperCase() : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const scope = typeof req.query.scope === 'string' ? req.query.scope : '';
    const subjectSlug = typeof req.query.subjectSlug === 'string' ? req.query.subjectSlug : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (classCode && isValidClassCode(classCode)) {
      conditions.push('d.class_code = ?');
      params.push(classCode);
    } else if (classCode === 'CAMPUS') {
      conditions.push('d.class_code IS NULL');
    }
    if (category && ALLOWED_DOC_CATEGORIES.includes(category as DocumentCategory)) {
      conditions.push('d.category = ?');
      params.push(category);
    } else if (scope === 'ressources') {
      conditions.push(`d.category IN ('td', 'ds', 'resume', 'cnc', 'cf')`);
    }
    if (subjectSlug) {
      conditions.push('d.subject_slug = ?');
      params.push(subjectSlug);
    }
    if (q) {
      conditions.push('(LOWER(d.title) LIKE ? OR LOWER(d.chapter) LIKE ? OR LOWER(d.description) LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT d.*, p.status as progress_status
         FROM documents d
         LEFT JOIN document_progress p ON p.document_id = d.id AND p.user_id = ?
         ${whereClause}
         ORDER BY d.created_at DESC, d.id DESC
         LIMIT 200`
      )
      .all(req.user?.id ?? -1, ...params);

    res.json({ documents: rows });
  });

  app.post('/api/documents/:id/progress', requireAuth, (req: AuthenticatedRequest, res) => {
    const docId = Number(req.params.id);
    const status = req.body?.status;
    if (!Number.isInteger(docId) || !['a_faire', 'en_cours', 'maitrise'].includes(status)) {
      res.status(400).json({ error: 'Paramètres de progression invalides.' });
      return;
    }
    const exists = db.prepare('SELECT id FROM documents WHERE id = ?').get(docId);
    if (!exists) {
      res.status(404).json({ error: 'Document introuvable.' });
      return;
    }
    db.prepare(
      `INSERT INTO document_progress (user_id, document_id, status, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, document_id) DO UPDATE SET status = excluded.status, updated_at = datetime('now')`
    ).run(req.user!.id, docId, status);
    res.json({ ok: true, documentId: docId, status });
  });

  app.post('/api/documents/upload', requireAuth, upload.single('file'), (req: AuthenticatedRequest, res) => {
    const file = req.file;
    const classCodeRaw = typeof req.body.classCode === 'string' ? req.body.classCode.toUpperCase() : '';
    const category = typeof req.body.category === 'string' ? (req.body.category as DocumentCategory) : 'td';
    const subjectSlug = typeof req.body.subjectSlug === 'string' ? req.body.subjectSlug.trim() : '';
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const chapter = typeof req.body.chapter === 'string' ? req.body.chapter.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';

    if (!file || !title || !ALLOWED_DOC_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Fichier PDF, titre et catégorie valides requis.' });
      return;
    }

    const isGuide = category === 'guides';
    if (!isGuide && !isValidClassCode(classCodeRaw)) {
      res.status(400).json({ error: 'Classe CPGE invalide.' });
      return;
    }

    if (category === 'colloscopes') {
      if (!isClassModerator(req.user!, classCodeRaw)) {
        res.status(403).json({ error: 'Droits insuffisants pour publier un colloscope.' });
        return;
      }
    } else if (!canManageProfTools(req.user!)) {
      res.status(403).json({
        error: 'Seuls les professeurs (et l’administration) peuvent publier les TD, DS, résumés, CNC et CF.',
      });
      return;
    }

    // Verify PDF magic header
    const header = file.buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      res.status(400).json({ error: 'Le fichier envoyé doit être un document PDF valide (%PDF-).' });
      return;
    }

    const baseName = sanitizeFileSegment(path.basename(file.originalname, '.pdf')) + '-' + Date.now() + '.pdf';
    const isResourceCategory = (RESOURCE_CATEGORIES as readonly string[]).includes(category);
    let relativeSegments: string[];
    let targetBaseDir = DOCS_ROOT;
    let urlPrefix = '/documents';

    if (isResourceCategory) {
      targetBaseDir = RESSOURCES_ROOT;
      urlPrefix = '/ressources';
      const classDef = getClassDefinition(classCodeRaw);
      const validSubject =
        classDef && subjectSlug && classDef.subjects.some((s) => s.slug === subjectSlug)
          ? subjectSlug
          : sanitizeFileSegment(subjectSlug || 'general');
      relativeSegments = [classCodeRaw, validSubject, category, baseName];
    } else if (category === 'guides') {
      relativeSegments = ['guides', baseName];
    } else if (category === 'cours' && subjectSlug) {
      relativeSegments = ['cours', classCodeRaw, sanitizeFileSegment(subjectSlug), baseName];
    } else {
      relativeSegments = [category, classCodeRaw, baseName];
    }

    const resolvedTarget = resolveInside(targetBaseDir, ...relativeSegments);
    if (!resolvedTarget) {
      res.status(400).json({ error: 'Chemin de stockage invalide.' });
      return;
    }

    fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
    fs.writeFileSync(resolvedTarget, file.buffer);

    const publicUrlPath = `${urlPrefix}/${relativeSegments.map((s) => encodeURIComponent(s)).join('/')}`;
    const result = db
      .prepare(
        `INSERT INTO documents (class_code, subject_slug, category, title, chapter, description, file_path, file_size, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        isGuide ? null : classCodeRaw,
        subjectSlug || null,
        category,
        title,
        chapter || DOCUMENT_CATEGORY_LABELS[category],
        description,
        publicUrlPath,
        file.size,
        req.user!.id
      );

    if (isResourceCategory) {
      syncRessourcesFolderToDb(db, true);
    }

    const created = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(result.lastInsertRowid));
    if (!isGuide && isValidClassCode(classCodeRaw)) {
      recordClassActivity(
        classCodeRaw,
        'document',
        `${DOCUMENT_CATEGORY_LABELS[category]} : ${title}`,
        category === 'colloscopes' ? 'colloscope' : 'bibliotheque',
        req.user!.id
      );
    }
    res.status(201).json({ document: created });
  });

  app.delete('/api/documents/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!canManageProfTools(req.user!)) {
      res.status(403).json({ error: 'Suppression réservée aux professeurs et à l’administration.' });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Identifiant de document invalide.' });
      return;
    }
    const existing = db.prepare('SELECT id, file_path FROM documents WHERE id = ?').get(id) as
      | { id: number; file_path: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Document introuvable.' });
      return;
    }
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);

    const isRessourceFile = existing.file_path.startsWith('/ressources/');
    const baseDir = isRessourceFile ? RESSOURCES_ROOT : DOCS_ROOT;
    const rawRel = existing.file_path.replace(/^\/(?:ressources|documents)\/+/, '');
    let decodedRel = rawRel;
    try {
      decodedRel = decodeURIComponent(rawRel);
    } catch {
      decodedRel = rawRel;
    }
    const resolved = resolveInside(baseDir, decodedRel);
    if (resolved && fs.existsSync(resolved)) {
      try {
        fs.unlinkSync(resolved);
      } catch {
        // Ignore file unlink errors
      }
    }
    if (isRessourceFile) {
      syncRessourcesFolderToDb(db, true);
    }
    res.json({ ok: true });
  });

  // ─── Per-Class Workspace (Public Overview + Private Protected Data) ─────
  app.get('/api/classes/:classCode/overview', optionalAuth, (req: AuthenticatedRequest, res) => {
    const code = req.params.classCode.toUpperCase();
    const classDef = getClassDefinition(code);
    if (!classDef) {
      res.status(404).json({ error: 'Classe CPGE introuvable.' });
      return;
    }

    const documents = db
      .prepare(
        `SELECT d.*, p.status as progress_status
         FROM documents d
         LEFT JOIN document_progress p ON p.document_id = d.id AND p.user_id = ?
         WHERE d.class_code = ?
         ORDER BY d.created_at DESC, d.id DESC`
      )
      .all(req.user?.id ?? -1, code);

    const timetables = db
      .prepare(
        `SELECT * FROM class_timetables WHERE class_code = ?
         ORDER BY semester ASC,
         CASE day_of_week
           WHEN 'Lundi' THEN 1
           WHEN 'Mardi' THEN 2
           WHEN 'Mercredi' THEN 3
           WHEN 'Jeudi' THEN 4
           WHEN 'Vendredi' THEN 5
           WHEN 'Samedi' THEN 6
         END ASC, start_time ASC`
      )
      .all(code);

    const colloscopes = db
      .prepare(
        `SELECT * FROM class_colloscopes WHERE class_code = ?
         ORDER BY week_number ASC, trinome_number ASC`
      )
      .all(code);

    res.json({
      class: classDef,
      documents,
      timetables,
      colloscopes,
      canAccessPrivate: req.user ? canAccessClassWorkspace(req.user, code) : false,
      isModerator: req.user ? isClassModerator(req.user, code) : false,
    });
  });

  app.get('/api/classes/:classCode/workspace-private', requireAuth, (req: AuthenticatedRequest, res) => {
    const code = req.params.classCode.toUpperCase();
    if (!isValidClassCode(code)) {
      res.status(404).json({ error: 'Classe introuvable.' });
      return;
    }
    if (!canAccessClassWorkspace(req.user!, code)) {
      res.status(403).json({
        error: `Accès restreint : vous êtes rattaché(e) à ${req.user!.classCode ?? 'aucune classe'}, et cet espace dynamique est réservé aux membres de ${code}, aux professeurs et à l'administration.`,
      });
      return;
    }

    const timetables = db
      .prepare(
        `SELECT * FROM class_timetables WHERE class_code = ?
         ORDER BY semester ASC,
         CASE day_of_week
           WHEN 'Lundi' THEN 1
           WHEN 'Mardi' THEN 2
           WHEN 'Mercredi' THEN 3
           WHEN 'Jeudi' THEN 4
           WHEN 'Vendredi' THEN 5
           WHEN 'Samedi' THEN 6
         END ASC, start_time ASC`
      )
      .all(code);

    const colloscopes = db
      .prepare(
        `SELECT * FROM class_colloscopes WHERE class_code = ?
         ORDER BY week_number ASC, trinome_number ASC`
      )
      .all(code);

    const announcements = db
      .prepare(
        `SELECT * FROM class_announcements WHERE class_code = ?
         ORDER BY is_pinned DESC, created_at DESC, id DESC`
      )
      .all(code);

    const messages = db
      .prepare(
        `SELECT * FROM class_messages WHERE class_code = ?
         ORDER BY id DESC LIMIT 100`
      )
      .all(code)
      .reverse();

    res.json({
      timetables,
      colloscopes,
      announcements,
      messages,
      isModerator: isClassModerator(req.user!, code),
    });
  });

  // Moderator announcements CRUD
  const announcementSchema = z.object({
    title: z.string().trim().min(3).max(140),
    content: z.string().trim().min(3).max(2000),
    isPinned: z.boolean().optional(),
  });

  app.post('/api/classes/:classCode/announcements', requireAuth, (req: AuthenticatedRequest, res) => {
    const code = req.params.classCode.toUpperCase();
    if (!isValidClassCode(code) || !isClassModerator(req.user!, code)) {
      res.status(403).json({ error: 'Publication réservée aux modérateurs de la classe (Délégués, Professeurs, Administration).' });
      return;
    }
    const parsed = announcementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Titre et contenu de l’annonce requis.' });
      return;
    }
    const result = db
      .prepare(
        `INSERT INTO class_announcements (class_code, author_id, author_name, author_role, title, content, is_pinned)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        req.user!.id,
        req.user!.fullName,
        req.user!.role,
        parsed.data.title,
        parsed.data.content,
        parsed.data.isPinned ? 1 : 0
      );

    const announcement = db.prepare('SELECT * FROM class_announcements WHERE id = ?').get(Number(result.lastInsertRowid));
    broadcastToClass(code, 'announcement:created', announcement);
    recordClassActivity(code, 'announcement', parsed.data.title, 'annonces', req.user!.id);
    res.status(201).json({ announcement });
  });

  app.patch('/api/classes/:classCode/announcements/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const code = req.params.classCode.toUpperCase();
    const id = Number(req.params.id);
    if (!isValidClassCode(code) || !Number.isInteger(id) || !isClassModerator(req.user!, code)) {
      res.status(403).json({ error: 'Action réservée aux modérateurs de la classe.' });
      return;
    }
    const existing = db
      .prepare('SELECT * FROM class_announcements WHERE id = ? AND class_code = ?')
      .get(id, code) as { id: number; title: string; content: string; is_pinned: number } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Annonce introuvable.' });
      return;
    }
    const isPinned = typeof req.body.isPinned === 'boolean' ? (req.body.isPinned ? 1 : 0) : existing.is_pinned;
    const title = typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : existing.title;
    const content = typeof req.body.content === 'string' && req.body.content.trim() ? req.body.content.trim() : existing.content;

    db.prepare(
      `UPDATE class_announcements SET title = ?, content = ?, is_pinned = ?, updated_at = datetime('now')
       WHERE id = ? AND class_code = ?`
    ).run(title, content, isPinned, id, code);
    const updated = db.prepare('SELECT * FROM class_announcements WHERE id = ?').get(id);
    broadcastToClass(code, 'announcement:updated', updated);
    recordClassActivity(code, 'announcement', `Annonce mise à jour : ${title}`, 'annonces', req.user!.id);
    res.json({ announcement: updated });
  });

  app.delete('/api/classes/:classCode/announcements/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const code = req.params.classCode.toUpperCase();
    const id = Number(req.params.id);
    if (!isValidClassCode(code) || !Number.isInteger(id) || !isClassModerator(req.user!, code)) {
      res.status(403).json({ error: 'Suppression réservée aux modérateurs de la classe.' });
      return;
    }
    db.prepare('DELETE FROM class_announcements WHERE id = ? AND class_code = ?').run(id, code);
    broadcastToClass(code, 'announcement:deleted', { id });
    res.json({ ok: true });
  });

  // Real-time Class Chat + Moderator Broadcast Sync
  const chatMessageSchema = z.object({
    content: z.string().trim().min(1).max(1500),
    isAnnouncement: z.boolean().optional(),
    announcementTitle: z.string().trim().max(140).optional(),
  });

  app.post('/api/classes/:classCode/messages', requireAuth, (req: AuthenticatedRequest, res) => {
    const code = req.params.classCode.toUpperCase();
    if (!isValidClassCode(code) || !canAccessClassWorkspace(req.user!, code)) {
      res.status(403).json({ error: 'Accès au chat réservé aux membres de la classe.' });
      return;
    }
    const parsed = chatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Message invalide.' });
      return;
    }

    const wantsAnnouncement = Boolean(parsed.data.isAnnouncement);
    if (wantsAnnouncement && !isClassModerator(req.user!, code)) {
      res.status(403).json({ error: 'Seuls les modérateurs (Délégués, Professeurs, Administration) peuvent diffuser une Annonce Modérateur.' });
      return;
    }

    const tx = db.transaction(() => {
      const msgRes = db
        .prepare(
          `INSERT INTO class_messages (class_code, author_id, author_name, author_role, content, is_announcement)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(code, req.user!.id, req.user!.fullName, req.user!.role, parsed.data.content, wantsAnnouncement ? 1 : 0);

      const messageId = Number(msgRes.lastInsertRowid);
      let createdAnnouncement: unknown = null;

      if (wantsAnnouncement) {
        const autoTitle =
          parsed.data.announcementTitle?.trim() ||
          `Annonce Modérateur — ${req.user!.fullName}`;
        const annRes = db
          .prepare(
            `INSERT INTO class_announcements (class_code, author_id, author_name, author_role, title, content, is_pinned, source_message_id)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
          )
          .run(code, req.user!.id, req.user!.fullName, req.user!.role, autoTitle, parsed.data.content, messageId);
        const announcementId = Number(annRes.lastInsertRowid);
        db.prepare('UPDATE class_messages SET announcement_id = ? WHERE id = ?').run(announcementId, messageId);
        createdAnnouncement = db.prepare('SELECT * FROM class_announcements WHERE id = ?').get(announcementId);
      }

      const createdMessage = db.prepare('SELECT * FROM class_messages WHERE id = ?').get(messageId);
      return { createdMessage, createdAnnouncement };
    });

    const { createdMessage, createdAnnouncement } = tx();
    broadcastToClass(code, 'message:created', createdMessage);
    if (createdAnnouncement) {
      broadcastToClass(code, 'announcement:created', createdAnnouncement);
      recordClassActivity(
        code,
        'announcement',
        parsed.data.announcementTitle?.trim() || `Annonce Modérateur — ${req.user!.fullName}`,
        'annonces',
        req.user!.id
      );
    } else {
      recordClassActivity(
        code,
        'message',
        `${req.user!.fullName} : ${parsed.data.content.slice(0, 72)}`,
        'chat',
        req.user!.id
      );
    }

    res.status(201).json({ message: createdMessage, announcement: createdAnnouncement });
  });

  // Timetable & Colloscope moderator updates
  const timetableSlotSchema = z.object({
    semester: z.enum(['S1', 'S2']),
    dayOfWeek: z.enum(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    sessionType: z.enum(['Cours', 'TD', 'TP', 'DS', 'Concours Blanc']),
    subjectSlug: z.string().trim().min(1).max(60),
    subjectName: z.string().trim().min(2).max(120),
    room: z.string().trim().min(1).max(60),
    professorName: z.string().trim().max(80).optional(),
  });

  app.post('/api/classes/:classCode/timetable', requireAuth, (req: AuthenticatedRequest, res) => {
    const code = req.params.classCode.toUpperCase();
    if (!isValidClassCode(code) || !isClassModerator(req.user!, code)) {
      res.status(403).json({ error: 'Modification d’emploi du temps réservée aux modérateurs.' });
      return;
    }
    const parsed = timetableSlotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données de créneau invalides (format horaire HH:MM requis).' });
      return;
    }
    const result = db
      .prepare(
        `INSERT INTO class_timetables (class_code, semester, day_of_week, start_time, end_time, session_type, subject_slug, subject_name, room, professor_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        parsed.data.semester,
        parsed.data.dayOfWeek,
        parsed.data.startTime,
        parsed.data.endTime,
        parsed.data.sessionType,
        parsed.data.subjectSlug,
        parsed.data.subjectName,
        parsed.data.room,
        parsed.data.professorName || req.user!.fullName
      );
    const slot = db.prepare('SELECT * FROM class_timetables WHERE id = ?').get(Number(result.lastInsertRowid));
    recordClassActivity(
      code,
      'timetable',
      `Emploi du temps (${parsed.data.dayOfWeek} ${parsed.data.startTime}) : ${parsed.data.subjectName}`,
      'emploi-du-temps',
      req.user!.id
    );
    res.status(201).json({ slot });
  });

  const colloscopeSlotSchema = z.object({
    weekNumber: z.number().int().min(1).max(30),
    trinomeNumber: z.number().int().min(1).max(20),
    subjectSlug: z.string().trim().min(1).max(60),
    subjectName: z.string().trim().min(2).max(120),
    kholleurName: z.string().trim().min(2).max(80),
    dayTime: z.string().trim().min(2).max(60),
    room: z.string().trim().min(1).max(40),
  });

  app.post('/api/classes/:classCode/colloscope', requireAuth, (req: AuthenticatedRequest, res) => {
    const code = req.params.classCode.toUpperCase();
    if (!isValidClassCode(code) || !isClassModerator(req.user!, code)) {
      res.status(403).json({ error: 'Modification du colloscope réservée aux modérateurs.' });
      return;
    }
    const parsed = colloscopeSlotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données de khôlle invalides.' });
      return;
    }
    const result = db
      .prepare(
        `INSERT INTO class_colloscopes (class_code, week_number, week_label, trinome_number, subject_slug, subject_name, kholleur_name, day_time, room)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        parsed.data.weekNumber,
        `Semaine ${parsed.data.weekNumber}`,
        parsed.data.trinomeNumber,
        parsed.data.subjectSlug,
        parsed.data.subjectName,
        parsed.data.kholleurName,
        parsed.data.dayTime,
        parsed.data.room
      );
    const entry = db.prepare('SELECT * FROM class_colloscopes WHERE id = ?').get(Number(result.lastInsertRowid));
    recordClassActivity(
      code,
      'colloscope',
      `Colloscope S${parsed.data.weekNumber} · Trinôme ${parsed.data.trinomeNumber} (${parsed.data.subjectName})`,
      'colloscope',
      req.user!.id
    );
    res.status(201).json({ entry });
  });

  // ─── Class Workspace Notifications ───────────────────────────────────────
  app.get('/api/classes/:classCode/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const code = req.params.classCode.toUpperCase();
    if (!isValidClassCode(code) || !canAccessClassWorkspace(req.user!, code)) {
      res.status(403).json({ error: 'Accès notifications réservé aux membres de la classe.' });
      return;
    }
    const seenRow = db
      .prepare('SELECT last_seen_activity_id FROM user_class_seen WHERE user_id = ? AND class_code = ?')
      .get(req.user!.id, code) as { last_seen_activity_id: number } | undefined;
    const lastSeenId = seenRow?.last_seen_activity_id ?? 0;

    const unreadRows = db
      .prepare(
        `SELECT id, class_code, kind, title, tab_target, actor_id, created_at
         FROM class_activity_log
         WHERE class_code = ? AND id > ? AND (actor_id IS NULL OR actor_id != ?)
         ORDER BY id DESC LIMIT 30`
      )
      .all(code, lastSeenId, req.user!.id) as Array<{
      id: number;
      class_code: string;
      kind: string;
      title: string;
      tab_target: string;
      actor_id: number | null;
      created_at: string;
    }>;

    const byTab: Record<string, number> = {
      bibliotheque: 0,
      colloscope: 0,
      'emploi-du-temps': 0,
      annonces: 0,
      chat: 0,
    };
    for (const row of unreadRows) {
      byTab[row.tab_target] = (byTab[row.tab_target] || 0) + 1;
    }

    res.json({
      classCode: code,
      unreadCount: unreadRows.length,
      lastSeenId,
      byTab,
      items: unreadRows.slice(0, 8),
    });
  });

  app.post('/api/classes/:classCode/notifications/mark-read', requireAuth, (req: AuthenticatedRequest, res) => {
    const code = req.params.classCode.toUpperCase();
    if (!isValidClassCode(code) || !canAccessClassWorkspace(req.user!, code)) {
      res.status(403).json({ error: 'Accès notifications réservé aux membres de la classe.' });
      return;
    }
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM class_activity_log WHERE class_code = ?')
      .get(code) as { maxId: number };

    db.prepare(
      `INSERT INTO user_class_seen (user_id, class_code, last_seen_activity_id, seen_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, class_code) DO UPDATE SET
         last_seen_activity_id = MAX(user_class_seen.last_seen_activity_id, excluded.last_seen_activity_id),
         seen_at = datetime('now')`
    ).run(req.user!.id, code, maxRow.maxId);

    res.json({ ok: true, classCode: code, lastSeenId: maxRow.maxId });
  });

  // ─── Internat Hub ────────────────────────────────────────────────────────
  app.get('/api/internat', (_req, res) => {
    const notices = db
      .prepare(`SELECT * FROM internat_notices ORDER BY is_pinned DESC, created_at DESC, id DESC`)
      .all();
    res.json({ notices });
  });

  const internatSchema = z.object({
    pavillon: z.string().trim().min(2).max(80),
    category: z.enum(['Horaire', 'Permanence', 'Maintenance', 'Annonce']),
    title: z.string().trim().min(3).max(140),
    content: z.string().trim().min(3).max(2000),
    isPinned: z.boolean().optional(),
  });

  app.post('/api/internat', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!canManageInternat(req.user!)) {
      res.status(403).json({ error: 'Réservé aux Maîtres d’internat et à l’administration.' });
      return;
    }
    const parsed = internatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Champs de note d’internat invalides.' });
      return;
    }
    const result = db
      .prepare(
        `INSERT INTO internat_notices (pavillon, category, title, content, is_pinned, author_id, author_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        parsed.data.pavillon,
        parsed.data.category,
        parsed.data.title,
        parsed.data.content,
        parsed.data.isPinned ? 1 : 0,
        req.user!.id,
        req.user!.fullName
      );
    const notice = db.prepare('SELECT * FROM internat_notices WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ notice });
  });

  app.delete('/api/internat/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!canManageInternat(req.user!)) {
      res.status(403).json({ error: 'Suppression réservée aux Maîtres d’internat et à l’administration.' });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }
    db.prepare('DELETE FROM internat_notices WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // ─── Vie Campus (BDE & Groupe Média) ─────────────────────────────────────
  app.get('/api/events', optionalAuth, (req: AuthenticatedRequest, res) => {
    const events = db
      .prepare(
        `SELECT e.*,
          (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) as registered_count,
          EXISTS(SELECT 1 FROM event_registrations r2 WHERE r2.event_id = e.id AND r2.user_id = ?) as is_registered
         FROM campus_events e
         ORDER BY e.created_at DESC, e.id DESC`
      )
      .all(req.user?.id ?? -1);
    res.json({ events });
  });

  const eventSchema = z.object({
    organizerGroup: z.enum(['BDE', 'Groupe Média', 'Administration']),
    eventType: z.enum(['Événement', 'Article', 'Conférence', 'Tournoi']),
    title: z.string().trim().min(3).max(140),
    summary: z.string().trim().min(5).max(300),
    content: z.string().trim().min(5).max(4000),
    eventDate: z.string().trim().min(2).max(60),
    location: z.string().trim().min(2).max(100),
    capacity: z.number().int().min(10).max(2000).optional(),
    instagramUrl: z
      .string()
      .trim()
      .max(300)
      .refine((v) => !v || /^https?:\/\//i.test(v), 'Le lien Instagram doit commencer par https://')
      .optional(),
  });

  app.post('/api/events', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!canManageCampusLife(req.user!)) {
      res.status(403).json({ error: 'Publication réservée au BDE, au Groupe Média et à l’administration.' });
      return;
    }
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Informations d’événement invalides (vérifiez aussi le lien Instagram https://).' });
      return;
    }
    const result = db
      .prepare(
        `INSERT INTO campus_events (organizer_group, event_type, title, summary, content, event_date, location, capacity, instagram_url, author_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        parsed.data.organizerGroup,
        parsed.data.eventType,
        parsed.data.title,
        parsed.data.summary,
        parsed.data.content,
        parsed.data.eventDate,
        parsed.data.location,
        parsed.data.capacity ?? 120,
        parsed.data.instagramUrl ?? '',
        req.user!.id
      );
    const created = db
      .prepare(
        `SELECT *, 0 as registered_count, 0 as is_registered FROM campus_events WHERE id = ?`
      )
      .get(Number(result.lastInsertRowid));
    res.status(201).json({ event: created });
  });

  app.delete('/api/events/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!canManageCampusLife(req.user!)) {
      res.status(403).json({ error: 'Suppression réservée au BDE, au Groupe Média et à l’administration.' });
      return;
    }
    const eventId = Number(req.params.id);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }
    db.prepare('DELETE FROM campus_events WHERE id = ?').run(eventId);
    res.json({ ok: true });
  });

  app.post('/api/events/:id/register', requireAuth, (req: AuthenticatedRequest, res) => {
    const eventId = Number(req.params.id);
    if (!Number.isInteger(eventId)) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }
    const ev = db.prepare('SELECT id, capacity FROM campus_events WHERE id = ?').get(eventId) as
      | { id: number; capacity: number }
      | undefined;
    if (!ev) {
      res.status(404).json({ error: 'Événement introuvable.' });
      return;
    }
    const existing = db
      .prepare('SELECT 1 FROM event_registrations WHERE event_id = ? AND user_id = ?')
      .get(eventId, req.user!.id);

    if (existing) {
      db.prepare('DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?').run(eventId, req.user!.id);
    } else {
      const countRow = db
        .prepare('SELECT COUNT(*) as c FROM event_registrations WHERE event_id = ?')
        .get(eventId) as { c: number };
      if (countRow.c >= ev.capacity) {
        res.status(409).json({ error: 'Capacité maximale atteinte pour cet événement.' });
        return;
      }
      db.prepare('INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)').run(eventId, req.user!.id);
    }

    const updated = db
      .prepare(
        `SELECT e.*,
          (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) as registered_count,
          EXISTS(SELECT 1 FROM event_registrations r2 WHERE r2.event_id = e.id AND r2.user_id = ?) as is_registered
         FROM campus_events e WHERE e.id = ?`
      )
      .get(req.user!.id, eventId);
    res.json({ event: updated });
  });

  // ─── Administration — Annonces Officielles ──────────────────────────────
  app.get('/api/administration/announcements', (_req, res) => {
    const announcements = db
      .prepare(
        `SELECT * FROM admin_announcements
         ORDER BY is_pinned DESC, created_at DESC, id DESC`
      )
      .all();
    res.json({ announcements });
  });

  const adminAnnouncementSchema = z.object({
    category: z.enum([
      'Note officielle',
      'Concours & Examens',
      'Scolarité',
      'Bourses & Internat',
      'Urgent',
    ]),
    targetAudience: z.string().trim().min(2).max(80).optional(),
    title: z.string().trim().min(3).max(160),
    content: z.string().trim().min(3).max(4000),
    isPinned: z.boolean().optional(),
  });

  app.post('/api/administration/announcements', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!canManageAdministration(req.user!)) {
      res.status(403).json({
        error: 'Publication réservée à l’Administration du Centre CPGE.',
      });
      return;
    }
    const parsed = adminAnnouncementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Champs de l’annonce officielle invalides.' });
      return;
    }
    const result = db
      .prepare(
        `INSERT INTO admin_announcements (category, target_audience, title, content, is_pinned, author_id, author_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        parsed.data.category,
        parsed.data.targetAudience || 'Toutes les classes',
        parsed.data.title,
        parsed.data.content,
        parsed.data.isPinned ? 1 : 0,
        req.user!.id,
        req.user!.fullName
      );
    const announcement = db
      .prepare('SELECT * FROM admin_announcements WHERE id = ?')
      .get(Number(result.lastInsertRowid));
    res.status(201).json({ announcement });
  });

  const adminAnnouncementPatchSchema = z.object({
    category: z
      .enum([
        'Note officielle',
        'Concours & Examens',
        'Scolarité',
        'Bourses & Internat',
        'Urgent',
      ])
      .optional(),
    targetAudience: z.string().trim().min(2).max(80).optional(),
    title: z.string().trim().min(3).max(160).optional(),
    content: z.string().trim().min(3).max(4000).optional(),
    isPinned: z.boolean().optional(),
  });

  app.patch('/api/administration/announcements/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!canManageAdministration(req.user!)) {
      res.status(403).json({
        error: 'Modification réservée à l’Administration du Centre CPGE.',
      });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }
    const existing = db
      .prepare('SELECT * FROM admin_announcements WHERE id = ?')
      .get(id) as
      | {
          id: number;
          category: string;
          target_audience: string;
          title: string;
          content: string;
          is_pinned: number;
        }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Annonce administrative introuvable.' });
      return;
    }
    const parsed = adminAnnouncementPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Paramètres de mise à jour invalides.' });
      return;
    }
    db.prepare(
      `UPDATE admin_announcements
       SET category = ?, target_audience = ?, title = ?, content = ?, is_pinned = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      parsed.data.category ?? existing.category,
      parsed.data.targetAudience ?? existing.target_audience,
      parsed.data.title ?? existing.title,
      parsed.data.content ?? existing.content,
      typeof parsed.data.isPinned === 'boolean' ? (parsed.data.isPinned ? 1 : 0) : existing.is_pinned,
      id
    );
    const updated = db.prepare('SELECT * FROM admin_announcements WHERE id = ?').get(id);
    res.json({ announcement: updated });
  });

  app.delete('/api/administration/announcements/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!canManageAdministration(req.user!)) {
      res.status(403).json({
        error: 'Suppression réservée à l’Administration du Centre CPGE.',
      });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }
    db.prepare('DELETE FROM admin_announcements WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // ─── Vite Dev Middleware or Static Production Build ──────────────────────
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html'));
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/documents/') || req.path.startsWith('/ressources/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Site Prépa server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

export { CLASS_CODES };
