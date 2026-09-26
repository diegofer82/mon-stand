# Mon Stand v2 — `app/`

React + TypeScript (Vite) servido por un Worker de Cloudflare (Hono) con D1, KV y R2. Plan y decisiones: [`docs/PLAN_DE_TRABAJO.md`](../docs/PLAN_DE_TRABAJO.md). Diseño: [Design System](https://claude.ai/artifact/EL9M2DpdxJkeKziaHprhFp) y [canvas de pantallas](https://claude.ai/artifact/TgJaV59CH23RrbqaJNRpbE).

## Estructura

| Carpeta       | Contenido                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `src/`        | Interfaz React. Estilos: Tailwind v4 con los tokens del Design System (`src/styles/app.css`)              |
| `worker/`     | API Hono (`/api/*`) y esquema Drizzle de D1 (`worker/db/schema.ts`)                                       |
| `shared/`     | Lógica de negocio pura compartida por la interfaz y el Worker (importes, fechas de Nouméa), con sus tests |
| `migrations/` | SQL de D1 generado por Drizzle; Wrangler lo aplica                                                        |
| `test/`       | Tests del Worker en el runtime real de Workers, contra una D1 migrada                                     |

## Comandos

```sh
npm ci                     # instalar (npm 10 u 11)
npm run db:migrate:local   # crear la D1 local
npm run dev                # http://localhost:5173 — interfaz + API
npm run check              # formato, lint, tipos, tests y build: lo mismo que la CI
```

Para **añadir o actualizar una dependencia** usar `npx npm@11 install …`: `npm install` de npm 10 falla con un error interno (`edgesOut`) al resolver las dependencias _peer_ de Vitest. `npm ci` funciona con las dos versiones.

## Entornos

| Entorno    | Worker              | D1                                  | Cómo se construye          |
| ---------- | ------------------- | ----------------------------------- | -------------------------- |
| local      | —                   | `mon-stand-local` (en `.wrangler/`) | `npm run dev`              |
| preview    | `mon-stand-preview` | `mon-stand-preview`                 | `npm run build:preview`    |
| production | `mon-stand`         | `mon-stand-production`              | `npm run build:production` |

KV `mon-stand-taux` (tasas de cambio) es el mismo en preview y producción. R2 `mon-stand-files` es un solo bucket: cada entorno escribe bajo su prefijo (`R2_PREFIX`).

## Base de datos

1. Cambiar `worker/db/schema.ts`.
2. `npm run db:generate -- --name <descripcion>` → nuevo archivo en `migrations/`.
3. `npm run db:migrate:local` y `npm test`.
4. Aplicar a preview antes de probar la rama (`npm run db:migrate:preview`) y a producción justo **antes** del merge (`npm run db:migrate:production`): Workers Builds despliega en cuanto el PR llega a `main`. Por eso una migración solo añade (columnas opcionales, tablas nuevas) y no rompe el código que ya está en producción. Los dos comandos requieren `wrangler login` o un token con permiso D1.

## Despliegue (Workers Builds)

Dos Workers conectados al repositorio en el panel de Cloudflare (_Workers & Pages → Create → Import a repository_):

|                       | `mon-stand` (producción)   | `mon-stand-preview`                                                                                 |
| --------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| Directorio raíz       | `app`                      | `app`                                                                                               |
| Comando de build      | `npm run build:production` | `npm run build:preview`                                                                             |
| Comando de deploy     | `npx wrangler deploy`      | `npx wrangler deploy`                                                                               |
| Rama de producción    | `main`                     | `main`                                                                                              |
| Builds de otras ramas | desactivados               | activados, comando `npx wrangler versions upload` (una URL de preview por rama, comentada en el PR) |

Cloudflare Access protege las URLs de preview (_mon-stand-preview → Settings → Domains & Routes → Cloudflare Access_). La página de producción es pública hasta la Fase 4 (PIN de vendedora y Access en `/admin`).
