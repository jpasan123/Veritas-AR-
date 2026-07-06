# Veritas AR

Web AR experience — scan the **Veritas logo** on the banner to see the 3D animated model.

**Tech:** MindAR · Three.js · Blender GLB

## Live

| Platform | URL |
|---|---|
| **Vercel** | Connect `Veritas-AR-` repo in Vercel dashboard |

## AR Experience

| Scan target | Model |
|---|---|
| Veritas logo on banner | `veritas-ar.glb` (animated lantern) |

## Local test

```bash
npx serve public -l 3000
```

Open `http://localhost:3000` — camera requires HTTPS on mobile (use Vercel or ngrok).

## Compile targets (after changing banner/logo images)

```bash
node scripts/compile-browser.js
```

## Deploy

Push to GitHub → Vercel auto-deploys from `public/` folder.
