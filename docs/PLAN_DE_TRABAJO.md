# Plan de trabajo — Mon Stand v2 (Cloudflare + rediseño)

> Estado: **propuesta validada** · 2026-09-25 · **revisada el 2026-09-27: sin preview, directo a producción** (§0, §5)
> Punto de partida: v1.3 (`index.html` en GitHub Pages)

---

## 0. Decisiones tomadas

| Tema                      | Decisión                                                                                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend y datos           | **Cloudflare**: Workers + D1 + KV + R2. Se retira Google Sheets / Apps Script                                                                                                                                                                               |
| URL                       | Subdominio **`*.workers.dev`** de momento (dominio propio más adelante, ver Backlog)                                                                                                                                                                        |
| Frontend                  | **React + TypeScript** (Vite)                                                                                                                                                                                                                               |
| Varios teléfonos a la vez | **No por ahora**, pero el modelo de datos se diseña multi-dispositivo desde el día 1; el tiempo real queda en Backlog                                                                                                                                       |
| Diseño                    | Rediseño completo con **/design** (Design System + canvas de pantallas en claude.ai)                                                                                                                                                                        |
| Plan Cloudflare           | **Workers Paid** (5 $/mes) + **Zero Trust Teams Free** (Access hasta 50 usuarios), ambos activos — ver §3                                                                                                                                                   |
| Calendario                | El mercado **para 3 meses** desde el 2026-09-27 (reanudación hacia finales de diciembre de 2026). La v2 sale **directamente en producción** antes de la reanudación; la v1.5 sigue en GitHub Pages como plan B hasta el corte (decidido 2026-09-27)         |
| Entornos                  | **Sin preview**: local → producción. Nadie usa la app durante la parada, así que producción sirve también de entorno de pruebas hasta el corte. Worker `mon-stand-preview` nunca creado; D1 `mon-stand-preview` borrada el 2026-09-27 (decidido 2026-09-27) |
| Datos de la migración     | **Definitivos**: el export del teléfono del 2026-09-26 y las respuestas de la vendedora del 2026-09-27. La v1 no registra nada más durante la parada → una sola importación y sin día de mercado con v1 y v2 en paralelo (decidido 2026-09-27)              |
| Google Sheets en la v1    | **No se corrige** (bug 5, duplicados, script v1.2): la app no se usa durante la parada del mercado y la sync se retira con la v2 (decidido 2026-09-26)                                                                                                      |

---

## 1. Punto de partida (v1.3)

- Una sola `index.html` (~1 100 líneas, 84 KB): HTML + CSS + JS vanilla, handlers `onclick` inline.
- Datos **solo en `localStorage`** del teléfono (`deb_*`). Sin servidor, sin multi-dispositivo.
- Sync opcional con Google Sheets vía Apps Script (`mode:'no-cors'`, sin confirmación real).
- Dependencias por CDN: jsPDF, XLSX, Google Fonts. No hay manifest ni service worker.

### Bugs detectados

| #   | Problema                                                                                                                                   | Dónde                                         | Impacto                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fechas en UTC (`toISOString().split('T')[0]`)                                                                                              | `index.html` l. 583, 590, 619, 637, 960, 1083 | En Nouméa (UTC+11) un cierre antes de las 11:00 se archiva con la fecha de **ayer**                                              |
| 2   | Tasa redondeada a entero `Math.round(1/r)` (y `JPY:1` por defecto)                                                                         | l. 527, 413                                   | 1 ¥ ≈ 0,7 CFP pasa a 1 → un artículo de 1 000 CFP se cobra 1 000 ¥ en vez de ~1 400 ¥                                            |
| 3   | Fallback Frankfurter no soporta XPF; EUR forzado a 119                                                                                     | l. 520, 528                                   | Sin tasas si open.er-api cae. El CFP está anclado al euro: **1 € = 119,332 CFP** → basta con tasas EUR × 119,332                 |
| 4   | Sync `mode:'no-cors'`                                                                                                                      | l. 654, 972                                   | Muestra "✓ Synchronisé" aunque falle                                                                                             |
| 5   | `loadFromGoogle` reemplaza todo el stock                                                                                                   | l. 984                                        | Pisa los cambios locales                                                                                                         |
| 6   | `stockFinal` sin `categorie`                                                                                                               | l. 961 → 1044                                 | PDF de historial: todo en "DIVERS"                                                                                               |
| 7   | Dos cierres el mismo día comparten `date`                                                                                                  | l. 944, 1018                                  | El segundo es inaccesible                                                                                                        |
| 8   | "Heures ce mois" = horas desde el último cierre                                                                                            | l. 962                                        | Etiqueta engañosa                                                                                                                |
| 9   | XLSX (~900 KB) cargado, `exportHeuresXLSX` nunca se llama                                                                                  | l. 12, 742                                    | Carga lenta en red de mercado                                                                                                    |
| 10  | PIN en claro en `localStorage`, `1234` por defecto                                                                                         | l. 414                                        | Protección nula                                                                                                                  |
| 11  | `innerHTML` con nombres/comentarios sin escapar                                                                                            | l. 690, 775…                                  | HTML roto / inyección                                                                                                            |
| 12  | `user-scalable=no`, `</div>` sobrante, `google-apps-script.js` ausente del repo (el de la v1.1 está en `legacy/v1.1/` desde el 2026-09-27) | l. 5, 317, 401                                | Accesibilidad, HTML inválido, config no reproducible                                                                             |
| 13  | Cobro en divisa: `montantEncaisse` guardado en la divisa y sumado como CFP; `remiseEncaissement` = CFP − divisa                            | `validerVente`                                | «Total encaissé» falso y remises ficticias (detectado en la Fase 0)                                                              |
| 14  | Precio en divisa = total CFP convertido y redondeado **hacia arriba** al múltiplo de 5                                                     | `arrondir5`, `convertCFP`                     | La app sugería 30 AUD por un collar de 2 000 CFP (la vendedora cobra 25) y 55 AUD por dos (cobra 50); sin precio fijo por divisa |

### Google Sheets (revisado el 2026-09-26 con el `.xlsx` de la hoja y el script v1.2)

- **Nada que importar**: las ventas (21), sesiones (5) y el stock de la hoja están todos en el export del teléfono, que tiene además el 18/04 y las sesiones de abril.
- «Ventes»: cada sync vuelve a añadir todas las ventas del día (`appendRows`) → 62 filas para 21 ventas. Sin fila de cabecera.
- Hoja en configuración regional US: las fechas `JJ/MM/AAAA` con día ≤ 12 quedan invertidas (07/05 → 5 de julio); las demás quedan como texto.
- «Heures»: 6 columnas, sin cabecera, 77 filas para 5 sesiones → no corresponde al script v1.2 (que borra la hoja y escribe 8 columnas con `ID` y `Payée`): **el despliegue activo es una versión anterior**. Muy probablemente el script de la v1.1, archivado el 2026-09-27 en [`legacy/v1.1/google-apps-script.js`](../legacy/v1.1/google-apps-script.js): crea las hojas por adelantado (de ahí la falta de cabecera) y vuelve a añadir todas las ventas y sesiones en cada sync.
- Script v1.2 (no desplegado): `Payée` se escribe `OUI`/`NON` pero se lee como `TRUE`/`1` → al cargar, todas las sesiones pasarían a «no pagada»; Sheets convierte `Arrivée`/`Départ` en horas → `debut`/`fin` inválidos. **No desplegarlo tal cual.**
- `loadAll` devuelve el stock sin precios en divisa: la v1.5 conserva los `prixDevises` del teléfono.

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

| Pieza           | Servicio                             | Uso                                                                      |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| Web instalable  | Workers Static Assets                | SPA + PWA, deploy automático en cada push a `main` (sin URLs de preview) |
| API             | Workers + Hono                       | Bootstrap, sync, cierres, admin, exportes                                |
| Base de datos   | D1                                   | Fuente de verdad (ventas, stock, horas, cierres)                         |
| Tasas de cambio | Cron diario + KV                     | EUR base (Frankfurter/BCE) × 119,332; fallback open.er-api               |
| Archivos        | R2                                   | PDFs de cierre, fotos de artículos, archivo mensual                      |
| PDF             | Browser Run                          | HTML del cierre (mismo diseño que la app) → PDF                          |
| Acceso          | Cloudflare Access + PIN por vendedor | Propietario por email; vendedores con PIN verificado en servidor         |
| Observabilidad  | Workers Logs                         | Diagnóstico de incidencias                                               |

### Principios de diseño

1. **Offline-first**: cada operación se guarda en IndexedDB y en una cola _outbox_; se envía cuando hay red.
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
articles          id, nom, categorie_id, emoji?, prix_cfp, promo_2eme_pct?, photo_key?, actif, updated_at
article_prix      article_id, devise, prix, updated_at               ← precio manual; sin fila = calculado
stock_mouvements  id, article_id, delta, motif, vente_id?, vendeur_id, device_id, ts
journees          id, date_locale, lieu, vendeur_id, fond_caisse_cfp?, ouverte_at, cloturee_at?,
                  commentaire_cloture?, pdf_key?
journee_fonds     journee_id, devise, montant                    ← fondo de caja por divisa (Fase 3)
ventes            id, journee_id, vendeur_id, device_id, ts, sous_total_cfp,
                  remise_panier_cfp, remise_encaissement_cfp, total_cfp, annulee_at?
vente_lignes      id, vente_id, article_id, nom_snapshot, qty, prix_unit_cfp, total_cfp
vente_paiements   id, vente_id, devise (CFP|AUD|USD|EUR|NZD|JPY|TPE),
                  montant_devise, total_devise, taux_cfp, montant_cfp,  ← permite pago mixto
                  rendu_montant?, rendu_devise?                         ← monnaie devuelta (en la divisa del pago)
comptages_caisse  id, journee_id, devise, attendu, compte, ecart
sessions_travail  id, vendeur_id, debut, fin?, duree_min, commentaire, payee_at?
paiements_heures  id, vendeur_id, montant_cfp, date, note
taux_historique   devise, cfp_par_unite, source, date
settings          key, value
sync_ops          op_id, device_id, received_at                  ← idempotencia
```

### API (borrador)

| Ruta                             | Descripción                                                                 |
| -------------------------------- | --------------------------------------------------------------------------- |
| `POST /api/devices/pair`         | Emparejar un teléfono (código/QR generado desde `/admin`)                   |
| `POST /api/auth/pin`             | Vendedor + PIN → sesión (rate limiting)                                     |
| `GET /api/bootstrap`             | Artículos, categorías, tasas, vendedores, ajustes                           |
| `POST /api/sync`                 | Push de operaciones del outbox + pull de cambios desde un cursor            |
| `GET /api/journees[/:id]`        | Historial y detalle de jornadas                                             |
| `POST /api/journees/:id/cloture` | Cierre → PDF (Browser Run) → R2 (+ email)                                   |
| `/api/admin/*`                   | CRUD artículos/vendedores, informes, export CSV/XLSX (protegido por Access) |

### Stack

- **Front**: Vite + React + TypeScript (strict), Tailwind CSS v4 con los tokens del Design System, iconos Lucide. Sin Radix ni TanStack Query (decidido en la Fase 3): los bottom sheets van sobre `<dialog>` nativo (foco atrapado, Escape, scrim) y los datos se leen de IndexedDB con `dexie-react-hooks`, así que una librería de caché de red no aporta nada.
- **Offline**: `vite-plugin-pwa` (Workbox, toda la app precargada) + Dexie (IndexedDB) con un outbox de operaciones (`shared/ops.ts`, contrato zod compartido con el Worker).
- **Worker**: Hono + zod, Drizzle ORM (esquema y migraciones D1).
- **Tooling**: `@cloudflare/vite-plugin` (front + Worker en un solo proyecto, D1/KV/R2 locales en dev), Wrangler.
- **Tests**: Vitest (lógica de negocio), `@cloudflare/vitest-pool-workers` (API), Playwright (flujos: venta, cobro, cierre, modo avión).

### Estructura del repo

Desde el corte (2026-10-01) la raíz solo sirve la página de redirección (GitHub Pages); la v2 vive en `app/`.

```
mon-stand/
├─ index.html              # página de redirección hacia la v2
├─ legacy/                 # v1.0, v1.1 y v1.5 archivadas, excluidas de GitHub Pages (_config.yml)
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

|                           | Workers Free                | Workers Paid                            | Uso en el proyecto                                                  |
| ------------------------- | --------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| CPU por petición HTTP     | 10 ms                       | hasta 5 min (30 s por defecto)          | Import de datos v1, exportes, sync de lotes grandes                 |
| CPU por Cron Trigger      | 10 ms                       | 30 s (intervalo < 1 h) / 15 min (≥ 1 h) | Cron de tasas y archivo mensual D1 → R2                             |
| Cron Triggers por cuenta  | 5                           | 250                                     | Sin restricción práctica                                            |
| Peticiones                | 100 000/día                 | 10 M/mes incluidas (+0,30 $/M)          | Margen de sobra; las peticiones a los archivos estáticos son gratis |
| Tamaño por BD D1          | 500 MB                      | 10 GB                                   | Años de historial                                                   |
| D1 lecturas / escrituras  | 5 M/día / 100 000/día       | 25 000 M / 50 M al mes                  | Panel del propietario sin preocuparse                               |
| Consultas D1 por petición | 50                          | 1 000                                   | Sync de lotes del outbox en una sola petición                       |
| **D1 Time Travel**        | 7 días                      | **30 días**                             | Restaurar la BD a cualquier minuto del último mes                   |
| Workers Logs              | 200 000 eventos/día, 3 días | 20 M/mes, 7 días                        | Revisar el lunes un problema del sábado                             |
| **Browser Run**           | 10 min/día, 3 navegadores   | 10 h/mes + 10 navegadores               | PDF de cierre generado en servidor desde HTML                       |
| Durable Objects           | 100 000 peticiones/día      | 1 M peticiones/mes incluidas            | Tiempo real multi-teléfono (Backlog)                                |
| Email Sending             | no disponible               | 3 000 emails/mes incluidos              | PDF de cierre por email (requiere dominio, ver nota)                |

Coste estimado para el volumen de un stand: **los 5 $/mes de Workers Paid** que ya se pagan; R2 dentro de su capa gratuita (10 GB); Access sin coste con Zero Trust Teams Free (hasta 50 usuarios).

Notas:

- **Cloudflare Access sobre `workers.dev`**: Access puede proteger la URL `workers.dev` de producción. Se usará para `/admin` (no hay previews); las vendedoras entran con PIN.
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

| Pantalla                                 | Cambios principales                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso                                   | Selector de vendedor (avatares) + teclado PIN                                                                                                               |
| **Caja** (principal)                     | Cuadrícula de artículos (foto/emoji + precio), un toque = añadir; carrito en bottom sheet con total fijo; búsqueda y filtros                                |
| **Cobro**                                | Divisas en botones grandes, teclado numérico, billetes rápidos (1 000 / 5 000 / 10 000 CFP), monnaie muy visible, **pago mixto**, **deshacer última venta** |
| Stock                                    | Nivel de stock visual, badges faible/épuisé, modo edición separado del modo venta, réassort rápido                                                          |
| Horas                                    | Botón grande Commencer/Terminer (mantener pulsado), línea de tiempo, resumen mensual pagado/pendiente                                                       |
| **Cierre**                               | KPIs (CA, ventas, cesta media), top artículos, reparto por divisa, **conteo de caja** (esperado vs contado → écart), PDF                                    |
| Historial                                | Por día y mercado, detalle, re-generar PDF                                                                                                                  |
| Panel propietario (`/admin`, escritorio) | CA por día/mercado/mes, horas a pagar por vendedor, exportes CSV/XLSX                                                                                       |
| Ajustes                                  | Vendedores, dispositivos, tasa horaria, tasas de cambio, categorías                                                                                         |

Navegación: 4 pestañas (Caja · Stock · Horas · Cierre); Ajustes en el menú del avatar.

### Primera versión (2026-09-26)

Artefactos privados en claude.ai (para la vendedora hay que compartirlos desde el menú _Share_):

- **Design System «Debajah Création»**: <https://claude.ai/artifact/EL9M2DpdxJkeKziaHprhFp> — tokens claro «Plein soleil» / oscuro «Soir», 31 componentes React (`window.Debajah`), iconos Lucide, fuentes.
- **Canvas «Mon Stand v2»**: <https://claude.ai/artifact/TgJaV59CH23RrbqaJNRpbE> — 21 pantallas: Vendre (acceso, caja, carrito, cobro en CFP / AUD / mixto, otro importe, venta registrada con «Annuler»), Gérer (stock, ficha de artículo, horas, cierre, conteo de caja, historial, ajustes), las mismas en oscuro, caja en tablet horizontal y panel `/admin`. La caja es un prototipo que se puede tocar (añadir, carrito, cobrar, deshacer).

Decisiones tomadas en el diseño:

| Tema                      | Decisión                                                                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tipografía UI             | **Atkinson Hyperlegible Next** en lugar de DM Sans: DM Sans no tiene cifras tabulares (`tnum`) y el plan las exige para los importes; Atkinson distingue 0/O y 1/l/I, pensada para leer con reflejos. Playfair Display se queda para marca y títulos                                 |
| Color                     | Violeta = marca y selección; «night» (violeta profundo) solo para la barra de caja, el acceso y el PDF; oro = la acción principal (una por vista) y el dinero; estados siempre con palabra o icono                                                                                   |
| Importes                  | `formatNumber` con espacio fino: `toLocaleString('fr-FR')` usa U+202F, que no existe en ninguna de las dos fuentes                                                                                                                                                                   |
| Cobro                     | Botones de moneda con el importe ya calculado en cada divisa (regla v1.5), billete sugerido + «Compte juste» + «Autre montant»; si el importe recibido no alcanza, «Payer le reste autrement» abre el pago mixto                                                                     |
| Marca                     | No hay logotipo: nombre en Playfair + hoja Lucide (heredera del 🌿)                                                                                                                                                                                                                  |
| Orden de la caja («Tout») | **Los más vendidos primero**: unidades vendidas en los últimos 30 días (`vente_lignes`), empate por nombre; agotados al final. Se calcula al abrir la jornada y no cambia durante el día, para que las fichas no se muevan bajo el dedo. Las categorías conservan el orden del stock |

Impacto en el modelo de datos (confirmado por las respuestas de la vendedora del 2026-09-27):

- `articles.emoji` (opcional): la cuadrícula de la caja distingue los artículos por su emoji. A la vendedora le basta; las fotos (`photo_key`) quedan para más adelante.
- **Fondo de caja por divisa**: la jornada empieza con **1 000 CFP y 100 AUD**, y el conteo compara cada divisa con «fondo + efectivo neto». `journees.fond_caisse_cfp` no basta: la Fase 3 añade la tabla `journee_fonds` (journee_id, devise, montant) en una migración nueva y deja de usar esa columna. 1 000 CFP y 100 AUD se proponen por defecto al abrir la jornada.
- Monnaie de un pago en divisa: se devuelve **en la misma divisa** (AUD → AUD), así que `rendu_devise` = divisa del pago y el esperado del conteo AUD = fondo AUD + AUD recibidos − AUD devueltos.
- Artículos con precio 0 (Bourgoir, Boîte déco) no aparecen en la caja; el stock los marca «Prix à fixer».

Respuestas de la vendedora (2026-09-27):

| #   | Pregunta                                                                         | Respuesta                                         | Consecuencia                                                                                             |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | La monnaie de un pago en AUD: ¿en AUD o en CFP?                                  | En AUD                                            | Monnaie en la divisa del pago (arriba)                                                                   |
| 2   | ¿Emoji o fotos para los artículos?                                               | Los emoji están bien                              | Sin fotos por ahora                                                                                      |
| 3   | ¿Bastan los billetes propuestos (compte juste, billete siguiente, otro importe)? | Sí                                                | Cobro sin cambios                                                                                        |
| 4   | ¿Con cuánto fondo de caja empieza el día?                                        | 100 AUD y 1 000 CFP                               | Fondo por divisa (arriba)                                                                                |
| 5   | Pago mixto: ¿50 AUD cuentan al tipo del día (3 689 CFP)?                         | No, es muy raro                                   | El pago mixto queda como opción secundaria («Payer le reste autrement»), al tipo del día, sin más reglas |
| 6   | ¿Es práctico mantener pulsado para Commencer / Terminer?                         | Sí                                                | Se mantiene                                                                                              |
| 7   | ¿El modo claro se lee bien a pleno sol?                                          | Sí: vende a la sombra, dentro de la gare maritime | Claro por defecto; no hace falta un modo de alto contraste                                               |

---

## 5. Fases

Estimaciones orientativas en días de trabajo efectivo.

**Sin preview** (§0): cada cambio se valida en local (`npm run check`: tests en el runtime real de Workers contra una D1 migrada) y en la CI del PR, y llega a producción al mergear en `main`. Hasta el corte nadie usa la app, así que las pruebas en el teléfono se hacen en la URL de producción con datos de prueba, que se borran antes de importar los reales (Fase 6). **Ningún dato real entra en producción antes de la Fase 4**: hasta entonces la API no tiene autenticación.

### Fase 0 — Estabilizar la v1.3 → v1.4 (≈ 1 día · GitHub Pages)

- [x] Fechas en hora local (bug 1)
- [x] Tasas: EUR fijo 119,332; resto derivado de tasas EUR; conservar decimales (bugs 2–3)
- [x] `stockFinal` con categoría; clave única por cierre (bugs 6–7)
- [x] Botón **"Export complet (JSON)"**: articles, ventes, sessions, sessionActive, historique, rates, settings (sin PIN) — imprescindible para migrar: el nuevo dominio no puede leer el `localStorage` de github.io
- [x] Quitar la librería XLSX; `user-scalable=no`; `</div>` sobrante (bugs 9, 12)
- [x] Extra: cobro en divisa (bug 13) — `montantEncaisse` siempre en CFP, más `montantDevise` y `tauxCFP` en los pagos en divisa
- La sync con Google Sheets no se toca: se retira con la v2.

**Hecho cuando**: v1.4 en producción y el export probado en el teléfono de la vendedora.

**Estado**: hecha. v1.4 mergeada en `main` (PR #2); export probado en el teléfono de la vendedora el 2026-09-26 (26 artículos, 4 cierres v1.3 → `clo_legacy_0…3`, tasas con decimales).

### Fase 0.5 — Precios en divisa → v1.5 (GitHub Pages)

- [x] Redondeo `arrondirDevise`: al **5 más cercano**; por encima de **1 000** (JPY) a la **centena más cercana** (bug 14)
- [x] Precio de venta por divisa en el stock: **calculado** (por defecto) o **manual** (`article.prixDevises = {AUD: 27}`; solo los manuales)
- [x] Caja: total en divisa = **suma de los precios en divisa** de los artículos (2ª unidad en promo redondeada igual; remise en CFP convertida y total re-redondeado)
- [x] Cobro en divisa: la monnaie devuelta no cuenta como cobrado (`montantEncaisse` ≤ precio en divisa × tasa); nuevo campo `totalDevise` (precio pedido en la divisa)
- [x] `loadFromGoogle` conserva los `prixDevises` locales si la hoja no los trae

Verificado con el export del teléfono: la nueva regla reproduce las **12 ventas en divisa** del historial (la v1.4 fallaba 8 de 12).

**Estado**: mergeada en `main` (PR #3) el 2026-09-26. La prueba en el teléfono de la vendedora ya no corre prisa: el mercado para 3 meses y la v2 debe estar lista antes de la reanudación. La v1.5 queda como plan B si no lo está.

### Fase 1 — Diseño con /design (≈ 2–3 días)

- [x] Design System "Debajah Création" (primera versión, §4)
- [x] Canvas con todas las pantallas (§4), claro/oscuro, móvil + tablet + `/admin`
- [x] Revisión e iteración — validado el 2026-09-26 con un cambio: «Tout» ordenado por ventas (§4)
- [x] Tokens finales listos para Tailwind (`@theme`): `app/src/styles/app.css`

**Hecho cuando**: pantallas validadas por el propietario y la vendedora.

**Estado**: hecha. Pantallas validadas el 2026-09-26 (enlaces en §4) y tokens en `app/src/styles/app.css`. Respuestas de la vendedora recibidas el 2026-09-27 (§4).

### Fase 2 — Fundaciones Cloudflare (≈ 2 días)

- [x] Proyecto `app/`: Vite + React + TS + `@cloudflare/vite-plugin` + Hono; ESLint, Prettier, Vitest (suite Worker en el runtime real contra D1 migrada + suite de dominio)
- [x] **Activar R2** en el dashboard de Cloudflare (activado y verificado el 2026-09-25)
- [x] `wrangler.jsonc` con entornos local y producción, siguiendo la convención de ControlCash: Worker `mon-stand`; D1 `mon-stand-production` (creada el 2026-09-26 en Oceanía); KV `mon-stand-taux` (tasas); R2 `mon-stand-files` (un prefijo por entorno). El entorno preview se retiró el 2026-09-27 (§0). Browser Run y cron se añaden en la Fase 5 con su código
- [x] Migración D1 inicial (esquema §2 + validación del diseño) con Drizzle: `app/migrations/0000_init.sql`, 16 tablas, aplicada a producción el 2026-09-26
- [x] Workers Builds conectado al repo el 2026-09-27 (directorio raíz `app/`): deploy en cada push a `main`, **sin builds de otras ramas** (una versión de preview usaría la D1 real) — configuración en [`app/README.md`](../app/README.md)
- [x] Publicación en <https://mon-stand.applis.workers.dev>: primer deploy con Wrangler el 2026-09-27; `/api/health` responde `ok` con la D1 de producción (migración `0000_init.sql`, 16 tablas). Access sobre `/admin` en la Fase 4
- [x] CI GitHub Actions (`.github/workflows/ci.yml`): formato, lint, tipos de bindings, typecheck, tests y build en cada PR

**Hecho cuando**: una página React + `/api/health` leyendo D1 están desplegadas en `workers.dev`, con deploy automático desde `main`.

**Estado**: hecha el 2026-09-27. Producción en <https://mon-stand.applis.workers.dev>, desplegada por Workers Builds en cada push a `main`.

### Fase 3 — Nueva interfaz (≈ 5–7 días)

- [x] Componentes del Design System: `app/src/composants/ui/` (botón y botón mantenido, importes, etiquetas, badges, KPI, chips, campos, teclado numérico, PIN, barra de app, pestañas, bottom sheet sobre `<dialog>`, toast, estado de sync, avatar, tarjetas, tuile de artículo, barra de caja, botones de divisa y billete, monnaie, línea de conteo)
- [x] Migración `0001_journee_fonds`: fondo de caja por divisa (`journee_fonds`, §4); `journees.fond_caisse_cfp` deja de usarse
- [x] `app/shared/domaine/`: lógica de negocio pura con tests (45) — promo 2ª unidad, remises, monnaie en la divisa del pago, pago mixto, precios en divisa calculados/manuales y redondeos (`arrondirDevise`, v1.5), billetes sugeridos, redondeo de horas a 30 min, stock como suma de movimientos, orden de la caja, totales de cierre y esperado del conteo por divisa. Los casos reproducen las reglas v1.4/v1.5 (`calcLT`, `calcTotalDevise`, `validerVente`); las 12 ventas reales del export se contrastarán al importar (Fase 6)
- [x] Pantallas: Acceso (PIN verificado con PBKDF2 en el teléfono) → Caja → Cobro → Stock (+ ficha) → Cierre (+ conteo, historial) → Horas → Réglages (vendedoras, tasas, categorías, lugar, tema, instalación, export)
- [x] PWA: manifest, iconos generados sin dependencias (`app/scripts/icones.mjs`), service worker (toda la app precargada), Dexie, outbox (cada acción es una operación con UUID aplicada en local y encolada). Sin servidor todavía: el outbox se vacía en la Fase 4
- [x] Textos centralizados en `app/src/textes/fr.ts`

**Hecho cuando**: una venta completa y un cierre funcionan en modo avión en iPhone y Android (PWA instalada desde la URL de producción, con datos de prueba).

**Estado**: código hecho el 2026-09-27 y probado en el navegador (PIN, apertura de jornada con fondo 1 000 CFP + 100 AUD, venta de 5 500 CFP cobrada con 100 AUD → monnaie 30 AUD, conteo con écart, clôture e historial). Pendiente de Diego: instalar la PWA desde producción en iPhone y Android y repetir el flujo en modo avión. Datos de partida en un teléfono vacío: catálogo v1 y una vendedora «Vendeuse» con PIN `1234` (cambiable en Réglages), que la Fase 4 sustituye por el bootstrap del servidor.

### Fase 4 — API, sincronización y acceso (≈ 3–4 días)

- [x] Rutas Hono + validación zod (`app/shared/api.ts`): `POST /api/devices/pair`, `POST /api/auth/pin`, `GET /api/bootstrap`, `POST /api/sync`, `/api/admin/*` (código de emparejamiento, dispositivos, revocación). Error uniforme `{ erreur: { code, message } }`
- [x] Sync push/pull con cursor e idempotencia: `sync_ops` (op ya aplicada = aceptada sin repetir) y `sync_journal` (diario con `seq`; el pull devuelve las operaciones de los demás dispositivos desde el cursor, por páginas). Migración `0002_sync_journal`, aplicada a producción el 2026-09-27
- [x] Stock como libro de movimientos; reglas de conflicto: stock = suma, artículos = última escritura gana por `updated_at` (una escritura más antigua se ignora, precios en divisa incluidos)
- [x] Acceso: PIN por vendedora con hash PBKDF2 (WebCrypto) verificado en servidor, 5 intentos por minuto y por teléfono (`auth_tentatives`, 429 + `Retry-After`); el cambio de PIN viaja como hash en `vendeur.upsert`, nunca el PIN. Emparejamiento por **código de 8 caracteres** (15 min, un solo uso) generado desde `/admin`: más simple que un QR en un teléfono que ya tiene el código delante; el QR queda en el backlog. Token de dispositivo guardado como SHA-256; revocación desde `/admin`
- [x] Cloudflare Access para `/admin` y `/api/admin`: el Worker valida el JWT (`Cf-Access-Jwt-Assertion`, JWKS del equipo) cuando `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD` están definidos; sin ellas, jeton `ADMIN_TOKEN` (secreto de Wrangler, creado el 2026-09-27) pegado en `/admin`. Sin ninguno de los dos, `/api/admin` responde 503: nunca abierto. **Hecho el 2026-10-01**: aplicación Access «Mon Stand — /admin» creada en Zero Trust (destinos `/admin` y `/api/admin`, política _Allow_ para el correo del propietario, login con GitHub, sesión de 1 mes) y las dos vars rellenadas; con Access configurado el Worker exige el JWT y el jeton ya no vale. El service worker deja pasar `/cdn-cgi/` (retorno del login) y el panel avisa cuando la sesión caduca. Detalle y vuelta atrás en `app/README.md` (§ Cloudflare Access). Queda borrar el secreto `ADMIN_TOKEN`, que ya no abre nada
- [x] Verificación offline del PIN con el hash cacheado en el dispositivo (el bootstrap entrega hash y sal); con red, el servidor verifica y cuenta los intentos

**Hecho cuando**: dos navegadores venden sin red, se reconectan y el stock cuadra.

**Estado**: código hecho el 2026-09-27. El test `app/test/sync.spec.ts` reproduce el criterio en el runtime real de Workers: dos teléfonos emparejados venden 2 y 3 unidades, se reenvía una operación (idempotente), cada uno recibe lo del otro y un tercer teléfono arranca con el stock = inicial − 5. Probado además en el navegador contra la API local: código → emparejamiento → bootstrap → PIN (servidor) → venta → outbox vacío. Access en producción desde el 2026-10-01 (`app/test/acces-admin.spec.ts` prueba la validación del JWT). Pendiente de Diego: la prueba en dos teléfonos reales.

### Fase 5 — Automatizaciones (≈ 2 días)

- [x] Cron diario de tasas (06:00 Nouméa) → KV `taux:latest` + `taux_historique` + una operación `taux.definir` por divisa en el diario, para que cada teléfono reciba las tasas del día en su siguiente pull (`app/worker/taux.ts`: BCE vía Frankfurter, secours open.er-api, EUR × 119,332). Botón «Actualiser maintenant» en `/admin`
- [x] Cierre: plantilla HTML autónoma con el diseño de la app (`app/worker/pdf/cloture.ts`) → Browser Rendering (binding `BROWSER`, solo en producción) → PDF en R2 `clotures/AAAA/AAAA-MM-DD_<id>.pdf`, generado en segundo plano al recibir la clôture por sync; sin navegador (local, tests) se archiva el HTML. Sin email: no hay dominio con Email Routing (backlog)
- [x] Panel `/admin` (`app/src/ecrans/Admin.tsx`, pestañas que cargan al abrirse): ventas del mes (CA, jornadas, panier moyen, por mercado, encaissements, top), jornadas con el PDF/HTML de clôture (ver, regenerar), horas del mes por vendedora (total, a pagar, pagado), exportes **CSV** de ventas y horas (separador «;», BOM: se abren en Excel; XLSX en el backlog), tasas, archivos, emparejamiento y dispositivos
- [x] Archivo mensual D1 → R2 `archives/AAAA-MM.json` (todas las tablas, sin hashes) el día 1 (cron) o a mano desde `/admin`; descargable desde el panel

**Hecho cuando**: al cerrar la jornada el PDF queda archivado y visible en el panel.

**Estado**: código hecho el 2026-09-27. `app/test/automatisations.spec.ts` comprueba en el runtime de Workers: clôture sincronizada → archivo en R2 visible y descargable desde el panel (HTML sin navegador), KPIs y exportes del mes, tasas (fuente simulada) en KV + historial + diario, archivo mensual. Verificado en producción el 2026-09-27: una jornada de test (lieu «Test PDF (à purger)», appareil de test revocado) sincronizada desde la API produjo un PDF real por Browser Rendering (86 Ko) en R2, servido por el panel; el cron de tasas también se lanzó a mano desde /admin (tasas BCE en KV, historial y diario). Los datos de esa jornada se borran con la purga de la Fase 6.

### Fase 6 — Migración y puesta en producción (≈ 1–2 días, antes de la reanudación del mercado)

El export del 2026-09-26 es definitivo (§0): una sola importación, sin día de mercado en paralelo. Requisito: la Fase 4 desplegada (la API ya no es pública).

- [x] Importador "export v1 JSON → D1" (`app/shared/import-v1.ts`, puro; CLI `node app/scripts/importer-v1.mjs <export.json> --sortie <import.sql>`): genera el SQL (idempotente: ids derivados del export, `INSERT OR IGNORE`) y un informe con el CA de cada cierre comparado con el `totalEncaisse` de la v1, más avisos. Probado en la D1 local con `app/test/fixtures/export-v1-synthetique.json` (`app/test/import-v1.spec.ts`: dos pasadas, mismas cuentas): **el export real nunca entra en el repo**
  - Ventas v1.4/v1.5: `montantEncaisse` en CFP + `montantDevise`/`totalDevise`/`tauxCFP` en divisa → `vente_paiements`. Ventas v1.3 (sin `montantDevise`): lo recibido está en la divisa y no hay tasa → se acredita el total de la venta y el informe lo avisa
  - Cierres v1.3 sin `id` (`clo_legacy_N`): la fecha se recalcula en Nouméa a partir de `clotureAt` (el informe muestra los cambios)
  - Artículos v1.5: `prixDevises` → `article_prix`; el stock del export es la verdad (un movimiento `inventaire` por artículo); ventas sin cierre → jornada «en cours» abierta; sesiones (`payee` → `payee_at`); tasas del export → `taux_historique`; vendedora `vend_1` con el prénom y el taux horaire de `settings`, PIN `1234` (a cambiar)
- [x] Scripts de purga y comprobación: `app/scripts/purger-production.sql` (conserva los teléfonos emparejados) y `app/scripts/verifier-vide.sql` (cuentas por tabla). Mode d'emploi completo en [`app/README.md`](../app/README.md) (§ Migración). Corregidos el 2026-09-28 al ensayarlos con el export real en una D1 local: la purga fallaba por la clave foránea del teléfono ligado a la vendedora y la comprobación por el límite de D1 en los `UNION ALL`; ahora los prueba `app/test/scripts-migration.spec.ts`
- [x] ~~Si hay datos en Google Sheets: exportarlos una vez e importarlos~~ — no hace falta, todo está en el export del teléfono (§1)
- [x] ~~Un día de mercado con v1 y v2 en paralelo~~ — sustituido por el ensayo y la verificación siguientes: el mercado está parado (§0)
- [ ] **(Diego)** Ensayo con la vendedora en producción: generar un código en <https://mon-stand.applis.workers.dev/admin> (jeton `ADMIN_TOKEN`), instalar la PWA en su teléfono, emparejarlo y simular una jornada (ventas en modo avión, cobro en AUD con monnaie, conteo de caja, cierre → PDF en el panel)
  - [x] Ajuste pedido durante el ensayo (2026-09-28): «Ouvrir la journée» empieza también las horas de la vendedora (interruptor «Commencer mes heures», activado por defecto, contra el olvido de la v1) y avisa si quedaron horas de un día anterior sin terminar; al cierre, solo un recordatorio de terminar las horas (la clôture puede hacerse en casa, la hora de fin se corrige en Heures). Corregido también el conteo de caja, cuya columna «Écart» salía de la pantalla a 375 px
- [x] Auditoría de QA antes de la puesta en producción (2026-10-01): jornada completa simulada en local (ventas multi-divisa, venta y cierre sin red, conteo, panel) y relectura del código. Dos fallos bloqueantes corregidos (barra del carrito tapada por las pestañas; hash del PIN borrado al editar una vendedora) y nueve más; lo pendiente y lo que hay que decidir está en [`AUDITORIA_QA_2026-10-01.md`](AUDITORIA_QA_2026-10-01.md). El ensayo en un teléfono real sigue pendiente: ningún teléfono ha sincronizado todavía una jornada en producción
- [x] Borrar los datos de prueba con `app/scripts/purger-production.sql`, comprobar con `app/scripts/verifier-vide.sql` que todo está a cero e importar el SQL generado por el importador (`npx wrangler d1 execute mon-stand-production --remote --env production --file …`) — hecho el 2026-10-01 con la autorización de Diego: copia previa en `~/.mon-stand/avant-import.sql`, purga (todo a cero salvo 2 dispositivos antiguos), importación de 181 sentencias
- [x] Verificar contra el export, en la base y en la API del panel (2026-10-01): 26 artículos (stock total 235, 8 con stock 0), 4 cierres — 18/04 35 000 CFP (11 ventas), 28/04 10 900 (5), 07/05 17 000 (7), 14/05 20 000 (9) —, 32 ventas, 16 sesiones (121 h, todas pagadas), 5 tasas, vendedora Wendy (`vend_1`, PIN `1234` a cambiar)
- [x] Teléfono de la vendedora emparejado en producción (2026-10-01, dispositivo «Wendy»), PIN `1234` cambiado, teléfono de pruebas de Diego revocado
- [ ] **(Diego / vendedora)** Inventario real en el teléfono (Stock → Ajuster): 8 artículos llegan con stock 0 y quedan bloqueados en caja hasta entonces. Primera jornada real: comprobar en `/admin` que el cierre y su PDF llegan (ningún teléfono ha sincronizado todavía una jornada en producción)
- [x] Corte (2026-10-01, tras emparejar el teléfono de la vendedora y cambiar su PIN): `index.html` raíz → página de redirección a `workers.dev`; v1.5 archivada en `legacy/v1.5/` (con su README de uso e `inventaire.json`); README raíz reescrito para la v2
- [ ] **(Diego)** Desactivar el despliegue de Apps Script (Google Sheets ya no recibe nada: la v2 no lo usa)

**Hecho cuando**: antes de la reanudación del mercado, la vendedora tiene la v2 instalada y todo el historial está en D1.

**Estado**: hecho el 2026-10-01. Datos reales importados y verificados, teléfono de la vendedora emparejado, corte de la v1 hecho. El ensayo de una jornada completa en producción no se hizo antes del corte (se sustituyó por la auditoría de QA en local): la primera jornada real hará de ensayo, con la v1.5 archivada en `legacy/v1.5/` y el export del 2026-09-26 como red de seguridad. La aplicación Cloudflare Access para `/admin` se creó el mismo día (Fase 4). Quedan para Diego: desactivar Apps Script y borrar el secreto `ADMIN_TOKEN`, que ya no abre nada.

**Total orientativo: ~3 semanas de trabajo efectivo**, con los 3 meses de parada como margen.

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

| Riesgo                                                                                         | Mitigación                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red inestable en el mercado                                                                    | Offline-first con outbox; nada bloquea una venta                                                                                                                                                                        |
| iOS borra el almacenamiento de webs no usadas en 7 días (si no están en la pantalla de inicio) | Instalar la PWA en la pantalla de inicio + D1 como fuente de verdad                                                                                                                                                     |
| `localStorage` no se transfiere entre dominios                                                 | Export JSON en la Fase 0 + importador en la Fase 6                                                                                                                                                                      |
| Errores de fecha por zona horaria                                                              | `Pacific/Noumea` explícito + tests                                                                                                                                                                                      |
| Sin preview, un error llega directo a producción                                               | Tests en el runtime real de Workers y CI antes del merge; migraciones que solo añaden, probadas en local; `wrangler rollback` para el código y D1 Time Travel (30 días) para los datos; hasta el corte nadie usa la app |
| Datos de prueba mezclados con los reales                                                       | Nada real en producción antes de la Fase 4; los datos de prueba se borran y se comprueban a cero antes de importar (Fase 6)                                                                                             |
| La v2 no está lista al reanudarse el mercado                                                   | 3 meses de margen para ~3 semanas de trabajo; si no basta, la v1.5 sigue en GitHub Pages (plan B), pero el export dejaría de ser definitivo: habría que exportar de nuevo antes de importar                             |

---

## 8. Pendiente de confirmar

- [x] Suscripción Cloudflare: Workers Paid + Zero Trust Teams Free (confirmado 2026-09-25).
- [x] Conector "Cloudflare Developer Platform" conectado y verificado (lectura de Workers, D1, KV).
- [x] R2 activado y verificado.
- [ ] ¿Hay un dominio en la cuenta Cloudflare para el envío de email?
- [x] ¿Hay datos en Google Sheets que importar? **No** (verificado el 2026-09-26, ver §1).
