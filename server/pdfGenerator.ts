import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { CAMPUS_CLASSES, DOCUMENT_CATEGORY_LABELS, type ClassDefinition, type DocumentCategory } from '../src/shared/curriculum.ts';

export interface GeneratedPdfSpec {
  relativePath: string; // e.g. documents/colloscopes/MPSI/colloscope-s1.pdf
  classCode: string | null;
  subjectSlug: string | null;
  category: DocumentCategory;
  title: string;
  chapter: string;
  description: string;
  lines: string[];
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function ensureDocumentDirectories(publicDir: string): void {
  const docRoot = path.join(publicDir, 'documents');
  const topFolders = ['colloscopes', 'cours', 'td', 'ds', 'concours-blancs', 'corriges', 'guides'];
  for (const folder of topFolders) {
    ensureDir(path.join(docRoot, folder));
  }

  for (const cls of CAMPUS_CLASSES) {
    for (const folder of ['colloscopes', 'td', 'ds', 'concours-blancs', 'corriges']) {
      ensureDir(path.join(docRoot, folder, cls.code));
    }
    for (const subj of cls.subjects) {
      if (subj.slug === 'eps') continue;
      ensureDir(path.join(docRoot, 'cours', cls.code, subj.slug));
    }
  }
}

export async function writePdfFile(absPath: string, title: string, subtitle: string, lines: string[]): Promise<number> {
  ensureDir(path.dirname(absPath));
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 54 });
    const stream = fs.createWriteStream(absPath);

    doc.pipe(stream);

    // Header band
    doc.rect(0, 0, doc.page.width, 86).fill('#0b0b0b');
    doc.fillColor('#ffa582').fontSize(10).font('Helvetica-Bold').text('SITE PRÉPA · CAMPUS CPGE MAROC', 54, 26);
    doc.fillColor('#f5f5f5').fontSize(18).font('Helvetica-Bold').text(title, 54, 44, { width: 490 });

    doc.moveDown(2.5);
    doc.fillColor('#444444').fontSize(10).font('Helvetica-Bold').text(subtitle, 54, 108);
    doc
      .moveTo(54, 126)
      .lineTo(doc.page.width - 54, 126)
      .strokeColor('#d4d4d8')
      .lineWidth(0.8)
      .stroke();

    let y = 144;
    doc.fillColor('#18181b').fontSize(11).font('Helvetica');
    for (const line of lines) {
      if (y > doc.page.height - 90) {
        doc.addPage();
        y = 54;
      }
      if (line.startsWith('## ')) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#09090b').text(line.slice(3), 54, y);
        y = doc.y + 8;
        doc.font('Helvetica').fontSize(10.5).fillColor('#27272a');
      } else {
        doc.text(line, 54, y, { width: doc.page.width - 108, lineGap: 4 });
        y = doc.y + 6;
      }
    }

    doc
      .fontSize(8.5)
      .fillColor('#71717a')
      .text(
        'Document pédagogique — Site Prépa (Support structuré conforme au référentiel officiel CPGE)',
        54,
        doc.page.height - 46,
        { align: 'center', width: doc.page.width - 108 }
      );

    doc.end();

    stream.on('finish', () => {
      try {
        const stat = fs.statSync(absPath);
        resolve(stat.size);
      } catch (err) {
        reject(err);
      }
    });
    stream.on('error', reject);
  });
}

function buildStarterSpecs(): GeneratedPdfSpec[] {
  const specs: GeneratedPdfSpec[] = [
    {
      relativePath: 'documents/guides/guide-rentree-cpge.pdf',
      classCode: null,
      subjectSlug: null,
      category: 'guides',
      title: 'Guide d’accueil et d’organisation en CPGE',
      chapter: 'Orientation & Méthodologie',
      description: 'Repères pratiques pour la rentrée en Sup/Spé : rythme des khôlles, DS hebdomadaires et organisation du travail.',
      lines: [
        '## 1. Rythme hebdomadaire en CPGE',
        'L’année préparatoire s’articule autour des cours magistraux, des séances de travaux dirigés (TD), des travaux pratiques (TP), des devoirs surveillés (DS) du samedi matin et des interrogations orales hebdomadaires (khôlles).',
        '## 2. Préparation des khôlles par trinôme',
        'Consultez le colloscope interactif de votre classe pour connaître la rotation exacte de votre trinôme, la matière évaluée, le nom du khôlleur, le créneau et la salle attribuée.',
        '## 3. Cahier de préparation et fiches de synthèse',
        'Chaque chapitre publié dans la bibliothèque pédagogique est accompagné d’une feuille de TD et d’un corrigé type après la séance.',
      ],
    },
    {
      relativePath: 'documents/guides/reglement-interieur-internat.pdf',
      classCode: null,
      subjectSlug: null,
      category: 'guides',
      title: 'Règlement et horaires de l’Internat',
      chapter: 'Vie en internat',
      description: 'Horaires des études du soir, créneaux de restauration, permanence des maîtres d’internat et règles de vie collective.',
      lines: [
        '## 1. Horaires types de la semaine',
        '• Petit-déjeuner : 07h00 – 07h45',
        '• Déjeuner : 12h15 – 13h30',
        '• Étude encadrée et travail en salle : 18h30 – 20h00 puis 21h00 – 22h30',
        '• Dîner : 20h00 – 20h55',
        '• Extinction des feux / silence des pavillons : 23h15',
        '## 2. Permanence des Maîtres d’internat',
        'Les maîtres d’internat assurent le suivi des présences, les sorties exceptionnelles autorisées et la diffusion des avis techniques via le portail Internat.',
      ],
    },
    {
      relativePath: 'documents/guides/methodologie-tipe-cnc.pdf',
      classCode: null,
      subjectSlug: null,
      category: 'guides',
      title: 'Méthodologie TIPE — Préparation CNC & Concours',
      chapter: 'TIPE',
      description: 'Calendrier des jalons TIPE (démarrage au S2 en Sup, soutenance en Spé) et structure attendue du dossier.',
      lines: [
        '## 1. Ancrage scientifique et problématique',
        'Un sujet de TIPE doit reposer sur une démarche expérimentale, théorique ou numérique mesurable, avec un apport personnel clairement identifié.',
        '## 2. Jalons de l’année',
        '• Semestre 2 (Sup) : choix du thème, bibliographie et premières manipulations.',
        '• Trimestre 1 (Spé) : mise en œuvre du protocole et modélisation Python / SII.',
        '• Trimestre 2 (Spé) : répétitions de soutenance et finalisation de la MCOT.',
      ],
    },
  ];

  for (const cls of CAMPUS_CLASSES) {
    specs.push({
      relativePath: `documents/colloscopes/${cls.code}/colloscope-${cls.code.toLowerCase()}-s1.pdf`,
      classCode: cls.code,
      subjectSlug: null,
      category: 'colloscopes',
      title: `Colloscope Officiel — Classe ${cls.code}`,
      chapter: 'Semestre 1',
      description: `Calendrier hebdomadaire des rotations de khôlles par trinôme pour la classe ${cls.code} (${cls.levelLabel}).`,
      lines: [
        `## Classe ${cls.code} — ${cls.filiere}`,
        `Niveau : ${cls.levelLabel}`,
        '## Modalités générales des khôlles',
        'Les interrogations orales se déroulent par trinômes selon les rotations hebdomadaires affichées dans l’onglet Colloscope Interactif.',
        'Toute permutation exceptionnelle entre trinômes doit être validée au préalable par les délégués et le professeur concerné.',
      ],
    });
  }

  return specs;
}

export async function seedStarterPdfAssets(publicDir: string): Promise<Array<GeneratedPdfSpec & { fileSize: number }>> {
  ensureDocumentDirectories(publicDir);
  const specs = buildStarterSpecs();
  const results: Array<GeneratedPdfSpec & { fileSize: number }> = [];

  for (const spec of specs) {
    const absPath = path.join(publicDir, spec.relativePath);
    let fileSize = 0;
    if (!fs.existsSync(absPath)) {
      const catLabel = DOCUMENT_CATEGORY_LABELS[spec.category] ?? spec.category;
      const sub = `${catLabel}${spec.classCode ? ` · Classe ${spec.classCode}` : ' · Campus'}${spec.chapter ? ` · ${spec.chapter}` : ''}`;
      fileSize = await writePdfFile(absPath, spec.title, sub, spec.lines);
    } else {
      fileSize = fs.statSync(absPath).size;
    }
    results.push({ ...spec, fileSize });
  }
  return results;
}

export function getClassDocumentFileName(cls: ClassDefinition, name: string): string {
  return `${cls.code.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
}
