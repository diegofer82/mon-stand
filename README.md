# Mon Stand — Debajah Création

App del stand artesanal: caja multi-divisa, stock, horas y cierre del día. Interfaz en francés.

- **App (v2)**: <https://mon-stand.applis.workers.dev> — panel del propietario en `/admin`.
- **Dirección antigua** (GitHub Pages, `https://diegofer82.github.io/mon-stand/`): desde el corte del 2026-10-01 es una página de redirección hacia la v2 ([`index.html`](index.html)).

## Qué hay en el repositorio

| Carpeta                    | Contenido                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`app/`](app/)             | La v2: React + TypeScript servidos por un Worker de Cloudflare (Hono) con D1, KV y R2. Cómo funciona, comandos, despliegue y migración: [`app/README.md`](app/README.md) |
| [`docs/`](docs/)           | [Plan de trabajo y decisiones](docs/PLAN_DE_TRABAJO.md) y la [auditoría de QA](docs/AUDITORIA_QA_2026-10-01.md) previa a la puesta en producción                         |
| [`legacy/`](legacy/)       | Las versiones v1.0, v1.1 y v1.5 (un solo `index.html`, datos en el `localStorage` del teléfono), archivadas como referencia. No se publican ni se modifican              |
| [`index.html`](index.html) | Página de redirección de la dirección antigua                                                                                                                            |
| [`AGENTS.md`](AGENTS.md)   | Reglas para los agentes que trabajan en el repo (Git, convenciones)                                                                                                      |

## Uso diario

- **La vendedora** abre la app en el teléfono (instalada en la pantalla de inicio), entra con su PIN, abre la jornada, vende (también sin red: las ventas se guardan en el teléfono y suben solas), cuenta la caja y cierra. El cierre queda archivado en PDF.
- **El propietario** usa `/admin`: ventas y cierres por mes, horas, exportes CSV, tasas, y el emparejamiento de teléfonos (código de 8 caracteres, 15 minutos).

## Desarrollo

```sh
cd app
npm ci
npm run db:migrate:local
npm run dev      # http://localhost:5173
npm run check    # formato, lint, tipos, tests y build (lo mismo que la CI)
```

Todo cambio pasa por una rama y un PR; `main` despliega solo (Workers Builds para la v2, GitHub Pages para la redirección). Ver [`AGENTS.md`](AGENTS.md).
