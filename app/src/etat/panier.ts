// El carrito vive en la coquille (Principal), no en la pantalla Caisse: cambiar de pestaña para mirar
// el stock y volver no lo vacía.
import { useState, type Dispatch, type SetStateAction } from 'react';

import type { LignePanier } from '../../shared/domaine/types';

export interface Panier {
  lignes: LignePanier[];
  setLignes: Dispatch<SetStateAction<LignePanier[]>>;
  remise: string;
  setRemise: Dispatch<SetStateAction<string>>;
}

export function usePanier(): Panier {
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [remise, setRemise] = useState('');
  return { lignes, setLignes, remise, setRemise };
}
