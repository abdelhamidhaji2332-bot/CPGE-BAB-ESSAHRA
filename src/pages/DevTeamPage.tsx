import { Lock, Shield, Trash2, UserPlus } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { GlowCard } from '../components/GlowCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  CAMPUS_CLASSES,
  ROLE_LABELS,
  type ClassCode,
  type UserRole,
} from '../shared/curriculum';

interface AccountRow {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  class_code: ClassCode | null;
  trinome_number: number | null;
  subject_specialty: string | null;
  created_at: string;
}

export function DevTeamPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, apiFetch } = useAuth();
  const toast = useToast();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('etudiant');
  const [classCode, setClassCode] = useState<string>('MPSI');
  const [trinomeNumber, setTrinomeNumber] = useState<string>('1');
  const [subjectSpecialty, setSubjectSpecialty] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isDevTeam = user?.role === 'admin';

  const loadAccounts = useCallback(
    async (signal?: AbortSignal) => {
      if (!isDevTeam) return;
      setLoading(true);
      try {
        const res = await apiFetch('/api/admin/users', { signal });
        if (!res.ok) {
          if (!signal?.aborted) {
            toast.error('Impossible de charger la liste des comptes.');
          }
          return;
        }
        const data = await res.json();
        if (signal?.aborted) return;
        setAccounts(data.users || []);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!signal?.aborted) {
          toast.error('Erreur réseau lors du chargement des comptes.');
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [apiFetch, isDevTeam, toast]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadAccounts(controller.signal);
    return () => controller.abort();
  }, [loadAccounts]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          role,
          classCode: classCode === 'NONE' ? null : classCode,
          trinomeNumber: trinomeNumber ? Number(trinomeNumber) : null,
          subjectSpecialty: subjectSpecialty.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Création du compte impossible.';
        setFeedback(msg);
        toast.error(msg);
        return;
      }
      setFullName('');
      setEmail('');
      setPassword('');
      setSubjectSpecialty('');
      const msg = `Compte créé pour ${data.user.fullName} (${ROLE_LABELS[role]}).`;
      setFeedback(msg);
      toast.success(msg);
      await loadAccounts();
    } catch {
      const msg = 'Erreur réseau lors de la création du compte.';
      setFeedback(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleUpdate = async (userId: number, nextRole: UserRole, nextClass: string | null) => {
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: nextRole,
          classCode: nextClass || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Mise à jour du rôle impossible.');
        return;
      }
      toast.success('Rôle et classe mis à jour.');
      await loadAccounts();
    } catch {
      toast.error('Erreur réseau lors de la mise à jour.');
    }
  };

  const handleDeleteAccount = async (userId: number) => {
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Suppression refusée.';
        setFeedback(msg);
        toast.error(msg);
        return;
      }
      toast.success('Compte supprimé avec succès.');
      await loadAccounts();
    } catch {
      toast.error('Erreur réseau lors de la suppression.');
    }
  };

  if (!isDevTeam) {
    return (
      <div className="bg-[#f7ead0] py-16 text-[#4a2e1a] dark:bg-[#12100e] dark:text-[#f5ebd6]">
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <GlowCard className="p-8 text-center">
            <Lock className="mx-auto h-9 w-9 text-[#a8532c] dark:text-[#e88c5d]" />
            <h1 className="mt-3 font-display text-2xl font-semibold text-[#a8532c] dark:text-[#e88c5d]">
              Panneau Équipe Dev — Accès exclusif
            </h1>
            <p className="mt-2 text-sm text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
              Seule l’Équipe Dev est autorisée à accéder à ce panneau et à créer des comptes sur Site
              Prépa.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => onNavigate('/portail')}
                className="btn-rust rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
              >
                Aller à la connexion
              </button>
            </div>
          </GlowCard>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f7ead0] py-6 text-[#4a2e1a] dark:bg-[#12100e] dark:text-[#f5ebd6] sm:py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b-2 border-[#e6c58c] pb-5 dark:border-[#5a4634] sm:flex-row sm:items-end sm:pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8532c] dark:text-[#e88c5d]">
              <Shield className="h-3.5 w-3.5" />
              <span>Contrôle d’accès exclusif</span>
            </div>
            <h1 className="dune-heading mt-1.5 sm:mt-2 font-display text-2xl sm:text-3xl font-semibold text-[#a8532c] dark:text-[#e88c5d]">
              Panneau Équipe Dev — Création des comptes
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-[#4a2e1a]/85 dark:text-[#e3d4b7]">
              Créez et attribuez les comptes des élèves, délégués, professeurs, maîtres d’internat,
              BDE (président des étudiants) et Groupe Média (page Instagram).
            </p>
          </div>
          <span className="font-mono text-xs font-semibold text-[#4a2e1a] dark:text-[#f5ebd6] tabular-nums">
            {accounts.length} compte{accounts.length > 1 ? 's' : ''} actif{accounts.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Create Account Form (Only Dev Team) */}
        <GlowCard className="mt-6 sm:mt-8 p-4 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#a8532c] dark:text-[#e88c5d]">
            <UserPlus className="h-4 w-4" />
            <span>Créer un nouveau compte utilisateur</span>
          </div>

          <form onSubmit={handleCreateAccount} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#f5ebd6]">Nom complet</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Youssef El Amrani"
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#f5ebd6]">Adresse email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="y.elamrani@campus.ma"
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#f5ebd6]">Mot de passe initial</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#f5ebd6]">Rôle</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                >
                  {Object.entries(ROLE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#f5ebd6]">Classe CPGE</label>
                <select
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                >
                  <option value="NONE">Toutes / Transverse</option>
                  {CAMPUS_CLASSES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.level})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#f5ebd6]">Trinôme (optionnel)</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={trinomeNumber}
                  onChange={(e) => setTrinomeNumber(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4a2e1a] dark:text-[#f5ebd6]">Spécialité (optionnel)</label>
                <input
                  type="text"
                  value={subjectSpecialty}
                  onChange={(e) => setSubjectSpecialty(e.target.value)}
                  placeholder="Ex: Mathématiques"
                  className="mt-1.5 w-full rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-3 py-2 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6] dark:placeholder:text-[#b5a383]"
                />
              </div>
            </div>

            {feedback ? <p className="text-xs font-semibold text-[#a8532c] dark:text-[#e88c5d]">{feedback}</p> : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="btn-rust rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Création...' : 'Créer le compte'}
              </button>
            </div>
          </form>
        </GlowCard>

        {/* Mobile Account Cards */}
        <div className="mt-6 space-y-3 sm:hidden">
          {loading ? (
            <div className="rounded-xl border border-[#c98f4f] bg-[#fcf4e4] p-6 text-center text-xs text-[#4a2e1a]/70 dark:border-[#5a4634] dark:bg-[#1c1916] dark:text-[#c8b696]">
              Chargement des comptes...
            </div>
          ) : (
            accounts.map((acc) => (
              <GlowCard key={acc.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm text-[#4a2e1a] dark:text-[#f5ebd6]">{acc.full_name}</p>
                    <p className="truncate text-xs text-[#4a2e1a]/75 dark:text-[#c8b696]">{acc.email}</p>
                  </div>
                  {acc.id !== user?.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(acc.id)}
                      aria-label={`Supprimer ${acc.full_name}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#c98f4f] text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] dark:border-[#5a4634] dark:text-[#e88c5d] dark:hover:bg-[#c25e32] dark:hover:text-[#fdf6e9] transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-[#a8532c] dark:text-[#e88c5d] shrink-0">Session active</span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select
                    value={acc.role}
                    onChange={(e) => handleRoleUpdate(acc.id, e.target.value as UserRole, acc.class_code)}
                    className="min-h-[40px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-2.5 py-1.5 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  >
                    {Object.entries(ROLE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={acc.class_code || ''}
                    onChange={(e) => handleRoleUpdate(acc.id, acc.role, e.target.value || null)}
                    className="min-h-[40px] rounded-lg border border-[#c98f4f] bg-[#f7ead0] px-2.5 py-1.5 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                  >
                    <option value="">Aucune</option>
                    {CAMPUS_CLASSES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </GlowCard>
            ))
          )}
        </div>

        {/* Desktop Accounts Table */}
        <div className="mt-8 hidden sm:block overflow-x-auto rounded-xl border border-[#c98f4f] bg-[#fcf4e4] dark:border-[#5a4634] dark:bg-[#1c1916]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#c98f4f]/50 bg-[#e6c58c]/55 text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#27221c] dark:text-[#f5ebd6]">
              <tr>
                <th className="px-4 py-3 font-semibold">Nom</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Rôle</th>
                <th className="px-4 py-3 font-semibold">Classe</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c98f4f]/30 dark:divide-[#423428]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[#4a2e1a]/70 dark:text-[#c8b696]">
                    Chargement des comptes...
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-[#e6c58c]/20 dark:hover:bg-[#27221c]">
                    <td className="px-4 py-3 font-semibold text-[#4a2e1a] dark:text-[#f5ebd6]">{acc.full_name}</td>
                    <td className="px-4 py-3 text-[#4a2e1a]/80 dark:text-[#e3d4b7]">{acc.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={acc.role}
                        onChange={(e) => handleRoleUpdate(acc.id, e.target.value as UserRole, acc.class_code)}
                        className="rounded border border-[#c98f4f] bg-[#f7ead0] px-2 py-1 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                      >
                        {Object.entries(ROLE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={acc.class_code || ''}
                        onChange={(e) => handleRoleUpdate(acc.id, acc.role, e.target.value || null)}
                        className="rounded border border-[#c98f4f] bg-[#f7ead0] px-2 py-1 text-xs text-[#4a2e1a] dark:border-[#5a4634] dark:bg-[#26211c] dark:text-[#f5ebd6]"
                      >
                        <option value="">Aucune</option>
                        {CAMPUS_CLASSES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {acc.id !== user?.id ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc.id)}
                          aria-label={`Supprimer ${acc.full_name}`}
                          className="rounded border border-[#c98f4f] p-1.5 text-[#a8532c] hover:bg-[#a8532c] hover:text-[#f7ead0] dark:border-[#5a4634] dark:text-[#e88c5d] dark:hover:bg-[#c25e32] dark:hover:text-[#fdf6e9] transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#4a2e1a]/60 dark:text-[#c8b696]">Session active</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
