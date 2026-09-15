import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // La connexion passe par /api/auth/, servi par Django. En production c'est
    // nginx qui met l'appli et l'API sur la même origine (voir
    // src/server/README.md) ; ici on reproduit ça pour que `npm run dev` puisse
    // se connecter pour de vrai, cookies de session compris.
    // Démarrer la pile complète à côté : `make up` à la racine du dépôt.
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
})
