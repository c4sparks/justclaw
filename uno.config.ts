import { defineConfig, presetUno } from 'unocss'

/**
 * UnoCSS configuration.
 * Replaces Tailwind CSS 4. Provides identical utility classes
 * with a fraction of the build time (Oxc/Rolldown based).
 */
export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      primary: '#f97316',
      'primary-hover': '#ea580c',
      'primary-light': '#fb923c',
      surface: '#0f1219',
      card: 'rgba(255, 255, 255, 0.05)',
      content: '#f0eef6',
      muted: '#8b8a9e',
      success: '#34d399',
      error: '#fb7185',
      warning: '#fbbf24',
      accent: '#60a5fa',
      glass: 'rgba(255, 255, 255, 0.08)'
    }
  },
  shortcuts: {
    'glass-card':
      'bg-card backdrop-blur-16 border border-glass rounded-xl',
    'btn-primary':
      'px-6 py-3 text-base font-bold rounded-2xl bg-gradient-to-r from-primary to-primary-hover text-white shadow-lg transition-all duration-300 active:scale-95',
    'btn-secondary':
      'px-4 py-2 text-sm font-bold rounded-xl bg-white/5 text-muted border border-glass hover:bg-white/10 transition-all duration-200',
    'btn-ghost':
      'px-5 py-2.5 text-sm font-bold rounded-xl bg-white/5 text-muted border border-glass hover:bg-white/10 transition-all'
  },
  rules: [
    ['animate-glow-pulse', {
      animation: 'glow-pulse 2s ease-in-out infinite'
    }]
  ]
})
