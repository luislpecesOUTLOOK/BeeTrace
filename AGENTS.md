# AGENTS.md

Astro 7 static marketing site (BeeTrace hero/landing). No tests, linter, CI, or backend.

## Commands

- `npm install` — install (no lockfile discipline documented; `package-lock.json` exists)
- `npm run dev` — dev server at http://localhost:4321
- `npm run build` — static output to `dist/`
- `npm run preview` — preview the `dist/` build
- `npm test` — `node --test scripts/trace.test.mjs scripts/store.test.mjs` (pure blend/QR logic + store flows with browser shims; no runner deps)

## Structure

- `src/pages/` — landing + app in two static trees (see below); landing section order: `Header, Hero, HowItWorks, ForBuyers, ScanSection, Pricing, ClosingCta, Footer`.
- `src/layouts/Base.astro` — global tokens (`--ink/--card/--cream/--muted/--faint/--accent/--ok`, `--display`, `--mono`), body comb/glow background (`public/comb.svg` + radial gradient), skip link, self-hosted fonts via `@fontsource-variable/bricolage-grotesque` + `@fontsource/jetbrains-mono` (imported in frontmatter, not CDN).
- `src/components/` — one `.astro` file per section; `LotCard.astro` (props: `lot`, `fields[]`, `steps[]`), small primitives (`Hex`, `Check`, `Brand`, `SectionIntro`); `nav.ts` exports `sections(lang)` + `home(lang)` used by `Header`/`Footer` — add nav labels in `src/lib/i18n.ts`, keep anchor `href`s in sync with section `id`s.
- `src/lib/i18n.ts` — central ES/EN dict (`content.es` is the shape; `en` must match it or the build fails typecheck-by-shape). Helpers: `prefix`, `counterpart`, `docLang`. Landing components take `lang` prop; client scripts read locale from `document.documentElement.lang`.
- `src/pages/` — two static trees: `/` (ES) and `/en/` (EN); app views live in `src/components/app/*View.astro` with thin wrappers in both trees. New user-facing strings go in the dict (both languages), never hardcoded in one locale.
- `src/lib/` — `trace.ts` (pure logic: QR parse/format `BT1:<ID>`, blend math, validations; no DOM, tested in Node), `store.ts` (localStorage demo persistence — NOT real auth, every consumer shows the modo-local banner; messages localized via `setStoreLang`), `scanner.ts` (getUserMedia + `jsqr` decode), `app-ui.ts` (profile guard, flash messages).
- Backend path: `README-BACKEND.md` — required before claiming real auth/permissions.
- `astro.config.mjs` is empty default; `tsconfig.json` extends `astro/tsconfigs/strict`, excludes `dist`.

## Conventions

- Scoped `<style>` per component; shared values come only from `Base.astro` `:root` tokens — don't hardcode colors/fonts.
- Static only: no framework components, no client JS, no env vars, no routing beyond `#anchor` links with `scroll-margin-top`.
- Copy in square brackets (`[Apiary name]`, `[Region]`) in `Hero.astro` lot data is intentional placeholder.
- Note: `README.md` mentions `src/components/CombBackdrop.astro`, which does not exist — backdrop lives in `Base.astro` body CSS. Don't recreate it.
