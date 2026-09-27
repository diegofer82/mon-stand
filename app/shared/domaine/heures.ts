// Horas de la vendedora: redondeo a la media hora, duración, importe debido, resumen.
import { arrondir } from '../montants';
import type { SessionTravail } from './types';

/** Redondea un instante a la media hora más cercana: <15 min hacia abajo, si no hacia arriba (v1: arrondir30). */
export function arrondir30(instant: Date): Date {
  const d = new Date(instant.getTime());
  d.setUTCSeconds(0, 0);
  const m = d.getUTCMinutes();
  const r = m % 30;
  d.setUTCMinutes(r < 15 ? m - r : m + (30 - r));
  return d;
}

export function dureeMinutes(debutIso: string, finIso: string): number {
  return Math.max(0, arrondir((new Date(finIso).getTime() - new Date(debutIso).getTime()) / 60000));
}

/** Importe debido por una sesión: duración × tasa horaria, entero CFP. */
export function montantDuCfp(dureeMin: number, tauxHoraireCfp: number): number {
  return arrondir((dureeMin / 60) * tauxHoraireCfp);
}

/** «7h30», «0h45». */
export function formatDuree(minutes: number): string {
  const m = Math.max(0, arrondir(minutes));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

export interface ResumeHeures {
  nbSessions: number;
  totalMin: number;
  duCfp: number;
  payeCfp: number;
}

/** Resumen de sesiones cerradas: total de horas, lo pendiente de pago y lo ya pagado. */
export function resumeHeures(sessions: SessionTravail[], tauxHoraireCfp: number): ResumeHeures {
  const r: ResumeHeures = { nbSessions: 0, totalMin: 0, duCfp: 0, payeCfp: 0 };
  for (const s of sessions) {
    if (s.fin === null || s.dureeMin === null) continue;
    r.nbSessions++;
    r.totalMin += s.dureeMin;
    const montant = montantDuCfp(s.dureeMin, tauxHoraireCfp);
    if (s.payeeAt) r.payeCfp += montant;
    else r.duCfp += montant;
  }
  return r;
}
