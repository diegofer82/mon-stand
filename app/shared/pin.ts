// PIN de vendedora: PBKDF2-SHA-256 (WebCrypto), disponible en el navegador y en el Worker.
// El teléfono guarda hash y sal para verificar sin red; el servidor verifica igual (Fase 4).

const ITERATIONS = 100_000;

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function genererSel(): string {
  const sel = new Uint8Array(16);
  crypto.getRandomValues(sel);
  return hex(sel.buffer);
}

export function pinValide(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function hacherPin(pin: string, selHex: string): Promise<string> {
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const sel = new Uint8Array(selHex.match(/../g)?.map((h) => parseInt(h, 16)) ?? []);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations: ITERATIONS },
    cle,
    256,
  );
  return hex(bits);
}

/** Comparación en tiempo constante de dos hex de la misma longitud. */
export async function verifierPin(pin: string, selHex: string, hashAttendu: string): Promise<boolean> {
  const h = await hacherPin(pin, selHex);
  if (h.length !== hashAttendu.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ hashAttendu.charCodeAt(i);
  return diff === 0;
}
