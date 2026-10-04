# Children’s UX review — local revision

Status: reasonable changes implemented locally. No GitHub update, build, commit, or deployment. The published app still has the previous interface.

## Method and audience

This is a heuristic review using a children’s UX research lens, not a study with children or a claim of professional credentials. Primary audience: a five-year-old using an iPad mini with a finger; secondary audiences: a three-year-old with adult help, an eight-year-old, and a grown-up managing files/devices. Assessment covers recognition versus reading, choice load, motor demands, feedback, recoverability, creative ownership, and transitions between activities.

Evidence: previous local HTML/CSS/controller saved in `before/`, inspection of the new implementation, official product documentation, conservative layout calculations, and controller/core/storage/API tests. Browser access to the local preview was denied because an admin security check was unavailable. No substitute browser was used. Therefore rendered appearance, actual touch accuracy, VoiceOver behavior, and Safari/Home Screen operation remain unverified. No images were displayed in chat.

## Reference research

- [Crayon Club settings](https://help.sagomini.com/article/507-how-can-i-change-the-coloring-settings): puts brush size, history, line constraints, exports and page reset in a secondary settings menu. Our interpretation: keep everyday coloring controls easy to reach and put file/family administration elsewhere. We retained Undo visibly because mistake recovery matters.
- [Bimi Boo Coloring](https://bimiboo.com/apps/coloring-for-kids/): describes beginner coloring and themed browsing for ages 2–4. Our interpretation: use visible picture categories and minimal instructions, rather than a dense searchable catalog.
- [Crayola Create & Play](https://www.crayolacreateandplay.com/): describes creative activities for ages 3–8 including art and puzzles. Our interpretation: connect the child’s finished artwork directly to a puzzle activity.
- [PBS Kids drawing game](https://pbskids.org/games/play/pinkalicious-drawing/760086): reference for a focused drawing activity. The game itself was not played during this review.
- [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): explains how target size and spacing reduce accidental activation. WCAG’s AA minimum is 24 CSS pixels with exceptions; **56 CSS pixels is our larger design target**, not a WCAG requirement or a proven threshold for all five-year-olds.

Product descriptions were read; these apps were not installed or interactively compared. Recommendations below are our design inferences, not findings from those vendors’ user studies.

## Findings and disposition

High = blocks or disrupts a core activity. Medium = likely confusion, effort, or accidental action. Low = refinement. “Implemented” means changed in local source, with the validation limits above.

| ID | Priority | Evidence and child scenario | Change | Status |
|---|---|---|---|---|
| 01 | High | Previous studio surrounded the page with navigation, explanations and controls. Coloring lost visual priority. | Hide the site header/nav during coloring; make a large square paper the center, with compact tool/color docks. | Implemented; device rendering pending. |
| 02 | High | Small color choices and tightly packed controls increase precision demands for young fingers. | Main swatches 56–60 px, tools at least 56 px wide; generous spacing. Narrow phones use three palette rows instead of shrinking swatches and a single-column saved-picture gallery to keep its two action buttons usable. | Implemented; physical tap trial pending. |
| 03 | High | Tags, detail labels and explanatory wording add reading and scanning before play. | Image-only picture cards; simple picture categories; remove level filter, tags, page counts and instructions from the child flow. | Implemented. |
| 04 | Medium | Names alone require recognition of text, especially for Issa. | Three large name cards with consistent flower/rocket/sun symbols. | Implemented; ask children whether symbols are recognizable. |
| 05 | High | A general puzzle destination lacks the immediate context of the child’s own picture. | Puzzle buttons on saved picture cards and the finished-picture dialog; no empty global puzzle tab. | Implemented; controller flow tested. |
| 06 | High | In the first rebuild, Done sent the child straight to a gallery and concealed the intended next activity. | Done saves, shows their picture, and offers Puzzle, Color and My pictures. | Implemented and tested. |
| 07 | Medium | Horizontally hidden categories require discovering an unfamiliar gesture; Stories was near the end. | Show all eight category buttons together, in two rows on tablet portrait/smaller screens. | Implemented; viewport rendering pending. |
| 08 | Medium | The previous difficulty dropdown requires reading a control convention. | Four large choices with numerals and grid previews. 9 is the first/default choice. | Implemented; all exact counts tested. |
| 09 | High | A destructive reset can undo a child’s effort with one stray tap. | Start over and mixing an in-progress puzzle require a simple No/Yes dialog. Clearing colors also creates an undo checkpoint. | Implemented and tested. |
| 10 | Medium | A child chooses a color after erasing and expects to color again. | Selecting a color leaves Erase and returns to Fill. | Implemented and tested. |
| 11 | High | Painting and erasing must never damage the coloring page itself. | Preserve separate base/paint layers and multiply composition; eraser operates only on paint. | Preserved; pixel and controller tests pass. |
| 12 | Medium | Invisible tool/color state makes repeated taps hard to interpret; color-only feedback excludes some users. | Selected tool border, swatch checkmark/outline, selected puzzle-piece outline and accessible pressed states. | Implemented; contrast/rendered visibility pending. |
| 13 | Medium | A running timer while away from the puzzle creates unfair times; a paused clock without a clear play state is confusing. | Start at first piece, stop at completion, pause on leaving/hiding; paused overlay with Play, disabled piece interactions. No leaderboards or pressure messages. | Implemented; clock/controller tests pass. |
| 14 | High | First rebuild centered an oversized board in a scrolling region, risking inaccessible leftmost columns and a misaligned hint. | Separate board frame sized to the actual board; overflow starts at the leading edge; hint tracks that frame. Minimum cell target retained. | Implemented; 36-piece structure tested, pan/hint rendering pending. |
| 15 | Medium | On portrait layouts, tall 50-piece tiles could exceed the piece tray’s height. | 50 pieces have been removed; the horizontal tray below the board uses 72 px pieces and preserves rectangular proportions. | Implemented by geometry inspection; rendered test pending. |
| 16 | Medium | Files, renaming and pairing interrupt play and can open keyboards/file pickers. | Move those controls into Grown-ups; disable file imports until a child is selected. Reject imports whose family/player changed during async decoding. | Implemented; no-player guard tested. |
| 17 | High | Controls active while opening artwork could paint the previous page or race the new load. | Opening overlay, disabled tools, cleared layers and a load ticket to discard stale results. | Implemented; basic opening, failed image, and cancellation of slow loads tested. |
| 18 | Medium | Removing a placed piece or hiding a section can leave keyboard focus on a disconnected control. | Move focus to the next piece after keyboard placement and to the new section heading; preserve touch navigation without forced focus scrolling. | Implemented; controller focus restoration tested; native accessibility test pending. |
| 19 | Medium | Icon-only narrow-screen Back/Undo/Redo could lose their names when labels are hidden. | Explicit accessible labels; visible focus outlines; reduced-motion support. | Implemented; semantic inspection only. |
| 20 | Low | Replacing the Pause button’s contents every timer tick adds avoidable DOM work. | Update its contents only when its pause/play state changes. Coalesced drawing events render once per move. | Implemented; controller checks pass, hardware performance pending. |
| 21 | High | A new external icon sprite missing from the offline shell would break recognition offline. | Cache the sprite with a new local service-worker shell version. | Implemented; asset/reference check passes, service-worker browser test pending. |
| 22 | High | Rebuilding the interface must preserve editable saves, sibling separation and sync/conflict copies. | Keep storage/backend architecture and verify core/API/storage flows plus new UI controller flows. | 26 tests pass. Cross-device browser trial pending. |
| 23 | Medium | Some outline pages were too busy; comic panels did not match the requested young-reader graphic-novel scenes. | Previous local image revision simplifies 37 pages, replaces eight comic pages, retains 11 simple pages; Stories category uses those scenes. | Asset revision complete; see image report. Raster screening is not all-page visual approval. |

## Owner decisions — October 4, 2026

All four decisions are resolved: no spoken guidance, no parental lock, no coloring assistance. Drag-and-drop puzzles are implemented alongside tap placement, 50 pieces are removed, and a horizontally swipeable tray stays below the board in both orientations. Family connection now uses an automatically generated three-word passphrase and preserves the existing internal family identity.

See [decision implementation and review](DECISIONS-2026-10-04.md). There are no remaining optional-feature approvals from this review. Device verification and authorization to build/publish remain outstanding.

## Hands-on acceptance session after return

Use the iPad mini in Safari and the Home Screen installation, in both orientations. Give a five-year-old a short goal: “Pick your name, choose a picture, color it, then make a puzzle.” Observe without coaching first. Note wrong taps, hesitation, help requests and whether they understand Done and Puzzle. Test Undo, picking a color after Erase, cancelling Start over, Picture hint and Play after pause. Let the three-year-old try with an adult and let the eight-year-old choose 24/36 pieces. Confirm no clipped tools or inaccessible pieces; check Safari bars and rotation. Finish with offline reopening, reconnect syncing to a second device, VoiceOver/keyboard checks, and an unsynced-save failure. These checks are pending and should precede deployment approval.
