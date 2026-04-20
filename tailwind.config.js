/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#E30613',
          container: '#c20510',
        },
        secondary: {
          DEFAULT: '#9e4041',
          container: '#7a3132',
        },
        surface: {
          DEFAULT: '#fcf9f8',
          'container-lowest': '#ffffff',
          'container-low': '#f6f3f2',
          container: '#f0edec',
          'container-high': '#eae7e6',
          'container-highest': '#e5e2e1',
        },
        'on-surface': {
          DEFAULT: '#1c1b1b',
          variant: '#5e3f3b',
        },
        'on-primary': '#ffffff',
        'on-secondary': '#ffffff',
        outline: {
          DEFAULT: '#857371',
          variant: '#d8c2bf',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        'on-error': '#ffffff',
        'on-error-container': '#ba1a1a',
        success: {
          DEFAULT: '#1b7d3a',
          container: '#d4f5dc',
        },
        warning: {
          DEFAULT: '#9c6d00',
          container: '#ffedc0',
        },
      },
      borderRadius: {
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
