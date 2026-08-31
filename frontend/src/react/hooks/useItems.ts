import { useEffect, useMemo, useRef, useState } from "react";
import { call } from "../lib/frappe";
import type { PosItem, PosProfile } from "../lib/types";

/** Items pulled per page. Bounded because the grid renders them all. */
const PAGE_SIZE = 500;
/** Keystrokes only become a query after this; the input itself never waits. */
const SEARCH_DEBOUNCE_MS = 90;
/** Below this length a search matches too much to be worth filtering. */
const MIN_QUERY_LENGTH = 2;

interface UseItemsResult {
	items: PosItem[];
	groups: string[];
	loading: boolean;
	error: string | null;
}

/**
 * Loads the item catalogue once per profile/group and filters locally.
 *
 * Local filtering is the point: at a till the catalogue is small enough to hold
 * in memory, and a round trip per keystroke is exactly the latency this screen
 * exists to remove.
 */
export function useItems(
	profile: PosProfile | null,
	group: string,
	search: string,
): UseItemsResult {
	const [items, setItems] = useState<PosItem[]>([]);
	const [groups, setGroups] = useState<string[]>(["ALL"]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Debounced copy of the search box, so typing repaints instantly while the
	// filter still coalesces.
	const [query, setQuery] = useState("");
	useEffect(() => {
		const timer = setTimeout(
			() => setQuery(search.trim().toLowerCase()),
			SEARCH_DEBOUNCE_MS,
		);
		return () => clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		if (!profile) return undefined;
		let cancelled = false;

		(async () => {
			setLoading(true);
			setError(null);
			try {
				const rows = await call<PosItem[]>(
					"posawesome.posawesome.api.items.get_items",
					{
						pos_profile: JSON.stringify(profile),
						price_list: profile.selling_price_list,
						item_group: group === "ALL" ? "" : group.toLowerCase(),
						search_value: "",
						customer: profile.customer ?? null,
						include_image: 1,
						limit: PAGE_SIZE,
					},
				);
				if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
			} catch (e) {
				if (!cancelled)
					setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [profile, group]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const rows = await call<Array<{ name: string }>>(
					"posawesome.posawesome.api.items.get_items_groups",
				);
				if (!cancelled && Array.isArray(rows)) {
					setGroups(["ALL", ...rows.map((r) => r.name)]);
				}
			} catch {
				// A missing group list is not fatal — the grid still works with ALL.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Lowercase haystack per item, built once per item object rather than once
	// per keystroke. Keyed on the object so it is reclaimed with the item.
	const haystacks = useRef(new WeakMap<PosItem, string>());

	const filtered = useMemo(() => {
		let rows = items;

		if (profile?.posa_hide_variants_items) {
			rows = rows.filter((item) => !item.variant_of);
		}

		if (query.length < MIN_QUERY_LENGTH) return rows;

		const terms = query.split(/\s+/).filter(Boolean);
		const cache = haystacks.current;

		return rows.filter((item) => {
			let haystack = cache.get(item);
			if (haystack === undefined) {
				const barcodes = Array.isArray(item.item_barcode)
					? item.item_barcode.map((b) => b?.barcode ?? "")
					: [String(item.item_barcode ?? "")];
				haystack = [
					item.item_code,
					item.item_name,
					item.barcode,
					item.description,
					...barcodes,
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase();
				cache.set(item, haystack);
			}
			const hay = haystack;
			return terms.every((term) => hay.includes(term));
		});
	}, [items, query, profile]);

	return { items: filtered, groups, loading, error };
}
