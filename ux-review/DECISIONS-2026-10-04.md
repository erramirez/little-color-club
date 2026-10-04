# Owner decisions implemented — October 4, 2026

Local only. No build, commit, GitHub write or deployment.

- Omit spoken guidance, a parent lock, and coloring assistance.
- Replace the displayed family code with an automatically assigned three-word phrase. Example format: `purple-dog-kite`; this is an example, not the actual family credential. Spaces, hyphens and letter case normalize to the same phrase. The registry points to the existing internal family key and preserves artwork. Unknown phrases return a clear error rather than opening a new empty family. Existing full-length codes remain compatible. First phrase registration requires online access and never blocks local play.
- Add drag-and-drop alongside tap placement. Move upward to lift a touch piece, or briefly hold; sideways movement remains native tray scrolling. Mouse dragging also works. A floating preview follows the pointer and marks the destination. Correct drops place the piece; wrong/outside/cancelled drops retain it. Pause, page hiding or leaving the puzzle cancels an active drag. Timer starts when picking up/tapping the first piece and stops on completion.
- Remove 50 pieces. Sizes are 9, 16, 24 and 36, with four large selection buttons.
- Put the horizontal piece tray beneath the puzzle in portrait and landscape. Preserve piece proportions, roomy spacing and finger scrolling. The board remains the principal panel.

## Follow-up UX checks and fixes

1. Distinguish browsing from moving: do not start time for a horizontal swipe; reserve vertical movement for dragging and keep tap placement available. Implemented; controller swipe/drag tests pass.
2. Recover from wrong drops: do not remove the piece or reset the puzzle. Implemented and tested.
3. Avoid orphan drag previews: cancel on pointer cancellation, pause, leaving and rebuilding. Preserve cancellation hooks after pause so the next drag still works. Implemented; pause/resume test passes.
4. Preserve family ownership: register a phrase against the existing family, claim it atomically, retry collisions and return one canonical phrase after concurrent requests. Implemented; handler/storage integration tests pass.
5. Keep local play fast/offline: do not await network phrase registration during app startup. Persist the phrase for offline viewing/copying. Implemented; real offline browser verification pending.
6. Verify the gesture in Safari: actual native scrolling, long-press behavior, pointer capture and drop accuracy on the iPad mini are pending because browser policy verification was unavailable. Mocked controller tests do not substitute for this.

26 tests pass, covering the previous artwork/storage/timer guarantees plus phrase normalization, pairing to the original gallery, collisions, unknown-phrase rejection, touch/mouse dragging, horizontal browsing, cancellation, pause/resume and the four supported grids. Syntax and local reference checks also pass. The build script was updated to include the new modules/tests for a future authorized build; it was not run.

The family endpoint uses the official [Netlify function rate-limit configuration](https://docs.netlify.com/build/functions/api/) with a limit of 20 requests per IP/domain in 60 seconds. This configuration has not been deployed or verified against the live platform.
