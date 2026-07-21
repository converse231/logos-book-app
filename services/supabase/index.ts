// ─────────────────────────────────────────────────────────────────────────────
// Supabase implementation of QuireApi — assembled method-group by method-group
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
//     B4 — sessionApi: completeSession (RPC) + home/stats/insights/goal reads
//     B6 — aiApi:      aiRecommend (ai_recommend edge fn)
//     B6 — bestsellerApi: getBestsellers (NYT cache, sync_bestsellers edge fn + cron)
//     B5 — notificationApi: notification settings + push-token registration
//   Still on the mock:
//     (none of the QuireApi surface — B4b adds the MMKV offline queue around completeSession)
// ─────────────────────────────────────────────────────────────────────────────

import type { QuireApi } from '../api';
import { mockApi } from '../mock';
import { authApi } from './auth';
import { libraryApi } from './library';
import { sessionApi } from './sessions';
import { aiApi } from './ai';
import { accountApi } from './account';
import { bestsellerApi } from './bestsellers';
import { notificationApi } from './notifications';
import { feedbackApi } from './feedback';

// Real method groups, in B-phase order. Spread last-wins over the mock.
export const liveApi: QuireApi = {
  ...mockApi,
  ...authApi,
  ...libraryApi,
  ...sessionApi,
  ...aiApi,
  ...accountApi,
  ...bestsellerApi,
  ...notificationApi,
  ...feedbackApi,
};
