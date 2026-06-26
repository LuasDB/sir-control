/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Paleta oficial SIRSA ─────────────────────────────────────────
        sirsa: {
          black  : '#1D1C19',
          yellow : '#F8CD24',
          'yellow-dark' : '#B08629',
          'yellow-hover': '#E6BE1F',
          gray   : '#626261',
          'gray-light'  : '#A0A09F',
          white  : '#FBFBFB',
          bg     : '#F5F5F5',
          border : '#D9D9D9',
          green  : '#2BA84A',
          blue   : '#2E75B6',
          red    : '#E63946',
        },
        // Aliases semánticos (usados en componentes)
        primary  : '#1D1C19',
        accent   : '#F8CD24',
        muted    : '#626261',
        faint    : '#A0A09F',
        surface  : '#FFFFFF',
        canvas   : '#F5F5F5',
        border   : '#D9D9D9',
        success  : '#2BA84A',
        info     : '#2E75B6',
        danger   : '#E63946',
        warning  : '#B08629',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs:    ['12px', '16px'],
        sm:    ['13px', '18px'],
        base:  ['14px', '20px'],
        md:    ['15px', '22px'],
        lg:    ['16px', '24px'],
        xl:    ['18px', '26px'],
        '2xl': ['20px', '28px'],
        '3xl': ['24px', '32px'],
      },
      borderRadius: {
        sm  : '6px',
        DEFAULT: '8px',
        md  : '8px',
        lg  : '12px',
        xl  : '16px',
        full: '9999px',
      },
      boxShadow: {
        card  : '0 2px 8px rgba(0,0,0,0.08)',
        modal : '0 8px 32px rgba(0,0,0,0.16)',
        input : '0 0 0 3px rgba(248,205,36,0.25)',
        btn   : '0 1px 3px rgba(0,0,0,0.12)',
        topbar: '0 1px 0 rgba(0,0,0,0.10)',
      },
      spacing: {
        '4.5': '18px',
        '5.5': '22px',
        '6.5': '26px',
        '7.5': '30px',
        '18' : '72px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
}
