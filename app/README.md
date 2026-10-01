# Mon Stand v2 — `app/`

React + TypeScript (Vite) servido por un Worker de Cloudflare (Hono) con D1, KV y R2. Plan y decisiones: [`docs/PLAN_DE_TRABAJO.md`](../docs/PLAN_DE_TRABAJO.md). Diseño: [Design System](https://claude.ai/artifact/EL9M2DpdxJkeKziaHprhFp) y [canvas de pantallas](https://claude.ai/artifact/TgJaV59CH23RrbqaJNRpbE).

## Estructura

| Carpeta       | Contenido                                                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`        | Interfaz React: `ecrans/` (pantallas), `composants/ui/` (Design System), `db/` (Dexie, acciones, outbox), `etat/`, `pwa/`, `textes/fr.ts`. Estilos: Tailwind v4 con los tokens del Design System (`src/styles/app.css`)       |
| `worker/`     | API Hono (`/api/*`) y esquema Drizzle de D1 (`worker/db/schema.ts`)                                                                                                                                                           |
| `shared/`     | Lógica de negocio pura compartida por la interfaz y el Worker: `domaine/` (panier, encaissement, heures, stock, cloture, catálogo), importes, fechas de Nouméa, tasas, PIN, contrato de operaciones (`ops.ts`), con sus tests |
| `migrations/` | SQL de D1 generado por Drizzle; Wrangler lo aplica                                                                                                                                                                            |
| `scripts/`    | Utilidades Node sin dependencias: `icones.mjs` genera los PNG de la PWA (`public/icons/`, `apple-touch-icon.png`)                                                                                                             |
| `test/`       | Tests del Worker en el runtime real de Workers, contra una D1 migrada                                                                                                                                                         |

## Cómo funciona la interfaz (Fase 3)

- **Offline-first**: los datos viven en IndexedDB (`src/db/db.ts`). Cada acción de la vendedora (`src/db/actions.ts`) construye una **operación** con UUID (`shared/ops.ts`, validada con zod), la aplica en local (`src/db/appliquer.ts`) y la deja en el **outbox**. El stock es la suma de movimientos; una venta anulada deja movimientos compensatorios. Una venta se anula desde el aviso que sigue al cobro (10 s) o desde Clôture → «Ventes du jour», solo mientras su jornada está abierta.
- **Lecturas reactivas** con `dexie-react-hooks` (`src/db/hooks.ts`): las pantallas se repintan solas.
- **PWA**: `vite-plugin-pwa` precarga toda la app; la nueva versión se activa en la siguiente apertura, nunca en mitad de una venta.

## Sincronización y acceso (Fase 4)

- **Emparejamiento**: el propietario genera en `/admin` un código de 8 caracteres (15 min, un solo uso); el teléfono lo introduce al abrir la app (`POST /api/devices/pair`) y recibe un token (guardado como SHA-256 en `devices`). El teléfono pide la instantánea con ese token y lo guarda junto con ella en una sola transacción: la sincronización no arranca antes, y si la instantánea falla el teléfono sigue sin emparejar (hace falta otro código). Todo lo demás lleva `Authorization: Bearer <token>`. Revocar un teléfono desde `/admin` invalida su token; sus operaciones ya recibidas se conservan.
- **Bootstrap** (`GET /api/bootstrap`): instantánea completa (catálogo, vendedoras con hash y sal del PIN, tasas, ajustes, stock actual, jornadas de 90 días con ventas y conteos, sesiones) y el cursor del diario. En una D1 vacía siembra el catálogo v1 y la vendedora «Vendeuse» con PIN `1234` (`worker/semence.ts`; cambiarlo en Réglages).
- **Sync** (`POST /api/sync`, `src/sync/client.ts`): push del outbox (`sync_ops` hace idempotente cada `op_id`; el Worker aplica cada operación en un `batch` atómico, `worker/sync/appliquer.ts`) y pull de las operaciones de los demás dispositivos desde el cursor (`sync_journal`, por páginas). Se dispara al arrancar, al volver la red, al volver a primer plano, tras cada acción y cada minuto. Solo un 2xx retira una entrada del outbox; una operación rechazada tres veces deja de reenviarse y se queda en el outbox (aún sin pantalla que la muestre: pendiente P4 de la [auditoría](../docs/AUDITORIA_QA_2026-10-01.md)).
- **PIN**: `POST /api/auth/pin` verifica el hash PBKDF2 en el servidor con 5 intentos por minuto y por teléfono (`auth_tentatives`, 429 + `Retry-After`). Sin red, el teléfono verifica con el hash que trajo el bootstrap. El cambio de PIN viaja como hash en una operación `vendeur.upsert`; el PIN nunca sale del teclado.
- **Administración** (`/admin`, `/api/admin/*`): Cloudflare Access en producción (ver abajo). Con `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD` definidos en `wrangler.jsonc`, el Worker exige el JWT de Access (`Cf-Access-Jwt-Assertion`, validado con el JWKS del equipo y el AUD de la aplicación): sin un JWT válido responde 401 `access_requis` y el jeton no vale. Sin esas dos vars, el jeton secreto `ADMIN_TOKEN` (`npx wrangler secret put ADMIN_TOKEN --env production`) pegado en la página `/admin`. En local, `ADMIN_SANS_AUTH = "true"`. Sin nada configurado en producción, `/api/admin` responde 503.

### Cloudflare Access (en producción desde el 2026-10-01)

- **Aplicación** «Mon Stand — /admin» (Zero Trust → Access controls → Applications, _self-hosted_), con dos destinos: `mon-stand.applis.workers.dev/admin` y `mon-stand.applis.workers.dev/api/admin` (los sub-paths quedan cubiertos). El resto —la app de la vendedora, `/api/health`, emparejamiento, bootstrap y sync— sigue fuera de Access: los teléfonos entran con su token y el PIN.
- **Política** «Mon Stand — propriétaire»: _Allow_ para el correo del propietario. El único proveedor de identidad del equipo es GitHub; la sesión dura 1 mes.
- **Dos capas**: Access corta en el borde (302 al login, o 401 si la petición lleva `X-Requested-With: XMLHttpRequest`) y el Worker vuelve a validar el JWT, por si una petición llegara al Worker sin pasar por Access.
- **Service worker**: `/admin` y `/cdn-cgi/` no entran en el `navigateFallback` (`vite.config.ts`). `/cdn-cgi/access/authorized` es el retorno del login: si el service worker respondiera con la app, la cookie de sesión no se guardaría.
- **Sesión caducada** con el panel abierto: las peticiones reciben 401 (o una redirección que no se sigue) y el panel muestra «Connexion requise» → «Se reconnecter», que recarga `/admin` y pasa por el login.
- **`ADMIN_TOKEN`** ya no abre nada mientras las dos vars estén definidas. El secreto puede borrarse: `npx wrangler secret delete ADMIN_TOKEN --env production`.
- **Vuelta atrás**: vaciar `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD` en `env.production.vars` (PR y merge) y borrar la aplicación en Zero Trust; el panel vuelve a pedir el jeton.
- **Rehacerla** (otra cuenta, otro dominio): crear la aplicación con los dos destinos y la política, copiar el **Application Audience (AUD) Tag** de la aplicación y el nombre del equipo (`<equipo>.cloudflareaccess.com`, visible en la URL del login), rellenar las dos vars, `npm run cf-typegen`, PR y merge. Comprobar con `curl -s -o /dev/null -w '%{http_code}' https://…/api/admin/moi` → 302.

## Automatizaciones (Fase 5)

- **Tasas** (`worker/taux.ts`): cron `0 19 * * *` (06:00 Nouméa). Base EUR del BCE (Frankfurter; secours open.er-api) × 119,332 → KV `taux:latest`, `taux_historique` y una operación `taux.definir` por divisa en `sync_journal`: los teléfonos las reciben en su siguiente pull. `POST /api/admin/taux/actualiser` la lanza a mano.
- **Clôture en PDF** (`worker/pdf/cloture.ts`): al recibir una operación `journee.cloturer` por sync, el Worker genera en segundo plano (`waitUntil`) el HTML del cierre y lo convierte en PDF con Browser Rendering (binding `BROWSER`, solo en `env.production`); el fichero va a R2 (`<prefijo>/clotures/AAAA/AAAA-MM-DD_<id>.pdf`) y su clave a `journees.pdf_key`. Sin binding (local, tests) se archiva el HTML. `GET /api/admin/journees/:id/pdf` lo sirve; `POST` lo regenera.
- **Panel `/admin`** (`src/ecrans/Admin.tsx`): ventas del mes, jornadas y clôtures, horas por vendedora, exportes CSV (`/api/admin/export/ventes.csv?mois=AAAA-MM`, `heures.csv`), tasas, archivos, emparejamiento y dispositivos. Cada pestaña carga sus datos al abrirse.
- **Archivo mensual** (`worker/archive.ts`): cron `0 20 1 * *` → R2 `<prefijo>/archives/AAAA-MM.json` con todas las tablas (sin hashes de PIN ni de token). D1 Time Travel cubre los 30 últimos días; el archivo, el resto. `POST /api/admin/archives?mois=` a mano.

## Migración desde la v1 (Fase 6)

El export completo del teléfono (JSON, botón «Export complet» de la v1.4+) es la única fuente. **Nunca entra en el repo**: guardarlo fuera (por ejemplo `~/.mon-stand/`).

1. **Ensayo** en producción con datos de prueba: código en `/admin` → Appareils, emparejar el teléfono, jornada simulada, clôture, PDF visible en Journées.
2. **Copia de seguridad** de la D1: `npx wrangler d1 export mon-stand-production --remote --env production --output ~/.mon-stand/avant-import.sql`.
3. **Purga** de los datos de prueba. Antes, **désappairer todos los teléfonos** (Réglages → Désappairer, que exige un outbox vacío): un teléfono que sigue emparejado no vuelve a hacer bootstrap, conserva los datos de prueba y reinyectaría sus operaciones pendientes. Después: `npx wrangler d1 execute mon-stand-production --remote --env production --file scripts/purger-production.sql` (las filas de `devices` se conservan), luego `… --file scripts/verifier-vide.sql`: todo a cero salvo `devices` (los teléfonos quedan desligados de la vendedora hasta su próximo PIN). Los dos scripts los prueba `test/scripts-migration.spec.ts`.
4. **Importación**: `node scripts/importer-v1.mjs ~/.mon-stand/export.json --sortie ~/.mon-stand/import.sql` (informe por cierre: CA calculado vs. `totalEncaisse` de la v1, avisos; en los cierres v1.3 la v1 sumaba las unidades recibidas en divisa como si fueran CFP, así que el écart es exactamente lo acreditado en CFP menos esas unidades) y `npx wrangler d1 execute mon-stand-production --remote --env production --file ~/.mon-stand/import.sql`. **Entre la purga y la importación no se genera ningún código de emparejamiento ni se abre la app**: en una base vacía, «Générer un code» o un bootstrap siembran el catálogo por defecto (`worker/semence.ts`) y la importación, que es `INSERT OR IGNORE`, conservaría esos artículos y duplicaría el stock. Repetir la importación no duplica nada, pero una corrección del importador solo se aplica tras una nueva purga.
5. **Verificación**: en `/admin`, eligiendo los meses de los cierres (abril y mayo de 2026: el panel abre en el mes en curso), los 4 cierres con su CA y reparto por divisa, y las sesiones en Heures. Después, generar un código y emparejar el teléfono: 26 artículos y su stock. Los cierres y las sesiones de hace más de 90 días no llegan al teléfono (ventana del bootstrap).
6. La vendedora cambia el PIN (`1234`) en Réglages.

Reglas del importador (`shared/import-v1.ts`, test `test/import-v1.spec.ts` con `test/fixtures/export-v1-synthetique.json`): ventas v1.4/v1.5 con `montantDevise`/`totalDevise`/`tauxCFP`; ventas v1.3 en divisa (sin tasa) acreditadas al total y avisadas; fecha de cada cierre = día de su primera venta en Nouméa (la `date` de la v1 es la del momento del cierre; sin ventas, `clotureAt` o esa `date`); stock = cantidad del export (un movimiento `inventaire` por artículo); ventas sin cierre → jornada abierta «en cours».

## Comandos

```sh
npm ci                     # instalar (npm 10 u 11)
npm run db:migrate:local   # crear la D1 local
npm run dev                # http://localhost:5173 — interfaz + API
npm run check              # formato, lint, tipos, tests y build: lo mismo que la CI
```

Para **añadir o actualizar una dependencia** usar `npx npm@11 install …`: `npm install` de npm 10 falla con un error interno (`edgesOut`) al resolver las dependencias _peer_ de Vitest. `npm ci` funciona con las dos versiones.

## Entornos

No hay entorno preview (decidido el 2026-09-27, ver el plan): se prueba en local y se despliega a producción.

| Entorno    | Worker      | D1                                  | Cómo se construye          |
| ---------- | ----------- | ----------------------------------- | -------------------------- |
| local      | —           | `mon-stand-local` (en `.wrangler/`) | `npm run dev`              |
| production | `mon-stand` | `mon-stand-production`              | `npm run build:production` |

KV `mon-stand-taux` guarda las tasas de cambio. R2 `mon-stand-files`: cada entorno escribe bajo su prefijo (`R2_PREFIX`).

## Base de datos

1. Cambiar `worker/db/schema.ts`.
2. `npm run db:generate -- --name <descripcion>` → nuevo archivo en `migrations/`.
3. `npm run db:migrate:local` y `npm test`.
4. Aplicar a producción justo **antes** del merge (`npm run db:migrate:production`, requiere `wrangler login` o un token con permiso D1): Workers Builds despliega en cuanto el PR llega a `main`. Por eso una migración solo añade (columnas opcionales, tablas nuevas) y no rompe el código que ya está en producción. Sin preview, la migración se prueba entera en local (`npm run db:migrate:local`, `npm test`) antes de tocar producción. Wrangler guarda una copia antes de aplicarla y D1 Time Travel permite volver a cualquier minuto de los últimos 30 días: ante un problema se restaura, no se improvisa SQL en producción.

## Despliegue (Workers Builds)

Un solo Worker conectado al repositorio en el panel de Cloudflare (_mon-stand → Settings → Build → Connect_):

|                       | `mon-stand` (producción)                                   |
| --------------------- | ---------------------------------------------------------- |
| Directorio raíz       | `app`                                                      |
| Comando de build      | `npm run build:production`                                 |
| Comando de deploy     | `npx wrangler deploy`                                      |
| Rama de producción    | `main`                                                     |
| Builds de otras ramas | **desactivados**: una versión de preview usaría la D1 real |

Los PR se validan con la CI (`npm run check` en GitHub Actions); el despliegue solo sale de `main`. Para volver a la versión anterior: _mon-stand → Deployments_ o `npx wrangler rollback`.

La página de producción es pública, pero sin emparejar un teléfono no hay datos: solo `/api/health` responde sin token. Hasta que Diego pruebe el flujo en producción con datos de prueba y los borre, **no se importan datos reales** (Fase 6).
