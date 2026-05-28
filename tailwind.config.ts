import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Josefin Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        josefin: ['"Josefin Sans"', "sans-serif"],
        dm: ['"DM Sans"', "sans-serif"],
        geist: ['"Geist"', "sans-serif"],
        "geist-mono": ['"Geist Mono"', "monospace"],
        inter: ['"Inter"', "sans-serif"],
        jakarta: ['"Plus Jakarta Sans"', "sans-serif"],
        poppins: ['"Poppins"', "sans-serif"],
        outfit: ['"Outfit"', "sans-serif"],
        montserrat: ['"Montserrat"', "sans-serif"],
        "open-sans": ['"Open Sans"', "sans-serif"],
        roboto: ['"Roboto"', "sans-serif"],
        "ibm-plex": ['"IBM Plex Sans"', "sans-serif"],
        "ibm-plex-mono": ['"IBM Plex Mono"', "monospace"],
        "space-grotesk": ['"Space Grotesk"', "sans-serif"],
        "space-mono": ['"Space Mono"', "monospace"],
        oxanium: ['"Oxanium"', "sans-serif"],
        playfair: ['"Playfair Display"', "serif"],
        lora: ['"Lora"', "serif"],
        merriweather: ['"Merriweather"', "serif"],
        "libre-baskerville": ['"Libre Baskerville"', "serif"],
        "source-serif": ['"Source Serif 4"', "serif"],
        "source-code": ['"Source Code Pro"', "monospace"],
        "roboto-mono": ['"Roboto Mono"', "monospace"],
        "fira-code": ['"Fira Code"', "monospace"],
        "jetbrains-mono": ['"JetBrains Mono"', "monospace"],
        architects: ['"Architects Daughter"', "cursive"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        "netsuite-blue": "hsl(var(--netsuite-blue))",
        "netsuite-light": "hsl(var(--netsuite-light))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        error: "hsl(var(--error))",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
