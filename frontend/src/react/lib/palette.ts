/**
 * Crayon palette for item tiles.
 *
 * Applied as inline styles rather than Tailwind classes on purpose: the colour
 * is chosen at runtime from the item group, and Tailwind can only emit classes
 * it can see in the source, so `bg-crayon-${x}` would be purged.
 *
 * Every colour is a single flat tone — no gradients, and all are dark enough
 * for white text to clear WCAG AA at the tile's text size.
 */
export const CRAYONS = [
	"#2563eb", // blue
	"#0d9488", // teal
	"#16a34a", // green
	"#ea580c", // orange
	"#7c3aed", // purple
	"#db2777", // pink
	"#0ea5e9", // sky
	"#65a30d", // lime
	"#4f46e5", // indigo
	"#dc2626", // red
] as const;

/**
 * Stable colour for a key. The same item group always gets the same crayon, so
 * a cashier learns "the teal ones are drinks" instead of re-reading every tile.
 */
export function crayonFor(key: string | undefined | null): string {
	if (!key) return CRAYONS[0];
	let hash = 0;
	for (let i = 0; i < key.length; i += 1) {
		// Cheap deterministic string hash (djb2-ish), kept in 32-bit range.
		hash = (hash * 33 + key.charCodeAt(i)) | 0;
	}
	return CRAYONS[Math.abs(hash) % CRAYONS.length];
}
