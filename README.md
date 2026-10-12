# BeeTrace hero

Astro build of hero **A1 · Comb** (dark, lot card) from the BeeTrace heroes canvas.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

- `src/components/Hero.astro`: headline, CTAs, journey line, and the lot data
- `src/components/LotCard.astro`: the verified lot card
- `src/components/CombBackdrop.astro`: honeycomb pattern and amber glow
- `src/layouts/Base.astro`: colour tokens (`--accent` and the rest) and self-hosted fonts (Bricolage Grotesque, JetBrains Mono)

Copy in square brackets (`[Apiary name]`, `[Region]`) is placeholder.
