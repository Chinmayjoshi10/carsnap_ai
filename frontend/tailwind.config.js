export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        bg:      '#F7F6F3',
        surface: '#FFFFFF',
        navy:    { DEFAULT: '#0F1B2D', light: '#1A2E4A' },
        accent:  '#2563EB',
        border:  '#E8E5E0',
        success: '#059669',
        warning: '#D97706',
        error:   '#DC2626',
        tx: {
          primary:   '#0F1B2D',
          secondary: '#6B7280',
          muted:     '#9CA3AF',
        }
      },
      boxShadow: {
        'card':   '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'lifted': '0 4px 12px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.06)',
        'btn':    '0 1px 2px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      }
    }
  },
  plugins: [],
}
