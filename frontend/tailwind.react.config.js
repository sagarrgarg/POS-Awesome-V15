/**
 * Tailwind config for the React POS screen.
 *
 * Scoped to src/react so the Vue bundle's utility output is untouched.
 * The palette is deliberately flat and saturated — "crayon" colours with a
 * single tone each, no gradients and no tint ramps to pick between.
 */
export default {
	content: ["./src/react/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				// Named surfaces, so components never reach for arbitrary values
				// like `bg-[var(--x)]` where Tailwind cannot tell a colour from a
				// width (`border-[--x]` is genuinely ambiguous).
				canvas: "#f1f5f9",
				surface: "#ffffff",
				line: "#e2e8f0",
				"line-strong": "#cbd5e1",
				ink: "#0f172a",
				muted: "#64748b",
				crayon: {
					blue: "#2563eb",
					sky: "#0ea5e9",
					teal: "#0d9488",
					green: "#16a34a",
					lime: "#65a30d",
					amber: "#f59e0b",
					orange: "#ea580c",
					red: "#dc2626",
					pink: "#db2777",
					purple: "#7c3aed",
					indigo: "#4f46e5",
					slate: "#475569",
				},
			},
			fontSize: {
				// Tight type scale: the UI is dense, so the defaults are a step
				// smaller than Tailwind's and line heights are pinned.
				"2xs": ["0.6875rem", { lineHeight: "0.875rem" }],
				xs: ["0.75rem", { lineHeight: "1rem" }],
				sm: ["0.8125rem", { lineHeight: "1.125rem" }],
				base: ["0.875rem", { lineHeight: "1.25rem" }],
			},
			borderRadius: {
				DEFAULT: "6px",
				md: "8px",
				lg: "10px",
			},
		},
	},
	plugins: [],
};
