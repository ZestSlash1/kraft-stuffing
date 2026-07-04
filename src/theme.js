// Compatibility shim — the canonical theme now lives in src/ui/theme.js
// (Loadex dark-marine system, LOADEX_UIUX_MASTER.md). Existing imports of
// `{ theme, statusTone }` from this path keep working unchanged.
export * from './ui/theme.js';
export { theme as default } from './ui/theme.js';
