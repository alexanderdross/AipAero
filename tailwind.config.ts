import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

export default {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
      },
      colors: {
        'drossblue': {
          DEFAULT: '#2d6a9a'
          },
        'drossgray': {
          DEFAULT: '#f0f2f2',
        }
      }
    },
  },
  plugins: [require('@tailwindcss/forms')],
} satisfies Config;
