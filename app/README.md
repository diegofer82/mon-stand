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

La página de producción es pública, pero hasta la Fase 4 (PIN de vendedora y Access en `/admin`) solo expone `/api/health`: **no se importan datos reales antes de la Fase 4**.
