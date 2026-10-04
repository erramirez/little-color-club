# Focused app reviews — October 4, 2026

Update: the owner subsequently authorized implementation. See [the local implementation record](IMPLEMENTED-FOCUSED-PLAN-2026-10-04.md) for completed items, validation and remaining device checks. The findings below preserve the pre-change review.

Scope: current local app in dist/, backend handlers, storage/sync, service worker, tests, build checks and documentation. Review only: no app changes, GitHub push or Netlify deployment. Earlier child observations remain deferred in KIDS-OBSERVATION-NOTES.md.

Priority: P1 fix before the next substantive release; P2 next improvement pass; P3 optional cleanup. No P0 emergency was established. Confirmed means code inspection or controlled local reproduction; a design concern is a hypothesis until observed on the iPad.

Evidence: all 26 existing tests passed. Browser inspection was attempted but denied because the admin policy check was unavailable; no workaround was used. Thus no fresh rendered screenshots, physical iPad gesture testing, VoiceOver testing or child usability study is claimed. Security review is a source review, not a penetration test or dependency vulnerability audit. Runtime six ES modules total 53,392 bytes raw / 15,041 bytes gzip; CSS 20,057 / 5,032. Dist totals approximately 74 MB, predominantly 68 illustration PNGs. Video is outside the publish directory.

## 1. Design and UX

### D1 — P1: dark fills cannot be recolored (confirmed)
Evidence: dist/core.mjs:10 rejects a target if its brightest channel is below 105; app.mjs:136 passes the composited picture, so the test cannot distinguish dark paint from an original outline. A one-pixel dark-brown region [98,64,50] refused a yellow refill. The same applies to black. A child sees a normal tap do nothing.
Recommendation: determine original outline barriers from the base image, while treating added paint as editable. Define region behavior for mixed brush strokes; add regression cases for every dark swatch, black outlines, and repeated recoloring. This is a correctness fix, not coloring assistance.

### D2 — P2: picking a library page always creates another artwork (confirmed behavior, design concern)
Evidence: app.mjs:84–86 always assigns a new UUID; saved last-picture settings are never read. Children revisiting the same picture through Color start fresh; continuing requires My pictures. Repeated visits/Done can create many nearly identical gallery cards.
Recommendation: make Continue versus New picture explicit where an existing drawing exists; preserve the ability to make multiple versions. A thumbnail-based choice can avoid extra explanation. Decide this flow with the owner before changing it.

### D3 — P2: library and gallery become crowded (design concern)
Evidence: profile selection defaults to All, rendering 68 equally prominent pages (app.mjs:91–103). There is no difficulty filter, continuation shelf or gallery cleanup. Page titles are available to accessibility but not displayed, appropriately keeping child wording light.
Recommendation: prioritize a small visual Continue row or theme-first browsing; offer discreet parent gallery cleanup rather than adding tags to every card. Test with all three ages before adding another navigation layer.

### D4 — P2: puzzle tray discoverability and touch arbitration need real-device validation (unverified interaction risk)
Evidence: 36 pieces are in one horizontal tray; drag pickup uses upward motion or a 220 ms hold, while touch-action:pan-x lets the browser scroll sideways. Mock tests do not simulate browser gesture cancellation. A slow browsing touch can become a pickup; diagonal gestures may behave differently in Safari. MDN documents that native gesture handling can send pointercancel: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action .
Recommendation: retain the requested horizontal tray and drag-and-drop. Verify swipe, diagonal drag, hold then swipe, release outside board, orientation change, and tap-to-place on the physical iPad. Add a subtle clipped next piece or edge cue only if children fail to discover scrolling; tune hold threshold from observation.

### D5 — P2: saving feedback is difficult to interpret (confirmed UI implementation; comprehension concern)
Evidence: studio saveStatus is hidden and aria-live=off (index.html:52); cloud state appears only in Grown-ups. Done acknowledges a local save, while sync may still be pending. Save failure relies on a 3.5-second toast. mergeGallery can say synced even with pending uploads (sync.mjs:24).
Recommendation: keep child UI quiet, but show a persistent retry state on actual local-save failure. Make parent status reflect pending queue and distinguish device save from cloud save. Avoid announcing routine saves repeatedly to assistive technology.

Strengths to preserve: large tool targets, pictorial profiles, focused studio, separate outline layer, reversible clearing, automatic timer and pause, concise primary flow. Do not add speech, a parental lock or coloring assistance, which the owner declined.

Deferred child observations: add an intermediate brush size; show custom/extra selected colors on the main palette. Neither is implemented in this pass.

## 2. Security and reliability

### R1 — P1: cloud acknowledgement can discard a newer local save (reproduced)
Evidence: sync.mjs:23 performs getArt followed by putArt as separate transactions. Controlled probe inserted a newer local revision between these operations. Final record reverted to old-stroke, pending:false; the newer-stroke was lost. Probe is /private/tmp/color-review-race.mjs and uses real IndexedDB storage with fake-indexeddb and a controlled interleaving; it does not touch production.
Recommendation: add an atomic IndexedDB read-modify-write operation to update cloud ETag/pending state only for the acknowledged revision. Preserve any newer paint/revision. Route local and cloud record transitions through this boundary; test the precise interleaving and two tabs saving the same picture.

### R2 — P1: conflict/remote-load paths also replace mutable records without safeguards (confirmed unsafe operations; additional losses not reproduced)
Evidence: loadRemote blindly putArt's the remote record (sync.mjs:22). Conflict handling forks a snapshot, fetches remote and replaces the original; app.mjs:296 changes art to that snapshot without reconciling the live canvas. Painting can continue while fetches await. A failed remote fetch after a fork can cause another fork on retry.
Recommendation: make conflict resolution a revision-aware, idempotent transition. Preserve the live local picture and its pending revision; give a conflict copy a stable identity for retries. Bind the editor to the resulting local version explicitly. Pass family identity into remote loads instead of rereading mutable global family state. Add delayed-fetch, painting-during-conflict, failed-fetch/retry, and family-switch tests.

### R3 — P1: public artwork endpoint has no abuse/cost controls (confirmed)
Evidence: art.mts has no rateLimit; art-handler.mjs:4 accepts any syntactically valid random key, allowing callers to create their own unlimited namespaces; PUT limits one request's size, but not record count or total storage. Gallery GET downloads every full record concurrently just to return summaries.
Recommendation: configure platform rate limiting on /api/art, set per-family artwork/storage limits, bound read concurrency and request bytes, and validate recognized registration where appropriate. Preserve anonymous first use with a bounded registration path. Origin checks do not restrict non-browser clients. This finding concerns resource abuse; it does not establish access to another family's unknown key. Netlify native rate-limit guidance: https://www.netlify.com/blog/how-to-rate-limit-ai-features-and-avoid-surprise-costs/ .

### R4 — P2: family switching can strand unsynced work (confirmed)
Evidence: app.mjs:290 awaits flush, but flush swallows failures or returns immediately if already busy. pairFamily can proceed with pending work in the previous namespace. Previous records remain locally, but recovering the previous family requires its phrase, which may never have been registered while offline.
Recommendation: before switching, determine pending count and ensure a recoverable previous connection. Offer Save and switch / stay, or a parent-only previous-family recovery list. Do not silently migrate pictures between families. Test switching while offline, while upload is in flight and after failed upload.

### R5 — P2: gallery reads grow with complete artwork data (confirmed)
Evidence: art-handler.mjs:5 fetches all records with Promise.all; each can include several MB of base64. Response summaries also include every thumbnail, potentially exceeding the function's response budget. storage.mjs:9–10 getAll retrieves all families' full paint data before filtering locally. Blobs SDK list without paginate aggregates pages; this is unbounded work, not a demonstrated missing-pagination bug.
Recommendation: separate gallery summaries from full artwork, expose bounded page results, cap concurrency, and add IndexedDB indexes for family/profile and pending records. Start with indexed local reads and bounded cloud results; retain Blobs rather than introducing a database solely for this toy.

### R6 — P2: offline/update behavior can mix versions or hide cached assets (confirmed policy; failures not reproduced)
Evidence: sw.js:5 uses network-first for all cached files. A stalled fetch has no fallback deadline; HTTP 5xx does not throw, so cached files are not used. Unversioned JS/CSS can be refreshed independently into the same cache across deployments. Every preview query URL can create another cache entry. Newly viewed illustrations are not guaranteed offline until cache writes finish.
Recommendation: immutable/versioned shell assets with cache-first loading, a controlled update boundary, bounded image caching, and timeout/non-success fallback where appropriate. Test open offline, slow network, 503 with cached asset, update while drawing, and old installed version after deploy.

### R7 — P2: family phrase/key has no revocation or rotation (confirmed)
Evidence: registry permanently maps phrase to a long-lived bearer key. Phrase disclosure grants family artwork access. Key is duplicated in localStorage, IndexedDB and a JavaScript-set cookie, although APIs already use Authorization headers. Three-word phrase protection depends on server throttling as well as word selection; do not describe it as equivalent to a 256-bit secret.
Recommendation: retain the requested three-word pairing UX. Add parent-controlled reset/revoke only with owner agreement, document recovery semantics, and remove the cookie if no required storage-context behavior relies on it. Never log phrases or tokens. No child passwords or parental lock are recommended.

Other positives: no external arbitrary URLs in imported artwork, data-image allowlists and size limits, random 256-bit device key, family/profile namespacing, strong Blobs consistency, conditional server writes, no-store API responses and restrictive CSP. The review did not prove these protections cover every exploit.

## 3. Concise, fit-for-purpose code

### C1 — P1: centralize revision/state transitions before cosmetic cleanup
Evidence: app and sync separately mutate art, dirty, pending, etag, family and revision across asynchronous boundaries. saveChain serializes app saves but not cloud record writes. The reproduced R1 issue is a consequence.
Recommendation: small explicit storage operations such as acknowledgeUpload and preserveConflict, with atomic transactions. Keep vanilla modules; introducing a state framework is unnecessary. Test runtime code, not a parallel model.

### C2 — P2: readable formatting and modest responsibility splits
Evidence: app.mjs has 302 highly compressed lines covering rendering, save lifecycle, files, profiles, puzzles and pairing; sync.mjs compresses the entire upload/conflict loop into line 23. Server handler branches are similarly compressed.
Recommendation: format first, then extract editor/save and puzzle controllers if boundaries remain clear. Keep request, validation and storage layers separate. Avoid breaking every event handler into a separate file. Formatting increases lines without materially increasing transfer size.

### C3 — P2: consolidate CSS overrides into one final layout definition
Evidence: style.css repeatedly defines puzzle-layout, tray, piece, board and breakpoints. Earlier landscape side-panel layouts remain before later rules that restore the requested bottom tray. Avatar SVG/brand SVG rules remain alongside current emoji/img styling.
Recommendation: consolidate final rules and breakpoint behavior, then remove obsolete declarations. Check iPad portrait/landscape and narrow phones before/after. CSS is only 5 KB gzip; this is maintenance cleanup, not a large speed win.

### C4 — P2: remove dead state and misleading test helpers
Evidence: puzzleArtId is written but never read; last:* settings are written but never read; syncProfile and LEVELS exports are unused by runtime. compositePixels and erasePixels are exercised by tests, but the browser actually uses canvas multiply/destination-out.
Recommendation: either use last-picture data for an approved Continue flow or stop writing it. Remove other dead runtime exports/state if no consumer exists. Keep pure pixel helpers only if they serve a documented oracle, and add real canvas checks so those tests do not stand in for browser verification.

### C5 — P3: relax brittle build bookkeeping and isolate production artifacts
Evidence: build fails unless page count equals exactly 68; README still says 56. Historical art-review assets occupy ~76 MB; generated video occupies ~39 MB outside dist; these are not shipped to children. Existing .gitignore does not explicitly exclude generated video frames.
Recommendation: validate nonempty unique catalog, references and required themes instead of an exact total; derive counts in documentation where practical. Keep useful prompt/review records, but archive generated scratch/before PNGs and video frames outside source control or ignore them deliberately. Do not delete review history indiscriminately.

## Incorporated independent review

The owner supplied a second static review of GitHub commit 8aa399f. Findings were compared with the current local code; overlapping findings above remain single work items. That reviewer could run 25 tests; this environment ran all 26 successfully. Neither review establishes current physical iPad behavior. No dependency vulnerability audit has been completed.

### R8 — P1: thumbnail encoding assumes WebP (confirmed mismatch; current iPad behavior unverified)
Evidence: app.mjs:30 requests canvas WebP encoding; core.mjs:19 only permits WebP thumbnails. Local validation rejects an otherwise identical PNG thumbnail and accepts the WebP version. Unsupported canvas formats fall back to PNG, as documented by MDN: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL . The historical WebKit bug cited by the other review could not be retrieved; it does not alone establish current iPadOS behavior.
Impact: if the device returns PNG, both cloud PUT validation and editable-file import reject its artwork. Mocked canvas tests always return the requested type and conceal the mismatch. A waiting sync message alone does not diagnose this cause; it can also indicate networking or server failures.
Recommendation: detect the actual returned MIME type; allow bounded PNG/JPEG/WebP thumbnails consistently in server and editable-file validation. Keep paint PNG for transparency. Verify output size and decode the data, not just its label, where appropriate. Add fallback tests and an actual Safari/iPad round trip (save, upload, open on another device, editable export/import).

### R9 — P1: a permanent upload error blocks later pictures (reproduced)
Evidence: sync.mjs:23 throws out of the upload loop on any non-409 error. A local probe returned 400 for the first of two pending records: only the first request was attempted and both remained pending. The same applies to 413; periodic sync retries the failing record indefinitely. Dense paint exceeding limits is plausible but has not been measured.
Recommendation: isolate per-picture failures, continue independent uploads, distinguish permanent validation/size failures from temporary network/429/5xx failures, use bounded backoff, and make parent-visible retry/export recovery available. Preflight payload limits without preventing a recoverable local save. Add first-item-rejected/second-item-success regression and a reconnect/backoff test.

### D6 — P2: no delete or gallery rename (confirmed)
Evidence: local storage and API expose no deletion; picture naming is available only inside the opened artwork's Grown-ups dialog. Existing R5/CSS/duplicate-flow findings make unlimited gallery growth more costly.
Recommendation: add parent-accessible gallery rename and confirmed delete. Cloud deletion needs a tombstone/version policy so an offline device cannot resurrect deleted artwork. Decide undo/recovery behavior before implementation. This is P2 for the current small family app rather than automatically treating absence of delete as a release blocker.

### D7 — P2 preventive: retired library IDs hide saved artwork (confirmed behavior; legacy migration waived by owner)
Evidence: app.mjs:190 filters saved records against the current catalog; records with retired page IDs become invisible. Plain built-in artwork saves paint but not the original base, so showing a placeholder alone does not restore an editable drawing.
Context: the owner explicitly permitted removing old pages and said no prior work needed preserving. Do not resurrect that discarded library or build a historical migration now.
Recommendation: preserve IDs and bases for future pages that have saved work; retain archived bases or an explicit versioned base reference. At minimum, display an unavailable-picture entry with recovery options instead of silently hiding it. No new claim of existing child data loss is made.

### D8 — P2 optional: finished-picture sharing
Evidence: export/download is in Grown-ups and uses an anchor download; there is no native file share flow.
Recommendation: consider Share in the Done dialog using feature-detected navigator.canShare/navigator.share with file download fallback. Treat exposing a device share sheet to children as an owner UX choice, not an automatic change. Verify installed iPad app behavior and user-gesture requirements before implementation.

### C6 — P2, high value: optimize coloring-page assets
Evidence: all 68 PNGs total 77,619,347 bytes (~74 MiB). Four local samples are 1254×1254 RGB, rendered into a 900×900 canvas. In-memory conversion to 900px grayscale PNG reduced them from 1,067,597–1,307,904 bytes to 248,225–296,256 bytes (about 75–77% smaller). No source images were modified and no visual/fill-quality approval is claimed.
Recommendation: test lossless grayscale at original resolution first, then compare 900px grayscale if resizing materially helps. Verify outlines, tiny gaps, fill leakage/halos and display quality on representative simple/detailed pages; retain originals outside published assets. Prefer grayscale before aggressive palette quantization. Full-library savings remain an estimate until measured. Loading feedback can reuse the thumbnail while full art opens. This is the main payload optimization; JavaScript minification is a much smaller opportunity.

### C7 — P3: verification scripts and safe diagnostics
Evidence: verify-deploy.mjs still checks old icon paths and writes a synthetic record into a fresh random production namespace with no cleanup. verify-art-deploy.mjs actually iterates the current catalog, but its success text incorrectly says 56. Both function wrappers suppress exceptions without logging.
Recommendation: use current manifest/catalog references; default mutation checks to a deploy preview or isolated disposable test namespace with explicit cleanup once deletion exists. Log safe error category/request ID without phrases, bearer keys, full artwork, or private payloads. Synthetic verification records are not evidence of junk appearing in the children's normal galleries.

### How overlapping or conflicting recommendations were handled

- Endpoint registration/rate limits/quotas merge into R3; full-record galleries and indexed reads merge into R5. Numeric pending keys or a separate queue are suitable; do not use boolean IndexedDB index keys.
- Offline recommendation merges into R6. Use immutable/cache-first shell assets and bounded image caching; stale-while-revalidate may suit images, but applying it indiscriminately to unversioned modules can still mix releases.
- CSS, formatting, dead state and stale documentation merge into C2–C5. pageSource and hidden state inputs can be simplified when their controllers are touched; removing wrappers is lower value than correcting state transitions.
- Do not add difficulty badges: the owner explicitly asked to remove little tags. A simple difficulty filter remains an optional UX choice; otherwise remove unused level data.
- Keep three-word phrases as requested. Do not adopt four words without the owner changing that decision. Improve server controls and optional reset/revocation instead; distributed guessing deserves consideration without claiming an incident.
- Preserve legacy-key compatibility until device usage is checked. Removing a fallback just because it looks unused can disconnect installations.
- Small puzzle labels/Mix meaning, fill halos, scrollable 36-piece boards, and drag-versus-scroll become physical-device checks under D4 and the coloring QA list. They are not newly proven rendering defects.
- Keep review records where useful; moving docs folders or adding a framework is not a priority. Files outside dist do not increase the installed app payload.

## Revised implementation order after owner review

1. R8/R9: format-safe thumbnails and per-picture queue failures; current iPad round-trip check.
2. R1/R2/C1: atomic acknowledgement and conflict preservation; focused race regressions. Steps 1 and 2 belong in the same reliability release.
3. D1 and R3: dark refill correctness plus backend registration/limits/quotas.
4. R5/C6: bounded cloud summaries, local indexes and verified page-image optimization.
5. R4/R6/D5: recoverable family switching, stable update/offline behavior and accurate save status.
6. C2–C5/C7: controlled cleanup, accurate checks and safe diagnostics.
7. Owner-reviewed D2/D3/D6/D8/R7 choices: Continue/New flow, gallery organization/deletion, sharing and optional phrase reset. D7 prevents future retirement losses; no old-library restoration is planned.
8. Physical iPad/child observation pass; then implement the two previously logged brush-size/color-palette observations.

No app implementation, repository update or deployment is included in this review pass.
