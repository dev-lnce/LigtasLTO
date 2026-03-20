// FRONTEND DEMO MODE:
// - Server uses `process.env.DEMO_MODE`.
// - Vite exposes env vars only when prefixed with `VITE_`.
// This keeps frontend/backend behavior aligned when running with a correctly
// populated `.env` / `.env.example`.
export const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE ?? 'false') === 'true';
