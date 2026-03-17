/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* HSL variable-based colors (for @apply and utility classes) */
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        /* Soul.md Deep Sea Neon palette */
        cyan: {
          DEFAULT: '#00F5FF',
          50: '#E0FEFF',
          100: '#B0FCFF',
          200: '#80FAFF',
          300: '#40F8FF',
          400: '#00F5FF',
          500: '#00C8D4',
          600: '#009BA8',
          700: '#006E7D',
          800: '#004151',
          900: '#001A20',
        },
        violet: {
          DEFAULT: '#7000FF',
          50: '#F0E5FF',
          100: '#D9B3FF',
          200: '#C280FF',
          300: '#AB4DFF',
          400: '#941AFF',
          500: '#7000FF',
          600: '#5A00CC',
          700: '#430099',
          800: '#2D0066',
          900: '#160033',
        },
        deepsea: {
          DEFAULT: '#0A0F14',
          light: '#0F1620',
          medium: '#141D28',
          card: '#111820',
        },
        frost: '#E0E6ED',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'sonar': 'sonar-pulse 2s ease-out infinite',
        'glow-breathe': 'glow-breathe 4s ease-in-out infinite',
        'border-glow': 'border-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
