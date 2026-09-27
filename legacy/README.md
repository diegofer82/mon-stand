# Versiones archivadas de la v1

Copias de referencia, archivadas el 2026-09-27. No se modifican y **no se publican** en GitHub Pages: `_config.yml` excluye esta carpeta.

| Carpeta | Versión                  | Fecha      | Contenido                                                                                                                                                              |
| ------- | ------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1.0/` | v1.0 «Mon Stand»         | 2026-04-18 | `index.html` (igual al commit `1b09eb4`), su README e `inventaire.json` (igual al de la raíz). Datos en `localStorage` con claves `stand_*`; tasas solo por Frankfurter |
| `v1.1/` | v1.1 «Debajah Création» | 2026-04-18 | `index.html` (igual al commit `172689b`): PIN, sync Google Sheets, claves `deb_*`. `google-apps-script.js`: el Apps Script de esa época, que nunca había estado en el repo |

## Por qué no se publican

`v1.1` usa las mismas claves `deb_*` que la v1 de la raíz, y GitHub Pages las serviría en el mismo origen (`diegofer82.github.io`). Abierta en el teléfono de la vendedora, leería y reescribiría sus datos con la lógica antigua: fechas en UTC, tasas redondeadas a entero, cobro en divisa sumado como CFP (bugs 1, 2 y 13 del plan).

## El Apps Script de la v1.1

Es, con toda probabilidad, **el que sigue desplegado**: explica lo que se vio en la hoja el 2026-09-26 ([plan §1](../docs/PLAN_DE_TRABAJO.md)).

- `getOrCreateSheet` crea «Ventes» y «Heures» por adelantado, así que `appendRows` nunca escribe la cabecera: las dos hojas no tienen fila de cabecera.
- Cada sync vuelve a añadir todas las ventas y sesiones del teléfono: 62 filas para 21 ventas y 77 para 5 sesiones.
- «Heures» tiene 6 columnas (fecha, llegada, salida, duración, comentario, vendedor), sin `ID` ni `Payée`, a diferencia del script v1.2.

Se retira con la v2 (Fase 6: desactivar el despliegue de Apps Script). Al corte, la v1 de la raíz también se archiva aquí.
