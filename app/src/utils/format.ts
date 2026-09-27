// Fechas y horas para la interfaz: siempre en Pacific/Noumea y en francés.
import { FUSEAU_METIER } from '../../shared/dates';

const opts = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU_METIER, ...o });

const fmtHeure = opts({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtCourte = opts({ weekday: 'short', day: 'numeric', month: 'short' });
const fmtLongue = opts({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMoyenne = opts({ weekday: 'long', day: 'numeric', month: 'long' });

function majuscule(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** «08:30» a partir de un instante ISO. */
export function heure(iso: string): string {
  return fmtHeure.format(new Date(iso));
}

/** Instante UTC de una fecha local AAAA-MM-DD a mediodía en Nouméa (para formatear la fecha sin desplazarla). */
function midiLocal(dateLocale: string): Date {
  return new Date(`${dateLocale}T12:00:00+11:00`);
}

/** «Sam. 3 oct.» */
export function dateCourte(dateLocale: string): string {
  return majuscule(fmtCourte.format(midiLocal(dateLocale)));
}

/** «samedi 3 octobre 2026» */
export function dateLongue(dateLocale: string): string {
  return fmtLongue.format(midiLocal(dateLocale));
}

/** «Samedi 3 octobre» */
export function dateMoyenne(dateLocale: string): string {
  return majuscule(fmtMoyenne.format(midiLocal(dateLocale)));
}

/** Componentes locales (Nouméa) de un instante: fecha AAAA-MM-DD y hora HH:MM, para los campos de formulario. */
export function partiesLocales(iso: string): { date: string; heure: string } {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSEAU_METIER,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))) {
    p[x.type] = x.value;
  }
  return { date: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
}

/** Instante ISO (UTC) de una fecha y hora locales de Nouméa (UTC+11, sin horario de verano). */
export function instantLocal(date: string, heureLocale: string): string {
  return new Date(`${date}T${heureLocale}:00+11:00`).toISOString();
}

/** «2026-10» del mes de una fecha local. */
export function moisDe(dateLocale: string): string {
  return dateLocale.slice(0, 7);
}
