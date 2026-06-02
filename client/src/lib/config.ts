// VITE_APP_MODE=server → use the Express backend (default for local dev with server)
// anything else (or unset) → local/static mode (default for GitHub Pages)
export const isLocalMode = import.meta.env.VITE_APP_MODE !== 'server';

// Cesium ion API key — set VITE_CESIUM_KEY at build time for the map to work
export const cesiumKey = import.meta.env.VITE_CESIUM_KEY ?? '';

console.info(`[config] mode=${isLocalMode ? 'local' : 'server'} cesiumKey=${cesiumKey ? '✓ set' : '✗ missing'}`);
