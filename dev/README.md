# dev/ — sources for the 3D café layer

`index.html` at the repo root is the deployable, self-contained app. It is assembled by:

```bash
python3 dev/build.py
```

which takes `dev/classic_index.html` (the original 2D checklist, untouched) and injects the 3D
layer from `dev/src/`:

- `cafe3d.css`, `cafe3d.html` — 3D-mode styles and HUD markup
- `core.js` helpers · `textures.js` procedural textures · `room.js` materials/room/lighting/sky · `exterior.js` beach resort (deck, pool, sand, ocean shader, huts, palms, towers) · `avatar.js` the player character ·
  `props.js` furniture builders · `nav.js` grid + A* + collision · `cat_model.js` jointed cat +
  animation · `cat_ai.js` behaviour brain + locomotion · `world.js` layout, toys, ambient life ·
  `player.js` cameras & interaction · `audio.js` synthesized sound · `ui.js` panel/HUD glue ·
  `main.js` boot

You never need to run the build to *use* the app — only to change it. Edit a file in `dev/src/`,
run the build, and commit the regenerated `index.html`.
