# AGENTS.md — Instrucciones para agentes

Estas reglas se aplican a **todos los agentes** (Claude Code, Codex, Copilot, etc.) que trabajen en este repositorio.

## Proyecto

**Mon Stand — Debajah Création**: app de stand artesanal (caja multi-divisa, stock, horas, cierre del día).

- **v1** (producción): `index.html` en la raíz, servido por GitHub Pages desde `main`.
- **v2** (en preparación): React + TypeScript en `app/`, desplegada en Cloudflare Workers (`*.workers.dev`) con D1, KV y R2.
- Plan de trabajo y decisiones: [`docs/PLAN_DE_TRABAJO.md`](docs/PLAN_DE_TRABAJO.md). Leerlo antes de empezar cualquier tarea de la v2.

## Reglas Git (obligatorias)

1. **Toda tarea termina con commit y push.** No se deja ningún cambio sin commitear ni ningún commit sin pushear.
2. **Árbol de trabajo limpio al terminar**: `git status` no debe mostrar cambios ni archivos sin seguimiento. Los archivos temporales van fuera del repo, nunca en él.
3. **`main` siempre limpio y desplegable**:
   - No se commitea directamente en `main`: se trabaja en una rama, se abre un PR y se mergea.
   - Todo lo que llega a `main` funciona: GitHub Pages (v1) y Workers Builds (v2) despliegan desde `main`.
   - Sin código roto, archivos de depuración, secretos ni archivos generados que no correspondan.
4. **Después de un merge**: actualizar `main` local (`git checkout main && git pull`) y borrar la rama mergeada, local y remota.
5. **Antes de cada push**: pasar las verificaciones del proyecto que existan (typecheck, lint, tests).

### Checklist de fin de tarea

- [ ] Cambios commiteados con un mensaje claro (en español)
- [ ] Push hecho a la rama de trabajo
- [ ] PR abierto o actualizado hacia `main`
- [ ] `git status` limpio
- [ ] `main` sin cambios locales y al día con `origin/main`

## Convenciones

- **Idiomas**: interfaz de la app en francés; documentación y commits en español.
- **Cloudflare** (misma convención que los demás proyectos de la cuenta):
  - Workers: `mon-stand` (producción) y `mon-stand-preview`
  - D1: `mon-stand-production` y `mon-stand-preview`
  - KV: `mon-stand-taux` · R2: `mon-stand-files`
- **Importes** en enteros CFP; **zona horaria** `Pacific/Noumea` (nunca `toISOString()` para fechas de negocio).
- **Secretos**: nunca en el repo; usar los secretos de Wrangler o las variables del entorno.
