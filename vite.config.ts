import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    // Evita React duplicado ao consumir @migrate/design-system via dependência file: (R1)
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // SEGURANÇA: nunca gerar source maps em produção
    sourcemap: false,
  },
})
