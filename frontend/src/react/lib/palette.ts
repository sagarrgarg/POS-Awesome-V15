import type { ThemeProps } from "@radix-ui/themes";

type AccentColor = NonNullable<ThemeProps["accentColor"]>;

/**
 * Crayon palette for item tiles, drawn entirely from Radix's own colour scales.
 *
 * No hardcoded hex values: each entry names a Radix accent scale, and tiles
 * paint with `var(--{scale}-9)` (the "solid" step Radix uses for filled
 * buttons) over `var(--{scale}-contrast)` for the label. That keeps the tiles
 * inside the design system, gives correct contrast for free, and means they
 * follow light/dark appearance without a second palette.
 */
export const CRAYONS: readonly AccentColor[] = [
	"blue",
	"teal",
	"green",
	"orange",
	"purple",
	"pink",
	"cyan",
	"lime",
	"indigo",
	"crimson",
	"amber",
	"jade",
] as const;

/**
 * Stable colour for a key. The same item group always gets the same crayon, so
 * a cashier learns "the teal ones are drinks" instead of re-reading every tile.
 */
export function crayonFor(key: string | undefined | null): AccentColor {
	if (!key) return CRAYONS[0];
	let hash = 0;
	for (let i = 0; i < key.length; i += 1) {
		// Cheap deterministic string hash (djb2-ish), kept in 32-bit range.
		hash = (hash * 33 + key.charCodeAt(i)) | 0;
	}
	return CRAYONS[Math.abs(hash) % CRAYONS.length];
}

/** Inline style for a solid tile in the given Radix scale. */
export function solidFill(color: AccentColor): React.CSSProperties {
	return {
		backgroundColor: `var(--${color}-9)`,
		color: `var(--${color}-contrast)`,
	};
}
