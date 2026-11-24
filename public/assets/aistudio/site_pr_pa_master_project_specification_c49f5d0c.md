# MASTER PROJECT SPECIFICATION — `proect.md`
## SITE PRÉPA — Flagship CPGE Campus Digital Platform

## 0. ROLE, MISSION & EXECUTION RULES

Act as a world-class multidisciplinary engineering team composed of:

- Senior Full-Stack Architect
- Senior Next.js / TypeScript Engineer
- Supabase & PostgreSQL Database Architect
- UI/UX Designer (UI/UX Pro Max standards)
- Motion & Interaction Designer
- Cybersecurity & RBAC Specialist
- DevOps & Vercel Deployment Engineer

Your mission is to DESIGN, ENGINEER, AND DELIVER a complete, production-ready, flagship-grade web platform for a Moroccan CPGE campus: **Site Prépa**.

This is not a landing-page exercise, a static mockup, or a simple dashboard template.

Build a complete, interconnected digital campus ecosystem that students, professors, boarding-school supervisors, administrators, and student organizations can genuinely use.

### Non-Negotiable Execution Rules
- Build real functionality, not visual simulations.
- Every navigation item, button, filter, modal, form, tab, download, and interaction must work.
- Never leave dead links, decorative buttons, empty pages, or fake interactions.
- Never use hardcoded mock authentication or simulated permissions.
- Never expose administrative operations through frontend-only authorization.
- Enforce authorization on the server and through Supabase Row-Level Security (RLS).
- Use realistic French-language sample content only where actual institutional data is unavailable.
- Do not fabricate academic documents, student records, grades, announcements, or institutional statistics.
- Never claim a feature is complete if its backend integration is missing.
- Prioritize architectural correctness, maintainability, security, and real usability over unnecessary visual complexity.

**Execution priority:** Functional completeness → Security → UX quality → Performance → Visual polish.

---

## 1. PRODUCT IDENTITY & CORE OBJECTIVE

- **Product:** Site Prépa
- **Category:** CPGE Campus Management & Student Community Platform
- **Primary language:** French
- **Context:** Moroccan CPGE educational environment
- **Target users:** Sup/Spé students, professors, administration, maîtres d'internat, délégués, BDE, and Groupe Média.

Use authentic terminology throughout the interface:

- Filières
- Classes
- Sup / Spé
- Colloscope
- Khôlles
- Trinômes
- Devoirs Surveillés (DS)
- Concours Blancs
- Cours / TD / TP
- Internat
- Maîtres d'internat
- Délégués
- BDE
- Espace Professeur

Avoid generic SaaS terminology wherever an authentic CPGE equivalent exists.

### Product Philosophy

The platform must feel like a premium digital campus combining:

- An academic resource center.
- A timetable and examination management system.
- A secure student portal.
- An internal communication network.
- A boarding-school information hub.
- An event and student-life platform.
- A teacher-managed computer science submission system.

All modules must share a unified design system, authentication system, user identity, and permission architecture.

---

## 2. CAMPUS ACADEMIC STRUCTURE: CLASSES & CURRICULA

The platform serves **8 official classes** divided into **1ère année (Sup)** and **2ème année (Spé)**, mapped strictly to the official Moroccan CPGE curriculum (`cpge.ac.ma`).

### 2.1 Classes Overview

| Niveau | Code Classe | Filière | Description |
| :--- | :--- | :--- | :--- |
| **1ère année (Sup)** | `MPSI` | Mathématiques, Physique et Sciences de l'Ingénieur | Voie scientifique dominante Mathématiques |
| **1ère année (Sup)** | `PCSI1` | Physique, Chimie et Sciences de l'Ingénieur (Groupe 1) | Voie scientifique expérimentale (Physique-Chimie-SII) |
| **1ère année (Sup)** | `PCSI2` | Physique, Chimie et Sciences de l'Ingénieur (Groupe 2) | Voie scientifique expérimentale (Physique-Chimie-SII) |
| **1ère année (Sup)** | `ECS` | Économique et Commerciale — Option Scientifique | Voie économique et commerciale (1ère année) |
| **2ème année (Spé)** | `MP` | Mathématiques – Physique | Poursuite de la filière MPSI |
| **2ème année (Spé)** | `PSI1` | Physique et Sciences de l'Ingénieur (Groupe 1) | Poursuite orientée Physique & SII |
| **2ème année (Spé)** | `PSI2` | Physique et Sciences de l'Ingénieur (Groupe 2) | Poursuite orientée Physique & SII |
| **2ème année (Spé)** | `2ECS` | Économique et Commerciale — Option Scientifique (2A) | Poursuite de la filière ECS |

---

### 2.2 Complete Official Subjects per Class

#### A. Première Année (Sup)

##### 1. `MPSI`
- **Mathématiques** (`mathematiques`) — Logique, algèbre générale et linéaire, analyse, probabilités
- **Physique** (`physique`) — Mécanique, électromagnétisme, thermodynamique, optique + TP
- **Chimie** (`chimie`) — Solutions aqueuses, cinétique, structure de la matière + TP
- **Sciences Industrielles de l'Ingénieur (SII)** (`sii`) — Systèmes asservis, cinématique, statique + TP
- **Informatique** (`informatique`) — Algorithmique et programmation Python
- **Français – Philosophie** (`francais-philosophie`) — Culture générale
- **Langue Arabe et Traduction** (`arabe-traduction`)
- **Langue Anglaise** (`anglais`)
- **Éducation Physique et Sportive (EPS)** (`eps`)
- **TIPE** (`tipe`) — Travaux d'Initiative Personnelle Encadrés (démarrage au S2)

##### 2. `PCSI1` & `PCSI2`
*(Les deux classes suivent exactement le même programme officiel)*
- **Mathématiques** (`mathematiques`)
- **Physique** (`physique`) — Approche expérimentale renforcée + TP
- **Chimie** (`chimie`) — Programme approfondi (chimie organique et générale) + TP
- **Sciences Industrielles de l'Ingénieur (SII)** (`sii`)
- **Informatique** (`informatique`) — Algorithmique et programmation Python
- **Français – Philosophie** (`francais-philosophie`)
- **Langue Arabe et Traduction** (`arabe-traduction`)
- **Langue Anglaise** (`anglais`)
- **Éducation Physique et Sportive (EPS)** (`eps`)
- **TIPE** (`tipe`) — Démarrage au S2

##### 3. `ECS`
- **Mathématiques** (`mathematiques`) — Algèbre linéaire, analyse, probabilités
- **Informatique et Algorithmique** (`informatique`) — Programmation Python appliquée
- **Histoire, Géographie et Géopolitique du Monde Contemporain (HGGMC)** (`hggmc`)
- **Économie et Droit** (`economie-droit`) — Microéconomie, macroéconomie, droit institutionnel et des contrats
- **Gestion et Management** (`gestion-management`) — Comptabilité générale, management des organisations
- **Culture Générale et Méthodologie (Français – Philosophie)** (`francais-philosophie`)
- **Langue Arabe et Traduction** (`arabe-traduction`)
- **Langue Anglaise** (`anglais`)
- **Éducation Physique et Sportive (EPS)** (`eps`)

---

#### B. Deuxième Année (Spé)

##### 4. `MP`
- **Mathématiques** (`mathematiques`) — Espaces vectoriels normés, réduction des endomorphismes, calcul différentiel, probabilités
- **Physique** (`physique`) — Physique quantique, équations de Maxwell, thermodynamique statistique, optique ondulatoire + TP
- **Chimie** (`chimie`) — Thermochimie, électrochimie
- **Sciences Industrielles de l'Ingénieur (SII)** (`sii`) — Ou Option Informatique selon le choix de l'étudiant
- **Informatique** (`informatique`) — Tronc commun
- **TIPE** (`tipe`) — Préparation et soutenance pour les concours (CNC / Français)
- **Français – Philosophie** (`francais-philosophie`)
- **Langue Arabe et Traduction** (`arabe-traduction`)
- **Langue Anglaise** (`anglais`)
- **Éducation Physique et Sportive (EPS)** (`eps`)

##### 5. `PSI1` & `PSI2`
*(Les deux classes suivent exactement le même programme officiel)*
- **Mathématiques** (`mathematiques`)
- **Physique** (`physique`) — Mécanique des fluides, électronique de puissance, électromagnétisme + TP
- **Chimie** (`chimie`)
- **Sciences Industrielles de l'Ingénieur (SII)** (`sii`) — Automatique, chaînes d'énergie, mécanique des systèmes + TP
- **Informatique** (`informatique`) — Tronc commun
- **TIPE** (`tipe`) — Préparation et soutenance concours
- **Français – Philosophie** (`francais-philosophie`)
- **Langue Arabe et Traduction** (`arabe-traduction`)
- **Langue Anglaise** (`anglais`)
- **Éducation Physique et Sportive (EPS)** (`eps`)

##### 6. `2ECS`
- **Mathématiques** (`mathematiques`) — Algèbre bilinéaire, optimisation multivariée, variables aléatoires à densité
- **Informatique et Algorithmique** (`informatique`) — Simulation probabiliste et Python
- **Histoire, Géographie et Géopolitique du Monde Contemporain (HGGMC)** (`hggmc`) — Géodynamique de l'UE, Amériques, Afrique/Moyen-Orient, Maroc
- **Économie et Droit** (`economie-droit`) — Économie monétaire et financière, finances publiques, droit commercial et du travail
- **Gestion et Management** (`gestion-management`) — Comptabilité analytique, analyse financière, GRH, marketing
- **Culture Générale et Méthodologie (Français – Philosophie)** (`francais-philosophie`)
- **Langue Arabe et Traduction** (`arabe-traduction`)
- **Langue Anglaise** (`anglais`)
- **Éducation Physique et Sportive (EPS)** (`eps`)

---

## 3. ESPACE DÉDIÉ PAR CLASSE (PER-CLASS WORKSPACE)

Chaque classe (`MPSI`, `PCSI1`, `PCSI2`, `ECS`, `MP`, `PSI1`, `PSI2`, `2ECS`) dispose d'un espace complet, cloisonné et interactif (`/classes/[classSlug]`) donnant un accès intégral aux ressources pédagogiques, plannings et outils de communication de la classe.

### 3.1 Modules Obligatoires par Classe

1. **Bibliothèque Pédagogique (`Cours`, `TD`, `DS`, `Corrigés`)**
   - Accès complet et filtrable par matière officielle de la classe.
   - Consultation en ligne et téléchargement direct des supports PDF publiés.
   - Suivi de progression et recherche par chapitre ou mots-clés.

2. **Colloscope Interactif**
   - Tableau hebdomadaire des rotations de khôlles par trinôme, matière, khôlleur, salle et créneau horaire.
   - Téléchargement de la version PDF officielle du colloscope de la classe.

3. **Emploi du Temps Annuel**
   - Planning complet de l'année académique intégrant les créneaux hebdomadaires (`Cours`, `TD`, `TP`), les créneaux de `Devoirs Surveillés (DS)`, et les périodes de `Concours Blancs`.
   - Navigation par semaine / semestre et filtrage par type de séance.

4. **Annonces de Classe (`Annonces Officielle`)**
   - Fil d'annonces officielles propres à la classe (changements de salle, reports de cours, consignes de DS, informations de l'administration ou des professeurs).
   - Publication, modification et épinglage réservés exclusivement aux modérateurs de la classe (`Délégués`, `Professeurs`, `Administration`).

5. **Chat de Classe Temps Réel avec Intégration Modérateur**
   - Canal de discussion en temps réel (`Supabase Realtime`) réservé aux membres de la classe.
   - **Diffusion d'annonces par les modérateurs :** Les modérateurs (`Délégués`, `Professeurs`, `Administration`) peuvent publier des annonces directement dans le chat de classe. Toute annonce publiée par un modérateur s'affiche avec un badge distinctif (`Annonce Modérateur`), s'épingle automatiquement en haut du chat et se synchronise avec l'onglet **Annonces de Classe** afin qu'aucune information critique ne soit noyée dans les messages.
   - Contrôle d'accès strict via PostgreSQL Row-Level Security (RLS) vérifiant l'appartenance de l'utilisateur à la classe et son rôle.

---

## 4. ENGINEERING ARCHITECTURE

### 4.1 Technology Stack

#### Frontend
- Next.js using the App Router.
- TypeScript with strict mode enabled.
- React.
- Tailwind CSS.
- Framer Motion.
- Lucide React.
- Reusable, accessible UI components.
- React Hook Form + Zod for validated forms where appropriate.

#### Backend
- Supabase Authentication.
- Supabase PostgreSQL.
- Supabase Realtime.
- Supabase Storage.
- Supabase Row-Level Security.
- Next.js Server Actions and Route Handlers where appropriate.

#### Infrastructure
- GitHub for source control and versioned academic assets.
- Vercel for hosting and deployment.
- Supabase for authentication, database, realtime services, and dynamic file storage.

Use current stable, mutually compatible package versions. Avoid deprecated APIs.

### 4.2 Architectural Principles

Implement:

- Strict TypeScript typing.
- Modular feature-based architecture.
- Server Components by default.
- Client Components only when interactivity requires them.
- Server-side authorization for protected operations.
- Zod validation for all sensitive inputs.
- Centralized error handling.
- Reusable loading, empty, and error states.
- Pagination for potentially large datasets.
- Optimistic UI updates only when safe.
- Database indexes for frequently queried columns.
- Appropriate caching and cache invalidation.
- Responsive image and media optimization.
- Secure environment-variable handling.

Never use the Supabase service-role key in browser code.

Use the authenticated user's session for normal database operations and restrict elevated server-side operations to trusted server contexts.

---

## 5. HYBRID DATA & STORAGE ARCHITECTURE

The platform must use two distinct data-storage strategies.

### 5.1 GitHub + Vercel: Static Academic Assets

All officially published academic PDFs are stored in the GitHub repository, organisés par **classe exacte** et par **matière officielle**.

Directory structure:

```text
public/
  documents/
    colloscopes/
      MPSI/
      PCSI1/
      PCSI2/
      ECS/
      MP/
      PSI1/
      PSI2/
      2ECS/
    cours/
      MPSI/
        mathematiques/
        physique/
        chimie/
        sii/
        informatique/
        francais-philosophie/
        arabe-traduction/
        anglais/
        tipe/
      PCSI1/
        mathematiques/
        physique/
        chimie/
        sii/
        informatique/
        francais-philosophie/
        arabe-traduction/
        anglais/
        tipe/
      PCSI2/
        mathematiques/
        physique/
        chimie/
        sii/
        informatique/
        francais-philosophie/
        arabe-traduction/
        anglais/
        tipe/
      ECS/
        mathematiques/
        informatique/
        hggmc/
        economie-droit/
        gestion-management/
        francais-philosophie/
        arabe-traduction/
        anglais/
      MP/
        mathematiques/
        physique/
        chimie/
        sii/
        informatique/
        tipe/
        francais-philosophie/
        arabe-traduction/
        anglais/
      PSI1/
        mathematiques/
        physique/
        chimie/
        sii/
        informatique/
        tipe/
        francais-philosophie/
        arabe-traduction/
        anglais/
      PSI2/
        mathematiques/
        physique/
        chimie/
        sii/
        informatique/
        tipe/
        francais-philosophie/
        arabe-traduction/
        anglais/
      2ECS/
        mathematiques/
        informatique/
        hggmc/
        economie-droit/
        gestion-management/
        francais-philosophie/
        arabe-traduction/
        anglais/
    td/
      MPSI/
      PCSI1/
      PCSI2/
      ECS/
      MP/
      PSI1/
      PSI2/
      2ECS/
    ds/
      MPSI/
      PCSI1/
      PCSI2/
      ECS/
      MP/
      PSI1/
      PSI2/
      2ECS/
    concours-blancs/
      MPSI/
      PCSI1/
      PCSI2/
      ECS/
      MP/
      PSI1/
      PSI2/
      2ECS/
    corriges/
      MPSI/
      PCSI1/
      PCSI2/
      ECS/
      MP/
      PSI1/
      PSI2/
      2ECS/
    guides/
```

### 5.2 Supabase PostgreSQL, Realtime & Storage: Dynamic Data

All dynamic, user-generated, and operational data is stored and secured in Supabase:

- **Tables principales par classe :** `classes`, `class_subjects`, `class_timetables`, `class_colloscopes`, `class_announcements`, `class_messages`.
- **Sécurité RLS (Row-Level Security) :**
  - Lecture des ressources dynamiques (`timetables`, `colloscopes`, `announcements`, `messages`) restreinte aux étudiants et enseignants rattachés à la classe concernée (ainsi qu'à l'administration).
  - Écriture dans `class_messages` autorisée aux membres authentifiés de la classe.
  - Publication d'annonces (`class_announcements` et messages avec `is_announcement = true`) strictement réservée aux rôles modérateurs de la classe (`delegue`, `professeur`, `admin`).