# AGENTS.md

Astro 7 static marketing site (BeeTrace hero/landing). No tests, linter, CI, or backend.

## Commands

- `npm install` — install (no lockfile discipline documented; `package-lock.json` exists)
- `npm run dev` — dev server at http://localhost:4321
- `npm run build` — static output to `dist/`
- `npm run preview` — preview the `dist/` build
- No `test` / `lint` / `typecheck` scripts — verify with `npm run build`.

## Structure

- `src/pages/index.astro` — sole page; section order: `Header, Hero, HowItWorks, ForBuyers, Pricing, ClosingCta, Footer`.
- `src/layouts/Base.astro` — global tokens (`--ink/--card/--cream/--muted/--faint/--accent/--ok`, `--display`, `--mono`), body comb/glow background (`public/comb.svg` + radial gradient), skip link, self-hosted fonts via `@fontsource-variable/bricolage-grotesque` + `@fontsource/jetbrains-mono` (imported in frontmatter, not CDN).
- `src/components/` — one `.astro` file per section; `LotCard.astro` (props: `lot`, `fields[]`, `steps[]`), small primitives (`Hex`, `Check`, `Brand`, `SectionIntro`); `nav.ts` exports shared `sections` array used by `Header` — add nav links there, keep anchor `href`s in sync with section `id`s.
- `astro.config.mjs` is empty default; `tsconfig.json` extends `astro/tsconfigs/strict`, excludes `dist`.

## Conventions

- Scoped `<style>` per component; shared values come only from `Base.astro` `:root` tokens — don't hardcode colors/fonts.
- Static only: no framework components, no client JS, no env vars, no routing beyond `#anchor` links with `scroll-margin-top`.
- Copy in square brackets (`[Apiary name]`, `[Region]`) in `Hero.astro` lot data is intentional placeholder.
- Note: `README.md` mentions `src/components/CombBackdrop.astro`, which does not exist — backdrop lives in `Base.astro` body CSS. Don't recreate it.
