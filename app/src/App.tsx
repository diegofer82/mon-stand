import { CircleAlert, CircleCheck, Database, Leaf, LoaderCircle, Server } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

interface Health {
  statut: 'ok' | 'degrade';
  environnement: 'local' | 'preview' | 'production';
  dateMetier: string;
  heureMetier: string;
  base: { ok: true; migration: string | null; tables: number; latenceMs: number } | { ok: false; erreur: string };
}

type Etat = { phase: 'chargement' } | { phase: 'ok'; health: Health } | { phase: 'erreur'; message: string };

const ENVIRONNEMENTS: Record<Health['environnement'], string> = {
  local: 'Local',
  preview: 'Preview',
  production: 'Production',
};

function dateLongue(dateMetier: string): string {
  const [annee, mois, jour] = dateMetier.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(annee ?? 1970, (mois ?? 1) - 1, jour ?? 1)),
  );
}

export function App() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        const health = (await response.json()) as Health;
        setEtat({ phase: 'ok', health });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setEtat({ phase: 'erreur', message: error instanceof Error ? error.message : 'Serveur injoignable' });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pt-16 pb-10">
      <header className="flex flex-col gap-2">
        <p className="flex items-center gap-2.5 font-display text-brand font-semibold tracking-tight">
          <Leaf aria-hidden className="size-8 text-violet" strokeWidth={2} />
          Debajah Création
        </p>
        <p className="text-body text-ink-muted">
          Mon Stand v2 est en construction. Cette page vérifie que l’application, le serveur et la base de données
          communiquent.
        </p>
      </header>

      <section
        aria-labelledby="etat-titre"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
        aria-busy={etat.phase === 'chargement'}
      >
        <h1 id="etat-titre" className="text-heading font-bold">
          État du service
        </h1>
        {etat.phase === 'chargement' && (
          <p className="flex items-center gap-2 text-body text-ink-muted">
            <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
            Vérification en cours…
          </p>
        )}
        {etat.phase === 'erreur' && (
          <Ligne ok={false} icone={<Server aria-hidden className="size-5" />} titre="Serveur injoignable">
            {etat.message}
          </Ligne>
        )}
        {etat.phase === 'ok' && <Rapport health={etat.health} />}
      </section>
    </main>
  );
}

function Rapport({ health }: { health: Health }) {
  const { base } = health;
  return (
    <>
      <Ligne
        ok
        icone={<Server aria-hidden className="size-5" />}
        titre={`Serveur · ${ENVIRONNEMENTS[health.environnement]}`}
      >
        {`Nouméa, ${dateLongue(health.dateMetier)} · ${health.heureMetier}`}
      </Ligne>
      {base.ok ? (
        <Ligne ok icone={<Database aria-hidden className="size-5" />} titre="Base de données connectée">
          {`${base.tables} tables · migration ${base.migration ?? 'aucune'} · ${base.latenceMs} ms`}
        </Ligne>
      ) : (
        <Ligne ok={false} icone={<Database aria-hidden className="size-5" />} titre="Base de données inaccessible">
          {base.erreur}
        </Ligne>
      )}
    </>
  );
}

function Ligne({ ok, icone, titre, children }: { ok: boolean; icone: ReactNode; titre: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-sunk text-violet">{icone}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body font-semibold">{titre}</p>
        <p className="text-caption text-ink-muted tabular-nums">{children}</p>
      </div>
      <span
        className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-caption font-semibold ${
          ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}
      >
        {ok ? (
          <CircleCheck aria-hidden className="size-3.5" strokeWidth={2.5} />
        ) : (
          <CircleAlert aria-hidden className="size-3.5" strokeWidth={2.5} />
        )}
        {ok ? 'OK' : 'Erreur'}
      </span>
    </div>
  );
}
