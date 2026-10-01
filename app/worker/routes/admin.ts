// Administración (propietario): emparejamiento, dispositivos, KPIs, jornadas y PDF, horas, exportes CSV,
// tasas y archivos. Protegida por authAdmin.
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { Hono } from 'hono';

import { CODE_APPAIRAGE_LONGUEUR, type Appareil } from '../../shared/api';
import { resumeJournee } from '../../shared/domaine/cloture';
import { formatDuree, montantDuCfp } from '../../shared/domaine/heures';
import { archiverMois, listerArchives, moisPrecedent } from '../archive';
import { erreur, genererCodeAppairage, type AppEnv } from '../auth';
import { schema } from '../db';
import { chargerComptages, chargerJournees, chargerTaux, chargerVentes } from '../lectures';
import { archiverCloture } from '../pdf/cloture';
import { DEVICE_SERVEUR_ID, semerSiVide } from '../semence';
import { actualiserTaux, CLE_KV_TAUX, type TableTauxKv } from '../taux';

export const admin = new Hono<AppEnv>();

const CODE_DUREE_MS = 15 * 60_000;
const MOIS = /^\d{4}-\d{2}$/;

function moisDemande(c: { req: { query: (k: string) => string | undefined } }): string {
  const m = c.req.query('mois');
  if (m && MOIS.test(m)) return m;
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Pacific/Noumea',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date()))
    p[x.type] = x.value;
  return `${p.year}-${p.month}`;
}

function moisSuivant(mois: string): string {
  const [a, m] = mois.split('-').map(Number);
  return m === 12 ? `${(a ?? 0) + 1}-01` : `${a}-${String((m ?? 0) + 1).padStart(2, '0')}`;
}

const BOM = String.fromCharCode(0xfeff); // Excel reconoce el UTF-8 con BOM

function csv(lignes: (string | number | null)[][]): string {
  const cellule = (v: string | number | null) => {
    if (v === null) return '';
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM + separador «;»: Excel en francés lo abre bien.
  return BOM + lignes.map((l) => l.map(cellule).join(';')).join('\r\n') + '\r\n';
}

admin.get('/moi', (c) => c.json({ admin: c.get('admin'), environnement: c.env.ENVIRONMENT }));

// ---- Emparejamiento y dispositivos ----

admin.post('/pairing', async (c) => {
  const db = c.get('db');
  await semerSiVide(db);
  const code = genererCodeAppairage(CODE_APPAIRAGE_LONGUEUR);
  const expiresAt = new Date(Date.now() + CODE_DUREE_MS).toISOString();
  await db.insert(schema.pairingCodes).values({ code, expiresAt });
  return c.json({ code, expiresAt }, 201);
});

admin.get('/devices', async (c) => {
  const db = c.get('db');
  const rows = await db.select().from(schema.devices).orderBy(desc(schema.devices.createdAt));
  const appareils: Appareil[] = rows
    .filter((d) => d.id !== DEVICE_SERVEUR_ID)
    .map((d) => ({
      id: d.id,
      nom: d.nom,
      vendeurId: d.vendeurId,
      createdAt: d.createdAt,
      lastSeenAt: d.lastSeenAt,
      actif: d.tokenHash !== '',
    }));
  return c.json({ appareils });
});

admin.delete('/devices/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const rows = await db
    .select({ id: schema.devices.id })
    .from(schema.devices)
    .where(eq(schema.devices.id, id))
    .limit(1);
  if (!rows[0] || id === DEVICE_SERVEUR_ID) return erreur(c, 404, 'introuvable', 'Appareil introuvable');
  await db.update(schema.devices).set({ tokenHash: '' }).where(eq(schema.devices.id, id));
  return c.json({ ok: true });
});

// ---- KPIs y jornadas ----

async function journeesDuMois(db: AppEnv['Variables']['db'], mois: string) {
  const journees = await chargerJournees(db, { mois, limite: 1000 });
  const ventes = await chargerVentes(
    db,
    journees.map((j) => j.id),
  );
  return { journees, ventes };
}

admin.get('/kpis', async (c) => {
  const db = c.get('db');
  const mois = moisDemande(c);
  const { journees, ventes } = await journeesDuMois(db, mois);
  const vendeurs = await db.select().from(schema.vendeurs);
  const nomVendeur = new Map(vendeurs.map((v) => [v.id, v.prenom]));
  const parJournee = journees.map((j) => {
    const r = resumeJournee(ventes.filter((v) => v.journeeId === j.id));
    return {
      id: j.id,
      dateLocale: j.dateLocale,
      lieu: j.lieu,
      vendeur: nomVendeur.get(j.vendeurId) ?? j.vendeurId,
      ouverteAt: j.ouverteAt,
      clotureeAt: j.clotureeAt,
      pdfKey: j.pdfKey,
      nbVentes: r.nbVentes,
      totalEncaisseCfp: r.totalEncaisseCfp,
      panierMoyenCfp: r.panierMoyenCfp,
      parPaiement: r.parPaiement,
    };
  });
  const parLieu = new Map<string, { lieu: string; nbJournees: number; nbVentes: number; totalEncaisseCfp: number }>();
  for (const j of parJournee) {
    const e = parLieu.get(j.lieu) ?? { lieu: j.lieu, nbJournees: 0, nbVentes: 0, totalEncaisseCfp: 0 };
    e.nbJournees++;
    e.nbVentes += j.nbVentes;
    e.totalEncaisseCfp += j.totalEncaisseCfp;
    parLieu.set(j.lieu, e);
  }
  const total = resumeJournee(ventes, 10);
  // Horas del mes por vendedora: sesiones cerradas cuyo inicio cae en el mes (Nouméa).
  const debut = `${mois}-01T00:00:00+11:00`;
  const fin = `${moisSuivant(mois)}-01T00:00:00+11:00`;
  const sessions = await db
    .select()
    .from(schema.sessionsTravail)
    .where(
      and(
        gte(schema.sessionsTravail.debut, new Date(debut).toISOString()),
        lt(schema.sessionsTravail.debut, new Date(fin).toISOString()),
      ),
    );
  const heures = vendeurs.map((v) => {
    const siennes = sessions.filter((s) => s.vendeurId === v.id && s.fin && s.dureeMin !== null);
    const totalMin = siennes.reduce((t, s) => t + (s.dureeMin ?? 0), 0);
    const aPayerMin = siennes.filter((s) => !s.payeeAt).reduce((t, s) => t + (s.dureeMin ?? 0), 0);
    return {
      vendeurId: v.id,
      prenom: v.prenom,
      tauxHoraireCfp: v.tauxHoraireCfp,
      nbSessions: siennes.length,
      totalMin,
      totalTexte: formatDuree(totalMin),
      aPayerCfp: siennes
        .filter((s) => !s.payeeAt)
        .reduce((t, s) => t + montantDuCfp(s.dureeMin ?? 0, v.tauxHoraireCfp), 0),
      aPayerTexte: formatDuree(aPayerMin),
      payeCfp: siennes
        .filter((s) => s.payeeAt)
        .reduce((t, s) => t + montantDuCfp(s.dureeMin ?? 0, v.tauxHoraireCfp), 0),
    };
  });
  return c.json({
    mois,
    total: {
      nbJournees: journees.length,
      nbVentes: total.nbVentes,
      nbArticles: total.nbArticles,
      totalEncaisseCfp: total.totalEncaisseCfp,
      panierMoyenCfp: total.panierMoyenCfp,
      parPaiement: total.parPaiement,
      topArticles: total.topArticles,
    },
    parJournee: parJournee.sort((a, b) => b.dateLocale.localeCompare(a.dateLocale)),
    parLieu: [...parLieu.values()].sort((a, b) => b.totalEncaisseCfp - a.totalEncaisseCfp),
    heures,
  });
});

admin.get('/journees/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const [journee] = await chargerJournees(db, { ids: [id] });
  if (!journee) return erreur(c, 404, 'introuvable', 'Journée introuvable');
  const [ventes, comptages] = await Promise.all([chargerVentes(db, [id]), chargerComptages(db, [id])]);
  return c.json({ journee, ventes, comptages, resume: resumeJournee(ventes, 10) });
});

/** El cierre archivado (PDF, o HTML si se generó sin navegador). */
admin.get('/journees/:id/pdf', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const rows = await db
    .select({ pdfKey: schema.journees.pdfKey })
    .from(schema.journees)
    .where(eq(schema.journees.id, id))
    .limit(1);
  const cle = rows[0]?.pdfKey;
  if (!cle) return erreur(c, 404, 'introuvable', 'Pas de clôture archivée pour cette journée');
  const objet = await c.env.FILES.get(cle);
  if (!objet) return erreur(c, 404, 'introuvable', 'Fichier absent de R2');
  const type = objet.httpMetadata?.contentType ?? 'application/octet-stream';
  c.header('Content-Type', type);
  c.header('Content-Disposition', `inline; filename="${cle.split('/').pop() ?? 'cloture'}"`);
  c.header('Cache-Control', 'private, max-age=0');
  return c.body(objet.body);
});

/** (Re)genera el cierre archivado. */
admin.post('/journees/:id/pdf', async (c) => {
  const db = c.get('db');
  const cle = await archiverCloture(c.env, db, c.req.param('id'));
  if (!cle) return erreur(c, 404, 'introuvable', 'Journée introuvable');
  return c.json({ cle, format: cle.endsWith('.pdf') ? 'pdf' : 'html' });
});

// ---- Exportes CSV ----

admin.get('/export/ventes.csv', async (c) => {
  const db = c.get('db');
  const mois = moisDemande(c);
  const { journees, ventes } = await journeesDuMois(db, mois);
  const lieu = new Map(journees.map((j) => [j.id, j]));
  const lignes: (string | number | null)[][] = [
    [
      'date',
      'heure',
      'lieu',
      'vente_id',
      'article',
      'quantite',
      'prix_unitaire_cfp',
      'total_ligne_cfp',
      'sous_total_cfp',
      'remise_panier_cfp',
      'remise_encaissement_cfp',
      'total_cfp',
      'paiements',
      'encaisse_cfp',
      'annulee',
    ],
  ];
  const heure = (iso: string) =>
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Pacific/Noumea',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(iso));
  for (const v of [...ventes].sort((a, b) => a.ts.localeCompare(b.ts))) {
    const j = lieu.get(v.journeeId);
    const paiements = v.paiements
      .map(
        (p) =>
          `${p.montantDevise} ${p.devise}${p.renduMontant ? ` (rendu ${p.renduMontant} ${p.renduDevise ?? p.devise})` : ''}`,
      )
      .join(' + ');
    const encaisse = v.paiements.reduce((s, p) => s + p.montantCfp, 0);
    for (const l of v.lignes) {
      lignes.push([
        j?.dateLocale ?? '',
        heure(v.ts),
        j?.lieu ?? '',
        v.id,
        l.nomSnapshot,
        l.qty,
        l.prixUnitCfp,
        l.totalCfp,
        v.sousTotalCfp,
        v.remisePanierCfp,
        v.remiseEncaissementCfp,
        v.totalCfp,
        paiements,
        encaisse,
        v.annuleeAt ? 'oui' : 'non',
      ]);
    }
  }
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="ventes_${mois}.csv"`);
  return c.body(csv(lignes));
});

admin.get('/export/heures.csv', async (c) => {
  const db = c.get('db');
  const mois = moisDemande(c);
  const vendeurs = new Map((await db.select().from(schema.vendeurs)).map((v) => [v.id, v]));
  const debut = new Date(`${mois}-01T00:00:00+11:00`).toISOString();
  const fin = new Date(`${moisSuivant(mois)}-01T00:00:00+11:00`).toISOString();
  const sessions = await db
    .select()
    .from(schema.sessionsTravail)
    .where(and(gte(schema.sessionsTravail.debut, debut), lt(schema.sessionsTravail.debut, fin)));
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Pacific/Noumea',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const lignes: (string | number | null)[][] = [
    ['vendeuse', 'debut', 'fin', 'duree_min', 'duree', 'taux_horaire_cfp', 'montant_cfp', 'payee', 'commentaire'],
  ];
  for (const s of sessions.sort((a, b) => a.debut.localeCompare(b.debut))) {
    const v = vendeurs.get(s.vendeurId);
    lignes.push([
      v?.prenom ?? s.vendeurId,
      fmt.format(new Date(s.debut)),
      s.fin ? fmt.format(new Date(s.fin)) : '',
      s.dureeMin,
      s.dureeMin !== null ? formatDuree(s.dureeMin) : '',
      v?.tauxHoraireCfp ?? 0,
      s.dureeMin !== null ? montantDuCfp(s.dureeMin, v?.tauxHoraireCfp ?? 0) : 0,
      s.payeeAt ? 'oui' : 'non',
      s.commentaire,
    ]);
  }
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="heures_${mois}.csv"`);
  return c.body(csv(lignes));
});

// ---- Tasas y archivos ----

admin.get('/taux', async (c) => {
  const db = c.get('db');
  const kv = await c.env.TAUX.get<TableTauxKv>(CLE_KV_TAUX, 'json');
  const historique = await chargerTaux(db);
  return c.json({ kv, historique });
});

admin.post('/taux/actualiser', async (c) => {
  try {
    const table = await actualiserTaux(c.env, c.get('db'));
    return c.json(table);
  } catch (e) {
    return erreur(c, 503, 'interne', e instanceof Error ? e.message : 'Taux indisponibles');
  }
});

admin.get('/archives', async (c) => c.json({ archives: await listerArchives(c.env) }));

admin.post('/archives', async (c) => {
  const mois = c.req.query('mois');
  const cible = mois && MOIS.test(mois) ? mois : moisPrecedent(new Date());
  const r = await archiverMois(c.env, c.get('db'), cible);
  return c.json({ mois: cible, ...r }, 201);
});

admin.get('/archives/:mois', async (c) => {
  const mois = c.req.param('mois');
  if (!MOIS.test(mois)) return erreur(c, 400, 'requete_invalide', 'Mois AAAA-MM attendu');
  const objet = await c.env.FILES.get(`${c.env.R2_PREFIX}archives/${mois}.json`);
  if (!objet) return erreur(c, 404, 'introuvable', 'Archive absente');
  c.header('Content-Type', 'application/json');
  c.header('Content-Disposition', `attachment; filename="mon-stand_${mois}.json"`);
  return c.body(objet.body);
});
