# PassOn — logo assets + React component

Ce dossier contient le logo PassOn (fourni en webp) retravaillé pour un
usage en interface : fond transparent, recadré, deux formats (icône seule
et lockup complet), plus les tailles favicon habituelles.

## Contenu

```
assets/
  logo-full.png / logo-full.webp     Icône + texte "pass on", fond transparent
  logo-mark.png / logo-mark.webp     Icône seule (les deux mains + le document)
  logo-mark-512.png                  Icône seule, recentrée dans un carré 512x512
  apple-touch-icon.png (180x180)     Pour manifest / apple-touch-icon
  favicon-32.png, favicon-16.png     Pour favicon.ico / <link rel="icon">
components/
  PassOnLogo.tsx                     Composant React/TypeScript
```

Ce qui a été fait sur l'image d'origine : suppression du fond blanc (rendu
transparent), rognage aux bords du contenu, nettoyage du léger liseré clair
qui restait autour des formes, et compression (quantification des couleurs)
pour un poids raisonnable — `logo-full.png` est passé de ~640 Ko à ~115 Ko
sans perte visible.

## Installation

1. Copier le dossier `assets/` dans votre dossier `public/` (par exemple
   `public/logo/`), et `PassOnLogo.tsx` dans votre dossier `components/`.
2. Le composant pointe vers `/logo/logo-full.png` etc. — adapter les chemins
   dans `components/PassOnLogo.tsx` (objet `assets`) si vous rangez les
   fichiers ailleurs.

## Utilisation

```tsx
import { PassOnLogo } from "@/components/PassOnLogo";

// Lockup complet (icône + "pass on"), par ex. sur un écran de connexion
<PassOnLogo variant="full" height={64} />

// Icône seule, par ex. dans le header à côté du nom du produit
<PassOnLogo variant="mark" height={32} />
```

Le composant utilise une simple balise `<picture>/<img>` (pas `next/image`),
donc il fonctionne tel quel dans Next.js, Vite, CRA, etc. Si vous êtes sur
Next.js et voulez l'optimisation automatique de `next/image`, remplacez le
`<img>` interne par `<Image src={asset.png} ... />` en gardant les mêmes
chemins.

## Favicon

Pour le favicon du site, les fichiers `favicon-16.png`, `favicon-32.png` et
`apple-touch-icon.png` sont prêts à l'emploi. Dans `app/layout.tsx` (Next.js
App Router) :

```tsx
export const metadata = {
  icons: {
    icon: [
      { url: "/logo/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/logo/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/logo/apple-touch-icon.png",
  },
};
```
