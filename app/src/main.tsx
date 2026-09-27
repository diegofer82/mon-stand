import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import { App } from './App';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root introuvable');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: la nueva versión se activa en la siguiente apertura, nunca en mitad de una venta.
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}
