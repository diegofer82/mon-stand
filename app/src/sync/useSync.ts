import { useSyncExternalStore } from 'react';

import { abonner, lireStatut, type StatutSync } from './client';

export function useSync(): StatutSync {
  return useSyncExternalStore(abonner, lireStatut, lireStatut);
}
