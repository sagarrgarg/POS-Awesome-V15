import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import { PosThemeProvider } from "./ThemeProvider";
import "@radix-ui/themes/styles.css";
import "./theme.css";

/**
 * Entry point for the React POS screen.
 *
 * Exposes a mount/unmount pair rather than mounting on import, because the
 * Frappe page controls the lifecycle: the desk keeps page wrappers around and
 * re-shows them, so mounting on script load would leak roots.
 */
let root: Root | null = null;

function syncNavbarOffset() {
	// The app pins itself below the desk navbar. Measuring beats hardcoding
	// because the navbar height differs between desk versions and themes.
	const navbar = document.querySelector<HTMLElement>(
		".navbar, header.navbar",
	);
	const height = navbar?.getBoundingClientRect().height ?? 60;
	document.documentElement.style.setProperty(
		"--posnext-top",
		`${Math.round(height)}px`,
	);
}

export function mount(container: HTMLElement): void {
	syncNavbarOffset();
	// Removed in unmount(); mount() is only ever called once per page show.
	window.addEventListener("resize", syncNavbarOffset, { passive: true });

	container.classList.add("posnext-host");
	if (!root) {
		root = createRoot(container);
	}
	root.render(
		<StrictMode>
			<PosThemeProvider>
				<App />
			</PosThemeProvider>
		</StrictMode>,
	);
}

export function unmount(): void {
	window.removeEventListener("resize", syncNavbarOffset);
	root?.unmount();
	root = null;
}
