---
name: Walkthrough video tooling
description: Lessons from producing the portal feature-tour videos (mobile + desktop)
---
- `~/.fonts` gets wiped between sessions/runs — never rely on installed fonts for recorded overlays. The tap-hand cursor is embedded as a base64 PNG data-URI (extracted from NotoColorEmoji's CBDT glyph) inside both recorder scripts, so it renders regardless of fontconfig.
  **Why:** the emoji-font hand intermittently rendered as tofu when ~/.fonts was cleared mid-session.
- Quote-form submits during recording must be intercepted with `ctx.route('**/api/quick-quote', fulfill 200)` — a real POST emails real staff. `page.route` failed to intercept in the recorder; use context-level route.
- Desktop pages render slower: desktop assembly trims 2.8s from clip starts vs 1.5s mobile (timings.json is trim-adjusted automatically).
- Playwright wheel scrolling misses inner scroll containers — smoothScroll evaluates JS to find the first element with scrollHeight > clientHeight and animates it.
- Assets: `scripts/record-walkthrough{,-desktop}.ts`, `scripts/assemble-video{,-desktop}.sh`; videos are copied to `client/public/portal-feature-tour{,-desktop}.mp4` — republish and re-copy after any video edit. Login page picks version via matchMedia(min-width: 768px).
