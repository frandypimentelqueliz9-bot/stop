/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                'hand': ['"Patrick Hand"', 'cursive'], // Fuente estilo manuscrito
            }
        },
    },
    plugins: [],
}
