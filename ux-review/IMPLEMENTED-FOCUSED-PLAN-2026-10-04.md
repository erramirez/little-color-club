# Focused plan implementation — local review build

Authorized by the owner after the two reviews were combined. Initially implemented locally. The owner authorized GitHub publication and production Netlify deployment on October 4, 2026. Native iPad testing remains deferred.

## Implemented

- **Saved kid feedback:** four brush sizes (18/36/52/70), selected extra/custom swatch visible and checked in the main palette. The current custom swatch temporarily occupies the peach slot to keep a 12-swatch layout; selecting a standard color restores peach.
- **D1:** fill uses the base-image pixels, so black/dark-brown paint can be recolored and original outlines remain protected.
- **R1/R2/C1:** IndexedDB atomic cloud acknowledgements preserve newer strokes and ETags. Conflict fetches precede atomic branching; failed fetches cannot create duplicate copies. Editor branches have scoped redirects so a reopened remote original is not forced into a prior fork. Pending local records cannot be replaced by remote reads.
- **R8/R9:** thumbnail PNG/JPEG/WebP accepted; oversized PNG thumbnails fall back to JPEG. Uploads isolate rejected records, continue with later pictures, back off and expose per-picture errors/retry. Large local editable backups can re-import independently of tighter cloud limits.
- **R3:** registered keys required for PUT; platform rate limits on art/family endpoints; streaming request byte limits; CAS allocation budgets (500 retained IDs/family, 120 MiB/family, 512 MiB/3,000 retained IDs/site). Committed immutable tombstones reclaim payload bytes but retain bounded identity slots; failed requests conservatively retain reservations. These govern new allocations, not an audited inventory of old production objects.
- **R5:** cloud gallery summaries separate from paint with 12-item API pages. IndexedDB metadata/payload separation, family/profile and numeric pending indexes, and v1 migration. Legacy summaries migrate on demand; cached summaries are repaired when their payload ETags differ.
- **R4/R7 partial:** switching waits for pending work; previous phrase retained for recovery. Legacy cookie read once, then expired. Three-word phrases and compatible old keys remain.
- **R6:** build-generated hashed/marked offline shell, cache-first coherent release, normal service-worker waiting rather than forced mid-session updates, bounded image cache, fetch timeout, and graceful cache-quota failures. New versions activate after existing sessions close.
- **D2/D3:** Continue/New choice when revisiting a locally saved page, and a Keep coloring shortcut to a recent available local picture. Theme grid remains simple; no extra tags.
- **D5:** persistent failed-save banner/retry plus accurate pending/error status in Grown-ups.
- **D6:** parent gallery management with rename and confirmed delete. Tombstones prevent stale offline devices recreating deleted pictures, including when the old pending picture is otherwise unable to upload.
- **D7:** retired-page entries are no longer silently filtered from the gallery. Future saves retain the original base with the editable picture. Previously discarded library is not restored.
- **D8:** Done sharing uses a pre-created PNG File, feature-detected native sharing and download fallback. Share executes only on the user's tap.
- **C2–C5/C7:** readable code, named sync steps, consolidated final CSS/breakpoints, unused size/difficulty wrappers and page level/source exports removed, mathematical canvas test helpers moved outside runtime. Obsolete icons archived outside dist. Dynamic catalog checks/docs and current manifest checks replace stale counts/icons. Deploy verification is read-only; function diagnostics exclude secrets/art. Generated review images/video frames ignored.
- **C6:** all 68 pages remain 1254×1254; brightest-channel grayscale, no palette quantization or resizing. Total 77,619,347 → 28,483,562 bytes, a 63.3% reduction. Pixel output is verified after decode and the source dark-outline mask is exactly retained. Originals backed up at /private/tmp/color-club-original-pages-20261004; report in art-review/optimization-2026-10-04.json.

## Verification

43 tests pass, including real fake-indexeddb transactions/migration, the save acknowledgement race, stale ETag protection, conflicts and retries, queue isolation, PNG fallback validation, cloud summaries/pagination, quota concurrency, large-body rejection, tombstones, dark refill, editable backups, offline release/cache behavior and mocked-controller child journeys/new controls. Build checks validate modules, UI IDs, catalog/image signatures and install manifest. Both Netlify functions bundle for Node 22.

Browser rendering, native sharing, accessibility and physical iPad gestures remain unverified. The latest browser attempt found no active tab and reported the Mac locked; earlier attempts were blocked by unavailable admin-policy verification. No browser-security workaround was used. The static preview at port 4173 serves these files and local saves; it does not run Netlify APIs. A Netlify Dev/preview integration and physical iPad pass are required before production publication.

## Deliberately separate choices

- Credential reset/revocation requires deciding how connected devices are disconnected and recovered. No existing family key was revoked. The three-word approach remains as explicitly requested.
- A theme-first home redesign and empirical drag/hold tuning remain optional, pending child/device observation. The requested horizontal tray and tap/drag choices are preserved.
- No speech, parent lock, difficulty badges or coloring assistance were introduced.
- Splitting every controller into another module or adding a framework was unnecessary; storage and sync responsibilities were separated where correctness required it. Runtime remains vanilla ES modules with no new dependency.

For review: refresh the local preview. If an older service worker controls the tab, close its tabs and reopen to activate the waiting complete release.

## Size control follow-up

The changing brush dot previously contributed its height plus margins to the tool row. It now sits inside a fixed 32px indicator frame, with fixed tool heights across breakpoints (25px frame in compact landscape). Changing brush size affects only the dot, not the toolbar allocation. All 43 tests/build checks pass after this change. iPad mini simulator verification was requested but could not run: xcrun simctl is unavailable, and browser access was denied because its admin-policy security check could not be verified. No alternative browser automation was used to bypass that denial. Rendered position/gesture checks remain pending.
