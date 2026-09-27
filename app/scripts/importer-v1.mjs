// Importa el export completo de la v1 (JSON del teléfono) en D1: genera el SQL y el informe.
//
//   node scripts/importer-v1.mjs <export.json> [--sortie <import.sql>] [--pin 1234]
//
// Luego, tras purgar los datos de prueba (scripts/purger-production.sql) y comprobar que todo está a cero:
//   npx wrangler d1 execute mon-stand-production --remote --env production --file <import.sql>
//
// El export real nunca entra en el repo: pasar una ruta fuera del proyecto (por defecto el SQL va al lado del export).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { webcrypto } from 'node:crypto';

import { genererImport, versSql } from '../shared/import-v1.ts';

const args = process.argv.slice(2);
const fichier = args.find((a) => !a.startsWith('--'));
if (!fichier) {
  console.error('Usage : node scripts/importer-v1.mjs <export.json> [--sortie <import.sql>] [--pin 1234]');
  process.exit(2);
}
const option = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
};
const sortie = option('--sortie', join(dirname(fichier), 'mon-stand_import-v1.sql'));
const pin = option('--pin', '1234');
if (!/^\d{4}$/.test(pin)) {
  console.error('Le PIN fait 4 chiffres.');
  process.exit(2);
}

const exp = JSON.parse(readFileSync(fichier, 'utf8'));
if (exp.app !== 'mon-stand' || exp.type !== 'export-complet') {
  console.error('Ce fichier n’est pas un export complet de Mon Stand v1.');
  process.exit(2);
}

// Mismo hash que la app (PBKDF2-SHA-256, 100 000 iteraciones).
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sel = new Uint8Array(16);
webcrypto.getRandomValues(sel);
const cle = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
const bits = await webcrypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations: 100_000 },
  cle,
  256,
);

const { requetes, rapport } = genererImport(exp, { pinHash: hex(bits), pinSalt: hex(sel.buffer) });
writeFileSync(sortie, versSql(requetes) + '\n');

console.log(`Export v${rapport.version} → ${requetes.length} sentencias SQL en ${sortie}`);
console.log(`  artículos : ${rapport.articles} (${rapport.prixManuels} precios manuales en divisa)`);
console.log(`  jornadas  : ${rapport.journees.length}`);
for (const j of rapport.journees) {
  const ecart = j.ecart === 0 ? 'OK' : `écart ${j.ecart > 0 ? '+' : ''}${j.ecart} CFP vs. v1 (${j.totalEncaisseV1})`;
  console.log(
    `    ${j.date}  ${String(j.nbVentes).padStart(3)} ventes  ${String(j.totalEncaisseCfp).padStart(8)} CFP  ${ecart}`,
  );
}
console.log(`  ventas    : ${rapport.ventes} (${rapport.ventesV13Devise} en divisa v1.3 sin tasa)`);
console.log(`  sesiones  : ${rapport.sessions}`);
console.log(`  tasas     : ${rapport.taux}`);
if (rapport.avertissements.length) {
  console.log('Avisos :');
  for (const a of rapport.avertissements) console.log(`  - ${a}`);
}
console.log(`PIN de la vendedora : ${pin} (a cambiar en Réglages tras la primera conexión).`);
