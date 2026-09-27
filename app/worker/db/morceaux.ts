// D1 admite como mucho 100 parámetros ligados por sentencia: una inserción de muchas filas se trocea.
const MAX_PARAMETRES = 100;

/** Trocea filas para que cada INSERT quede por debajo del límite, según el número de columnas. */
export function morceaux<T>(lignes: readonly T[], colonnes: number): T[][] {
  const taille = Math.max(1, Math.floor(MAX_PARAMETRES / colonnes));
  const out: T[][] = [];
  for (let i = 0; i < lignes.length; i += taille) out.push(lignes.slice(i, i + taille));
  return out;
}
