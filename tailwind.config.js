/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#FAFAF8',
        primary: '#1A2B4A',
        accent: '#E8A020',
        sage: '#8FAF7E',
        danger: '#C0392B',
        tesco: '#005EB8',
        sainsburys: '#F06C00',
        asda: '#78BE20',
        morrisons: '#FFD700',
        lidl: '#0050AA',
        aldi: '#00539B',
      },
      fontFamily: {
        fraunces: ['Fraunces', 'serif'],
        'source-sans': ['SourceSans3', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
