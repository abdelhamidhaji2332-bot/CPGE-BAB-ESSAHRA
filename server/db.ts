import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CAMPUS_CLASSES, type ClassCode } from '../src/shared/curriculum.ts';
import { seedStarterPdfAssets } from './pdfGenerator.ts';

let dbInstance: Database.Database | null = null;

export function getDb(dataDir = path.resolve(process.cwd(), 'data')): Database.Database {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'site_prepa.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  dbInstance = db;
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('etudiant', 'delegue', 'professeur', 'maitre_internat', 'bde', 'groupe_media', 'admin')),
      class_code TEXT,
      trinome_number INTEGER,
      subject_specialty TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classes (
      code TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      level_label TEXT NOT NULL,
      filiere TEXT NOT NULL,
      short_track TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(class_code, slug)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT REFERENCES classes(code) ON DELETE CASCADE,
      subject_slug TEXT,
      category TEXT NOT NULL CHECK (category IN ('td', 'ds', 'resume', 'cnc', 'cf', 'cours', 'concours-blancs', 'corriges', 'colloscopes', 'guides')),
      title TEXT NOT NULL,
      chapter TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS document_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('a_faire', 'en_cours', 'maitrise')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, document_id)
    );

    CREATE TABLE IF NOT EXISTS class_timetables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
      semester TEXT NOT NULL CHECK (semester IN ('S1', 'S2')),
      day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi')),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      session_type TEXT NOT NULL CHECK (session_type IN ('Cours', 'TD', 'TP', 'DS', 'Concours Blanc')),
      subject_slug TEXT,
      subject_name TEXT NOT NULL,
      room TEXT NOT NULL,
      professor_name TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS class_colloscopes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      week_label TEXT NOT NULL,
      trinome_number INTEGER NOT NULL,
      subject_slug TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      kholleur_name TEXT NOT NULL,
      day_time TEXT NOT NULL,
      room TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      source_message_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS class_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      content TEXT NOT NULL,
      is_announcement INTEGER NOT NULL DEFAULT 0,
      announcement_id INTEGER REFERENCES class_announcements(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS internat_notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pavillon TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Horaire', 'Permanence', 'Maintenance', 'Annonce')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campus_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organizer_group TEXT NOT NULL CHECK (organizer_group IN ('BDE', 'Groupe Média', 'Administration')),
      event_type TEXT NOT NULL CHECK (event_type IN ('Événement', 'Article', 'Conférence', 'Tournoi')),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      event_date TEXT NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 120,
      instagram_url TEXT NOT NULL DEFAULT '',
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS event_registrations (
      event_id INTEGER NOT NULL REFERENCES campus_events(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS info_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'Python 3',
      due_date TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      professor_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS info_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES info_assignments(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT,
      code_content TEXT NOT NULL,
      professor_feedback TEXT,
      status TEXT NOT NULL DEFAULT 'soumis' CHECK (status IN ('soumis', 'revu', 'valide')),
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(assignment_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS class_activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('document', 'announcement', 'message', 'timetable', 'colloscope', 'assignment')),
      title TEXT NOT NULL,
      tab_target TEXT NOT NULL DEFAULT 'bibliotheque',
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_class_seen (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
      last_seen_activity_id INTEGER NOT NULL DEFAULT 0,
      seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, class_code)
    );

    CREATE TABLE IF NOT EXISTS admin_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL CHECK (category IN ('Note officielle', 'Concours & Examens', 'Scolarité', 'Bourses & Internat', 'Urgent')),
      target_audience TEXT NOT NULL DEFAULT 'Toutes les classes',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_documents_class_cat ON documents(class_code, category);
    CREATE INDEX IF NOT EXISTS idx_timetables_class ON class_timetables(class_code, semester);
    CREATE INDEX IF NOT EXISTS idx_colloscopes_class_week ON class_colloscopes(class_code, week_number);
    CREATE INDEX IF NOT EXISTS idx_announcements_class ON class_announcements(class_code, is_pinned, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_class ON class_messages(class_code, created_at);
    CREATE INDEX IF NOT EXISTS idx_assignments_class ON info_assignments(class_code);
    CREATE INDEX IF NOT EXISTS idx_class_activity_class ON class_activity_log(class_code, id);
    CREATE INDEX IF NOT EXISTS idx_admin_announcements ON admin_announcements(is_pinned, created_at);
  `);

  try {
    db.exec(`ALTER TABLE campus_events ADD COLUMN instagram_url TEXT NOT NULL DEFAULT ''`);
  } catch {
    // Column already exists
  }

  const docsTableSql = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'documents'`)
    .get() as { sql: string } | undefined;
  if (docsTableSql && !docsTableSql.sql.includes("'resume'")) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE documents_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_code TEXT REFERENCES classes(code) ON DELETE CASCADE,
        subject_slug TEXT,
        category TEXT NOT NULL CHECK (category IN ('td', 'ds', 'resume', 'cnc', 'cf', 'cours', 'concours-blancs', 'corriges', 'colloscopes', 'guides')),
        title TEXT NOT NULL,
        chapter TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO documents_new (id, class_code, subject_slug, category, title, chapter, description, file_path, file_size, uploaded_by, created_at)
      SELECT id, class_code, subject_slug, category, title, chapter, description, file_path, file_size, uploaded_by, created_at FROM documents;
      DROP TABLE documents;
      ALTER TABLE documents_new RENAME TO documents;
      CREATE INDEX IF NOT EXISTS idx_documents_class_cat ON documents(class_code, category);
      COMMIT;
    `);
    db.pragma('foreign_keys = ON');
  }
}

export async function seedCampusDatabase(publicDir: string): Promise<void> {
  const db = getDb();

  // 1. Sync classes & subjects
  const insertClass = db.prepare(`
    INSERT INTO classes (code, level, level_label, filiere, short_track, description)
    VALUES (@code, @level, @level_label, @filiere, @short_track, @description)
    ON CONFLICT(code) DO UPDATE SET
      level = excluded.level,
      level_label = excluded.level_label,
      filiere = excluded.filiere,
      short_track = excluded.short_track,
      description = excluded.description
  `);

  const insertSubject = db.prepare(`
    INSERT INTO class_subjects (class_code, slug, name, description, sort_order)
    VALUES (@class_code, @slug, @name, @description, @sort_order)
    ON CONFLICT(class_code, slug) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      sort_order = excluded.sort_order
  `);

  const tx = db.transaction(() => {
    for (const cls of CAMPUS_CLASSES) {
      insertClass.run({
        code: cls.code,
        level: cls.level,
        level_label: cls.levelLabel,
        filiere: cls.filiere,
        short_track: cls.shortTrack,
        description: cls.description,
      });
      cls.subjects.forEach((sub, idx) => {
        insertSubject.run({
          class_code: cls.code,
          slug: sub.slug,
          name: sub.name,
          description: sub.description,
          sort_order: idx,
        });
      });
    }
  });
  tx();

  // 2. Remove un-authored starter lessons/TD/DS/corrigés/concours-blancs in /documents so teachers upload real content
  const stalePlaceholders = db
    .prepare(
      `SELECT id, file_path FROM documents
       WHERE uploaded_by IS NULL
         AND file_path LIKE '/documents/%'
         AND category IN ('cours', 'td', 'ds', 'concours-blancs', 'corriges')`
    )
    .all() as Array<{ id: number; file_path: string }>;

  if (stalePlaceholders.length > 0) {
    db.prepare(
      `DELETE FROM documents
       WHERE uploaded_by IS NULL
         AND file_path LIKE '/documents/%'
         AND category IN ('cours', 'td', 'ds', 'concours-blancs', 'corriges')`
    ).run();
    for (const row of stalePlaceholders) {
      const rel = row.file_path.replace(/^\/+/, '');
      const absTarget = path.resolve(publicDir, rel);
      const docsRoot = path.resolve(publicDir, 'documents') + path.sep;
      if (absTarget.startsWith(docsRoot) && fs.existsSync(absTarget)) {
        try {
          fs.unlinkSync(absTarget);
        } catch {
          // Ignore file unlink errors
        }
      }
    }
  }

  // Generate starter colloscope/guide PDF files on disk and register missing ones
  const generatedAssets = await seedStarterPdfAssets(publicDir);
  const existingPaths = new Set(
    (db.prepare('SELECT file_path FROM documents').all() as Array<{ file_path: string }>).map((r) => r.file_path)
  );
  const insertDoc = db.prepare(`
    INSERT INTO documents (class_code, subject_slug, category, title, chapter, description, file_path, file_size)
    VALUES (@class_code, @subject_slug, @category, @title, @chapter, @description, @file_path, @file_size)
  `);
  const docTx = db.transaction(() => {
    for (const asset of generatedAssets) {
      const urlPath = `/${asset.relativePath}`;
      if (!existingPaths.has(urlPath)) {
        insertDoc.run({
          class_code: asset.classCode,
          subject_slug: asset.subjectSlug,
          category: asset.category,
          title: asset.title,
          chapter: asset.chapter,
          description: asset.description,
          file_path: urlPath,
          file_size: asset.fileSize,
        });
      }
    }
  });
  docTx();

  // 3. Seed structural timetables if empty
  const existingTtCount = (db.prepare('SELECT COUNT(*) as count FROM class_timetables').get() as { count: number }).count;
  if (existingTtCount === 0) {
    const insertTt = db.prepare(`
      INSERT INTO class_timetables (class_code, semester, day_of_week, start_time, end_time, session_type, subject_slug, subject_name, room, professor_name)
      VALUES (@class_code, @semester, @day_of_week, @start_time, @end_time, @session_type, @subject_slug, @subject_name, @room, @professor_name)
    `);
    const ttTx = db.transaction(() => {
      for (const cls of CAMPUS_CLASSES) {
        const isEcs = cls.code === 'ECS' || cls.code === '2ECS';
        const mainA = cls.subjects[0];
        const mainB = cls.subjects[1];
        const mainC = cls.subjects[2];
        const infoSub = cls.subjects.find((s) => s.slug === 'informatique') ?? mainB;
        const frSub = cls.subjects.find((s) => s.slug === 'francais-philosophie') ?? mainC;
        const enSub = cls.subjects.find((s) => s.slug === 'anglais') ?? mainC;

        const baseSlots: Array<[string, string, string, string, string, string, string, string, string]> = [
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
          insertTt.run({
            class_code: cls.code,
            semester,
            day_of_week: day,
            start_time: start,
            end_time: end,
            session_type: sessionType,
            subject_slug: slug,
            subject_name: name,
            room,
            professor_name: prof,
          });
        }
      }
    });
    ttTx();
  }

  // 4. Seed structural colloscope grid if empty
  const existingColloCount = (db.prepare('SELECT COUNT(*) as count FROM class_colloscopes').get() as { count: number }).count;
  if (existingColloCount === 0) {
    const insertCollo = db.prepare(`
      INSERT INTO class_colloscopes (class_code, week_number, week_label, trinome_number, subject_slug, subject_name, kholleur_name, day_time, room)
      VALUES (@class_code, @week_number, @week_label, @trinome_number, @subject_slug, @subject_name, @kholleur_name, @day_time, @room)
    `);
    const colloTx = db.transaction(() => {
      const days = ['Lundi 17h15', 'Mardi 17h15', 'Mercredi 16h15', 'Jeudi 17h15', 'Vendredi 16h15', 'Vendredi 17h15'];
      for (const cls of CAMPUS_CLASSES) {
        const oralSubjects = cls.subjects.filter((s) => s.slug !== 'eps' && s.slug !== 'tipe').slice(0, 4);
        for (let week = 1; week <= 4; week++) {
          for (let trinome = 1; trinome <= 6; trinome++) {
            const subj = oralSubjects[(trinome + week - 2) % oralSubjects.length];
            insertCollo.run({
              class_code: cls.code,
              week_number: week,
              week_label: `Semaine ${week}`,
              trinome_number: trinome,
              subject_slug: subj.slug,
              subject_name: subj.name,
              kholleur_name: `Khôlleur ${subj.name.split(' ')[0]}`,
              day_time: days[(trinome + week) % days.length],
              room: `K-${101 + ((trinome + week) % 8)}`,
            });
          }
        }
      }
    });
    colloTx();
  }

  // 5. Seed structural internat info if empty
  const existingInternat = (db.prepare('SELECT COUNT(*) as count FROM internat_notices').get() as { count: number }).count;
  if (existingInternat === 0) {
    const insertInternat = db.prepare(`
      INSERT INTO internat_notices (pavillon, category, title, content, is_pinned, author_name)
      VALUES (@pavillon, @category, @title, @content, @is_pinned, @author_name)
    `);
    insertInternat.run({
      pavillon: 'Tous les pavillons',
      category: 'Annonce',
      title: 'Bienvenue à l’Internat CPGE Bab Sahra — Consignes générales',
      content: 'Retrouvez ici toutes les annonces officielles de l’internat (réunions de pavillon, horaires exceptionnels et rappels d’organisation) publiées par les maîtres d’internat.',
      is_pinned: 1,
      author_name: 'Maître d’internat',
    });
    insertInternat.run({
      pavillon: 'Tous les pavillons',
      category: 'Horaire',
      title: 'Horaires officiels des études du soir et restauration',
      content: 'Étude encadrée de 18h30 à 20h00 et de 21h00 à 22h30. Dîner servi entre 20h00 et 20h55. Extinction des feux et calme strict à 23h15.',
      is_pinned: 1,
      author_name: 'Vie Scolaire & Internat',
    });
    insertInternat.run({
      pavillon: 'Salles de travail & Pavillons A/B',
      category: 'Permanence',
      title: 'Permanence des Maîtres d’internat et autorisations de sortie',
      content: 'Les demandes de sortie exceptionnelle de fin de semaine doivent être enregistrées avant jeudi 18h00 auprès du maître d’internat de permanence.',
      is_pinned: 0,
      author_name: 'Équipe Internat',
    });
  }

  // 6. Seed structural campus events / BDE & Groupe Média framework if empty
  const existingEvents = (db.prepare('SELECT COUNT(*) as count FROM campus_events').get() as { count: number }).count;
  if (existingEvents === 0) {
    const insertEvent = db.prepare(`
      INSERT INTO campus_events (organizer_group, event_type, title, summary, content, event_date, location, capacity, instagram_url)
      VALUES (@organizer_group, @event_type, @title, @summary, @content, @event_date, @location, @capacity, @instagram_url)
    `);
    insertEvent.run({
      organizer_group: 'BDE',
      event_type: 'Conférence',
      title: 'Forum des Lauréats & Grandes Écoles (CNC / Français / CNAEM)',
      summary: 'Organisé par le BDE (président des étudiants) avec les anciens élèves du campus autour des concours et écoles d’ingénieurs & de commerce.',
      content: 'Tables rondes par filière (MP, PSI, ECS) pour préparer les choix de concours, l’organisation des oraux et les retours d’expérience TIPE.',
      event_date: 'Samedi 14h30',
      location: 'Grand Amphithéâtre',
      capacity: 180,
      instagram_url: '',
    });
    insertEvent.run({
      organizer_group: 'Groupe Média',
      event_type: 'Événement',
      title: 'Couverture officielle & actualités du campus sur Instagram',
      summary: 'Le Groupe Média partage ici et sur les pages Instagram du campus tous les événements, photos, affiches et récapitulatifs vidéo.',
      content: 'Suivez les annonces d’événements, les galeries photos des journées d’intégration, tournois et conférences publiées conjointement sur Site Prépa et nos pages Instagram.',
      event_date: 'Publication Campus',
      location: 'Site Web & Pages Instagram',
      capacity: 300,
      instagram_url: 'https://instagram.com/',
    });
  }

  // 7. Seed starter Informatique Python assignment per class if empty
  const existingAssign = (db.prepare('SELECT COUNT(*) as count FROM info_assignments').get() as { count: number }).count;
  if (existingAssign === 0) {
    const insertAssign = db.prepare(`
      INSERT INTO info_assignments (class_code, title, description, language, due_date, professor_name)
      VALUES (@class_code, @title, @description, @language, @due_date, @professor_name)
    `);
    const assignTx = db.transaction(() => {
      for (const cls of CAMPUS_CLASSES) {
        const isSpe = cls.level === 'Spé';
        const isEcs = cls.code === 'ECS' || cls.code === '2ECS';
        insertAssign.run({
          class_code: cls.code,
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
          due_date: 'Vendredi 20h00',
          professor_name: 'Département Informatique',
        });
      }
    });
    assignTx();
  }

  // 8. Seed initial official administration announcements if empty
  const existingAdminAnn = (
    db.prepare('SELECT COUNT(*) as count FROM admin_announcements').get() as { count: number }
  ).count;
  if (existingAdminAnn === 0) {
    const insertAdminAnn = db.prepare(`
      INSERT INTO admin_announcements (category, target_audience, title, content, is_pinned, author_name)
      VALUES (@category, @target_audience, @title, @content, @is_pinned, @author_name)
    `);
    insertAdminAnn.run({
      category: 'Note officielle',
      target_audience: 'Toutes les classes',
      title: 'Note de la Direction — Diffusion des communiqués officiels du Centre CPGE',
      content:
        'Cet espace centralise l’ensemble des notes officielles, calendriers d’examens, avis de scolarité et communiqués urgents publiés par l’Administration du Centre CPGE Bab Sahra.',
      is_pinned: 1,
      author_name: 'Direction CPGE Bab Sahra',
    });
    insertAdminAnn.run({
      category: 'Concours & Examens',
      target_audience: '2ème année · Spé',
      title: 'Dossiers d’inscription aux Concours Nationaux (CNC / CNAEM)',
      content:
        'Les étudiants de 2ème année (MP, PSI1, PSI2, 2ECS) sont invités à vérifier l’exactitude de leurs pièces d’état civil et relevés auprès du secrétariat pédagogique avant validation définitive.',
      is_pinned: 1,
      author_name: 'Secrétariat des Concours',
    });
    insertAdminAnn.run({
      category: 'Scolarité',
      target_audience: 'Toutes les classes',
      title: 'Dépôt des justificatifs d’absence et demandes d’attestations',
      content:
        'Tout justificatif d’absence doit être déposé au bureau de la scolarité dans un délai maximal de 48 heures. Les demandes d’attestation de scolarité sont traitées chaque mardi et jeudi matin.',
      is_pinned: 0,
      author_name: 'Service Scolarité',
    });
  }
}

export function getClassCodeList(): ClassCode[] {
  return CAMPUS_CLASSES.map((c) => c.code);
}
