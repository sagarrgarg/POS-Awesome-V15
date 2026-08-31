/**
 * Single source of truth for POSAwesome layout breakpoints.
 *
 * Deliberately built on matchMedia rather than a `resize` listener: media query
 * listeners fire only when a threshold is actually crossed, so dragging a
 * window or rotating a tablet produces a handful of reactive writes instead of
 * one per frame. The state is module-level, so every component shares one set
 * of listeners no matter how many call `useBreakpoints()`.
 *
 * Breakpoints
 *   mobile   <  600px   single pane, cart lives in a floating action sheet
 *   tablet   <  1024px  single pane, roomier density
 *   laptop   <  1440px  dual pane
 *   desktop  >= 1440px  dual pane, wider gutters
 *
 * `isCompact` (< 1024px) is the switch that drives the action-sheet layout —
 * an iPad in portrait is compact, the same iPad in landscape is not.
 */

import { computed, readonly, ref } from "vue";

export const BREAKPOINTS = Object.freeze({
	mobile: 0,
	tablet: 600,
	laptop: 1024,
	desktop: 1440,
});

/** Below this width the checkout collapses to one pane + action sheets. */
export const COMPACT_MAX_WIDTH = BREAKPOINTS.laptop;

const hasWindow = typeof window !== "undefined";
const supportsMatchMedia = hasWindow && typeof window.matchMedia === "function";

const width = ref(hasWindow ? window.innerWidth : 1280);
const height = ref(hasWindow ? window.innerHeight : 800);
const name = ref("laptop");
const pointerCoarse = ref(false);
const reducedMotion = ref(false);
const virtualKeyboardInset = ref(0);

let initialised = false;
const disposers = [];

function resolveName(w) {
	if (w < BREAKPOINTS.tablet) return "mobile";
	if (w < BREAKPOINTS.laptop) return "tablet";
	if (w < BREAKPOINTS.desktop) return "laptop";
	return "desktop";
}

/**
 * Publish the active breakpoint on <html> so pure-CSS rules can react to it
 * without a single Vue re-render (see `[data-pos-bp]` in pos-ui.css).
 */
function syncDocumentAttributes() {
	if (typeof document === "undefined" || !document.documentElement) return;
	const root = document.documentElement;
	root.setAttribute("data-pos-bp", name.value);
	root.setAttribute("data-pos-pointer", pointerCoarse.value ? "coarse" : "fine");
}

function addQueryListener(query, handler) {
	if (!supportsMatchMedia) return;
	const mql = window.matchMedia(query);
	handler(mql.matches);
	const listener = (event) => handler(event.matches);
	// Safari < 14 only implements the deprecated add/removeListener pair.
	if (typeof mql.addEventListener === "function") {
		mql.addEventListener("change", listener);
		disposers.push(() => mql.removeEventListener("change", listener));
	} else if (typeof mql.addListener === "function") {
		mql.addListener(listener);
		disposers.push(() => mql.removeListener(listener));
	}
}

function readViewport() {
	if (!hasWindow) return;
	// visualViewport tracks the area *not* covered by the on-screen keyboard,
	// which is what a sheet or docked bar actually has to fit into.
	const vv = window.visualViewport;
	width.value = window.innerWidth;
	height.value = vv ? Math.round(vv.height) : window.innerHeight;
	virtualKeyboardInset.value = vv ? Math.max(0, Math.round(window.innerHeight - vv.height)) : 0;
	const next = resolveName(width.value);
	if (next !== name.value) name.value = next;
	syncDocumentAttributes();
}

function init() {
	if (initialised || !hasWindow) return;
	initialised = true;

	// One listener per threshold instead of a width watcher.
	Object.entries(BREAKPOINTS)
		.filter(([, min]) => min > 0)
		.forEach(([, min]) => addQueryListener(`(min-width: ${min}px)`, readViewport));

	addQueryListener("(pointer: coarse)", (matches) => {
		pointerCoarse.value = matches;
		syncDocumentAttributes();
	});

	addQueryListener("(prefers-reduced-motion: reduce)", (matches) => {
		reducedMotion.value = matches;
	});

	addQueryListener("(orientation: portrait)", readViewport);

	// Coalesce the remaining viewport reads (keyboard open/close, URL bar
	// collapse) into one write per frame.
	let rafId = null;
	const onViewportChange = () => {
		if (rafId !== null) return;
		rafId = window.requestAnimationFrame(() => {
			rafId = null;
			readViewport();
		});
	};

	window.addEventListener("resize", onViewportChange, { passive: true });
	disposers.push(() => window.removeEventListener("resize", onViewportChange));

	if (window.visualViewport) {
		window.visualViewport.addEventListener("resize", onViewportChange, { passive: true });
		disposers.push(() => window.visualViewport.removeEventListener("resize", onViewportChange));
	}

	readViewport();
}

/** Tear down the shared listeners. Only useful for tests / hot reload. */
export function disposeBreakpoints() {
	disposers.splice(0).forEach((fn) => fn());
	initialised = false;
}

export function useBreakpoints() {
	init();

	const isMobile = computed(() => name.value === "mobile");
	const isTablet = computed(() => name.value === "tablet");
	const isLaptop = computed(() => name.value === "laptop");
	const isDesktop = computed(() => name.value === "desktop");

	return {
		width: readonly(width),
		height: readonly(height),
		breakpoint: readonly(name),
		isMobile,
		isTablet,
		isLaptop,
		isDesktop,
		/** Single-pane layout with floating action sheets. */
		isCompact: computed(() => width.value < COMPACT_MAX_WIDTH),
		/** Side-by-side items + cart. */
		isSplit: computed(() => width.value >= COMPACT_MAX_WIDTH),
		isPortrait: computed(() => height.value >= width.value),
		isTouch: readonly(pointerCoarse),
		prefersReducedMotion: readonly(reducedMotion),
		/** Pixels currently hidden behind the on-screen keyboard. */
		keyboardInset: readonly(virtualKeyboardInset),
	};
}
