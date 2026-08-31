import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/gurgenBudget/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
