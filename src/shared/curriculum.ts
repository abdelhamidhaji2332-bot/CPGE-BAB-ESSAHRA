export type ClassCode =
  | 'MPSI'
  | 'PCSI1'
  | 'PCSI2'
  | 'ECS'
  | 'MP'
  | 'PSI1'
  | 'PSI2'
  | '2ECS';

export type AcademicLevel = 'Sup' | 'Spé';

export type UserRole =
  | 'etudiant'
  | 'delegue'
  | 'professeur'
  | 'maitre_internat'
  | 'bde'
  | 'groupe_media'
  | 'admin';

export type DocumentCategory =
  | 'cours'
  | 'td'
  | 'ds'
  | 'concours-blancs'
  | 'corriges'
  | 'colloscopes'
  | 'guides';

export interface SubjectDefinition {
  slug: string;
  name: string;
  description: string;
  hasTipeNote?: string;
}

export interface ClassDefinition {
  code: ClassCode;
  level: AcademicLevel;
  levelLabel: string;
  filiere: string;
  shortTrack: string;
  description: string;
  subjects: SubjectDefinition[];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  etudiant: 'Élève CPGE',
  delegue: 'Délégué de classe',
  professeur: 'Professeur',
  maitre_internat: "Maître d'internat",
  bde: 'BDE · Président des étudiants',
  groupe_media: 'Groupe Média · Événements & Pages Instagram',
  admin: 'Équipe Dev (Admin)',
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  cours: 'Cours',
  td: 'TD',
  ds: 'Devoirs Surveillés (DS)',
  'concours-blancs': 'Concours Blancs',
  corriges: 'Corrigés',
  colloscopes: 'Colloscopes',
  guides: 'Guides',
};

const MPSI_SUBJECTS: SubjectDefinition[] = [
  {
    slug: 'mathematiques',
    name: 'Mathématiques',
    description: 'Logique, algèbre générale et linéaire, analyse, probabilités',
  },
  {
    slug: 'physique',
    name: 'Physique',
    description: 'Mécanique, électromagnétisme, thermodynamique, optique et TP',
  },
  {
    slug: 'chimie',
    name: 'Chimie',
    description: 'Solutions aqueuses, cinétique, structure de la matière et TP',
  },
  {
    slug: 'sii',
    name: "Sciences Industrielles de l'Ingénieur (SII)",
    description: 'Systèmes asservis, cinématique, statique et TP',
  },
  {
    slug: 'informatique',
    name: 'Informatique',
    description: 'Algorithmique et programmation Python',
  },
  {
    slug: 'francais-philosophie',
    name: 'Français – Philosophie',
    description: 'Culture générale et méthodologie des concours',
  },
  {
    slug: 'arabe-traduction',
    name: 'Langue Arabe et Traduction',
    description: 'Expression écrite, version et thème',
  },
  {
    slug: 'anglais',
    name: 'Langue Anglaise',
    description: 'Synthèse, version, thème et khôlles orales',
  },
  {
    slug: 'eps',
    name: 'Éducation Physique et Sportive (EPS)',
    description: 'Préparation physique et sports collectifs',
  },
  {
    slug: 'tipe',
    name: 'TIPE',
    description: "Travaux d'Initiative Personnelle Encadrés (démarrage au S2)",
  },
];

const PCSI_SUBJECTS: SubjectDefinition[] = [
  {
    slug: 'mathematiques',
    name: 'Mathématiques',
    description: 'Algèbre linéaire, analyse réelle, géométrie et probabilités',
  },
  {
    slug: 'physique',
    name: 'Physique',
    description: 'Approche expérimentale renforcée et travaux pratiques',
  },
  {
    slug: 'chimie',
    name: 'Chimie',
    description: 'Programme approfondi en chimie organique, générale et TP',
  },
  {
    slug: 'sii',
    name: "Sciences Industrielles de l'Ingénieur (SII)",
    description: 'Analyse fonctionnelle, mécanique et systèmes automatisés',
  },
  {
    slug: 'informatique',
    name: 'Informatique',
    description: 'Algorithmique et programmation Python',
  },
  {
    slug: 'francais-philosophie',
    name: 'Français – Philosophie',
    description: 'Culture générale et dissertation',
  },
  {
    slug: 'arabe-traduction',
    name: 'Langue Arabe et Traduction',
    description: 'Traduction et expression analytique',
  },
  {
    slug: 'anglais',
    name: 'Langue Anglaise',
    description: 'Compréhension, expression écrite et orale',
  },
  {
    slug: 'eps',
    name: 'Éducation Physique et Sportive (EPS)',
    description: 'Équilibre et condition physique',
  },
  {
    slug: 'tipe',
    name: 'TIPE',
    description: "Travaux d'Initiative Personnelle Encadrés (démarrage au S2)",
  },
];

const ECS_SUBJECTS: SubjectDefinition[] = [
  {
    slug: 'mathematiques',
    name: 'Mathématiques',
    description: 'Algèbre linéaire, analyse et probabilités',
  },
  {
    slug: 'informatique',
    name: 'Informatique et Algorithmique',
    description: 'Programmation Python appliquée',
  },
  {
    slug: 'hggmc',
    name: 'Histoire, Géographie et Géopolitique du Monde Contemporain (HGGMC)',
    description: 'Mutations géopolitiques et géoéconomie contemporaine',
  },
  {
    slug: 'economie-droit',
    name: 'Économie et Droit',
    description: 'Microéconomie, macroéconomie, droit institutionnel et des contrats',
  },
  {
    slug: 'gestion-management',
    name: 'Gestion et Management',
    description: 'Comptabilité générale et management des organisations',
  },
  {
    slug: 'francais-philosophie',
    name: 'Culture Générale et Méthodologie (Français – Philosophie)',
    description: 'Dissertation de culture générale et contraction de texte',
  },
  {
    slug: 'arabe-traduction',
    name: 'Langue Arabe et Traduction',
    description: 'Synthèse et traduction économique',
  },
  {
    slug: 'anglais',
    name: 'Langue Anglaise',
    description: 'Essai, presse économique et traduction',
  },
  {
    slug: 'eps',
    name: 'Éducation Physique et Sportive (EPS)',
    description: 'Activités sportives encadrées',
  },
];

const MP_SUBJECTS: SubjectDefinition[] = [
  {
    slug: 'mathematiques',
    name: 'Mathématiques',
    description: 'Espaces vectoriels normés, réduction, calcul différentiel et probabilités',
  },
  {
    slug: 'physique',
    name: 'Physique',
    description: 'Physique quantique, Maxwell, thermodynamique statistique, optique et TP',
  },
  {
    slug: 'chimie',
    name: 'Chimie',
    description: 'Thermochimie et électrochimie',
  },
  {
    slug: 'sii',
    name: "Sciences Industrielles de l'Ingénieur (SII)",
    description: "Ou Option Informatique selon le choix de l'étudiant",
  },
  {
    slug: 'informatique',
    name: 'Informatique',
    description: 'Tronc commun — Algorithmique avancée, graphes et bases de données',
  },
  {
    slug: 'tipe',
    name: 'TIPE',
    description: 'Préparation et soutenance pour les concours (CNC et concours français)',
  },
  {
    slug: 'francais-philosophie',
    name: 'Français – Philosophie',
    description: 'Programme national des thèmes annuels',
  },
  {
    slug: 'arabe-traduction',
    name: 'Langue Arabe et Traduction',
    description: 'Traduction scientifique et littéraire',
  },
  {
    slug: 'anglais',
    name: 'Langue Anglaise',
    description: 'Préparation aux écrits et oraux des concours',
  },
  {
    slug: 'eps',
    name: 'Éducation Physique et Sportive (EPS)',
    description: 'Entraînement et épreuves physiques',
  },
];

const PSI_SUBJECTS: SubjectDefinition[] = [
  {
    slug: 'mathematiques',
    name: 'Mathématiques',
    description: 'Algèbre linéaire avancée, séries, équations différentielles et probabilités',
  },
  {
    slug: 'physique',
    name: 'Physique',
    description: 'Mécanique des fluides, électronique de puissance, électromagnétisme et TP',
  },
  {
    slug: 'chimie',
    name: 'Chimie',
    description: 'Thermodynamique chimique et cinétique électrochimique',
  },
  {
    slug: 'sii',
    name: "Sciences Industrielles de l'Ingénieur (SII)",
    description: "Automatique, chaînes d'énergie, mécanique des systèmes et TP",
  },
  {
    slug: 'informatique',
    name: 'Informatique',
    description: 'Tronc commun — Modélisation numérique et Python',
  },
  {
    slug: 'tipe',
    name: 'TIPE',
    description: 'Préparation expérimentale et soutenance concours',
  },
  {
    slug: 'francais-philosophie',
    name: 'Français – Philosophie',
    description: 'Dissertation et résumé de texte',
  },
  {
    slug: 'arabe-traduction',
    name: 'Langue Arabe et Traduction',
    description: 'Traduction et commentaire',
  },
  {
    slug: 'anglais',
    name: 'Langue Anglaise',
    description: 'Préparation aux épreuves écrites et orales',
  },
  {
    slug: 'eps',
    name: 'Éducation Physique et Sportive (EPS)',
    description: 'Condition physique et sport collectif',
  },
];

const ECS2_SUBJECTS: SubjectDefinition[] = [
  {
    slug: 'mathematiques',
    name: 'Mathématiques',
    description: 'Algèbre bilinéaire, optimisation multivariée, variables aléatoires à densité',
  },
  {
    slug: 'informatique',
    name: 'Informatique et Algorithmique',
    description: 'Simulation probabiliste et Python',
  },
  {
    slug: 'hggmc',
    name: 'Histoire, Géographie et Géopolitique du Monde Contemporain (HGGMC)',
    description: "Géodynamique de l'UE, Amériques, Afrique/Moyen-Orient et Maroc",
  },
  {
    slug: 'economie-droit',
    name: 'Économie et Droit',
    description: 'Économie monétaire et financière, finances publiques, droit commercial et du travail',
  },
  {
    slug: 'gestion-management',
    name: 'Gestion et Management',
    description: 'Comptabilité analytique, analyse financière, GRH et marketing',
  },
  {
    slug: 'francais-philosophie',
    name: 'Culture Générale et Méthodologie (Français – Philosophie)',
    description: 'Préparation aux épreuves de culture générale CNAEM / BCE',
  },
  {
    slug: 'arabe-traduction',
    name: 'Langue Arabe et Traduction',
    description: 'Traduction et essai géopolitique',
  },
  {
    slug: 'anglais',
    name: 'Langue Anglaise',
    description: 'Préparation aux oraux et écrits des grandes écoles de commerce',
  },
  {
    slug: 'eps',
    name: 'Éducation Physique et Sportive (EPS)',
    description: 'Activités physiques encadrées',
  },
];

export const CAMPUS_CLASSES: ClassDefinition[] = [
  {
    code: 'MPSI',
    level: 'Sup',
    levelLabel: '1ère année (Sup)',
    filiere: "Mathématiques, Physique et Sciences de l'Ingénieur",
    shortTrack: 'Scientifique · Dominante Mathématiques',
    description: 'Voie scientifique dominante Mathématiques',
    subjects: MPSI_SUBJECTS,
  },
  {
    code: 'PCSI1',
    level: 'Sup',
    levelLabel: '1ère année (Sup)',
    filiere: "Physique, Chimie et Sciences de l'Ingénieur (Groupe 1)",
    shortTrack: 'Scientifique · Physique-Chimie-SII',
    description: 'Voie scientifique expérimentale (Physique-Chimie-SII)',
    subjects: PCSI_SUBJECTS,
  },
  {
    code: 'PCSI2',
    level: 'Sup',
    levelLabel: '1ère année (Sup)',
    filiere: "Physique, Chimie et Sciences de l'Ingénieur (Groupe 2)",
    shortTrack: 'Scientifique · Physique-Chimie-SII',
    description: 'Voie scientifique expérimentale (Physique-Chimie-SII)',
    subjects: PCSI_SUBJECTS,
  },
  {
    code: 'ECS',
    level: 'Sup',
    levelLabel: '1ère année (Sup)',
    filiere: 'Économique et Commerciale — Option Scientifique',
    shortTrack: 'Économique & Commerciale',
    description: 'Voie économique et commerciale (1ère année)',
    subjects: ECS_SUBJECTS,
  },
  {
    code: 'MP',
    level: 'Spé',
    levelLabel: '2ème année (Spé)',
    filiere: 'Mathématiques – Physique',
    shortTrack: 'Concours CNC · X-ENS · Centrale · Mines',
    description: 'Poursuite de la filière MPSI',
    subjects: MP_SUBJECTS,
  },
  {
    code: 'PSI1',
    level: 'Spé',
    levelLabel: '2ème année (Spé)',
    filiere: "Physique et Sciences de l'Ingénieur (Groupe 1)",
    shortTrack: 'Physique & Ingénierie · Groupe 1',
    description: 'Poursuite orientée Physique & SII',
    subjects: PSI_SUBJECTS,
  },
  {
    code: 'PSI2',
    level: 'Spé',
    levelLabel: '2ème année (Spé)',
    filiere: "Physique et Sciences de l'Ingénieur (Groupe 2)",
    shortTrack: 'Physique & Ingénierie · Groupe 2',
    description: 'Poursuite orientée Physique & SII',
    subjects: PSI_SUBJECTS,
  },
  {
    code: '2ECS',
    level: 'Spé',
    levelLabel: '2ème année (Spé)',
    filiere: 'Économique et Commerciale — Option Scientifique (2A)',
    shortTrack: 'Concours CNAEM · BCE · Ecricome',
    description: 'Poursuite de la filière ECS',
    subjects: ECS2_SUBJECTS,
  },
];

export const CLASS_CODES: ClassCode[] = CAMPUS_CLASSES.map((c) => c.code);

export function getClassDefinition(code: string | undefined | null): ClassDefinition | undefined {
  if (!code) return undefined;
  const normalized = code.toUpperCase();
  return CAMPUS_CLASSES.find((c) => c.code === normalized);
}

export function isValidClassCode(code: string): code is ClassCode {
  return CLASS_CODES.includes(code as ClassCode);
}
