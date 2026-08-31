import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import autoprefixer from "autoprefixer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build for the React POS screen.
 *
 * Kept separate from vite.config.js because that one is a single-entry `lib`
 * build for the Vue bundle; adding a second entry to a lib build fights the
 * rollup output config. This emits a plain IIFE that the Frappe page loads.
 */
export default defineConfig({
	plugins: [react()],
	css: {
		// No Tailwind here: every visual decision on this screen comes from
		// Radix Themes props and its CSS variables, so a utility layer would
		// only be a second, competing source of spacing and colour.
		postcss: { plugins: [autoprefixer()] },
	},
	build: {
		target: "es2020",
		outDir: "../posawesome/public/dist/react",
		emptyOutDir: true,
		lib: {
			entry: path.resolve(__dirname, "src/react/main.tsx"),
			name: "PosAwesomeReact",
			formats: ["iife"],
			fileName: () => "posnext.js",
		},
		rollupOptions: {
			output: {
				assetFileNames: "posnext.[ext]",
			},
		},
	},
	resolve: {
		alias: {
			"@react": path.resolve(__dirname, "src/react"),
			"@offline": path.resolve(__dirname, "src/offline"),
		},
	},
	define: {
		"process.env.NODE_ENV": '"production"',
	},
});
