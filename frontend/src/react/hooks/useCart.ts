import { useCallback, useMemo, useReducer } from "react";
import { cartTotals, lineFromItem } from "../lib/cart";
import type { CartLine, PosItem } from "../lib/types";

type Action =
	| { type: "add"; item: PosItem; qty: number }
	| { type: "setQty"; uid: string; qty: number }
	| { type: "step"; uid: string; delta: number }
	| { type: "setRate"; uid: string; rate: number }
	| { type: "setDiscount"; uid: string; percentage: number }
	| { type: "remove"; uid: string }
	| { type: "clear" };

function reducer(lines: CartLine[], action: Action): CartLine[] {
	switch (action.type) {
		case "add": {
			// Merge into the existing line for the same item rather than stacking
			// duplicates — a cashier scanning the same barcode five times expects
			// one row reading 5, not five rows.
			const index = lines.findIndex(
				(line) =>
					line.item_code === action.item.item_code &&
					line.discount_percentage === 0,
			);
			if (index === -1) {
				return [...lines, lineFromItem(action.item, action.qty)];
			}
			const next = lines.slice();
			next[index] = { ...next[index], qty: next[index].qty + action.qty };
			return next;
		}

		case "setQty":
		case "step": {
			const next: CartLine[] = [];
			for (const line of lines) {
				if (line.uid !== action.uid) {
					next.push(line);
					continue;
				}
				const qty =
					action.type === "setQty"
						? action.qty
						: line.qty + action.delta;
				// Stepping to zero removes the line; that is what the minus button
				// on the last unit should do.
				if (qty > 0) next.push({ ...line, qty });
			}
			return next;
		}

		case "setRate":
			return lines.map((line) =>
				line.uid === action.uid
					? { ...line, rate: Math.max(0, action.rate) }
					: line,
			);

		case "setDiscount":
			return lines.map((line) =>
				line.uid === action.uid
					? {
							...line,
							discount_percentage: Math.min(
								100,
								Math.max(0, action.percentage),
							),
						}
					: line,
			);

		case "remove":
			return lines.filter((line) => line.uid !== action.uid);

		case "clear":
			return [];

		default:
			return lines;
	}
}

export function useCart(additionalDiscount = 0) {
	const [lines, dispatch] = useReducer(reducer, [] as CartLine[]);

	const totals = useMemo(
		() => cartTotals(lines, additionalDiscount),
		[lines, additionalDiscount],
	);

	const add = useCallback(
		(item: PosItem, qty = 1) => dispatch({ type: "add", item, qty }),
		[],
	);
	const step = useCallback(
		(uid: string, delta: number) => dispatch({ type: "step", uid, delta }),
		[],
	);
	const setQty = useCallback(
		(uid: string, qty: number) => dispatch({ type: "setQty", uid, qty }),
		[],
	);
	const setRate = useCallback(
		(uid: string, rate: number) => dispatch({ type: "setRate", uid, rate }),
		[],
	);
	const setDiscount = useCallback(
		(uid: string, percentage: number) =>
			dispatch({ type: "setDiscount", uid, percentage }),
		[],
	);
	const remove = useCallback(
		(uid: string) => dispatch({ type: "remove", uid }),
		[],
	);
	const clear = useCallback(() => dispatch({ type: "clear" }), []);

	// Memoised as a whole: callers put this object in dependency arrays, and a
	// fresh identity every render would defeat the `memo` on every item tile
	// and cart row. The individual callbacks are already stable.
	return useMemo(
		() => ({
			lines,
			totals,
			add,
			step,
			setQty,
			setRate,
			setDiscount,
			remove,
			clear,
		}),
		[lines, totals, add, step, setQty, setRate, setDiscount, remove, clear],
	);
}
