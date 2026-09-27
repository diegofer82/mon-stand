// Secretos (wrangler secret put): no aparecen en wrangler.jsonc, así que no salen en worker-configuration.d.ts.
// El binding BROWSER (solo en producción) sí lo genera `wrangler types`, como opcional.
declare global {
  interface Env {
    /** Jeton de administración alternativo a Cloudflare Access (ausente = solo Access). */
    ADMIN_TOKEN?: string;
  }
}

export {};
