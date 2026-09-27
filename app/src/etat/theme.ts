// Tema: automático (sistema), «Plein soleil» (claro) o «Soir» (oscuro), guardado en este navegador.
export type Theme = 'auto' | 'light' | 'dark';

const CLE = 'mon-stand.theme';

export function lireTheme(): Theme {
  try {
    const v = localStorage.getItem(CLE);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function appliquerTheme(theme: Theme): void {
  const racine = document.documentElement;
  if (theme === 'auto') racine.removeAttribute('data-theme');
  else racine.setAttribute('data-theme', theme);
  try {
    if (theme === 'auto') localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, theme);
  } catch {
    /* sin almacenamiento: el tema dura la sesión */
  }
}
