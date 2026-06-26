import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import viteCompression from 'vite-plugin-compression'

// if in ESM context
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Only enable Sentry plugin when auth token is provided via env
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const enableSentry = !!sentryAuthToken
const appVersion = process.env.npm_package_version ?? '0.0.0'
const sentryRelease = process.env.SENTRY_RELEASE ?? `lack-client@${appVersion}`

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
    }),
    // Conditionally enable Sentry plugin only when token is available
    ...(enableSentry
      ? [
        sentryVitePlugin({
          org: '4507305373007872',
          project: 'lack-client',
          authToken: sentryAuthToken,
          release: { name: sentryRelease },
          sourcemaps: {
            assets: './dist/**',
            ignore: ['node_modules'],
          },
          telemetry: false,
        }),
      ]
      : []),
  ],
  build: {
    // Generate sourcemap only when Sentry upload is enabled (production release)
    sourcemap: enableSentry ? 'hidden' : false,
    // Warn on large chunks to catch bundle size issues early
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-accordion',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-slider',
          ],
          'vendor-charts': ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-resources-to-backend'],
          'vendor-utils': ['clsx', 'tailwind-merge', 'class-variance-authority'],
        },
      },
    },
    // Minification settings
    minify: 'esbuild',
    target: 'es2020',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  define: {
    __SENTRY_RELEASE__: JSON.stringify(sentryRelease),
  }
})
