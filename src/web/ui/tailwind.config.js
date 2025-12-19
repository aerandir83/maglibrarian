/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0f172a',
                card: '#1e293b',
                primary: '#38bdf8',
                'primary-hover': '#0ea5e9',
                border: '#334155',
                muted: '#94a3b8',
                danger: '#ef4444',
                success: '#22c55e',
            }
        },
    },
    plugins: [],
}
