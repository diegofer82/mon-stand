// Panel del propietario (/admin, escritorio): emparejamiento de teléfonos y dispositivos.
// Protegido por Cloudflare Access; si no está configurado, por el jeton ADMIN_TOKEN pegado aquí (sessionStorage).
import { KeyRound, Link2, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Appareil, ErreurApi } from '../../shared/api';
import { Badge, Banniere, Marque } from '../composants/ui/Affichage';
import { Bouton } from '../composants/ui/Bouton';
import { Champ } from '../composants/ui/Saisie';
import { Carte, LigneListe } from '../composants/ui/Structure';
import { t } from '../textes/fr';
import { heure, dateCourte } from '../utils/format';

const CLE_JETON = 'mon-stand.admin.jeton';

function lireJeton(): string {
  try {
    return sessionStorage.getItem(CLE_JETON) ?? '';
  } catch {
    return '';
  }
}

class ErreurAdmin extends Error {
  constructor(
    public statut: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function appelAdmin<T>(chemin: string, jeton: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (jeton) headers.set('Authorization', `Bearer ${jeton}`);
  const r = await fetch(chemin, { ...init, headers, credentials: 'same-origin' });
  if (!r.ok) {
    let corps: Partial<ErreurApi> = {};
    try {
      corps = (await r.json()) as Partial<ErreurApi>;
    } catch {
      /* sin JSON */
    }
    throw new ErreurAdmin(r.status, corps.erreur?.code ?? 'inconnu', corps.erreur?.message ?? `Erreur ${r.status}`);
  }
  return (await r.json()) as T;
}

interface Chargement {
  etat: 'ok' | 'jeton' | 'erreur';
  appareils: Appareil[];
  message: string | null;
}

async function chargerAppareils(jeton: string): Promise<Chargement> {
  try {
    const r = await appelAdmin<{ appareils: Appareil[] }>('/api/admin/devices', jeton);
    return { etat: 'ok', appareils: r.appareils, message: null };
  } catch (e) {
    if (e instanceof ErreurAdmin && (e.statut === 401 || e.statut === 503)) {
      return { etat: 'jeton', appareils: [], message: e.statut === 503 ? t.admin.nonConfigure : null };
    }
    return { etat: 'erreur', appareils: [], message: e instanceof Error ? e.message : t.erreurs.generique };
  }
}

export function Admin() {
  const [jeton, setJeton] = useState(lireJeton);
  const [saisieJeton, setSaisieJeton] = useState('');
  const [etat, setEtat] = useState<'chargement' | 'ok' | 'jeton' | 'erreur'>('chargement');
  const [message, setMessage] = useState<string | null>(null);
  const [appareils, setAppareils] = useState<Appareil[]>([]);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);

  const [version, setVersion] = useState(0);
  const rafraichir = () => setVersion((v) => v + 1);

  useEffect(() => {
    let actif = true;
    void chargerAppareils(jeton).then((r) => {
      if (!actif) return;
      setAppareils(r.appareils);
      setEtat(r.etat);
      setMessage(r.message);
    });
    return () => {
      actif = false;
    };
  }, [jeton, version]);

  const enregistrerJeton = () => {
    const v = saisieJeton.trim();
    try {
      sessionStorage.setItem(CLE_JETON, v);
    } catch {
      /* sin almacenamiento */
    }
    setJeton(v);
    setSaisieJeton('');
  };

  const genererCode = async () => {
    try {
      setCode(await appelAdmin<{ code: string; expiresAt: string }>('/api/admin/pairing', jeton, { method: 'POST' }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.erreurs.generique);
    }
  };

  const revoquer = async (a: Appareil) => {
    if (!window.confirm(t.admin.revoquerConfirm(a.nom))) return;
    try {
      await appelAdmin('/api/admin/devices/' + encodeURIComponent(a.id), jeton, { method: 'DELETE' });
      rafraichir();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.erreurs.generique);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Marque />
        <h1 className="font-display text-title font-semibold">{t.admin.titre}</h1>
      </header>

      {etat === 'jeton' && (
        <Carte title={t.admin.jeton} icon={KeyRound}>
          {message && (
            <Banniere tone="warning" className="mb-3">
              {message}
            </Banniere>
          )}
          <p className="mb-3 text-caption text-ink-muted">{t.admin.jetonAide}</p>
          <div className="flex items-end gap-2">
            <Champ
              label={t.admin.jeton}
              type="password"
              value={saisieJeton}
              onChange={(e) => setSaisieJeton(e.target.value)}
              className="flex-1"
              autoComplete="off"
            />
            <Bouton variant="primary" size="md" onClick={enregistrerJeton} disabled={!saisieJeton.trim()}>
              {t.commun.valider}
            </Bouton>
          </div>
        </Carte>
      )}

      {etat === 'erreur' && <Banniere tone="danger">{message}</Banniere>}

      {etat === 'ok' && (
        <>
          {message && <Banniere tone="danger">{message}</Banniere>}
          <Carte title={t.admin.appairage} icon={Link2}>
            <p className="mb-3 text-caption text-ink-muted">{t.admin.appairageAide}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Bouton variant="primary" size="lg" icon={Link2} onClick={() => void genererCode()}>
                {t.admin.genererCode}
              </Bouton>
              {code && (
                <div className="flex flex-col">
                  <span className="font-mono text-amount-xl font-bold tracking-[0.2em] text-violet">{code.code}</span>
                  <span className="text-caption text-ink-muted">{t.admin.codeValable(heure(code.expiresAt))}</span>
                </div>
              )}
            </div>
          </Carte>

          <Carte
            title={t.admin.appareils}
            icon={Smartphone}
            action={
              <Bouton variant="ghost" size="sm" icon={RefreshCw} onClick={rafraichir}>
                {t.admin.actualiser}
              </Bouton>
            }
          >
            {appareils.length === 0 ? (
              <p className="text-body text-ink-muted">{t.admin.aucunAppareil}</p>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {appareils.map((a) => (
                  <LigneListe
                    key={a.id}
                    icon={Smartphone}
                    title={a.nom}
                    subtitle={`${t.admin.appaire} ${dateCourte(a.createdAt.slice(0, 10))}${a.lastSeenAt ? ` · ${t.admin.vu} ${dateCourte(a.lastSeenAt.slice(0, 10))} ${heure(a.lastSeenAt)}` : ''}`}
                  >
                    {a.actif ? (
                      <Badge tone="success">{t.admin.actif}</Badge>
                    ) : (
                      <Badge tone="neutral">{t.admin.revoque}</Badge>
                    )}
                    {a.actif && (
                      <Bouton variant="ghost" size="sm" icon={Trash2} onClick={() => void revoquer(a)}>
                        {t.admin.revoquer}
                      </Bouton>
                    )}
                  </LigneListe>
                ))}
              </div>
            )}
          </Carte>
        </>
      )}
    </main>
  );
}
