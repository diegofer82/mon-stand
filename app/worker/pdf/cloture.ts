// Cierre del día en PDF: plantilla HTML con el diseño de la app → Browser Rendering → R2.
// Sin binding BROWSER (local, tests) se archiva el HTML; el panel lo muestra igual.
import puppeteer from '@cloudflare/puppeteer';
import { eq } from 'drizzle-orm';

import { attenduParDevise, resumeJournee } from '../../shared/domaine/cloture';
import { formatDuree } from '../../shared/domaine/heures';
import type { ComptageCaisse, Journee, Vente } from '../../shared/domaine/types';
import { formatNumber } from '../../shared/montants';
import { schema, type Base } from '../db';
import { chargerComptages, chargerJournees, chargerVentes } from '../lectures';

const FUSEAU = 'Pacific/Noumea';
const ESPACE = String.fromCharCode(0xa0); // espacio insecable entre importe y divisa

function echapper(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function heure(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: FUSEAU,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

function dateLongue(dateLocale: string): string {
  const d = new Intl.DateTimeFormat('fr-FR', {
    timeZone: FUSEAU,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateLocale}T12:00:00+11:00`));
  return d.charAt(0).toUpperCase() + d.slice(1);
}

const montant = (v: number, devise: string = 'CFP') =>
  `${formatNumber(v, devise)}${ESPACE}${devise === 'TPE' ? 'CFP' : devise}`;

export interface DonneesCloture {
  journee: Journee;
  vendeur: string;
  ventes: Vente[];
  comptages: ComptageCaisse[];
  sessionsMin: number;
}

/** HTML autónomo (sin recursos externos) del cierre: cabecera «night», KPIs, encaissements, top, ventas, conteo. */
export function htmlCloture(d: DonneesCloture): string {
  const r = resumeJournee(d.ventes, 10);
  const attendus = attenduParDevise(d.journee, d.ventes);
  const comptageParDevise = new Map(d.comptages.map((c) => [c.devise, c]));
  const kpi = (label: string, valeur: string, detail?: string) =>
    `<div class="kpi"><div class="label">${label}</div><div class="valeur">${valeur}</div>${detail ? `<div class="detail">${detail}</div>` : ''}</div>`;
  const ligneTable = (cellules: string[], classe = '') =>
    `<tr class="${classe}">${cellules.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Clôture ${d.journee.dateLocale}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a0f2e; margin: 0; font-size: 12px; }
  header { background: #1f0f3d; color: #fff; padding: 18px 22px; border-radius: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
  header .marque { font-family: Georgia, "Times New Roman", serif; font-size: 22px; font-weight: 600; }
  header .marque span { color: #e0b12f; }
  header .meta { text-align: right; color: #c8bce0; }
  header .meta strong { color: #fff; font-size: 15px; display: block; }
  h2 { font-family: Georgia, serif; font-size: 15px; margin: 22px 0 8px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }
  .kpi { border: 1px solid #ddd6e8; border-radius: 12px; padding: 10px 12px; }
  .kpi .label { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #564a6d; font-weight: 600; }
  .kpi .valeur { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 2px; }
  .kpi .detail { font-size: 10px; color: #564a6d; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 5px 6px; border-bottom: 1px solid #ebe6f2; text-align: left; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #564a6d; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.annulee td { color: #8a7ea0; text-decoration: line-through; }
  .deux { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .ok { color: #17703f; font-weight: 600; } .neg { color: #b3261e; font-weight: 600; } .pos { color: #9a4d00; font-weight: 600; }
  footer { margin-top: 24px; font-size: 10px; color: #564a6d; border-top: 1px solid #ddd6e8; padding-top: 8px; }
</style></head><body>
<header>
  <div><div class="marque"><span>❦</span> Debajah Création</div><div>Clôture de journée</div></div>
  <div class="meta"><strong>${echapper(dateLongue(d.journee.dateLocale))}</strong>${echapper(d.journee.lieu)} · ${echapper(d.vendeur)}<br>Ouverte à ${heure(d.journee.ouverteAt)}${d.journee.clotureeAt ? `, clôturée à ${heure(d.journee.clotureeAt)}` : ''}</div>
</header>
<div class="kpis">
  ${kpi('Chiffre d’affaires', montant(r.totalEncaisseCfp), r.remisesEncaissementCfp ? `Remises à l’encaissement ${montant(r.remisesEncaissementCfp)}` : undefined)}
  ${kpi('Ventes', String(r.nbVentes), `${r.nbArticles} article${r.nbArticles > 1 ? 's' : ''}`)}
  ${kpi('Panier moyen', montant(r.panierMoyenCfp), r.remisesPanierCfp ? `Remises panier ${montant(r.remisesPanierCfp)}` : undefined)}
  ${kpi('Heures', formatDuree(d.sessionsMin))}
</div>
<div class="deux">
<section><h2>Encaissements</h2><table><tr><th>Moyen</th><th class="num">Reçu</th><th class="num">En CFP</th></tr>
${r.parPaiement.map((p) => ligneTable([`${p.devise === 'TPE' ? 'Carte' : p.devise} <span style="color:#564a6d">× ${p.nb}</span>`, `<span class="num">${montant(p.montantDevise, p.devise)}${p.rendu ? `<br><small>monnaie ${montant(p.rendu, p.devise)}</small>` : ''}</span>`, `<span class="num">${montant(p.montantCfp)}</span>`])).join('') || ligneTable(['Aucune vente', '', ''])}
</table></section>
<section><h2>Meilleures ventes</h2><table><tr><th>Article</th><th class="num">Qté</th><th class="num">Total</th></tr>
${r.topArticles.map((a) => ligneTable([echapper(a.nom), `<span class="num">${a.qty}</span>`, `<span class="num">${montant(a.totalCfp)}</span>`])).join('') || ligneTable(['—', '', ''])}
</table></section>
</div>
<section><h2>Comptage de caisse</h2><table><tr><th>Devise</th><th class="num">Fond</th><th class="num">Reçu</th><th class="num">Rendu</th><th class="num">Attendu</th><th class="num">Compté</th><th class="num">Écart</th></tr>
${attendus
  .map((a) => {
    const c = comptageParDevise.get(a.devise);
    const ecart = c ? c.ecart : null;
    const classe = ecart === null ? '' : ecart === 0 ? 'ok' : ecart < 0 ? 'neg' : 'pos';
    return ligneTable([
      a.devise,
      ...[a.fond, a.recu, a.rendu, a.attendu].map((v) => `<span class="num">${formatNumber(v, a.devise)}</span>`),
      `<span class="num">${c ? formatNumber(c.compte, a.devise) : '—'}</span>`,
      `<span class="num ${classe}">${ecart === null ? '—' : ecart === 0 ? 'Juste' : `${ecart > 0 ? '+' : ''}${formatNumber(ecart, a.devise)}`}</span>`,
    ]);
  })
  .join('')}
</table>${d.journee.commentaireCloture ? `<p><em>« ${echapper(d.journee.commentaireCloture)} »</em></p>` : ''}</section>
<section><h2>Ventes (${r.nbVentes})</h2><table><tr><th>Heure</th><th>Articles</th><th>Paiement</th><th class="num">Encaissé</th></tr>
${
  [...d.ventes]
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map((v) =>
      ligneTable(
        [
          heure(v.ts),
          echapper(v.lignes.map((l) => `${l.nomSnapshot} ×${l.qty}`).join(', ')) +
            (v.remisePanierCfp ? ` <small>remise ${montant(v.remisePanierCfp)}</small>` : ''),
          v.paiements
            .map(
              (p) =>
                `${formatNumber(p.montantDevise, p.devise)} ${p.devise === 'TPE' ? 'CFP (carte)' : p.devise}${p.renduMontant ? ` − ${formatNumber(p.renduMontant, p.renduDevise ?? p.devise)} rendu` : ''}`,
            )
            .join(' + '),
          `<span class="num">${v.annuleeAt ? 'annulée' : montant(v.paiements.reduce((s, p) => s + p.montantCfp, 0))}</span>`,
        ],
        v.annuleeAt ? 'annulee' : '',
      ),
    )
    .join('') || ligneTable(['—', 'Aucune vente', '', ''])
}
</table></section>
<footer>Mon Stand · document généré automatiquement à la clôture · importes en CFP, paiements en devise au taux du jour</footer>
</body></html>`;
}

export async function chargerDonneesCloture(db: Base, journeeId: string): Promise<DonneesCloture | null> {
  const [journee] = await chargerJournees(db, { ids: [journeeId] });
  if (!journee) return null;
  const [ventes, comptages, vendeurs, sessions] = await Promise.all([
    chargerVentes(db, [journeeId]),
    chargerComptages(db, [journeeId]),
    db
      .select({ id: schema.vendeurs.id, prenom: schema.vendeurs.prenom })
      .from(schema.vendeurs)
      .where(eq(schema.vendeurs.id, journee.vendeurId)),
    db
      .select({ dureeMin: schema.sessionsTravail.dureeMin, debut: schema.sessionsTravail.debut })
      .from(schema.sessionsTravail)
      .where(eq(schema.sessionsTravail.vendeurId, journee.vendeurId)),
  ]);
  const jour = journee.dateLocale;
  const sessionsMin = sessions
    .filter(
      (s) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: FUSEAU,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(s.debut)) === jour,
    )
    .reduce((t, s) => t + (s.dureeMin ?? 0), 0);
  return { journee, vendeur: vendeurs[0]?.prenom ?? '—', ventes, comptages, sessionsMin };
}

export function cleCloture(prefixe: string, journee: Journee, extension: 'pdf' | 'html'): string {
  return `${prefixe}clotures/${journee.dateLocale.slice(0, 4)}/${journee.dateLocale}_${journee.id}.${extension}`;
}

/** Genera y archiva el cierre en R2; devuelve la clave. Con BROWSER → PDF; si no → HTML. */
export async function archiverCloture(env: Env, db: Base, journeeId: string): Promise<string | null> {
  const donnees = await chargerDonneesCloture(db, journeeId);
  if (!donnees) return null;
  const html = htmlCloture(donnees);
  let cle: string;
  if (env.BROWSER) {
    const browser = await puppeteer.launch(env.BROWSER);
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
      cle = cleCloture(env.R2_PREFIX, donnees.journee, 'pdf');
      await env.FILES.put(cle, pdf, { httpMetadata: { contentType: 'application/pdf' } });
    } finally {
      await browser.close();
    }
  } else {
    cle = cleCloture(env.R2_PREFIX, donnees.journee, 'html');
    await env.FILES.put(cle, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
  }
  await db.update(schema.journees).set({ pdfKey: cle }).where(eq(schema.journees.id, journeeId));
  return cle;
}
