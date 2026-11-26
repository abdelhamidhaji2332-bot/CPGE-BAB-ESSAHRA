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
  authenticateBearerToken,
  canAccessClassWorkspace,
  canManageAdministration,
  canManageCampusLife,
  canManageInternat,
  canManageProfTools,
  canSendClassMessage,
  hasAdminConfigured,
  hashPassword,
  isClassModerator,
  optionalAuth,
  requireAuth,
  signAuthToken,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { ensureCampusSeeded } from './server/db.ts';
import {
  RESSOURCES_ROOT,
  ensureRessourcesDirectories,
  syncRessourcesFolderToDb,
} from './server/ressourcesSync.ts';
import {
  createAdminAnnouncement,
  createCampusEvent,
  createClassAnnouncement,
  createClassMessageWithOptionalAnnouncement,
  createColloscopeSlot,
  createInternatNotice,
  createTimetableSlot,
  deleteAdminAnnouncement,
  deleteCampusEvent,
  deleteClassAnnouncement,
  deleteDocumentRecord,
  deleteInternatNotice,
  getClassNotifications,
  getClassOverviewData,
  getClassWorkspacePrivateData,
  getDocumentCountsByClass,
  insertClassActivity,
  insertDocument,
  listAdminAnnouncements,
  listCampusEvents,
  listDocumentsWithProgress,
  listInternatNotices,
  markClassNotificationsRead,
  toggleEventRegistration,
  updateAdminAnnouncement,
  updateClassAnnouncement,
  upsertDocumentProgress,
} from './src/db/campus.ts';
import {
  createCampusUser,
  deleteUserById,
  getFirstAdminUser,
  getUserAuthRowByEmail,
  getUserById,
  listAllUsers,
  updateUserRole,
} from './src/db/users.ts';
import {
  CAMPUS_CLASSES,
  CLASS_CODES,
  DOCUMENT_CATEGORY_LABELS,
  RESOURCE_CATEGORIES,
  getClassDefinition,
  isValidClassCode,
  type DocumentCategory,
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

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Serve generated/uploaded static documents safely
  app.use('/documents', express.static(DOCS_ROOT));
  app.use(
    '/ressources',
    express.static(RESSOURCES_ROOT, { dotfiles: 'ignore', index: false, redirect: false })
  );

  // Lazy on-demand database seed on API traffic (no eager startup probes)
  app.use('/api', async (req, res, next) => {
    if (req.path === '/health') {
      next();
      return;
    }
    try {
      await ensureCampusSeeded(PUBLIC_DIR);
      next();
    } catch (error) {
      console.error('Lazy seed failed:', error);
      res.status(503).json({ error: 'Base de données temporairement indisponible.' });
    }
  });

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

  async function recordClassActivity(
    classCode: string,
    kind: 'document' | 'announcement' | 'message' | 'timetable' | 'colloscope' | 'assignment',
    title: string,
    tabTarget: string,
    actorId: number | null
  ): Promise<void> {
    if (!isValidClassCode(classCode)) return;
    try {
      const created = await insertClassActivity({
        classCode,
        kind,
        title,
        tabTarget,
        actorId,
      });
      broadcastToClass(classCode, 'workspace:activity', created);
    } catch (error) {
      console.error('Failed to record class activity:', error);
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

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString('utf8')) as {
          type?: string;
          token?: string;
          classCode?: string;
        };
        if (msg.type === 'auth' && typeof msg.token === 'string' && typeof msg.classCode === 'string') {
          const verified = await authenticateBearerToken(msg.token);
          const user = verified?.user ?? null;
          const code = msg.classCode.toUpperCase();
          if (!user || !isValidClassCode(code) || !canAccessClassWorkspace(user, code)) {
            ws.send(
              JSON.stringify({
                event: 'error',
                payload: { message: 'Accès WebSocket refusé pour cette classe.' },
              })
            );
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

  app.get('/api/auth/status', async (_req, res) => {
    try {
      res.json(await hasAdminConfigured());
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur serveur.' });
    }
  });

  const bootstrapAdminSchema = z.object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    password: z.string().min(8).max(128),
  });

  app.post('/api/auth/bootstrap-admin', async (req, res) => {
    try {
      const status = await hasAdminConfigured();
      if (status.hasAdminUser || status.hasEnvPasscode) {
        res.status(409).json({ error: 'Un compte administrateur est déjà configuré sur ce campus.' });
        return;
      }
      const parsed = bootstrapAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Veuillez renseigner un nom, un email valide et un mot de passe (8 caractères min.).',
        });
        return;
      }

      const email = parsed.data.email.toLowerCase();
      const existing = await getUserAuthRowByEmail(email);
      if (existing) {
        res.status(409).json({ error: 'Cette adresse email est déjà enregistrée.' });
        return;
      }

      const user = await createCampusUser({
        fullName: parsed.data.fullName,
        email,
        passwordHash: hashPassword(parsed.data.password),
        role: 'admin',
        classCode: null,
      });

      const token = signAuthToken(user.id);
      res.status(201).json({ token, user });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur lors de la création du compte.' });
    }
  });

  const adminPasscodeSchema = z.object({
    passcode: z.string().min(1).max(128),
    fullName: z.string().trim().min(2).max(80).optional(),
    email: z.string().trim().email().max(120).optional(),
  });

  app.post('/api/auth/admin-passcode', async (req, res) => {
    try {
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

      let user = await getFirstAdminUser();
      if (!user) {
        const email = (parsed.data.email ?? 'admin@siteprepa.ma').toLowerCase();
        const name = parsed.data.fullName ?? 'Direction Campus';
        user = await createCampusUser({
          fullName: name,
          email,
          passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
          role: 'admin',
          classCode: null,
        });
      }

      const token = signAuthToken(user.id);
      res.json({ token, user });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur serveur.' });
    }
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

  app.post('/api/auth/login', async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Identifiants incomplets.' });
        return;
      }
      const email = parsed.data.email.toLowerCase();
      const row = await getUserAuthRowByEmail(email);

      if (!row || !row.passwordHash || !verifyPassword(parsed.data.password, row.passwordHash)) {
        res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        return;
      }

      const user = await getUserById(row.id);
      if (!user) {
        res.status(404).json({ error: 'Utilisateur introuvable.' });
        return;
      }
      const token = signAuthToken(row.id);
      res.json({ token, user });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur lors de la connexion.' });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // ─── Dev Team (Admin) Account & RBAC Management ──────────────────────────
  app.get('/api/admin/users', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Accès réservé exclusivement à l’Équipe Dev.' });
        return;
      }
      const users = await listAllUsers();
      res.json({ users });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de charger les comptes.' });
    }
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

  app.post('/api/admin/users', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
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
      if (await getUserAuthRowByEmail(email)) {
        res.status(409).json({ error: 'Email déjà utilisé.' });
        return;
      }
      const user = await createCampusUser({
        fullName: parsed.data.fullName,
        email,
        passwordHash: hashPassword(parsed.data.password),
        role: parsed.data.role,
        classCode: parsed.data.classCode ?? null,
        trinomeNumber: parsed.data.trinomeNumber ?? null,
        subjectSpecialty: parsed.data.subjectSpecialty ?? null,
      });
      res.status(201).json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur lors de la création du compte.' });
    }
  });

  const updateRoleSchema = z.object({
    role: z.enum(['etudiant', 'delegue', 'professeur', 'maitre_internat', 'bde', 'groupe_media', 'admin']),
    classCode: z.enum(['MPSI', 'PCSI1', 'PCSI2', 'ECS', 'MP', 'PSI1', 'PSI2', '2ECS']).nullable().optional(),
  });

  app.patch('/api/admin/users/:id/role', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
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
      const updated = await updateUserRole(
        targetId,
        parsed.data.role,
        parsed.data.classCode !== undefined ? parsed.data.classCode : null
      );
      if (!updated) {
        res.status(404).json({ error: 'Utilisateur introuvable.' });
        return;
      }
      res.json({ user: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur lors de la mise à jour.' });
    }
  });

  app.delete('/api/admin/users/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
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
      await deleteUserById(targetId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur lors de la suppression.' });
    }
  });

  // ─── Classes & Public Academic Library ───────────────────────────────────
  app.get('/api/classes', async (_req, res) => {
    try {
      const countMap = await getDocumentCountsByClass();
      const classes = CAMPUS_CLASSES.map((c) => ({
        ...c,
        documentCount: countMap.get(c.code) ?? 0,
        subjectCount: c.subjects.length,
      }));
      res.json({ classes });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de charger les classes.' });
    }
  });

  app.get('/api/documents', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await syncRessourcesFolderToDb();
      const classCode = typeof req.query.classCode === 'string' ? req.query.classCode.toUpperCase() : '';
      const category = typeof req.query.category === 'string' ? req.query.category : '';
      const scope = typeof req.query.scope === 'string' ? req.query.scope : '';
      const subjectSlug = typeof req.query.subjectSlug === 'string' ? req.query.subjectSlug : '';
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

      const rows = await listDocumentsWithProgress({
        userId: req.user?.id,
        classCode: classCode && isValidClassCode(classCode) ? classCode : undefined,
        isCampusOnly: classCode === 'CAMPUS',
        category:
          category && ALLOWED_DOC_CATEGORIES.includes(category as DocumentCategory)
            ? category
            : undefined,
        scope: scope || undefined,
        subjectSlug: subjectSlug || undefined,
        q: q || undefined,
      });

      res.json({ documents: rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de charger les documents.' });
    }
  });

  app.post('/api/documents/:id/progress', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const docId = Number(req.params.id);
      const status = req.body?.status;
      if (!Number.isInteger(docId) || !['a_faire', 'en_cours', 'maitrise'].includes(status)) {
        res.status(400).json({ error: 'Paramètres de progression invalides.' });
        return;
      }
      const updated = await upsertDocumentProgress(req.user!.id, docId, status);
      if (!updated) {
        res.status(404).json({ error: 'Document introuvable.' });
        return;
      }
      res.json({ ok: true, documentId: docId, status });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur lors de la mise à jour.' });
    }
  });

  app.post('/api/documents/upload', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
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
          error: 'Seuls les professeurs (et l’administration) peuvent publier les cours, TD, DS, résumés, CNC et CF.',
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
      const created = await insertDocument({
        classCode: isGuide ? null : classCodeRaw,
        subjectSlug: subjectSlug || null,
        category,
        title,
        chapter: chapter || DOCUMENT_CATEGORY_LABELS[category],
        description,
        filePath: publicUrlPath,
        fileSize: file.size,
        uploadedBy: req.user!.id,
      });

      if (isResourceCategory) {
        await syncRessourcesFolderToDb(true);
      }

      if (!isGuide && isValidClassCode(classCodeRaw)) {
        await recordClassActivity(
          classCodeRaw,
          'document',
          `${DOCUMENT_CATEGORY_LABELS[category]} : ${title}`,
          category === 'colloscopes' ? 'colloscope' : 'bibliotheque',
          req.user!.id
        );
      }
      res.status(201).json({ document: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur lors du dépôt du document.' });
    }
  });

  app.delete('/api/documents/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!canManageProfTools(req.user!)) {
        res.status(403).json({ error: 'Suppression réservée aux professeurs et à l’administration.' });
        return;
      }
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Identifiant de document invalide.' });
        return;
      }
      const deleted = await deleteDocumentRecord(id);
      if (!deleted) {
        res.status(404).json({ error: 'Document introuvable.' });
        return;
      }

      const isRessourceFile = deleted.filePath.startsWith('/ressources/');
      const baseDir = isRessourceFile ? RESSOURCES_ROOT : DOCS_ROOT;
      const rawRel = deleted.filePath.replace(/^\/(?:ressources|documents)\/+/, '');
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
        await syncRessourcesFolderToDb(true);
      }
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur lors de la suppression.' });
    }
  });

  // ─── Per-Class Workspace (Public Overview + Private Protected Data) ─────
  app.get('/api/classes/:classCode/overview', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const code = req.params.classCode.toUpperCase();
      const classDef = getClassDefinition(code);
      if (!classDef) {
        res.status(404).json({ error: 'Classe CPGE introuvable.' });
        return;
      }

      const data = await getClassOverviewData(code, req.user?.id);
      res.json({
        class: classDef,
        documents: data.documents,
        timetables: data.timetables,
        colloscopes: data.colloscopes,
        canAccessPrivate: req.user ? canAccessClassWorkspace(req.user, code) : false,
        isModerator: req.user ? isClassModerator(req.user, code) : false,
        canSendMessages: req.user ? canSendClassMessage(req.user, code) : false,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de charger la classe.' });
    }
  });

  app.get('/api/classes/:classCode/workspace-private', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
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

      const data = await getClassWorkspacePrivateData(code);
      res.json({
        timetables: data.timetables,
        colloscopes: data.colloscopes,
        announcements: data.announcements,
        messages: data.messages,
        isModerator: isClassModerator(req.user!, code),
        canSendMessages: canSendClassMessage(req.user!, code),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de charger l’espace classe.' });
    }
  });

  // Moderator announcements CRUD
  const announcementSchema = z.object({
    title: z.string().trim().min(3).max(140),
    content: z.string().trim().min(3).max(2000),
    isPinned: z.boolean().optional(),
  });

  app.post('/api/classes/:classCode/announcements', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const code = req.params.classCode.toUpperCase();
      if (!isValidClassCode(code) || !isClassModerator(req.user!, code)) {
        res.status(403).json({
          error: 'Publication réservée aux modérateurs de la classe (Délégués, Professeurs, Administration).',
        });
        return;
      }
      const parsed = announcementSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Titre et contenu de l’annonce requis.' });
        return;
      }
      const announcement = await createClassAnnouncement({
        classCode: code,
        authorId: req.user!.id,
        authorName: req.user!.fullName,
        authorRole: req.user!.role,
        title: parsed.data.title,
        content: parsed.data.content,
        isPinned: Boolean(parsed.data.isPinned),
      });
      broadcastToClass(code, 'announcement:created', announcement);
      await recordClassActivity(code, 'announcement', parsed.data.title, 'annonces', req.user!.id);
      res.status(201).json({ announcement });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de publier l’annonce.' });
    }
  });

  app.patch('/api/classes/:classCode/announcements/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const code = req.params.classCode.toUpperCase();
      const id = Number(req.params.id);
      if (!isValidClassCode(code) || !Number.isInteger(id) || !isClassModerator(req.user!, code)) {
        res.status(403).json({ error: 'Action réservée aux modérateurs de la classe.' });
        return;
      }
      const updated = await updateClassAnnouncement(id, code, {
        title: typeof req.body.title === 'string' ? req.body.title : undefined,
        content: typeof req.body.content === 'string' ? req.body.content : undefined,
        isPinned: typeof req.body.isPinned === 'boolean' ? req.body.isPinned : undefined,
      });
      if (!updated) {
        res.status(404).json({ error: 'Annonce introuvable.' });
        return;
      }
      broadcastToClass(code, 'announcement:updated', updated);
      await recordClassActivity(
        code,
        'announcement',
        `Annonce mise à jour : ${updated.title}`,
        'annonces',
        req.user!.id
      );
      res.json({ announcement: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de modifier l’annonce.' });
    }
  });

  app.delete('/api/classes/:classCode/announcements/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const code = req.params.classCode.toUpperCase();
      const id = Number(req.params.id);
      if (!isValidClassCode(code) || !Number.isInteger(id) || !isClassModerator(req.user!, code)) {
        res.status(403).json({ error: 'Suppression réservée aux modérateurs de la classe.' });
        return;
      }
      await deleteClassAnnouncement(id, code);
      broadcastToClass(code, 'announcement:deleted', { id });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de supprimer l’annonce.' });
    }
  });

  // Real-time Class Chat + Moderator Broadcast Sync
  const chatMessageSchema = z.object({
    content: z.string().trim().min(1).max(1500),
    isAnnouncement: z.boolean().optional(),
    announcementTitle: z.string().trim().max(140).optional(),
  });

  app.post('/api/classes/:classCode/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const code = req.params.classCode.toUpperCase();
      if (!isValidClassCode(code) || !canSendClassMessage(req.user!, code)) {
        res.status(403).json({
          error: 'Seul le délégué de la classe est autorisé à envoyer des messages dans ce canal.',
        });
        return;
      }
      const parsed = chatMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Message invalide.' });
        return;
      }

      const wantsAnnouncement = Boolean(parsed.data.isAnnouncement);
      if (wantsAnnouncement && !isClassModerator(req.user!, code)) {
        res.status(403).json({
          error: 'Seuls les modérateurs (Délégués, Professeurs, Administration) peuvent diffuser une Annonce Modérateur.',
        });
        return;
      }

      const { createdMessage, createdAnnouncement } =
        await createClassMessageWithOptionalAnnouncement({
          classCode: code,
          authorId: req.user!.id,
          authorName: req.user!.fullName,
          authorRole: req.user!.role,
          content: parsed.data.content,
          isAnnouncement: wantsAnnouncement,
          announcementTitle: parsed.data.announcementTitle,
        });

      broadcastToClass(code, 'message:created', createdMessage);
      if (createdAnnouncement) {
        broadcastToClass(code, 'announcement:created', createdAnnouncement);
        await recordClassActivity(
          code,
          'announcement',
          parsed.data.announcementTitle?.trim() || `Annonce Modérateur — ${req.user!.fullName}`,
          'annonces',
          req.user!.id
        );
      } else {
        await recordClassActivity(
          code,
          'message',
          `${req.user!.fullName} : ${parsed.data.content.slice(0, 72)}`,
          'chat',
          req.user!.id
        );
      }

      res.status(201).json({ message: createdMessage, announcement: createdAnnouncement });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible d’envoyer le message.' });
    }
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

  app.post('/api/classes/:classCode/timetable', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
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
      const slot = await createTimetableSlot({
        classCode: code,
        semester: parsed.data.semester,
        dayOfWeek: parsed.data.dayOfWeek,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        sessionType: parsed.data.sessionType,
        subjectSlug: parsed.data.subjectSlug,
        subjectName: parsed.data.subjectName,
        room: parsed.data.room,
        professorName: parsed.data.professorName || req.user!.fullName,
      });
      await recordClassActivity(
        code,
        'timetable',
        `Emploi du temps (${parsed.data.dayOfWeek} ${parsed.data.startTime}) : ${parsed.data.subjectName}`,
        'emploi-du-temps',
        req.user!.id
      );
      res.status(201).json({ slot });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible d’ajouter ce créneau.' });
    }
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

  app.post('/api/classes/:classCode/colloscope', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
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
      const entry = await createColloscopeSlot({
        classCode: code,
        weekNumber: parsed.data.weekNumber,
        weekLabel: `Semaine ${parsed.data.weekNumber}`,
        trinomeNumber: parsed.data.trinomeNumber,
        subjectSlug: parsed.data.subjectSlug,
        subjectName: parsed.data.subjectName,
        kholleurName: parsed.data.kholleurName,
        dayTime: parsed.data.dayTime,
        room: parsed.data.room,
      });
      await recordClassActivity(
        code,
        'colloscope',
        `Colloscope S${parsed.data.weekNumber} · Trinôme ${parsed.data.trinomeNumber} (${parsed.data.subjectName})`,
        'colloscope',
        req.user!.id
      );
      res.status(201).json({ entry });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible d’ajouter la khôlle.' });
    }
  });

  // ─── Class Workspace Notifications ───────────────────────────────────────
  app.get('/api/classes/:classCode/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const code = req.params.classCode.toUpperCase();
      if (!isValidClassCode(code) || !canAccessClassWorkspace(req.user!, code)) {
        res.status(403).json({ error: 'Accès notifications réservé aux membres de la classe.' });
        return;
      }
      res.json(await getClassNotifications(req.user!.id, code));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de charger les notifications.' });
    }
  });

  app.post('/api/classes/:classCode/notifications/mark-read', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const code = req.params.classCode.toUpperCase();
      if (!isValidClassCode(code) || !canAccessClassWorkspace(req.user!, code)) {
        res.status(403).json({ error: 'Accès notifications réservé aux membres de la classe.' });
        return;
      }
      const lastSeenId = await markClassNotificationsRead(req.user!.id, code);
      res.json({ ok: true, classCode: code, lastSeenId });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur lors du marquage.' });
    }
  });

  // ─── Internat Hub ────────────────────────────────────────────────────────
  app.get('/api/internat', async (_req, res) => {
    try {
      res.json({ notices: await listInternatNotices() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de charger les avis internat.' });
    }
  });

  const internatSchema = z.object({
    pavillon: z.string().trim().min(2).max(80),
    category: z.enum(['Horaire', 'Permanence', 'Maintenance', 'Annonce']),
    title: z.string().trim().min(3).max(140),
    content: z.string().trim().min(3).max(2000),
    isPinned: z.boolean().optional(),
  });

  app.post('/api/internat', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!canManageInternat(req.user!)) {
        res.status(403).json({ error: 'Réservé aux Maîtres d’internat et à l’administration.' });
        return;
      }
      const parsed = internatSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Champs de note d’internat invalides.' });
        return;
      }
      const notice = await createInternatNotice({
        pavillon: parsed.data.pavillon,
        category: parsed.data.category,
        title: parsed.data.title,
        content: parsed.data.content,
        isPinned: Boolean(parsed.data.isPinned),
        authorId: req.user!.id,
        authorName: req.user!.fullName,
      });
      res.status(201).json({ notice });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de publier la note.' });
    }
  });

  app.delete('/api/internat/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!canManageInternat(req.user!)) {
        res.status(403).json({ error: 'Suppression réservée aux Maîtres d’internat et à l’administration.' });
        return;
      }
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Identifiant invalide.' });
        return;
      }
      await deleteInternatNotice(id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de supprimer la note.' });
    }
  });

  // ─── Vie Campus (BDE & Groupe Média) ─────────────────────────────────────
  app.get('/api/events', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      res.json({ events: await listCampusEvents(req.user?.id) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de charger les événements.' });
    }
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

  app.post('/api/events', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!canManageCampusLife(req.user!)) {
        res.status(403).json({ error: 'Publication réservée au BDE, au Groupe Média et à l’administration.' });
        return;
      }
      const parsed = eventSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Informations d’événement invalides (vérifiez aussi le lien Instagram https://).',
        });
        return;
      }
      const created = await createCampusEvent({
        organizerGroup: parsed.data.organizerGroup,
        eventType: parsed.data.eventType,
        title: parsed.data.title,
        summary: parsed.data.summary,
        content: parsed.data.content,
        eventDate: parsed.data.eventDate,
        location: parsed.data.location,
        capacity: parsed.data.capacity ?? 120,
        instagramUrl: parsed.data.instagramUrl ?? '',
        authorId: req.user!.id,
      });
      res.status(201).json({ event: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de publier l’événement.' });
    }
  });

  app.delete('/api/events/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!canManageCampusLife(req.user!)) {
        res.status(403).json({ error: 'Suppression réservée au BDE, au Groupe Média et à l’administration.' });
        return;
      }
      const eventId = Number(req.params.id);
      if (!Number.isInteger(eventId) || eventId <= 0) {
        res.status(400).json({ error: 'Identifiant invalide.' });
        return;
      }
      await deleteCampusEvent(eventId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de supprimer l’événement.' });
    }
  });

  app.post('/api/events/:id/register', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const eventId = Number(req.params.id);
      if (!Number.isInteger(eventId)) {
        res.status(400).json({ error: 'Identifiant invalide.' });
        return;
      }
      const result = await toggleEventRegistration(eventId, req.user!.id);
      if (result.status === 'not_found') {
        res.status(404).json({ error: 'Événement introuvable.' });
        return;
      }
      if (result.status === 'full') {
        res.status(409).json({ error: 'Capacité maximale atteinte pour cet événement.' });
        return;
      }
      res.json({ event: result.event });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur lors de l’inscription.' });
    }
  });

  // ─── Administration — Annonces Officielles ──────────────────────────────
  app.get('/api/administration/announcements', async (_req, res) => {
    try {
      res.json({ announcements: await listAdminAnnouncements() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de charger les annonces.' });
    }
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

  app.post('/api/administration/announcements', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!canManageAdministration(req.user!)) {
        res.status(403).json({ error: 'Publication réservée à l’Administration du Centre CPGE.' });
        return;
      }
      const parsed = adminAnnouncementSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Champs de l’annonce officielle invalides.' });
        return;
      }
      const announcement = await createAdminAnnouncement({
        category: parsed.data.category,
        targetAudience: parsed.data.targetAudience || 'Toutes les classes',
        title: parsed.data.title,
        content: parsed.data.content,
        isPinned: Boolean(parsed.data.isPinned),
        authorId: req.user!.id,
        authorName: req.user!.fullName,
      });
      res.status(201).json({ announcement });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de publier la note.' });
    }
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

  app.patch('/api/administration/announcements/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!canManageAdministration(req.user!)) {
        res.status(403).json({ error: 'Modification réservée à l’Administration du Centre CPGE.' });
        return;
      }
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Identifiant invalide.' });
        return;
      }
      const parsed = adminAnnouncementPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Paramètres de mise à jour invalides.' });
        return;
      }
      const updated = await updateAdminAnnouncement(id, parsed.data);
      if (!updated) {
        res.status(404).json({ error: 'Annonce administrative introuvable.' });
        return;
      }
      res.json({ announcement: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de modifier la note.' });
    }
  });

  app.delete('/api/administration/announcements/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!canManageAdministration(req.user!)) {
        res.status(403).json({ error: 'Suppression réservée à l’Administration du Centre CPGE.' });
        return;
      }
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Identifiant invalide.' });
        return;
      }
      await deleteAdminAnnouncement(id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Impossible de supprimer la note.' });
    }
  });

  // ─── Vite Dev Middleware or Static Production Build ──────────────────────
  const isProd =
    process.env.NODE_ENV === 'production' &&
    fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html'));
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
      plugins: [
        {
          name: 'disable-hmr-client-ws',
          enforce: 'post',
          transform(code, id) {
            if (
              id.includes('vite/dist/client/client.mjs') ||
              id.includes('vite\\dist\\client\\client.mjs')
            ) {
              return {
                code: code.replace(
                  /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
                  'const transport = normalizeModuleRunnerTransport({ connect() {}, disconnect() {}, send() {} });'
                ),
                map: null,
              };
            }
          },
        },
      ],
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/documents/') ||
        req.path.startsWith('/ressources/')
      ) {
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
