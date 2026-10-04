# Little Color Club

A touch-friendly family coloring studio and picture-puzzle app for Olivia, Henry, and Issa. Hosted on Netlify, with source on GitHub.

Live app: https://little-color-club.netlify.app

Source: https://github.com/erramirez/little-color-club

## Play

Open the deployed Netlify URL in Safari on the iPad. Tap Share → Add to Home Screen, then launch the Color Club icon. Pick a child's name to start. Every child can access all 68 built-in coloring pages; saved artwork belongs to the selected profile.

The library includes seven themes with at least eight pages each: original fairy tales, space, ocean, animals, vehicles, sports, and original young-reader graphic-novel scenes. Browse the picture categories. The library uses professionally styled black-and-white coloring-book illustrations, with original princesses, castles, fairies, dragons, and unicorns.

Fill shapes, draw with a finger or pencil, choose custom colors, undo/redo, or upload an image. The original page and coloring are separate canvas layers: brushes multiply over the base, and the eraser removes only added colors. Download a PNG or an editable `.colorclub` file. Editable files can be imported into any child's gallery.

Puzzles use 9, 16, 24, or 36 picture tiles (24 = 6×4). Swipe the horizontal tray beneath the board to browse pieces. Drag a piece up onto its spot, or tap a piece and then its destination. Time starts with the first piece and ends on completion. Pause/resume is available; leaving the puzzle or hiding the app pauses time. Hints show the finished artwork.

## Connect devices

On the original device, open Grown-up settings → Show family phrase. The app creates a three-word phrase, such as `purple-dog-kite`. Keep it safely: it provides access to the family's artwork. On another device, open the same app URL and enter the three words under Connect another family. The three buttons select profiles within that family; they are deliberately soft logins, with no passwords for kids.

If the new home-screen installation uses a different browser storage context, use the same three-word phrase there. Pairing waits for pending artwork to sync before switching families. The previous family phrase is retained in Grown-ups for recovery; local records remain scoped to their original family.

Each device saves full editable artwork in IndexedDB first. Online saves upload through Netlify Functions to a site-scoped, strongly consistent Netlify Blobs store. Other devices load cloud galleries and fetch full images on demand. Offline changes queue for upload on reconnect. Conditional writes prevent stale revisions from replacing newer art; conflicts preserve a separate copy.

The build generates a release marker and module hashes. The service worker verifies the shell before installation, keeps a complete release cache-first, and waits for open sessions to close before switching versions. Illustrations and thumbnails are cached as opened, with a 100-entry limit and a three-second fetch deadline. Previously opened pages and loaded artwork are available offline. New cloud artwork requires a connection. Clearing browser storage removes unsynced local work; keep the family phrase and use picture/editable exports for independent copies.

## Architecture

- `dist/`: dependency-free HTML/CSS/ES modules, canvas renderer, page library, install manifest, icons, service worker.
- `dist/core.mjs`: pure coloring, puzzle-grid, timing, and input-validation logic.
- `dist/puzzle-drag.mjs`: native horizontal tray scrolling, pointer dragging and board drop mapping.
- `dist/storage.mjs`: IndexedDB artwork and settings, scoped by family + profile + artwork ID.
- `dist/sync.mjs`: authenticated sync, pairing, offline queue, conflict copies.
- `netlify/functions/art.mts`: `/api/art` endpoint.
- `netlify/functions/family.mts`: `/api/family` phrase registration and pairing endpoint.
- `netlify/functions/_shared/art-handler.mjs`: validation, per-family/per-child storage keys, conditional writes.
- `netlify.toml`: static hosting, function bundling, security headers.

The device retains a random 256-bit internal family key in local storage/IndexedDB, transmits it in the Authorization header, and hashes it into artwork prefixes. The old JavaScript cookie is read once for migration and then expired. A separate site-scoped phrase registry maps a generated three-word phrase to that existing key; matching ignores case and accepts spaces or hyphens. Unknown phrases are rejected. Phrase claims use conditional writes to avoid collisions; concurrent registrations return the same canonical phrase. `/api/family` configures 20 requests per IP/domain per minute using Netlify’s function rate-limit configuration. Phrase creation needs a connection; previously saved phrases remain available offline. Local play does not wait for phrase registration. Existing full-length codes are accepted for compatibility but are no longer shown to users. Artwork and pairing secrets are excluded from GitHub. The artwork endpoint requires a registered key for PUT and configures 120 requests per IP/domain per minute. Payload budgets are conservative: 500 retained IDs per family (including tombstones), 120 MiB reserved per family, 512 MiB/3,000 retained IDs site-wide. Committed deletion reclaims payload reservation bytes; record IDs remain as tombstones to block offline resurrection. Failed reservations can retain capacity until maintenance. Existing pre-review data is accounted as it is updated; the ceilings govern new allocations, not an audited inventory of old production objects. This is a family toy, not a system for password-protected separation between siblings.

## Develop and deploy

Requires Node 22 or newer.

```sh
npm ci
npm run build
npx netlify-cli login
npx netlify-cli link --id YOUR_SITE_ID
npx netlify-cli dev
```

`npm run build` checks modules, UI references, page count, app icons, and the unit/integration tests. Netlify local development uses a sandboxed Blobs store, separate from production.

```sh
npx netlify-cli deploy --no-build --dir dist --functions netlify/functions
npx netlify-cli deploy --prod --no-build --dir dist --functions netlify/functions
```

Git-based continuous deployment is configured for this GitHub repository. Pushes to `main` build and publish through Netlify, using build command `npm run build`, publish directory `dist`, and functions directory `netlify/functions`. GitHub deploy keys and notification hooks are configured by Netlify. No app runtime secrets or API keys need to be configured for Netlify Blobs.

## Verification

Tests cover fill boundaries, protected outlines, erasing, puzzle grids, timer semantics, profile/family isolation, offline uploads, remote reads, conflict copies, editable-file validation, and device pairing. The current local artwork revision simplifies 37 pages and replaces eight comic pages with young-reader graphic-novel scenes. Raster checks cover all 68 pages; the current revision does not claim all-page visual approval (see `art-review/QUALITY_REVIEW.md`). The original SVG library has been removed at the owner’s request. Production HTTP/API checks verified profiles, app modules, install icons, the service worker, cloud writes/reads, isolation between profiles/families, and rejection of stale writes. Interactive browser and physical iPad testing are still needed; browser automation was blocked by the environment's policy check.


## Current UI revision

The child flow is Pick your name → Pick a picture → Color → Done → Puzzle. Coloring occupies a focused full-screen studio with large tools and swatches. My pictures contains personal artwork with Color and Puzzle actions; file imports/exports, naming and family pairing are in Grown-ups. Destructive resets are confirmed and coloring can be undone.

The review and step-by-step implementation record are in [ux-review/REVIEW.md](ux-review/REVIEW.md) and [ux-review/IMPLEMENTATION_PLAN.md](ux-review/IMPLEMENTATION_PLAN.md). The owner declined speech, a parent lock and coloring assistance; drag puzzles and three-word family pairing are implemented locally. The owner approved this revision for GitHub and Netlify publication on October 4, 2026; release build checks pass. Forty-three tests pass, including mocked-DOM controller journeys, failed-save recovery and load cancellation. Rendered browser, physical iPad and native accessibility verification remain pending because browser security verification was unavailable.

For a static local UI preview without running a build, serve `dist` with a local web server. The production `/api/art` endpoint is not supplied by a static server; local artwork can still be saved on that browser and sync will wait. Use Netlify development only when backend preview is needed. Use the deployment commands above for authorized releases.

The October 4 additions include three forest-cat adventures, three unicorns, one baby dragon and five zoo animals. The start-page brand and installed app use three colorful crayons; profile symbols are 🦄 Olivia, ⚽ Henry and 🐱 Issa. See `art-review/additions-2026-10-04.json` for the exact generation prompts. Publication was authorized on October 4, 2026.


## Focused review implementation

- Brush sizes: 18, 36, **52**, 70. A selected extra/custom color stays visible and checked in the main palette without adding another toolbar row.
- Dark paint can be refilled; fill boundaries come from the original page.
- Reopening a locally saved library page offers Keep coloring / New picture. The latest available local picture has a Keep coloring shortcut.
- Grown-ups → Manage pictures exposes rename and confirmed delete. Deleted cloud records become immutable tombstones; offline stale saves cannot recreate them.
- Done → Share uses the native file share sheet when available, with PNG download fallback.
- Save failures remain visible with Try again. Grown-ups provides per-picture sync errors, manual retry and the previous family phrase.
- IndexedDB version 2 migrates existing pictures, separates full paint/base payloads from indexed gallery metadata, and uses atomic acknowledgement/conflict operations. Stale editor saves follow their own conflict branch; remote originals remain independently editable.
- Uploads continue past a rejected picture, back off transient failures and preserve local editable backups. Large local backups can re-import even when above cloud limits.
- Cloud gallery summaries are stored separately from paint; each response is limited to 12 records. Old records migrate summaries on demand. New saved drawings retain their base image, so future library retirement cannot silently remove their original page.
- All 68 page PNGs retain 1254×1254 resolution. Brightest-channel grayscale reduces bytes from 77,619,347 to 28,483,562 (63.3%) without palette quantization. Source outline threshold pixels are preserved exactly; physical-device fill/visual checks remain pending.
- Repeated CSS layouts were consolidated, obsolete icons archived, test-only pixel oracles removed from runtime, unused difficulty data/state wrappers removed, build counts derived, and production verification made read-only.

Validation: 43 tests plus module/catalog/manifest/UI-reference checks. Netlify functions bundle for Node 22. No fresh rendered browser, native accessibility, Safari share or physical iPad approval is claimed: the Mac was locked during the latest browser attempt. The static preview saves locally but does not serve Netlify APIs; use Netlify Dev for isolated backend integration and a preview deployment before publishing.

Optional decisions still separate from this implementation: credential reset/revocation (which disconnects devices), a new theme-first navigation flow, and empirical gesture tuning. Three-word phrases, soft child profiles, no speech, no parent lock and no coloring assistance are retained.

## Palette update

The latest extra/custom color remains visible when a main color is selected, and the custom picker retains that choice. Peach also remains available. Hold a main, extra or remembered custom swatch for 500 ms to choose lighter or darker shades; tapping still selects its color. Moving more than 10 pixels or cancelling the pointer cancels a pending hold. Keyboard users can press Down Arrow on a swatch to open shades; the dialog supports normal Escape dismissal.

Validation: all 45 automated tests and build checks pass, including custom-color restoration, shade selection, hold-click suppression and gesture cancellation. These controller tests use mocked DOM/canvas; physical iPad gesture and rendered visual verification remain pending. Publication authorized for October 4, 2026.

## Drawing styles and emoji controls

Pen retains solid coverage. Watercolor uses translucent coverage with soft edges and subtle pigment variation; crayon uses grainy coverage with paper gaps. Fresh gestures layer pigment over previous paint, deepening the same color or mixing different colors. Coverage within a gesture is stable, independent of pointer-event frequency. Each gesture remains one undo step. Both tools use all four existing sizes, the existing paint layer, saved artwork format and eraser. Original outlines remain visible through the existing multiply composition.

Control symbols throughout static screens and dynamically created buttons now use emoji, including settings, navigation, drawing, gallery, puzzle, sharing and completion. Text labels and accessible names are retained, and symbols are decorative for screen readers. The existing crayon brand/install artwork remains. The old SVG control sprite is unused. The tool rail scrolls on short landscape screens; tools wrap on narrow portrait screens.

Validation: 51 automated tests and build checks pass. Pixel tests cover translucent texture, repeated-pass buildup, mixed colors and event-frequency independence; controller tests cover tool selection and gesture history. Browser preview was blocked by an unavailable security-policy check; rendered layout, emoji appearance and iPad responsiveness remain unverified. Publication authorized for October 4, 2026.
