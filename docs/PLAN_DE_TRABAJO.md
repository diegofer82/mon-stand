# Plan de trabajo — Mon Stand v2 (Cloudflare + rediseño)

> Estado: **propuesta validada** · 2026-09-25
> Punto de partida: v1.3 (`index.html` en GitHub Pages)

---

## 0. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Backend y datos | **Cloudflare**: Workers + D1 + KV + R2. Se retira Google Sheets / Apps Script |
| URL | Subdominio **`*.workers.dev`** de momento (dominio propio más adelante, ver Backlog) |
| Frontend | **React + TypeScript** (Vite) |
| Varios teléfonos a la vez | **No por ahora**, pero el modelo de datos se diseña multi-dispositivo desde el día 1; el tiempo real queda en Backlog |
| Diseño | Rediseño completo con **/design** (Design System + canvas de pantallas en claude.ai) |
| Plan Cloudflare | **Workers Paid** (5 $/mes) + **Zero Trust Teams Free** (Access hasta 50 usuarios), ambos activos — ver §3 |

---

## 1. Punto de partida (v1.3)

- Una sola `index.html` (~1 100 líneas, 84 KB): HTML + CSS + JS vanilla, handlers `onclick` inline.
- Datos **solo en `localStorage`** del teléfono (`deb_*`). Sin servidor, sin multi-dispositivo.
- Sync opcional con Google Sheets vía Apps Script (`mode:'no-cors'`, sin confirmación real).
- Dependencias por CDN: jsPDF, XLSX, Google Fonts. No hay manifest ni service worker.

### Bugs detectados

| # | Problema | Dónde | Impacto |
|---|---|---|---|
| 1 | Fechas en UTC (`toISOString().split('T')[0]`) | `index.html` l. 583, 590, 619, 637, 960, 1083 | En Nouméa (UTC+11) un cierre antes de las 11:00 se archiva con la fecha de **ayer** |
| 2 | Tasa redondeada a entero `Math.round(1/r)` (y `JPY:1` por defecto) | l. 527, 413 | 1 ¥ ≈ 0,7 CFP pasa a 1 → un artículo de 1 000 CFP se cobra 1 000 ¥ en vez de ~1 400 ¥ |
| 3 | Fallback Frankfurter no soporta XPF; EUR forzado a 119 | l. 520, 528 | Sin tasas si open.er-api cae. El CFP está anclado al euro: **1 € = 119,332 CFP** → basta con tasas EUR × 119,332 |
| 4 | Sync `mode:'no-cors'` | l. 654, 972 | Muestra "✓ Synchronisé" aunque falle |
| 5 | `loadFromGoogle` reemplaza todo el stock | l. 984 | Pisa los cambios locales |
| 6 | `stockFinal` sin `categorie` | l. 961 → 1044 | PDF de historial: todo en "DIVERS" |
| 7 | Dos cierres el mismo día comparten `date` | l. 944, 1018 | El segundo es inaccesible |
| 8 | "Heures ce mois" = horas desde el último cierre | l. 962 | Etiqueta engañosa |
| 9 | XLSX (~900 KB) cargado, `exportHeuresXLSX` nunca se llama | l. 12, 742 | Carga lenta en red de mercado |
| 10 | PIN en claro en `localStorage`, `1234` por defecto | l. 414 | Protección nula |
| 11 | `innerHTML` con nombres/comentarios sin escapar | l. 690, 775… | HTML roto / inyección |
| 12 | `user-scalable=no`, `</div>` sobrante, `google-apps-script.js` ausente del repo | l. 5, 317, 401 | Accesibilidad, HTML inválido, config no reproducible |

---

## 2. Arquitectura objetivo

```
 Teléfono(s) vendedor (PWA React)             Propietario (escritorio)
   IndexedDB + Service Worker + outbox             │ Cloudflare Access
            │ HTTPS (sync push/pull)               │
            ▼                                      ▼
 ┌──────────── Worker "mon-stand" (Hono) · mon-stand.<cuenta>.workers.dev ───────────┐
 │  Static assets (SPA)   /api/*   /admin   Cron (tasas, backup)   Browser Run (PDF) │
 └──────┬───────────────┬──────────────┬──────────────────┬──────────────────────────┘
     D1 (SQLite)     KV (tasas)     R2 (PDF, fotos,     Email (PDF de cierre,
   fuente de verdad                  backups)            si hay dominio con Email Routing)
```

### Componentes

| Pieza | Servicio | Uso |
|---|---|---|
| Web instalable | Workers Static Assets | SPA + PWA, deploy automático por push, URL de preview por PR |
| API | Workers + Hono | Bootstrap, sync, cierres, admin, exportes |
| Base de datos | D1 | Fuente de verdad (ventas, stock, horas, cierres) |
| Tasas de cambio | Cron diario + KV | EUR base (Frankfurter/BCE) × 119,332; fallback open.er-api |
| Archivos | R2 | PDFs de cierre, fotos de artículos, archivo mensual |
| PDF | Browser Run | HTML del cierre (mismo diseño que la app) → PDF |
| Acceso | Cloudflare Access + PIN por vendedor | Propietario por email; vendedores con PIN verificado en servidor |
| Observabilidad | Workers Logs | Diagnóstico de incidencias |

### Principios de diseño

1. **Offline-first**: cada operación se guarda en IndexedDB y en una cola *outbox*; se envía cuando hay red.
2. **Idempotencia**: cada operación lleva un UUID generado en el teléfono (`crypto.randomUUID()`); reenviar no duplica.
3. **Stock como libro de movimientos** (`vente`, `ajustement`, `reassort`, `annulation`, `inventaire`): la cantidad es la **suma** de movimientos → dos dispositivos offline nunca se pisan. Trazabilidad completa.
4. **Multi-dispositivo desde el día 1**: `device_id` y `vendeur_id` en cada operación, aunque hoy haya un solo teléfono.
5. **Importes en enteros CFP**; cada pago en divisa guarda la tasa aplicada.
6. **Zona horaria explícita** `Pacific/Noumea` en la configuración; fechas de negocio calculadas con `Intl`.

### Esquema D1 (borrador)

```
vendeurs          id, prenom, pin_hash, pin_salt, taux_horaire_cfp, actif, created_at
devices           id, nom, token_hash, vendeur_id?, created_at, last_seen_at
categories        id, nom, emoji, ordre
articles          id, nom, categorie_id, prix_cfp, promo_2eme_pct?, photo_key?, actif, updated_at
stock_mouvements  id, article_id, delta, motif, vente_id?, vendeur_id, device_id, ts
journees          id, date_locale, lieu, vendeur_id, ouverte_at, cloturee_at?, pdf_key?
ventes            id, journee_id, vendeur_id, device_id, ts, sous_total_cfp,
                  remise_panier_cfp, remise_encaissement_cfp, total_cfp, annulee_at?
vente_lignes      id, vente_id, article_id, nom_snapshot, qty, prix_unit_cfp, total_cfp
vente_paiements   id, vente_id, devise (CFP|AUD|USD|EUR|NZD|JPY|TPE),
                  montant_devise, taux_cfp, montant_cfp          ← permite pago mixto
comptages_caisse  id, journee_id, devise, attendu, compte, ecart
sessions_travail  id, vendeur_id, debut, fin?, duree_min, commentaire, payee_at?
paiements_heures  id, vendeur_id, montant_cfp, date, note
taux_historique   devise, cfp_par_unite, source, date
settings          key, value
sync_ops          op_id, device_id, received_at                  ← idempotencia
```

### API (borrador)

| Ruta | Descripción |
|---|---|
| `POST /api/devices/pair` | Emparejar un teléfono (código/QR generado desde `/admin`) |
| `POST /api/auth/pin` | Vendedor + PIN → sesión (rate limiting) |
| `GET /api/bootstrap` | Artículos, categorías, tasas, vendedores, ajustes |
| `POST /api/sync` | Push de operaciones del outbox + pull de cambios desde un cursor |
| `GET /api/journees[/:id]` | Historial y detalle de jornadas |
| `POST /api/journees/:id/cloture` | Cierre → PDF (Browser Run) → R2 (+ email) |
| `/api/admin/*` | CRUD artículos/vendedores, informes, export CSV/XLSX (protegido por Access) |

### Stack

- **Front**: Vite + React + TypeScript (strict), Tailwind CSS v4 con los tokens del Design System, Radix UI (diálogos, bottom sheets accesibles), iconos Lucide, TanStack Query.
- **Offline**: `vite-plugin-pwa` (Workbox) + Dexie (IndexedDB).
- **Worker**: Hono + zod, Drizzle ORM (esquema y migraciones D1).
- **Tooling**: `@cloudflare/vite-plugin` (front + Worker en un solo proyecto, D1/KV/R2 locales en dev), Wrangler.
- **Tests**: Vitest (lógica de negocio), `@cloudflare/vitest-pool-workers` (API), Playwright (flujos: venta, cobro, cierre, modo avión).

### Estructura del repo

La v1 sigue en la raíz (GitHub Pages la sirve) hasta el corte; la v2 vive en `app/`.

```
mon-stand/
├─ index.html              # v1.3 (hasta el corte; luego página de redirección)
├─ inventaire.json
├─ docs/PLAN_DE_TRABAJO.md
└─ app/                    # v2
   ├─ src/                 # React (pantallas, componentes, domain/, db/ Dexie)
   ├─ worker/              # Hono (rutas, sync, cron, pdf)
   ├─ migrations/          # SQL D1
   ├─ public/              # manifest, iconos
   ├─ tests/
   ├─ package.json
   └─ wrangler.jsonc
```

---

## 3. Qué aprovechamos de la suscripción (Workers Paid + Zero Trust Free)

Cifras verificadas en la documentación oficial de Cloudflare el 2026-09-25.

| | Workers Free | Workers Paid | Uso en el proyecto |
|---|---|---|---|
| CPU por petición HTTP | 10 ms | hasta 5 min (30 s por defecto) | Import de datos v1, exportes, sync de lotes grandes |
| CPU por Cron Trigger | 10 ms | 30 s (intervalo < 1 h) / 15 min (≥ 1 h) | Cron de tasas y archivo mensual D1 → R2 |
| Cron Triggers por cuenta | 5 | 250 | Sin restricción práctica |
| Peticiones | 100 000/día | 10 M/mes incluidas (+0,30 $/M) | Margen de sobra; las peticiones a los archivos estáticos son gratis |
| Tamaño por BD D1 | 500 MB | 10 GB | Años de historial |
| D1 lecturas / escrituras | 5 M/día / 100 000/día | 25 000 M / 50 M al mes | Panel del propietario sin preocuparse |
| Consultas D1 por petición | 50 | 1 000 | Sync de lotes del outbox en una sola petición |
| **D1 Time Travel** | 7 días | **30 días** | Restaurar la BD a cualquier minuto del último mes |
| Workers Logs | 200 000 eventos/día, 3 días | 20 M/mes, 7 días | Revisar el lunes un problema del sábado |
| **Browser Run** | 10 min/día, 3 navegadores | 10 h/mes + 10 navegadores | PDF de cierre generado en servidor desde HTML |
| Durable Objects | 100 000 peticiones/día | 1 M peticiones/mes incluidas | Tiempo real multi-teléfono (Backlog) |
| Email Sending | no disponible | 3 000 emails/mes incluidos | PDF de cierre por email (requiere dominio, ver nota) |

Coste estimado para el volumen de un stand: **los 5 $/mes de Workers Paid** que ya se pagan; R2 dentro de su capa gratuita (10 GB); Access sin coste con Zero Trust Teams Free (hasta 50 usuarios).

Notas:
- **Cloudflare Access sobre `workers.dev`**: Access puede proteger la URL `workers.dev` de producción, las URLs de preview, o ambas. Se usará para `/admin` y las previews; las vendedoras entran con PIN.
- Las funciones de **dominio** (WAF, reglas personalizadas, Polish) **no aplican a `*.workers.dev`**: se aprovecharán si más adelante se usa un dominio propio.
- El **envío de email** exige "onboardear" un dominio de la cuenta Cloudflare en Email Service (registros DKIM/DMARC); la app puede seguir en `workers.dev`. Los envíos a direcciones de destino verificadas son gratuitos y no cuentan en la cuota. Sin dominio: el PDF queda en R2 y se descarga desde `/admin`.

Fuentes: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) · [Browser Run pricing](https://developers.cloudflare.com/browser-run/pricing/) · [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) · [Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/) · [workers.dev + Access](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

---

## 4. Rediseño con /design

### Entregables
1. **Design System "Debajah Création"** (no existe ninguno en la cuenta): tokens de color, tipografía, espaciado, radios, sombras; componentes: botón, chip, tarjeta de artículo, teclado numérico, bottom sheet, toast, KPI, barra de pestañas.
2. **Canvas Design** con todas las pantallas: móvil 390 px en claro y oscuro + Caja en tablet horizontal.

### Dirección visual
- Mantener la identidad (violeta profundo + oro + 🌿) pero más sobria: superficies neutras, oro solo como acento/CTA, sin degradados en botones.
- **Modo claro de alto contraste por defecto** (stand al aire libre, a pleno sol); oscuro automático u opcional.
- Serif solo para marca y títulos; sans para la UI; **cifras tabulares** en importes.
- Iconos SVG coherentes (Lucide) en lugar de emoji en la UI; emoji o foto solo para categorías/artículos.
- Accesibilidad: objetivos táctiles ≥ 48 px, contraste AA, zoom permitido, estados de foco.

### Pantallas

| Pantalla | Cambios principales |
|---|---|
| Acceso | Selector de vendedor (avatares) + teclado PIN |
| **Caja** (principal) | Cuadrícula de artículos (foto/emoji + precio), un toque = añadir; carrito en bottom sheet con total fijo; búsqueda y filtros |
| **Cobro** | Divisas en botones grandes, teclado numérico, billetes rápidos (1 000 / 5 000 / 10 000 CFP), monnaie muy visible, **pago mixto**, **deshacer última venta** |
| Stock | Nivel de stock visual, badges faible/épuisé, modo edición separado del modo venta, réassort rápido |
| Horas | Botón grande Commencer/Terminer (mantener pulsado), línea de tiempo, resumen mensual pagado/pendiente |
| **Cierre** | KPIs (CA, ventas, cesta media), top artículos, reparto por divisa, **conteo de caja** (esperado vs contado → écart), PDF |
| Historial | Por día y mercado, detalle, re-generar PDF |
| Panel propietario (`/admin`, escritorio) | CA por día/mercado/mes, horas a pagar por vendedor, exportes CSV/XLSX |
| Ajustes | Vendedores, dispositivos, tasa horaria, tasas de cambio, categorías |

Navegación: 4 pestañas (Caja · Stock · Horas · Cierre); Ajustes en el menú del avatar.

---

## 5. Fases

Estimaciones orientativas en días de trabajo efectivo.

### Fase 0 — Estabilizar la v1.3 → v1.4 (≈ 1 día · GitHub Pages)
- [ ] Fechas en hora local (bug 1)
- [ ] Tasas: EUR fijo 119,332; resto derivado de tasas EUR; conservar decimales (bugs 2–3)
- [ ] `stockFinal` con categoría; clave única por cierre (bugs 6–7)
- [ ] Botón **"Export complet (JSON)"**: articles, ventes, sessions, sessionActive, historique, rates, settings (sin PIN) — imprescindible para migrar: el nuevo dominio no puede leer el `localStorage` de github.io
- [ ] Quitar la librería XLSX; `user-scalable=no`; `</div>` sobrante (bugs 9, 12)
- La sync con Google Sheets no se toca: se retira con la v2.

**Hecho cuando**: v1.4 en producción y el export probado en el teléfono de la vendedora.

### Fase 1 — Diseño con /design (≈ 2–3 días)
- [ ] Design System "Debajah Création"
- [ ] Canvas con todas las pantallas (§4), claro/oscuro, móvil + tablet
- [ ] Revisión en el teléfono con la vendedora (enlace compartido) e iteración
- [ ] Tokens finales listos para Tailwind (`@theme`)

**Hecho cuando**: pantallas validadas por el propietario y la vendedora.

### Fase 2 — Fundaciones Cloudflare (≈ 2 días)
- [ ] Proyecto `app/`: Vite + React + TS + `@cloudflare/vite-plugin` + Hono; ESLint, Prettier, Vitest
- [ ] **Activar R2** en el dashboard de Cloudflare (hoy desactivado en la cuenta: la API responde "Please enable R2")
- [ ] `wrangler.jsonc` con entornos producción y preview, siguiendo la convención de la cuenta (`controlcash` / `controlcash-preview`): Workers `mon-stand` y `mon-stand-preview`; D1 `mon-stand-production` y `mon-stand-preview`; KV `mon-stand-taux`; R2 `mon-stand-files`; Browser Run; cron
- [ ] Migración D1 inicial (esquema §2) con Drizzle
- [ ] Workers Builds conectado al repo (directorio raíz `app/`): deploy en push a `main`, URL de preview por PR
- [ ] Publicación en `mon-stand.<cuenta>.workers.dev`; Cloudflare Access sobre las URLs de preview y `/admin`
- [ ] CI GitHub Actions: typecheck + tests en cada PR

**Hecho cuando**: una página React + `/api/health` leyendo D1 están desplegadas en `workers.dev`, con preview por PR.

### Fase 3 — Nueva interfaz (≈ 5–7 días)
- [ ] Componentes del Design System
- [ ] `src/domain/`: lógica de negocio pura con tests — promo 2ª unidad, remises, monnaie, conversiones y redondeos (`arrondir5`), redondeo de horas a 30 min, totales de cierre. Primero tests que reproduzcan el comportamiento v1, luego las correcciones
- [ ] Pantallas en orden de valor: Caja → Cobro → Stock → Cierre → Horas → Ajustes
- [ ] PWA: manifest, iconos, service worker, Dexie, outbox; todo funciona sin red
- [ ] Textos centralizados (FR por defecto) para poder añadir EN más adelante

**Hecho cuando**: una venta completa y un cierre funcionan en modo avión en iPhone y Android.

### Fase 4 — API, sincronización y acceso (≈ 3–4 días)
- [ ] Rutas Hono + validación zod (§2)
- [ ] Sync push/pull con cursor e idempotencia (`sync_ops`)
- [ ] Stock como libro de movimientos; reglas de conflicto: stock = suma, artículos = última escritura por campo (`updated_at`)
- [ ] Cloudflare Access para el propietario; PIN por vendedor con hash PBKDF2 (WebCrypto) verificado en servidor + rate limiting; emparejamiento de dispositivo por QR
- [ ] Verificación offline del PIN con hash cacheado en el dispositivo

**Hecho cuando**: dos navegadores venden sin red, se reconectan y el stock cuadra.

### Fase 5 — Automatizaciones (≈ 2 días)
- [ ] Cron diario de tasas → KV + `taux_historique`
- [ ] Cierre: plantilla HTML → Browser Run → PDF en R2 (+ email si hay dominio con Email Routing)
- [ ] Panel `/admin`: KPIs, por mercado, horas a pagar, export CSV/XLSX
- [ ] Archivo mensual D1 → R2 (Time Travel cubre los 30 últimos días)

**Hecho cuando**: al cerrar la jornada el PDF queda archivado y visible en el panel.

### Fase 6 — Migración y corte (≈ 1 día + 1 día de mercado)
- [ ] Importador "v1 JSON → D1" en `/admin` (idempotente, con informe de lo importado)
- [ ] Si hay datos en Google Sheets: exportarlos una vez e importarlos
- [ ] Un día de mercado con v1 y v2 en paralelo; comparar cierres
- [ ] Corte: `index.html` raíz → página de redirección a `workers.dev`; v1 archivada en `legacy/`
- [ ] Desactivar el despliegue de Apps Script; actualizar el README

**Hecho cuando**: la vendedora usa solo la v2 y todo el historial está en D1.

**Total orientativo: ~3 semanas de trabajo efectivo.**

---

## 6. Backlog (después de la v2)

- **Tiempo real multi-teléfono** (Durable Objects + WebSocket) cuando haya varios teléfonos en el mismo stand — el modelo de datos ya lo permite.
- Recibo digital por QR para el cliente (FR/EN, clientes turistas).
- Fotos de artículos (R2 + transformación de imágenes).
- Workers AI: resumen semanal de ventas, sugerencias de réassort.
- Dominio propio + WAF / reglas personalizadas (si el plan de dominio lo incluye).
- Multi-stand / multi-mercado.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Red inestable en el mercado | Offline-first con outbox; nada bloquea una venta |
| iOS borra el almacenamiento de webs no usadas en 7 días (si no están en la pantalla de inicio) | Instalar la PWA en la pantalla de inicio + D1 como fuente de verdad |
| `localStorage` no se transfiere entre dominios | Export JSON en la Fase 0 + importador en la Fase 6 |
| Errores de fecha por zona horaria | `Pacific/Noumea` explícito + tests |

---

## 8. Pendiente de confirmar

- [x] Suscripción Cloudflare: Workers Paid + Zero Trust Teams Free (confirmado 2026-09-25).
- [x] Conector "Cloudflare Developer Platform" conectado y verificado (lectura de Workers, D1, KV).
- [ ] Activar R2 en el dashboard (necesario para PDFs y archivo).
- [ ] ¿Hay un dominio en la cuenta Cloudflare para el envío de email?
- [ ] ¿Hay datos en Google Sheets que importar?
