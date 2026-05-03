/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0F3D5C',
        'primary-dark': '#0a2d44',
        'primary-light': '#1a5478',
        success: '#1D9E75',
        danger: '#C0392B',
        'danger-light': '#FFF0F0',
        'bg-secondary': '#F4F4F4',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
