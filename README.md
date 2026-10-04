# Little Color Club

A touch-friendly family coloring studio and picture-puzzle app for Olivia, Henry, and Issa. Hosted on Netlify, with source on GitHub.

## Play

Open the deployed Netlify URL in Safari on the iPad. Tap Share → Add to Home Screen, then launch the Color Club icon. Pick a child's name to start. Every child can access all 56 built-in coloring pages; saved artwork belongs to the selected profile.

The library includes eight pages in each of seven themes: Disney characters, space, ocean, animals, vehicles, sports, and comics. Filter by theme and Easy / Playful / Detailed. Disney pages are unofficial simplified character drawings.

Fill shapes, draw with a finger or pencil, choose custom colors, undo/redo, or upload an image. The original page and coloring are separate canvas layers: brushes multiply over the base, and the eraser removes only added colors. Download a PNG or an editable `.colorclub` file. Editable files can be imported into any child's gallery.

Puzzles use 9, 16, 24, 36, or 50 picture tiles (24 = 6×4; 50 = 10×5). Tap a piece and its destination. Time starts with the first piece and ends on completion. Pause/resume is available; leaving the puzzle or hiding the app pauses time. Hints show the finished artwork.

## Connect devices

On the original device, open Grown-up settings → Show family code. Keep this code safely: it provides access to the family's artwork. On another device, open the same app URL and paste it under Connect to an existing family. The three buttons select profiles within that family; they are deliberately soft logins, with no passwords for kids.

If the new home-screen installation uses a different browser storage context, use the same pairing code there. Pairing shows the connected family's galleries; the previous family's local artwork remains stored, and its old code is needed to see it again.

Each device saves full editable artwork in IndexedDB first. Online saves upload through Netlify Functions to a site-scoped, strongly consistent Netlify Blobs store. Other devices load cloud galleries and fetch full images on demand. Offline changes queue for upload on reconnect. Conditional writes prevent stale revisions from replacing newer art; conflicts preserve a separate copy.

The service worker caches the full app shell and built-in library after the first successful online visit. Previously loaded artwork is available offline. New cloud artwork requires a connection. Clearing browser storage removes unsynced local work; keep the family code and use picture/editable exports for independent copies.

## Architecture

- `dist/`: dependency-free HTML/CSS/ES modules, canvas renderer, page library, install manifest, icons, service worker.
- `dist/core.mjs`: pure coloring, puzzle-grid, timing, and input-validation logic.
- `dist/storage.mjs`: IndexedDB artwork and settings, scoped by family + profile + artwork ID.
- `dist/sync.mjs`: authenticated sync, pairing, offline queue, conflict copies.
- `netlify/functions/art.mts`: `/api/art` endpoint.
- `netlify/functions/_shared/art-handler.mjs`: validation, per-family/per-child storage keys, conditional writes.
- `netlify.toml`: static hosting, function bundling, security headers.

Pairing codes are random 256-bit bearer secrets. Requests transmit them only in the Authorization header; the server hashes them into storage prefixes. Artwork and pairing secrets are excluded from GitHub. This is a family toy, not a system for password-protected separation between siblings.

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

For Git-based continuous deployment, connect this GitHub repository in Netlify using branch `main`, build command `npm run build`, publish directory `dist`, and functions directory `netlify/functions`. No app runtime secrets or API keys need to be configured for Netlify Blobs.

## Verification

Tests cover fill boundaries, protected outlines, erasing, puzzle grids, timer semantics, profile/family isolation, offline uploads, remote reads, conflict copies, editable-file validation, and device pairing. All library SVGs have been rasterized for asset review. Interactive browser and physical iPad testing are still needed; browser automation was blocked by the environment's policy check.
