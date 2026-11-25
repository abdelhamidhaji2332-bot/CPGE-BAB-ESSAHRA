import { and, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { db } from '../src/db/index.ts';
import {
  adminAnnouncements,
  campusEvents,
  classColloscopes,
  classes,
  classSubjects,
  classTimetables,
  documents,
  infoAssignments,
  internatNotices,
} from '../src/db/schema.ts';
import { CAMPUS_CLASSES, type ClassCode } from '../src/shared/curriculum.ts';
import { seedStarterPdfAssets } from './pdfGenerator.ts';
import { syncRessourcesFolderToDb } from './ressourcesSync.ts';

let isSeeded = false;
let seedInFlight: Promise<void> | null = null;

export async function ensureCampusSeeded(publicDir: string): Promise<void> {
  if (isSeeded) return;
  if (seedInFlight) return seedInFlight;

  seedInFlight = seedCampusDatabase(publicDir)
    .then(() => {
      isSeeded = true;
    })
    .catch((err) => {
      seedInFlight = null;
      throw err;
    });

  return seedInFlight;
}

export async function seedCampusDatabase(publicDir: string): Promise<void> {
  try {
    // 1. Sync classes & subjects
    for (const cls of CAMPUS_CLASSES) {
      await db
        .insert(classes)
        .values({
          code: cls.code,
          level: cls.level,
          levelLabel: cls.levelLabel,
          filiere: cls.filiere,
          shortTrack: cls.shortTrack,
          description: cls.description,
        })
        .onConflictDoUpdate({
          target: classes.code,
          set: {
            level: cls.level,
            levelLabel: cls.levelLabel,
            filiere: cls.filiere,
            shortTrack: cls.shortTrack,
            description: cls.description,
          },
        });

      for (let idx = 0; idx < cls.subjects.length; idx++) {
        const sub = cls.subjects[idx];
        await db
          .insert(classSubjects)
          .values({
            classCode: cls.code,
            slug: sub.slug,
            name: sub.name,
            description: sub.description,
            sortOrder: idx,
          })
          .onConflictDoUpdate({
            target: [classSubjects.classCode, classSubjects.slug],
            set: {
              name: sub.name,
              description: sub.description,
              sortOrder: idx,
            },
          });
      }
    }

    // 2. Remove stale un-authored starter documents in /documents
    const stalePlaceholders = await db
      .select({ id: documents.id, filePath: documents.filePath })
      .from(documents)
      .where(
        and(
          isNull(documents.uploadedBy),
          like(documents.filePath, '/documents/%'),
          inArray(documents.category, ['cours', 'td', 'ds', 'concours-blancs', 'corriges'])
        )
      );

    if (stalePlaceholders.length > 0) {
      await db
        .delete(documents)
        .where(
          and(
            isNull(documents.uploadedBy),
            like(documents.filePath, '/documents/%'),
            inArray(documents.category, ['cours', 'td', 'ds', 'concours-blancs', 'corriges'])
          )
        );
      for (const row of stalePlaceholders) {
        const rel = row.filePath.replace(/^\/+/, '');
        const absTarget = path.resolve(publicDir, rel);
        const docsRoot = path.resolve(publicDir, 'documents') + path.sep;
        if (absTarget.startsWith(docsRoot) && fs.existsSync(absTarget)) {
          try {
            fs.unlinkSync(absTarget);
          } catch {
            // Ignore unlink errors
          }
        }
      }
    }

    // Generate starter colloscope/guide PDF files on disk and register missing ones
    const generatedAssets = await seedStarterPdfAssets(publicDir);
    const existingDocRows = await db.select({ filePath: documents.filePath }).from(documents);
    const existingPaths = new Set(existingDocRows.map((r) => r.filePath));

    for (const asset of generatedAssets) {
      const urlPath = `/${asset.relativePath}`;
      if (!existingPaths.has(urlPath)) {
        await db.insert(documents).values({
          classCode: asset.classCode,
          subjectSlug: asset.subjectSlug,
          category: asset.category,
          title: asset.title,
          chapter: asset.chapter,
          description: asset.description,
          filePath: urlPath,
          fileSize: asset.fileSize,
        });
      }
    }

    // 3. Seed structural timetables if empty
    const ttCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classTimetables);
    if ((ttCountRows[0]?.count ?? 0) === 0) {
      const ttValues: Array<typeof classTimetables.$inferInsert> = [];
      for (const cls of CAMPUS_CLASSES) {
        const isEcs = cls.code === 'ECS' || cls.code === '2ECS';
        const mainA = cls.subjects[0];
        const mainB = cls.subjects[1];
        const mainC = cls.subjects[2];
        const infoSub = cls.subjects.find((s) => s.slug === 'informatique') ?? mainB;
        const frSub = cls.subjects.find((s) => s.slug === 'francais-philosophie') ?? mainC;
        const enSub = cls.subjects.find((s) => s.slug === 'anglais') ?? mainC;

        const baseSlots: Array<
          [string, string, string, string, string, string, string, string, string]
        > = [
          ['S1', 'Lundi', '08:00', '10:00', 'Cours', mainA.slug, mainA.name, `Amphi ${cls.code}`, 'Équipe pédagogique'],
          ['S1', 'Lundi', '10:15', '12:15', 'Cours', mainB.slug, mainB.name, `Salle ${cls.code}-1`, 'Équipe pédagogique'],
          ['S1', 'Lundi', '14:00', '16:00', 'TD', mainA.slug, mainA.name, `Salle ${cls.code}-1`, 'Équipe pédagogique'],
          ['S1', 'Mardi', '08:00', '10:00', 'Cours', mainC.slug, mainC.name, `Salle ${cls.code}-2`, 'Équipe pédagogique'],
          ['S1', 'Mardi', '10:15', '12:15', 'TP', infoSub.slug, infoSub.name, 'Labo Info 1', 'Prof. Informatique'],
          ['S1', 'Mercredi', '08:00', '10:00', 'Cours', frSub.slug, frSub.name, `Salle ${cls.code}-1`, 'Prof. Culture Générale'],
          ['S1', 'Mercredi', '10:15', '12:15', 'TD', mainB.slug, mainB.name, `Salle ${cls.code}-2`, 'Équipe pédagogique'],
          ['S1', 'Jeudi', '08:00', '10:00', 'Cours', mainA.slug, mainA.name, `Amphi ${cls.code}`, 'Équipe pédagogique'],
          ['S1', 'Jeudi', '14:00', '16:00', isEcs ? 'TD' : 'TP', mainB.slug, mainB.name, isEcs ? `Salle ${cls.code}-1` : 'Labo Physique', 'Équipe pédagogique'],
          ['S1', 'Vendredi', '08:00', '10:00', 'Cours', enSub.slug, enSub.name, `Salle ${cls.code}-3`, 'Prof. Langues'],
          ['S1', 'Vendredi', '14:00', '16:00', 'TD', mainC.slug, mainC.name, `Salle ${cls.code}-2`, 'Équipe pédagogique'],
          ['S1', 'Samedi', '08:00', '12:00', 'DS', mainA.slug, `${mainA.name} / ${mainB.name} (Alternance)`, 'Bloc Examens', 'Surveillance DS'],
          ['S2', 'Lundi', '08:00', '10:00', 'Cours', mainA.slug, mainA.name, `Amphi ${cls.code}`, 'Équipe pédagogique'],
          ['S2', 'Mercredi', '14:00', '16:00', 'TP', cls.level === 'Spé' || !isEcs ? 'tipe' : infoSub.slug, cls.level === 'Spé' || !isEcs ? 'TIPE — Encadrement' : infoSub.name, 'Salle TIPE', 'Encadrement TIPE'],
          ['S2', 'Samedi', '08:00', '12:00', 'Concours Blanc', mainA.slug, `Concours Blanc ${cls.code}`, 'Grand Amphi', 'Jury Campus'],
        ];

        for (const [semester, day, start, end, sessionType, slug, name, room, prof] of baseSlots) {
          ttValues.push({
            classCode: cls.code,
            semester,
            dayOfWeek: day,
            startTime: start,
            endTime: end,
            sessionType,
            subjectSlug: slug,
            subjectName: name,
            room,
            professorName: prof,
          });
        }
      }
      if (ttValues.length > 0) {
        await db.insert(classTimetables).values(ttValues);
      }
    }

    // 4. Seed structural colloscope grid if empty
    const colloCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classColloscopes);
    if ((colloCountRows[0]?.count ?? 0) === 0) {
      const days = ['Lundi 17h15', 'Mardi 17h15', 'Mercredi 16h15', 'Jeudi 17h15', 'Vendredi 16h15', 'Vendredi 17h15'];
      const colloValues: Array<typeof classColloscopes.$inferInsert> = [];
      for (const cls of CAMPUS_CLASSES) {
        const oralSubjects = cls.subjects.filter((s) => s.slug !== 'eps' && s.slug !== 'tipe').slice(0, 4);
        for (let week = 1; week <= 4; week++) {
          for (let trinome = 1; trinome <= 6; trinome++) {
            const subj = oralSubjects[(trinome + week - 2) % oralSubjects.length];
            colloValues.push({
              classCode: cls.code,
              weekNumber: week,
              weekLabel: `Semaine ${week}`,
              trinomeNumber: trinome,
              subjectSlug: subj.slug,
              subjectName: subj.name,
              kholleurName: `Khôlleur ${subj.name.split(' ')[0]}`,
              dayTime: days[(trinome + week) % days.length],
              room: `K-${101 + ((trinome + week) % 8)}`,
            });
          }
        }
      }
      if (colloValues.length > 0) {
        await db.insert(classColloscopes).values(colloValues);
      }
    }

    // 5. Seed structural internat info if empty
    const internatCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(internatNotices);
    if ((internatCountRows[0]?.count ?? 0) === 0) {
      await db.insert(internatNotices).values([
        {
          pavillon: 'Tous les pavillons',
          category: 'Annonce',
          title: 'Bienvenue à l’Internat CPGE Bab Sahra — Consignes générales',
          content:
            'Retrouvez ici toutes les annonces officielles de l’internat (réunions de pavillon, horaires exceptionnels et rappels d’organisation) publiées par les maîtres d’internat.',
          isPinned: 1,
          authorName: 'Maître d’internat',
        },
        {
          pavillon: 'Tous les pavillons',
          category: 'Horaire',
          title: 'Horaires officiels des études du soir et restauration',
          content:
            'Étude encadrée de 18h30 à 20h00 et de 21h00 à 22h30. Dîner servi entre 20h00 et 20h55. Extinction des feux et calme strict à 23h15.',
          isPinned: 1,
          authorName: 'Vie Scolaire & Internat',
        },
        {
          pavillon: 'Salles de travail & Pavillons A/B',
          category: 'Permanence',
          title: 'Permanence des Maîtres d’internat et autorisations de sortie',
          content:
            'Les demandes de sortie exceptionnelle de fin de semaine doivent être enregistrées avant jeudi 18h00 auprès du maître d’internat de permanence.',
          isPinned: 0,
          authorName: 'Équipe Internat',
        },
      ]);
    }

    // 6. Seed structural campus events if empty
    const eventsCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campusEvents);
    if ((eventsCountRows[0]?.count ?? 0) === 0) {
      await db.insert(campusEvents).values([
        {
          organizerGroup: 'BDE',
          eventType: 'Conférence',
          title: 'Forum des Lauréats & Grandes Écoles (CNC / Français / CNAEM)',
          summary:
            'Organisé par le BDE (président des étudiants) avec les anciens élèves du campus autour des concours et écoles d’ingénieurs & de commerce.',
          content:
            'Tables rondes par filière (MP, PSI, ECS) pour préparer les choix de concours, l’organisation des oraux et les retours d’expérience TIPE.',
          eventDate: 'Samedi 14h30',
          location: 'Grand Amphithéâtre',
          capacity: 180,
          instagramUrl: '',
        },
        {
          organizerGroup: 'Groupe Média',
          eventType: 'Événement',
          title: 'Couverture officielle & actualités du campus sur Instagram',
          summary:
            'Le Groupe Média partage ici et sur les pages Instagram du campus tous les événements, photos, affiches et récapitulatifs vidéo.',
          content:
            'Suivez les annonces d’événements, les galeries photos des journées d’intégration, tournois et conférences publiées conjointement sur Site Prépa et nos pages Instagram.',
          eventDate: 'Publication Campus',
          location: 'Site Web & Pages Instagram',
          capacity: 300,
          instagramUrl: 'https://instagram.com/',
        },
      ]);
    }

    // 7. Seed starter Informatique Python assignment per class if empty
    const assignCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(infoAssignments);
    if ((assignCountRows[0]?.count ?? 0) === 0) {
      const assignValues: Array<typeof infoAssignments.$inferInsert> = [];
      for (const cls of CAMPUS_CLASSES) {
        const isSpe = cls.level === 'Spé';
        const isEcs = cls.code === 'ECS' || cls.code === '2ECS';
        assignValues.push({
          classCode: cls.code,
          title: isEcs
            ? `TP Python — Simulation & Probabilités (${cls.code})`
            : isSpe
              ? `TP Python — Graphes, Plus Courts Chemins & Dynamique (${cls.code})`
              : `TP Python — Algorithmique & Récursivité (${cls.code})`,
          description: isEcs
            ? 'Implémenter les fonctions de simulation de lois discrètes et tracer la convergence empirique sous Python.'
            : isSpe
              ? 'Implémenter l’algorithme de Dijkstra sur matrice d’adjacence et analyser la complexité temporelle.'
              : 'Écrire les fonctions itératives et récursives demandées dans la feuille de TP n°1 avec jeux de tests unitaires.',
          language: 'Python 3',
          dueDate: 'Vendredi 20h00',
          professorName: 'Département Informatique',
        });
      }
      if (assignValues.length > 0) {
        await db.insert(infoAssignments).values(assignValues);
      }
    }

    // 8. Seed initial official administration announcements if empty
    const adminAnnCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminAnnouncements);
    if ((adminAnnCountRows[0]?.count ?? 0) === 0) {
      await db.insert(adminAnnouncements).values([
        {
          category: 'Note officielle',
          targetAudience: 'Toutes les classes',
          title: 'Note de la Direction — Diffusion des communiqués officiels du Centre CPGE',
          content:
            'Cet espace centralise l’ensemble des notes officielles, calendriers d’examens, avis de scolarité et communiqués urgents publiés par l’Administration du Centre CPGE Bab Sahra.',
          isPinned: 1,
          authorName: 'Direction CPGE Bab Sahra',
        },
        {
          category: 'Concours & Examens',
          targetAudience: '2ème année · Spé',
          title: 'Dossiers d’inscription aux Concours Nationaux (CNC / CNAEM)',
          content:
            'Les étudiants de 2ème année (MP, PSI1, PSI2, 2ECS) sont invités à vérifier l’exactitude de leurs pièces d’état civil et relevés auprès du secrétariat pédagogique avant validation définitive.',
          isPinned: 1,
          authorName: 'Secrétariat des Concours',
        },
        {
          category: 'Scolarité',
          targetAudience: 'Toutes les classes',
          title: 'Dépôt des justificatifs d’absence et demandes d’attestations',
          content:
            'Tout justificatif d’absence doit être déposé au bureau de la scolarité dans un délai maximal de 48 heures. Les demandes d’attestation de scolarité sont traitées chaque mardi et jeudi matin.',
          isPinned: 0,
          authorName: 'Service Scolarité',
        },
      ]);
    }

    // 9. Sync local ressources/ directory
    await syncRessourcesFolderToDb(true);
  } catch (error) {
    console.error('Database seed failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export function getClassCodeList(): ClassCode[] {
  return CAMPUS_CLASSES.map((c) => c.code);
}
