# What air are you breathing?

Mobile-first prototype: trace the air at your spot back along the wind, past the fires it crossed, then see what it is made of.
Cities: Lucknow and Delhi.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Try a deep link: `http://localhost:5173/?area=aliganj`

Production build: `npm run build && npm run preview`.

## Data

- `public/data/mock/`: hand-crafted sample data (default; a "Sample data" badge is shown).
- `public/data/live/`: snapshots written by `npm run fetch-data` (Milestone 5). Switch with `VITE_DATA_MODE=live`.

Copy `.env.example` to `.env` for local settings. Never commit `.env`.
