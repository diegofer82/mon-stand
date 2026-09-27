/**
 * Google Apps Script — Debajah Création
 * Coller ce code entier sur script.google.com
 * Déployer → Application web → Accès : Tout le monde
 *
 * Un Google Sheet "Debajah Création" sera créé automatiquement dans votre Drive.
 */

const SHEET_NAME = 'Debajah Création';

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'load') {
    return loadStock();
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'sync') {
      syncAll(data);
    }
  } catch (err) {
    // Silently continue — no-cors ne lit pas la réponse de toute façon
  }
  return ContentService.createTextOutput('ok');
}

// ── Charger le stock depuis Google Sheets ──────────────────────────
function loadStock() {
  try {
    const ss = getOrCreateSheet();
    const sheet = ss.getSheetByName('Stock');
    if (!sheet || sheet.getLastRow() < 2) {
      return ContentService.createTextOutput(JSON.stringify({ articles: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
    const articles = rows
      .filter(r => r[0])
      .map(r => ({
        id: r[0],
        nom: r[1],
        categorie: r[2],
        prixCFP: Number(r[3]),
        quantite: Number(r[4]),
        promo2eme: r[5] ? Number(r[5]) : null,
      }));
    return ContentService.createTextOutput(JSON.stringify({ articles }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ articles: [], error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Synchroniser tout ──────────────────────────────────────────────
function syncAll(data) {
  const ss = getOrCreateSheet();

  // 1. Stock
  syncSheet(ss, 'Stock',
    ['ID', 'Nom', 'Catégorie', 'Prix CFP', 'Quantité', 'Promo 2ème (%)', 'Dernière MAJ'],
    (data.articles || []).map(a => [
      a.id, a.nom, a.categorie, a.prixCFP, a.quantite,
      a.promo2eme || '', new Date().toLocaleString('fr-FR')
    ])
  );

  // 2. Ventes du jour
  const ventesRows = [];
  for (const v of (data.ventes || [])) {
    for (const a of (v.articles || [])) {
      ventesRows.push([
        new Date(v.ts).toLocaleDateString('fr-FR'),
        new Date(v.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        data.vendeur || '',
        a.nom, a.qty, a.prixUnit, a.total,
        v.remisePanier || 0, v.remiseEncaissement || 0,
        v.montantEncaisse, v.devise
      ]);
    }
  }
  if (ventesRows.length) {
    appendRows(ss, 'Ventes',
      ['Date', 'Heure', 'Vendeur', 'Article', 'Qté', 'Prix unit.', 'Total ligne', 'Remise panier', 'Remise enc.', 'Encaissé', 'Devise'],
      ventesRows
    );
  }

  // 3. Heures / Sessions
  const sessionsRows = (data.sessions || []).map(s => [
    new Date(s.debut).toLocaleDateString('fr-FR'),
    new Date(s.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    s.fin ? new Date(s.fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'En cours',
    Math.round(s.dureeMin / 60 * 100) / 100,
    s.commentaire || '',
    data.vendeur || ''
  ]);
  if (sessionsRows.length) {
    appendRows(ss, 'Heures',
      ['Date', 'Arrivée', 'Départ', 'Durée (h)', 'Commentaire', 'Vendeur'],
      sessionsRows
    );
  }

  // 4. Historique clôtures
  const histRows = (data.historique || []).map(h => [
    h.date, h.vendeur || '', h.nbVentes, h.totalEncaisse,
    h.nbSessions || 0, h.heuresTotal || ''
  ]);
  if (histRows.length) {
    syncSheet(ss, 'Historique',
      ['Date', 'Vendeur', 'Nb ventes', 'Total encaissé (CFP)', 'Nb sessions', 'Heures'],
      histRows
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────
function getOrCreateSheet() {
  const files = DriveApp.getFilesByName(SHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  const ss = SpreadsheetApp.create(SHEET_NAME);
  ['Stock', 'Ventes', 'Heures', 'Historique'].forEach(name => {
    if (!ss.getSheetByName(name)) ss.insertSheet(name);
  });
  const def = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  if (def && !['Stock', 'Ventes', 'Heures', 'Historique'].includes(def.getName())) {
    ss.deleteSheet(def);
  }
  return ss;
}

// Remplace le contenu entier d'une feuille (stock, historique)
function syncSheet(ss, name, headers, rows) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  sheet.appendRow(headers);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  // En-tête en gras + couleur
  const hdr = sheet.getRange(1, 1, 1, headers.length);
  hdr.setBackground('#1c1133');
  hdr.setFontColor('#c9a84c');
  hdr.setFontWeight('bold');
}

// Ajoute des lignes sans effacer (ventes, heures)
function appendRows(ss, name, headers, rows) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    const hdr = sheet.getRange(1, 1, 1, headers.length);
    hdr.setBackground('#1c1133');
    hdr.setFontColor('#c9a84c');
    hdr.setFontWeight('bold');
  }
  rows.forEach(r => sheet.appendRow(r));
}
