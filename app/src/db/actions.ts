// Acciones de la vendedora: construyen operaciones (UUID, instante, dispositivo), las aplican en local
// y las encolan para el servidor. Toda la aritmética viene del noyau (shared/domaine).
import { dateMetier } from '../../shared/dates';
import { ecartComptage } from '../../shared/domaine/cloture';
import {
  calculerPaiement,
  remiseEncaissement,
  type DemandePaiement,
  type ResultatPaiement,
} from '../../shared/domaine/encaissement';
import { arrondir30, dureeMinutes } from '../../shared/domaine/heures';
import { totalLigneCfp, totauxPanier } from '../../shared/domaine/panier';
import type {
  Article,
  Categorie,
  ComptageCaisse,
  Journee,
  LignePanier,
  MotifStock,
  MouvementStock,
  Paiement,
  SessionTravail,
  Vente,
} from '../../shared/domaine/types';
import type { Devise } from '../../shared/montants';
import type { OpDe } from '../../shared/ops';
import { genererSel, hacherPin } from '../../shared/pin';
import { emettreOp } from './appliquer';
import { db } from './db';
import { deviceId } from './meta';

interface Contexte {
  vendeurId: string;
}

const uuid = () => crypto.randomUUID();

async function enveloppe(ctx: Contexte | null) {
  return { opId: uuid(), deviceId: await deviceId(), vendeurId: ctx?.vendeurId ?? null, ts: new Date().toISOString() };
}

// ---- Journée ----

export async function ouvrirJournee(
  ctx: Contexte,
  lieu: string,
  fonds: Partial<Record<Devise, number>>,
): Promise<Journee> {
  const env = await enveloppe(ctx);
  const journee: Journee = {
    id: `jour_${uuid()}`,
    dateLocale: dateMetier(new Date(env.ts)),
    lieu: lieu.trim(),
    vendeurId: ctx.vendeurId,
    fonds,
    ouverteAt: env.ts,
    clotureeAt: null,
    commentaireCloture: null,
    pdfKey: null,
  };
  await emettreOp({ ...env, type: 'journee.ouvrir', journee });
  return journee;
}

export interface ComptageSaisi {
  devise: Devise;
  attendu: number;
  compte: number;
}

export async function cloturerJournee(
  ctx: Contexte,
  journeeId: string,
  commentaire: string,
  comptages: ComptageSaisi[],
): Promise<void> {
  const env = await enveloppe(ctx);
  const lignes: ComptageCaisse[] = comptages.map((c) => ({
    id: `cpt_${uuid()}`,
    journeeId,
    devise: c.devise,
    attendu: c.attendu,
    compte: c.compte,
    ecart: ecartComptage(c.attendu, c.compte, c.devise),
  }));
  await emettreOp({
    ...env,
    type: 'journee.cloturer',
    journeeId,
    clotureeAt: env.ts,
    commentaire: commentaire.trim() || null,
    comptages: lignes,
  });
}

// ---- Ventes ----

export interface PaiementSaisi extends Omit<DemandePaiement, 'resteCfp'> {
  /** Ya calculado por la pantalla de cobro (para mostrar la monnaie antes de validar). */
  resultat?: ResultatPaiement;
}

export async function enregistrerVente(
  ctx: Contexte,
  journeeId: string,
  lignes: LignePanier[],
  remisePanierCfp: number,
  paiementsSaisis: PaiementSaisi[],
): Promise<Vente> {
  const articles = new Map<string, Article>(
    (await db.articles.bulkGet(lignes.map((l) => l.articleId))).filter((a): a is Article => !!a).map((a) => [a.id, a]),
  );
  const totaux = totauxPanier(lignes, articles, remisePanierCfp);
  const env = await enveloppe(ctx);
  const venteId = `vte_${uuid()}`;

  const paiements: Paiement[] = [];
  let reste = totaux.totalCfp;
  for (const s of paiementsSaisis) {
    const r = s.resultat ?? calculerPaiement({ ...s, resteCfp: reste });
    paiements.push({
      id: `pai_${uuid()}`,
      devise: r.devise,
      montantDevise: r.montantDevise,
      totalDevise: r.totalDevise,
      tauxCfp: r.tauxCfp,
      montantCfp: r.montantCfp,
      renduMontant: r.rendu?.montant ?? null,
      renduDevise: r.rendu?.devise ?? null,
    });
    reste = Math.max(0, reste - r.montantCfp);
  }

  const vente: Vente = {
    id: venteId,
    journeeId,
    vendeurId: ctx.vendeurId,
    deviceId: env.deviceId,
    ts: env.ts,
    sousTotalCfp: totaux.sousTotalCfp,
    remisePanierCfp: totaux.remisePanierCfp,
    remiseEncaissementCfp: remiseEncaissement(totaux.totalCfp, paiements),
    totalCfp: totaux.totalCfp,
    annuleeAt: null,
    lignes: lignes
      .filter((l) => articles.has(l.articleId))
      .map((l) => {
        const a = articles.get(l.articleId)!;
        return {
          id: `lig_${uuid()}`,
          articleId: a.id,
          nomSnapshot: a.nom,
          qty: l.qty,
          prixUnitCfp: a.prixCfp,
          totalCfp: totalLigneCfp(a.prixCfp, a.promo2emePct, l.qty),
        };
      }),
    paiements,
  };
  const mouvements: MouvementStock[] = vente.lignes.map((l) => ({
    id: `mvt_${uuid()}`,
    articleId: l.articleId,
    delta: -l.qty,
    motif: 'vente',
    venteId,
    vendeurId: ctx.vendeurId,
    deviceId: env.deviceId,
    ts: env.ts,
  }));
  await emettreOp({ ...env, type: 'vente.creer', vente, mouvements });
  return vente;
}

/** Anula una venta: movimiento compensatorio trazado por línea, la venta queda marcada (no se borra). */
export async function annulerVente(ctx: Contexte, venteId: string): Promise<void> {
  const vente = await db.ventes.get(venteId);
  if (!vente || vente.annuleeAt) return;
  const env = await enveloppe(ctx);
  const mouvements: MouvementStock[] = vente.lignes.map((l) => ({
    id: `mvt_${uuid()}`,
    articleId: l.articleId,
    delta: l.qty,
    motif: 'annulation',
    venteId,
    vendeurId: ctx.vendeurId,
    deviceId: env.deviceId,
    ts: env.ts,
  }));
  await emettreOp({ ...env, type: 'vente.annuler', venteId, annuleeAt: env.ts, mouvements });
}

// ---- Stock et articles ----

export async function mouvementStock(
  ctx: Contexte,
  articleId: string,
  delta: number,
  motif: MotifStock,
): Promise<number> {
  if (!Number.isInteger(delta) || delta === 0) return 0;
  const env = await enveloppe(ctx);
  // Lectura del stock y movimiento en la misma transacción: un ajuste a la baja nunca deja el stock en
  // negativo, ni con varios toques seguidos en «−» ni con un «−10» sobre 3 unidades.
  return db.transaction('rw', db.tables, async () => {
    let applique = delta;
    if (delta < 0) {
      const mouvements = await db.mouvements.where('articleId').equals(articleId).toArray();
      const dispo = Math.max(
        0,
        mouvements.reduce((s, m) => s + m.delta, 0),
      );
      applique = Math.max(delta, -dispo);
    }
    if (applique === 0) return 0;
    await emettreOp({
      ...env,
      type: 'stock.mouvement',
      mouvement: {
        id: `mvt_${uuid()}`,
        articleId,
        delta: applique,
        motif,
        venteId: null,
        vendeurId: ctx.vendeurId,
        deviceId: env.deviceId,
        ts: env.ts,
      },
    });
    return applique;
  });
}

export type ArticleSaisi = Omit<Article, 'id' | 'updatedAt' | 'actif'> & { id?: string; actif?: boolean };

export async function enregistrerArticle(
  ctx: Contexte,
  saisi: ArticleSaisi,
  stockInitial: number | null = null,
): Promise<Article> {
  const env = await enveloppe(ctx);
  const article: Article = {
    id: saisi.id ?? `art_${uuid()}`,
    nom: saisi.nom.trim(),
    categorieId: saisi.categorieId,
    emoji: saisi.emoji?.trim() || null,
    prixCfp: Math.max(0, Math.trunc(saisi.prixCfp)),
    promo2emePct: saisi.promo2emePct && saisi.promo2emePct > 0 ? Math.trunc(saisi.promo2emePct) : null,
    prixDevises: Object.fromEntries(
      Object.entries(saisi.prixDevises).filter(([, v]) => typeof v === 'number' && v > 0),
    ),
    actif: saisi.actif ?? true,
    updatedAt: env.ts,
  };
  await emettreOp({ ...env, type: 'article.upsert', article });
  if (stockInitial !== null && stockInitial > 0) await mouvementStock(ctx, article.id, stockInitial, 'inventaire');
  return article;
}

export async function enregistrerCategorie(ctx: Contexte, categorie: Categorie): Promise<void> {
  const env = await enveloppe(ctx);
  await emettreOp({
    ...env,
    type: 'categorie.upsert',
    categorie: { ...categorie, nom: categorie.nom.trim(), emoji: categorie.emoji?.trim() || null },
  });
}

// ---- Heures ----

export async function commencerSession(ctx: Contexte): Promise<SessionTravail> {
  const env = await enveloppe(ctx);
  const session: SessionTravail = {
    id: `ses_${uuid()}`,
    vendeurId: ctx.vendeurId,
    debut: arrondir30(new Date(env.ts)).toISOString(),
    fin: null,
    dureeMin: null,
    commentaire: null,
    payeeAt: null,
  };
  await emettreOp({ ...env, type: 'session.upsert', session });
  return session;
}

export async function terminerSession(ctx: Contexte, sessionId: string): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (!s || s.fin) return;
  const env = await enveloppe(ctx);
  const fin = arrondir30(new Date(env.ts)).toISOString();
  await emettreOp({ ...env, type: 'session.upsert', session: { ...s, fin, dureeMin: dureeMinutes(s.debut, fin) } });
}

export async function enregistrerSession(ctx: Contexte, session: Omit<SessionTravail, 'dureeMin'>): Promise<void> {
  const env = await enveloppe(ctx);
  await emettreOp({
    ...env,
    type: 'session.upsert',
    session: { ...session, dureeMin: session.fin ? dureeMinutes(session.debut, session.fin) : null },
  });
}

export async function supprimerSession(ctx: Contexte, sessionId: string): Promise<void> {
  const env = await enveloppe(ctx);
  await emettreOp({ ...env, type: 'session.supprimer', sessionId });
}

export async function basculerPayee(ctx: Contexte, sessionId: string): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const env = await enveloppe(ctx);
  await emettreOp({ ...env, type: 'session.upsert', session: { ...s, payeeAt: s.payeeAt ? null : env.ts } });
}

// ---- Réglages ----

export async function definirTaux(
  ctx: Contexte | null,
  devise: Devise,
  cfpParUnite: number,
  source: string,
): Promise<void> {
  const env = await enveloppe(ctx);
  await emettreOp({ ...env, type: 'taux.definir', devise, cfpParUnite, source, date: dateMetier(new Date(env.ts)) });
}

export async function definirSetting(ctx: Contexte | null, key: string, value: string): Promise<void> {
  const env = await enveloppe(ctx);
  await emettreOp({ ...env, type: 'settings.definir', key, value });
}

export async function enregistrerVendeur(
  ctx: Contexte | null,
  vendeur: OpDe<'vendeur.upsert'>['vendeur'],
): Promise<void> {
  const env = await enveloppe(ctx);
  await emettreOp({ ...env, type: 'vendeur.upsert', vendeur });
}

/** Cambio de PIN: viaja el hash PBKDF2 (nunca el PIN) en una operación vendeur.upsert; el servidor lo guarda. */
export async function changerPin(ctx: Contexte | null, vendeurId: string, pin: string): Promise<void> {
  const v = await db.vendeurs.get(vendeurId);
  if (!v) return;
  const pinSalt = genererSel();
  const pinHash = await hacherPin(pin, pinSalt);
  await enregistrerVendeur(ctx, {
    id: v.id,
    prenom: v.prenom,
    tauxHoraireCfp: v.tauxHoraireCfp,
    actif: v.actif,
    pinHash,
    pinSalt,
  });
}
