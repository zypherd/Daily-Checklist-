# Daily Checklist — The Rose Teacup Café

A daily checklist that lives inside a small, living 3D coffee shop on a beach resort terrace — pool, palms, thatched huts, people on the sand and the ocean outside the windows. Rendered with cascaded shadows, ambient occlusion, bloom, sky-based reflections, sun shafts with drifting dust, and a film-style finish. Five cats with their own
personalities wander, nap, climb, play and greet each other while you work through your day's
tasks. Still a single self-contained `index.html` — no build step, no server, no backend.

## Use it

Open `index.html` in a current desktop browser (Chrome, Edge, Safari, Firefox). The 3D café loads
Three.js from a pinned CDN build; everything else (artwork, textures, cat models, sound) is generated
in the file itself. Your tasks and check-offs are saved in the browser's local storage exactly as
before.

If WebGL is unavailable or the CDN can't be reached (offline), the app automatically falls back to
the original 2D café — the checklist works either way. Add `?classic` to the URL (or use *Help →
Classic 2D café*) to choose the classic view; the *3D Café* button in the header brings you back.

## Host it

Turn on **GitHub Pages** (Settings → Pages → Deploy from branch → `master` / root). GitHub serves
`index.html` at the public URL automatically. The file only uses relative paths and `https://` CDN
imports, so it works from Pages, from a local server, or straight from disk.

## Exploring the café

| Action | Control |
| --- | --- |
| Look around (first person) | click the café, then move the mouse · `Esc` releases |
| Walk / run / crouch to cat level | `W A S D` · `Shift` · `C` |
| Switch camera (first person → third person → orbit / overhead) | `V` · reset with `R` |
| Change your outfit (casual, or work shirt + slacks in beige / black / blue / pink) | `O` |
| Orbit mode | drag to rotate · wheel to zoom · `WASD` pan · `Q`/`E` height |
| Select a cat (info card, follow, offer a treat) | click the cat · `N` cycles cats |
| Toss a toy · brew an espresso · ring the bell · light switch | click them · `T` · `L` |
| Sit down | click a chair or the couch (a sociable cat may join you) |
| Open / close the checklist | `Tab` · or click the task board behind the bar |
| Sound settings · help | `M` · `H` |
| Speed up / slow down the day | `[` `]` |

## Checklist features (all preserved)

- Daily / weekly / "today only" / "upon completion" task scheduling
- Subtasks, categories with custom colours, drag-and-drop reordering, quick-add rows
- The rose teacup fills with latte as you complete tasks; petals fall at 100%
- Print view (multiple card sizes), "All Tasks & Schedules" overview with inline editing
- Every completed task rings the service bell and tosses a treat onto the café floor — the cats
  come running. The chalk task board on the wall mirrors today's list and progress.

## You

You explore as a slim 5'4" woman modelled on a reference photo: fair warm skin, long wavy burgundy hair swept
behind one ear with a pink plumeria, blue eyes, thin arched brows and a soft smile. Outfits (`O`): black yoga
pants + white crop top, a business-casual button-up with slacks (beige / black / blue / pink), or the black
tank dress from the photo. First person shows your own body when you look down; third person follows her
over the shoulder; orbit view looks over the whole café and terrace. A barista works the bar, beach-goers
stroll the shore and sunbathe under the huts, gulls circle over the water.

Graphics quality (`G`): Ultra (ambient occlusion + MSAA), High, Medium; it steps down automatically if the
machine struggles.

## How the cats work

- **Models** — procedural, jointed 3D cats (torso, neck, head, ears, eyes with blink, four
  three-segment legs, eight-segment tail, collar). Fur uses generated textures (tabby stripes,
  bicolour patches, Siamese points) on a sheen material.
- **Animation** — pose blending (stand, walk/trot/run gaits, stalk, sit, loaf, sleep, stretch,
  groom, scratch, crouch, jump, land, bat) with a frame-rate-independent gait cycle, tail dynamics,
  breathing, ear twitches and head tracking.
- **Brain** — a utility-based decision system. Each cat has needs (energy, play, company,
  curiosity) and a personality (energy, curiosity, sociability, playfulness, laziness, boldness,
  sun-loving, height-loving). Behaviours are scored with noise and cooldowns: sleep/nap on the
  best spot, wander, observe, groom, stretch, climb, window-watch, scratch, play with toys, bat the
  dangling toy, investigate, greet another cat (who may reciprocate, ignore, or walk off), come to
  sit with you. Events (a tossed toy, a treat, the bell, the espresso machine, a bird on the ledge,
  another cat landing on the same couch, you rushing past) can interrupt what a cat is doing.
- **Physics & navigation** — occupancy grid + A* with string-pulling, steering with separation,
  turn-rate limits and arrival slow-down; circle-vs-furniture collision; ballistic jumps between
  the floor and perches (chairs, stools, couch, window sill, window bar, cat tree tiers) via a
  perch graph; toy balls and a mouse with gravity, bounce, rolling friction and collisions.

## Notes for future edits

- The 3D layer is the `<script type="module">` at the bottom of `index.html`, organised in
  sections (core, textures, room, props, nav, cat_model, cat_ai, world, player, audio, ui, main).
- Data (tasks/categories/check-offs) is stored per-browser in `localStorage` — it does not sync
  between computers or browsers.
- The file is large (~4.6 MB) because the classic café artwork is embedded as base64 so the
  fallback works fully offline. That's intentional.
