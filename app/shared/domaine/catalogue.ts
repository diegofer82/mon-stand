// Catálogo de partida (inventario v1) con ids deterministas: la misma semilla vale para IndexedDB y para D1,
// y el importador de la Fase 6 reutiliza los ids `art_<id v1>`.
import type { Article, Categorie } from './types';

export const CATEGORIES_DEFAUT: Categorie[] = [
  { id: 'cat_bijoux', nom: 'Bijoux', emoji: '💍', ordre: 1 },
  { id: 'cat_deco', nom: 'Déco', emoji: '🪴', ordre: 2 },
  { id: 'cat_jeux', nom: 'Jeux', emoji: '♟️', ordre: 3 },
  { id: 'cat_papeterie', nom: 'Papeterie', emoji: '🖊️', ordre: 4 },
];

/** Categoría v1 (`bijoux`) → id v2. */
export function idCategorie(categorieV1: string): string {
  return `cat_${categorieV1}`;
}

/** Artículo v1 (`collier-100`) → id v2. */
export function idArticle(articleV1: string): string {
  return `art_${articleV1}`;
}

interface ArticleSemence {
  id: string;
  nom: string;
  cat: string;
  emoji: string;
  prix: number;
  stock: number;
}

// Emoji elegidos con la vendedora para reconocer cada artículo en la caja (validación del diseño).
const SEMENCE: ArticleSemence[] = [
  { id: 'collier-100', nom: 'Collier 100', cat: 'bijoux', emoji: '📿', prix: 1000, stock: 93 },
  { id: 'collier-200', nom: 'Collier 200', cat: 'bijoux', emoji: '📿', prix: 2000, stock: 93 },
  { id: 'collier-300', nom: 'Collier 300', cat: 'bijoux', emoji: '📿', prix: 3000, stock: 93 },
  { id: 'chaine', nom: 'Chaîne', cat: 'bijoux', emoji: '⛓️', prix: 2500, stock: 5 },
  { id: 'bracelet', nom: 'Bracelet', cat: 'bijoux', emoji: '🧿', prix: 2000, stock: 13 },
  { id: 'bracelet-chaine', nom: 'Bracelet chaîne', cat: 'bijoux', emoji: '🔗', prix: 2500, stock: 1 },
  { id: 'dessous-verres', nom: 'Dessous de verres', cat: 'deco', emoji: '🥂', prix: 3500, stock: 7 },
  { id: 'bague', nom: 'Bague', cat: 'bijoux', emoji: '💍', prix: 1000, stock: 1 },
  { id: 'boucles', nom: "Boucles d'oreilles", cat: 'bijoux', emoji: '👂', prix: 2000, stock: 48 },
  { id: 'porte-cles', nom: 'Porte-clés', cat: 'bijoux', emoji: '🔑', prix: 1000, stock: 65 },
  { id: 'magnet', nom: 'Magnet', cat: 'deco', emoji: '🧲', prix: 700, stock: 10 },
  { id: 'broche', nom: 'Broche', cat: 'bijoux', emoji: '🎀', prix: 1000, stock: 48 },
  { id: 'stylo', nom: 'Stylo', cat: 'papeterie', emoji: '🖊️', prix: 1500, stock: 44 },
  { id: 'petite-boite', nom: 'Petite boîte', cat: 'deco', emoji: '📦', prix: 2500, stock: 4 },
  { id: 'grande-boite', nom: 'Grande boîte', cat: 'deco', emoji: '🗃️', prix: 3000, stock: 2 },
  { id: 'miroir', nom: 'Miroir', cat: 'deco', emoji: '🪞', prix: 2500, stock: 1 },
  { id: 'plateau', nom: 'Plateau', cat: 'deco', emoji: '🍽️', prix: 2500, stock: 6 },
  { id: 'echiquier', nom: 'Échiquier', cat: 'jeux', emoji: '♟️', prix: 16000, stock: 3 },
  { id: 'domino', nom: 'Domino', cat: 'jeux', emoji: '🁫', prix: 5500, stock: 1 },
  { id: 'lezard', nom: 'Lézard déco', cat: 'deco', emoji: '🦎', prix: 2200, stock: 2 },
  { id: 'feuilles-cana', nom: 'Feuilles cana', cat: 'deco', emoji: '🌿', prix: 1500, stock: 1 },
  { id: 'rond', nom: 'Rond déco', cat: 'deco', emoji: '⭕', prix: 1500, stock: 14 },
  { id: 'lotus', nom: 'Lotus', cat: 'deco', emoji: '🪷', prix: 1850, stock: 4 },
  { id: 'bourgoir', nom: 'Bourgoir', cat: 'deco', emoji: '🪵', prix: 0, stock: 1 },
  { id: 'boite-deco', nom: 'Boîte déco', cat: 'deco', emoji: '🎁', prix: 0, stock: 1 },
];

export interface CatalogueDefaut {
  categories: Categorie[];
  articles: Article[];
  /** Stock inicial por artículo (movimiento `inventaire`). */
  stockInitial: Map<string, number>;
}

export function catalogueDefaut(updatedAt: string): CatalogueDefaut {
  const stockInitial = new Map<string, number>();
  const articles: Article[] = SEMENCE.map((s) => {
    stockInitial.set(idArticle(s.id), s.stock);
    return {
      id: idArticle(s.id),
      nom: s.nom,
      categorieId: idCategorie(s.cat),
      emoji: s.emoji,
      prixCfp: s.prix,
      promo2emePct: null,
      prixDevises: {},
      actif: true,
      updatedAt,
    };
  });
  return { categories: CATEGORIES_DEFAUT, articles, stockInitial };
}

export const LIEU_DEFAUT = 'Gare maritime';
export const FONDS_DEFAUT = { CFP: 1000, AUD: 100 } as const;
export const TAUX_HORAIRE_DEFAUT = 1500;
