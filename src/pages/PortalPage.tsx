import { ArrowRight, KeyRound, Lock, LogOut, Shield, UserCheck } from 'lucide-react';
import React, { useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABELS } from '../shared/curriculum';

export function PortalPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const {
    user,
    authStatus,
    loadingStatus,
    signInWithGoogle,
    login,
    bootstrapAdmin,
    loginWithAdminPasscode,
    logout,
  } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // First-run Dev Team bootstrap state
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de connexion Google.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de connexion.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await bootstrapAdmin({
        fullName: adminName,
        email: adminEmail,
        password: adminPassword,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Impossible d’activer le compte Équipe Dev.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginWithAdminPasscode(adminPasscode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Code Équipe Dev refusé.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (user) {
    return (
      <div className="bg-[#f7ead0] py-6 text-[#4a2e1a] dark:bg-[#12100e] dark:text-[#f5ebd6] sm:py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-4 border-b-2 border-[#e6c58c] pb-6 dark:border-[#332920] sm:flex-row sm:items-end sm:gap-6 sm:pb-8">
            <div>
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
                Session Campus Active · {ROLE_LABELS[user.role]}
              </p>
              <h1 className="dune-heading mt-1.5 sm:mt-2 font-display text-2xl sm:text-3xl font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                {user.fullName}
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                {user.email}
                {user.classCode ? ` · Classe ${user.classCode}` : ''}
                {user.trinomeNumber ? ` · Trinôme ${user.trinomeNumber}` : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              {user.role === 'admin' ? (
                <button
                  type="button"
                  onClick={() => onNavigate('/dev-team')}
                  className="btn-rust inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer sm:min-h-0"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Ouvrir le Panneau Équipe Dev
                </button>
              ) : null}
              {user.classCode ? (
                <button
                  type="button"
                  onClick={() => onNavigate(`/classes/${user.classCode}`)}
                  className="btn-rust inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer sm:min-h-0"
                >
                  Espace {user.classCode}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={logout}
                className="btn-sand inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium cursor-pointer sm:min-h-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                Déconnexion
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <GlowCard onClick={() => onNavigate('/classes')} className="p-5">
              <p className="text-xs font-medium text-[#a8532c] dark:text-[#e88c5d]">Classes</p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                Espaces Sup &amp; Spé
              </h2>
              <p className="mt-1 text-xs text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                Cours, colloscopes, emplois du temps et chat temps réel.
              </p>
            </GlowCard>
            <GlowCard onClick={() => onNavigate('/ressources')} className="p-5">
              <p className="text-xs font-medium text-[#a8532c] dark:text-[#e88c5d]">Ressources</p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                Bibliothèque PDF
              </h2>
              <p className="mt-1 text-xs text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                Consulter et télécharger les cours, TD, DS et corrigés officiels.
              </p>
            </GlowCard>
            <GlowCard onClick={() => onNavigate('/administration')} className="p-5">
              <p className="text-xs font-medium text-[#a8532c] dark:text-[#e88c5d]">Administration</p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                Annonces officielles
              </h2>
              <p className="mt-1 text-xs text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                Consulter ou publier les notes officielles de la direction.
              </p>
            </GlowCard>
            <GlowCard onClick={() => onNavigate('/internat')} className="p-5">
              <p className="text-xs font-medium text-[#a8532c] dark:text-[#e88c5d]">Campus</p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                Internat &amp; Vie Étudiante
              </h2>
              <p className="mt-1 text-xs text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                Horaires, permanences, BDE et page Instagram du Groupe Média.
              </p>
            </GlowCard>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f7ead0] py-6 text-[#4a2e1a] dark:bg-[#12100e] dark:text-[#f5ebd6] sm:py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="border-b-2 border-[#e6c58c] pb-5 dark:border-[#332920] sm:pb-6">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
            Portail d’accès sécurisé
          </p>
          <h1 className="dune-heading mt-1.5 sm:mt-2 font-display text-2xl sm:text-3xl font-semibold text-[#a8532c] dark:text-[#e88c5d]">
            Connexion à Site Prépa
          </h1>
          <p className="mt-2 max-w-2xl text-xs sm:text-sm text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
            L’inscription libre est désactivée. Connectez-vous avec les identifiants créés pour vous
            par l’Équipe Dev.
          </p>
        </div>

        <div className="mt-6 sm:mt-8 grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-5">
          {/* Login Card */}
          <GlowCard className="p-4 sm:p-6 lg:col-span-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#a8532c] dark:text-[#e88c5d]">
              <KeyRound className="h-4 w-4" />
              <span>Identifiants personnels</span>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="btn-sand flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.92h5.27c-.23 1.45-1.69 4.25-5.27 4.25-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.81 0 3.02.77 3.71 1.44l2.53-2.44C16.81 4.07 14.7 3.2 12.18 3.2 7.21 3.2 3.18 7.23 3.18 12.2s4.03 9 9 9c5.19 0 8.64-3.65 8.64-8.79 0-.59-.06-1.04-.15-1.31z"
                  />
                </svg>
                <span>Se connecter avec Google</span>
              </button>
              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#e6c58c] dark:bg-[#332920]" />
                <span className="text-[11px] uppercase tracking-wider text-[#4a2e1a]/60 dark:text-[#c8b696]">
                  ou identifiants campus
                </span>
                <span className="h-px flex-1 bg-[#e6c58c] dark:bg-[#332920]" />
              </div>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Adresse email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@campus.ma"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#e3d4b7]">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383] sm:min-h-0"
                />
              </div>

              {error ? <p className="text-xs font-medium text-[#a8532c] dark:text-[#e88c5d]">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="btn-rust min-h-[44px] w-full rounded-lg px-4 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Vérification...' : 'Se connecter'}
              </button>
            </form>
          </GlowCard>

          {/* First-Run Dev Team Bootstrap OR Passcode Access */}
          <div className="space-y-4 lg:col-span-2">
            {!loadingStatus && !authStatus.hasAdminUser && !authStatus.hasEnvPasscode ? (
              <GlowCard className="p-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                  <Shield className="h-4 w-4" />
                  <span>Premier démarrage · Équipe Dev</span>
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                  Activer le compte Équipe Dev
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-[#4a2e1a]/80 dark:text-[#e3d4b7]">
                  Aucun compte Équipe Dev n’est encore configuré. Créez le premier compte pour
                  accéder au Panneau Équipe Dev et créer les comptes du campus.
                </p>

                <form onSubmit={handleBootstrapAdmin} className="mt-4 space-y-3">
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Nom du responsable Dev"
                    className="w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Email Équipe Dev"
                    className="w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Mot de passe (8+ caractères)"
                    className="w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-rust w-full rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Activer l’Équipe Dev
                  </button>
                </form>
              </GlowCard>
            ) : null}

            {!loadingStatus && authStatus.hasEnvPasscode ? (
              <GlowCard className="p-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                  <UserCheck className="h-4 w-4" />
                  <span>Accès Équipe Dev</span>
                </div>
                <h2 className="mt-2 font-display text-base font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">
                  Connexion par code serveur
                </h2>
                <form onSubmit={handlePasscodeLogin} className="mt-4 space-y-3">
                  <input
                    type="password"
                    required
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder="Code administrateur serveur"
                    className="w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] placeholder:text-[#4a2e1a]/45 dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-sand w-full rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Accéder au Panneau Dev
                  </button>
                </form>
              </GlowCard>
            ) : null}

            <GlowCard className="p-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#a8532c] dark:text-[#e88c5d]">
                <Lock className="h-4 w-4" />
                <span>Création des comptes</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
                Seule l’<strong>Équipe Dev</strong> dispose des autorisations nécessaires pour créer
                des comptes élèves, délégués, professeurs, maîtres d’internat, BDE (président des
                étudiants) et Groupe Média (page Instagram) depuis le Panneau Équipe Dev.
              </p>
            </GlowCard>
          </div>
        </div>
      </div>
    </div>
  );
}
