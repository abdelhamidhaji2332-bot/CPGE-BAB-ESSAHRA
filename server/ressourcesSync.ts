import { eq, like } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { db } from '../src/db/index.ts';
import { documents } from '../src/db/schema.ts';
import {
  CAMPUS_CLASSES,
  RESOURCE_CATEGORIES,
  RESOURCE_CATEGORY_LABELS,
  getClassDefinition,
  isValidClassCode,
  type ResourceCategory,
} from '../src/shared/curriculum.ts';

export const RESSOURCES_ROOT = path.resolve(process.cwd(), 'ressources');

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.txt',
  '.md',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.zip',
  '.py',
]);

let lastSyncTimestamp = 0;
const SYNC_COOLDOWN_MS = 500;

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveInsideDir(baseDir: string, ...segments: string[]): string | null {
  const target = path.resolve(baseDir, ...segments);
  const normalizedBase = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
  if (!target.startsWith(normalizedBase)) {
    return null;
  }
  return target;
}

function buildReadmeContent(): string {
  const lines: string[] = [
    '# Dossier `ressources/` — Bibliothèque Pédagogique Site Prépa',
    '',
    'Déposez vos fichiers pédagogiques (PDF, images, supports de cours/TD/DS) directement dans le dossier correspondant pour qu’ils apparaissent automatiquement sur la page **Ressources** du site.',
    '',
    '## Structure des dossiers',
    '',
    '```',
    'ressources/<CLASSE>/<MATIERE>/<CATEGORIE>/<votre-fichier.pdf>',
    '```',
    '',
    '- **Catégories disponibles** : `cours` (Cours), `td` (TD), `ds` (DS), `resume` (Résumé), `cnc` (CNC Spé), `cf` (CF Spé)',
    '- **Classes CPGE** :',
    '',
  ];

  for (const cls of CAMPUS_CLASSES) {
    lines.push(`### ${cls.code} — ${cls.levelLabel}`);
    for (const subj of cls.subjects) {
      lines.push(
        `- \`ressources/${cls.code}/${subj.slug}/\` → ${RESOURCE_CATEGORIES.map((c) => `\`${c}\``).join(', ')} (${subj.name})`
      );
    }
    lines.push('');
  }

  lines.push(
    '## Formats acceptés',
    '`.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.txt`, `.md`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx`, `.zip`, `.py`',
    '',
    'Les fichiers commençant par `.` (comme `.gitkeep`) et ce fichier `README.md` sont ignorés automatiquement.',
    ''
  );

  return lines.join('\n');
}

export function ensureRessourcesDirectories(): void {
  ensureDir(RESSOURCES_ROOT);

  const readmePath = path.join(RESSOURCES_ROOT, 'README.md');
  const nextReadme = buildReadmeContent();
  if (!fs.existsSync(readmePath) || fs.readFileSync(readmePath, 'utf8') !== nextReadme) {
    fs.writeFileSync(readmePath, nextReadme, 'utf8');
  }

  for (const cls of CAMPUS_CLASSES) {
    for (const subj of cls.subjects) {
      for (const cat of RESOURCE_CATEGORIES) {
        const leafDir = path.join(RESSOURCES_ROOT, cls.code, subj.slug, cat);
        ensureDir(leafDir);
        const gitkeepPath = path.join(leafDir, '.gitkeep');
        if (!fs.existsSync(gitkeepPath)) {
          fs.writeFileSync(gitkeepPath, '', 'utf8');
        }
      }
    }
  }
}

function formatTitleFromFilename(fileName: string): string {
  const ext = path.extname(fileName);
  const stem = fileName.slice(0, fileName.length - ext.length);
  const spaced = stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return fileName;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface ScannedResourceFile {
  classCode: string;
  subjectSlug: string | null;
  category: ResourceCategory;
  title: string;
  chapter: string;
  description: string;
  filePath: string;
  fileSize: number;
}

function collectFilesRecursively(
  dir: string,
  baseSegments: string[],
  out: Array<{ relSegments: string[]; absPath: string; size: number }>
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isSymbolicLink()) continue;

    const absPath = resolveInsideDir(RESSOURCES_ROOT, ...baseSegments, entry.name);
    if (!absPath) continue;

    if (entry.isDirectory()) {
      collectFilesRecursively(absPath, [...baseSegments, entry.name], out);
    } else if (entry.isFile()) {
      if (baseSegments.length === 0 && entry.name.toLowerCase() === 'readme.md') {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      try {
        const stat = fs.statSync(absPath);
        out.push({
          relSegments: [...baseSegments, entry.name],
          absPath,
          size: stat.size,
        });
      } catch {
        // Skip unreadable files
      }
    }
  }
}

function parseScannedFile(relSegments: string[], size: number): ScannedResourceFile | null {
  if (relSegments.length < 3) return null;

  const rawClass = relSegments[0].toUpperCase();
  if (!isValidClassCode(rawClass)) return null;

  const classDef = getClassDefinition(rawClass);
  if (!classDef) return null;

  const categorySet = new Set<string>(RESOURCE_CATEGORIES);
  let subjectSlug: string | null = null;
  let category: ResourceCategory | null = null;
  let extraSegments: string[] = [];

  if (relSegments.length >= 4 && categorySet.has(relSegments[2].toLowerCase())) {
    const candidateSubject = relSegments[1].toLowerCase();
    const matchedSubject = classDef.subjects.find((s) => s.slug === candidateSubject);
    subjectSlug = matchedSubject ? matchedSubject.slug : candidateSubject;
    category = relSegments[2].toLowerCase() as ResourceCategory;
    extraSegments = relSegments.slice(3, -1);
  } else if (categorySet.has(relSegments[1].toLowerCase())) {
    category = relSegments[1].toLowerCase() as ResourceCategory;
    extraSegments = relSegments.slice(2, -1);
  } else {
    return null;
  }

  const fileName = relSegments[relSegments.length - 1];
  const encodedUrlPath = `/ressources/${relSegments.map((seg) => encodeURIComponent(seg)).join('/')}`;
  const subjectName = subjectSlug
    ? classDef.subjects.find((s) => s.slug === subjectSlug)?.name || subjectSlug
    : '';
  const chapter =
    extraSegments.length > 0
      ? extraSegments.join(' · ')
      : subjectName || RESOURCE_CATEGORY_LABELS[category];

  return {
    classCode: rawClass,
    subjectSlug,
    category,
    title: formatTitleFromFilename(fileName),
    chapter,
    description: `Support ${RESOURCE_CATEGORY_LABELS[category]} — ${classDef.code}${subjectName ? ` (${subjectName})` : ''}.`,
    filePath: encodedUrlPath,
    fileSize: size,
  };
}

export async function syncRessourcesFolderToDb(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSyncTimestamp < SYNC_COOLDOWN_MS) {
    return;
  }
  lastSyncTimestamp = now;

  if (!fs.existsSync(RESSOURCES_ROOT)) {
    return;
  }

  const rawFiles: Array<{ relSegments: string[]; absPath: string; size: number }> = [];
  collectFilesRecursively(RESSOURCES_ROOT, [], rawFiles);

  const scannedMap = new Map<string, ScannedResourceFile>();
  for (const f of rawFiles) {
    const parsed = parseScannedFile(f.relSegments, f.size);
    if (parsed) {
      scannedMap.set(parsed.filePath, parsed);
    }
  }

  try {
    const existingRows = await db
      .select({
        id: documents.id,
        filePath: documents.filePath,
        fileSize: documents.fileSize,
      })
      .from(documents)
      .where(like(documents.filePath, '/ressources/%'));

    const existingByPath = new Map(existingRows.map((row) => [row.filePath, row]));

    await db.transaction(async (tx) => {
      for (const [filePath, item] of scannedMap.entries()) {
        const existing = existingByPath.get(filePath);
        if (!existing) {
          await tx.insert(documents).values({
            classCode: item.classCode,
            subjectSlug: item.subjectSlug,
            category: item.category,
            title: item.title,
            chapter: item.chapter,
            description: item.description,
            filePath: item.filePath,
            fileSize: item.fileSize,
            uploadedBy: null,
          });
        } else if (existing.fileSize !== item.fileSize) {
          await tx
            .update(documents)
            .set({ fileSize: item.fileSize })
            .where(eq(documents.id, existing.id));
        }
      }

      for (const row of existingRows) {
        if (!scannedMap.has(row.filePath)) {
          await tx.delete(documents).where(eq(documents.id, row.id));
        }
      }
    });
  } catch (error) {
    console.error('Failed to sync ressources folder to Cloud SQL:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
