# Osu!rea

Visualiseur d'area tablette pour osu! avec comparaison A/B, favoris, presets de ratio et profils de joueurs.

## Prérequis

- Node.js 20+
- npm

## Démarrage

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` : lance le serveur local Vite.
- `npm run build` : build de production.
- `npm run preview` : preview du build local.
- `npm run lint` : lint ESLint.
- `npm run test:run` : exécution des tests Vitest.
- `npm run test:coverage` : rapport de couverture.

## Stack

- Vite 6
- JavaScript (ES Modules)
- Vitest + jsdom
- ESLint + Prettier
- Déploiement Cloudflare Pages (`wrangler.jsonc`)
