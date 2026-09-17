# efficura-3d-renderer

Standalone Next.js app that renders the **capital-stack 3D tower** from the Asset Skyview page ("The whole capital stack, at a glance.").

Designed to be embedded in Framer (or any host) via an `<iframe>`.

## Quick start

```bash
cd efficura-3d-renderer
npm install
npm run dev
```

Open http://localhost:3000

## Production

```bash
npm run build
npm start
```

Or deploy to Vercel / Cloudflare Pages / Netlify. The app is a single client page with no API routes.

## Embed in Framer

```html
<iframe
  src="https://your-deployed-url.vercel.app"
  style="width:100%; height:420px; border:none; background:transparent;"
  loading="lazy"
  allow="webgl"
  title="Capital stack 3D"
></iframe>
```

Recommended height on the Asset Skyview section: **340px** (mobile) / **420px** (desktop), matching the original.

## What it renders

Same geometry, colours and intro animation as `CapitalStackMock` in the public repo:

| Tranche   | Fraction | Colour  |
|-----------|----------|---------|
| Equity    | 25%      | #d8956a |
| Mezzanine | 15%      | #c2662d |
| Senior    | 60%      | #7f3f20 |

- Orthographic camera, demand-driven frame loop (pauses after settle)
- Soft radial disc behind the tower
- Curved leader lines + percent / name labels

## Performance notes for iframe use

- `frameloop="demand"` — only re-renders while the intro settle animation runs
- Transparent canvas (`alpha: true`) so the host page background can show through if desired
- CSP headers allow framing from any origin (`frame-ancestors *`)
- Keep the iframe `loading="lazy"` and only mount it when the section is near the viewport

## Project layout

```
efficura-3d-renderer/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx          ← full-bleed capital stack
├── components/
│   └── CapitalStackMock.tsx
├── public/
├── next.config.ts
├── package.json
└── tsconfig.json
```
