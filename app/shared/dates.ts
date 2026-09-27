// Fechas de negocio: siempre en la hora de Nouméa, nunca con toISOString() (bug 1 de la v1).

export const FUSEAU_METIER = 'Pacific/Noumea';

function parts(instant: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: FUSEAU_METIER, ...options }).formatToParts(instant)) {
    out[p.type] = p.value;
  }
  return out;
}

/** Fecha del día de mercado, AAAA-MM-DD, en Nouméa. */
export function dateMetier(instant: Date = new Date()): string {
  const p = parts(instant, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hora local de Nouméa, «08:30». */
export function heureMetier(instant: Date = new Date()): string {
  const p = parts(instant, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${p.hour}:${p.minute}`;
}
