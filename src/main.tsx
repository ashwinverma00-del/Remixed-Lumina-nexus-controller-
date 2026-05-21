import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfills for simple-peer
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
(window as any).process = { env: {}, browser: true } as any;
(window as any).global = window;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service Worker Registration for Offline support
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Lumina Nexus SW registered:', reg.scope);
      })
      .catch((err) => {
        console.error('Lumina Nexus SW registration failed:', err);
      });
  });
} else if ('serviceWorker' in navigator) {
  // In development, we can still register it, but maybe bypass to avoid any caching conflicts during development
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Lumina Nexus SW registered (dev):', reg.scope);
      });
  });
}
