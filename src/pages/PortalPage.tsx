import { ArrowRight, KeyRound, Lock, LogOut, Shield, UserCheck } from 'lucide-react';
import React, { useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../shared/curriculum';

export function PortalPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const {
    user,
    authStatus,
    loadingStatus,
    login,
    bootstrapAdmin,
    loginWithAdminPasscode,
    logout,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // First-run Dev Team bootstrap state
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion.');
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
      setError(err instanceof Error ? err.message : 'Impossible d’activer le compte Équipe Dev.');
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
      setError(err instanceof Error ? err.message : 'Code Équipe Dev refusé.');
    } finally {
      setSubmitting(false);
    }
  };

  if (user) {
    return (
      <div className="bg-[#f7ead0] py-12 text-[#4a2e1a]">
        <div className="mx-auto max-w-5xl px-5 sm:px-6">
          <div className="flex flex-col justify-between gap-6 border-b-2 border-[#e6c58c] pb-8 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#a8532c]">
                Session Campus Active · {ROLE_LABELS[user.role]}
              </p>
              <h1 className="dune-heading mt-2 font-display text-3xl font-semibold text-[#a8532c]">
                {user.fullName}
              </h1>
              <p className="mt-2 text-sm text-[#4a2e1a]/80">
                {user.email}
                {user.classCode ? ` · Classe ${user.classCode}` : ''}
                {user.trinomeNumber ? ` · Trinôme ${user.trinomeNumber}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {user.role === 'admin' ? (
                <button
                  type="button"
                  onClick={() => onNavigate('/dev-team')}
                  className="btn-rust inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Ouvrir le Panneau Équipe Dev
                </button>
              ) : null}
              {user.classCode ? (
                <button
                  type="button"
                  onClick={() => onNavigate(`/classes/${user.classCode}`)}
                  className="btn-rust inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Espace {user.classCode}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={logout}
                className="btn-sand inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Déconnexion
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <GlowCard onClick={() => onNavigate('/classes')} className="p-5">
              <p className="text-xs font-medium text-[#a8532c]">Classes</p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#4a2e1a]">
                Espaces Sup &amp; Spé
              </h2>
              <p className="mt-1 text-xs text-[#4a2e1a]/80">
                Cours, colloscopes, emplois du temps et chat temps réel.
              </p>
            </GlowCard>
            <GlowCard onClick={() => onNavigate('/espace-prof')} className="p-5">
              <p className="text-xs font-medium text-[#a8532c]">Informatique</p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#4a2e1a]">
                Dépôts de TP Python
              </h2>
              <p className="mt-1 text-xs text-[#4a2e1a]/80">
                Consulter les énoncés et remettre vos fichiers Python.
              </p>
            </GlowCard>
            <GlowCard onClick={() => onNavigate('/internat')} className="p-5">
              <p className="text-xs font-medium text-[#a8532c]">Campus</p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#4a2e1a]">
                Internat &amp; Vie Étudiante
              </h2>
              <p className="mt-1 text-xs text-[#4a2e1a]/80">
                Horaires, permanences, BDE et page Instagram du Groupe Média.
              </p>
            </GlowCard>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f7ead0] py-12 text-[#4a2e1a]">
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <div className="border-b-2 border-[#e6c58c] pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a8532c]">
            Portail d’accès sécurisé
          </p>
          <h1 className="dune-heading mt-2 font-display text-3xl font-semibold text-[#a8532c]">
            Connexion à Site Prépa
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#4a2e1a]/85">
            L’inscription libre est désactivée. Connectez-vous avec les identifiants créés pour vous
            par l’Équipe Dev.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Login Card Only (No Self-Registration) */}
          <GlowCard className="p-6 lg:col-span-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#a8532c]">
              <KeyRound className="h-4 w-4" />
              <span>Identifiants personnels</span>
            </div>

            <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a]">Adresse email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@campus.ma"
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4a2e1a]">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-sm text-[#4a2e1a] placeholder:text-[#4a2e1a]/45"
                />
              </div>

              {error ? <p className="text-xs font-medium text-[#a8532c]">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="btn-rust w-full rounded-lg px-4 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Vérification...' : 'Se connecter'}
              </button>
            </form>
          </GlowCard>

          {/* First-Run Dev Team Bootstrap OR Passcode Access */}
          <div className="space-y-4 lg:col-span-2">
            {!loadingStatus && !authStatus.hasAdminUser && !authStatus.hasEnvPasscode ? (
              <GlowCard className="p-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#a8532c]">
                  <Shield className="h-4 w-4" />
                  <span>Premier démarrage · Équipe Dev</span>
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold text-[#4a2e1a]">
                  Activer le compte Équipe Dev
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-[#4a2e1a]/80">
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
                    className="w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  />
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Email Équipe Dev"
                    className="w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Mot de passe (8+ caractères)"
                    className="w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
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
                <div className="flex items-center gap-2 text-xs font-semibold text-[#a8532c]">
                  <UserCheck className="h-4 w-4" />
                  <span>Accès Équipe Dev</span>
                </div>
                <h2 className="mt-2 font-display text-base font-semibold text-[#4a2e1a]">
                  Connexion par code serveur
                </h2>
                <form onSubmit={handlePasscodeLogin} className="mt-4 space-y-3">
                  <input
                    type="password"
                    required
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder="Code administrateur serveur"
                    className="w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a]"
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
              <div className="flex items-center gap-2 text-xs font-semibold text-[#a8532c]">
                <Lock className="h-4 w-4" />
                <span>Création des comptes</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#4a2e1a]/85">
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
