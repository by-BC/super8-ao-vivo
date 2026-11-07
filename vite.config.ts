import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serve o site em /super8-ao-vivo/ (dev e preview usam o mesmo caminho)
export default defineConfig({
  base: '/super8-ao-vivo/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
