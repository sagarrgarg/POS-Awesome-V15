/**
 * Responsive metrics for the POS surfaces.
 *
 * Backed by `useBreakpoints` (matchMedia driven), so this no longer recomputes
 * on every resize frame. The previously exported shape is preserved — callers
 * still get `windowWidth`, `dynamicSpacing`, `responsiveStyles` and friends —
 * but the values are now derived from a fixed reference viewport instead of
 * "whatever the window happened to be at mount", which made every scale start
 * at exactly 1.0 and then drift.
 *
 * `responsiveStyles` is also mirrored onto :root, because a few components read
 * `--container-height` off `document.documentElement` directly.
 */

import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { useBreakpoints } from "./useBreakpoints.js";

/** Reference viewport the spacing scale is authored against (a 13" laptop). */
const REFERENCE_WIDTH = 1440;
const REFERENCE_HEIGHT = 900;

const BASE_SPACING = Object.freeze({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32 });
const MIN_SPACING = Object.freeze({ xs: 2, sm: 4, md: 8, lg: 12, xl: 16 });

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Chrome above the POS panes: Frappe navbar + POSAwesome navbar + gutters. */
const CHROME_HEIGHT = Object.freeze({
	mobile: 132,
	tablet: 140,
	laptop: 148,
	desktop: 152,
});

export function useResponsive() {
	const bp = useBreakpoints();

	const windowWidth = bp.width;
	const windowHeight = bp.height;

	// Retained for API compatibility; they are now stable reference values
	// rather than a snapshot of the first render.
	const baseWidth = computed(() => REFERENCE_WIDTH);
	const baseHeight = computed(() => REFERENCE_HEIGHT);

	const widthScale = computed(() => clamp(windowWidth.value / REFERENCE_WIDTH, 0.72, 1.35));
	const heightScale = computed(() => clamp(windowHeight.value / REFERENCE_HEIGHT, 0.72, 1.35));
	const averageScale = computed(() => (widthScale.value + heightScale.value) / 2);

	const dynamicSpacing = computed(() => {
		const scale = averageScale.value;
		return Object.keys(BASE_SPACING).reduce((acc, key) => {
			acc[key] = Math.max(MIN_SPACING[key], Math.round(BASE_SPACING[key] * scale));
			return acc;
		}, {});
	});

	/**
	 * Height available to a pane, measured rather than guessed at 68vh. Using
	 * the visual viewport keeps the panes correct when the mobile keyboard or
	 * the collapsing URL bar eats into the window.
	 */
	const containerHeight = computed(() => {
		const chrome = CHROME_HEIGHT[bp.breakpoint.value] ?? CHROME_HEIGHT.laptop;
		return Math.max(280, Math.round(windowHeight.value - chrome));
	});

	/** Height of the item-card grid area within the selector pane. */
	const cardHeight = computed(() => Math.round(containerHeight.value * (bp.isCompact.value ? 0.72 : 0.78)));

	const responsiveStyles = computed(() => {
		const spacing = dynamicSpacing.value;
		return {
			"--dynamic-xs": `${spacing.xs}px`,
			"--dynamic-sm": `${spacing.sm}px`,
			"--dynamic-md": `${spacing.md}px`,
			"--dynamic-lg": `${spacing.lg}px`,
			"--dynamic-xl": `${spacing.xl}px`,
			"--container-height": `${containerHeight.value}px`,
			"--card-height": `${cardHeight.value}px`,
			"--font-scale": averageScale.value.toFixed(2),
			"--pos-keyboard-inset": `${bp.keyboardInset.value}px`,
		};
	});

	// Mirror onto :root so non-Vue CSS and the few getComputedStyle() readers
	// pick up real pixel values instead of falling back to a hardcoded "68vh".
	let stopMirror = null;

	const applyToRoot = (styles) => {
		if (typeof document === "undefined" || !document.documentElement) return;
		const root = document.documentElement;
		Object.entries(styles).forEach(([key, value]) => root.style.setProperty(key, value));
	};

	onMounted(() => {
		applyToRoot(responsiveStyles.value);
		stopMirror = watch(responsiveStyles, applyToRoot, { flush: "post" });
	});

	onBeforeUnmount(() => {
		if (stopMirror) {
			stopMirror();
			stopMirror = null;
		}
	});

	return {
		// Original surface
		windowWidth,
		windowHeight,
		baseWidth,
		baseHeight,
		widthScale,
		heightScale,
		averageScale,
		dynamicSpacing,
		responsiveStyles,
		// Layout state
		breakpoint: bp.breakpoint,
		isMobile: bp.isMobile,
		isTablet: bp.isTablet,
		isLaptop: bp.isLaptop,
		isDesktop: bp.isDesktop,
		isCompact: bp.isCompact,
		isSplit: bp.isSplit,
		isPortrait: bp.isPortrait,
		isTouch: bp.isTouch,
		prefersReducedMotion: bp.prefersReducedMotion,
		keyboardInset: bp.keyboardInset,
		containerHeight,
		cardHeight,
	};
}
