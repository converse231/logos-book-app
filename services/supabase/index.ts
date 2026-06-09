// ─────────────────────────────────────────────────────────────────────────────
// Supabase implementation of LogosApi — assembled method-group by method-group
// across the B-phases (see CLAUDE.md "Backend integration roadmap").
//
// THE SEAM: `liveApi` is the mock with the real Supabase methods layered on top.
// Each B-phase adds another partial (authApi, libraryApi, …); everything not yet
// real keeps falling through to the mock, so the app never breaks mid-migration
// and there are zero UI changes. app/_layout.tsx provides `liveApi`.
//
//   Implemented so far:
//     B2 — authApi:    auth + onboarding write-through + getProfile
//     B3 — libraryApi: library + search + reviews (+ ensure_book edge fn)
//   Still on the mock:
//     B4 — sessions/home/stats/insights/goal-read
// ─────────────────────────────────────────────────────────────────────────────

import type { LogosApi } from '../api';
import { mockApi } from '../mock';
import { authApi } from './auth';
import { libraryApi } from './library';

// Real method groups, in B-phase order. Spread last-wins over the mock.
export const liveApi: LogosApi = {
  ...mockApi,
  ...authApi,
  ...libraryApi,
};
