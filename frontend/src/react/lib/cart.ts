import type { CartLine, CartTotals, PosItem } from "./types";

/**
 * Cart maths, kept as pure functions so they can be reasoned about (and tested)
 * without a React tree. The reducer in useCart owns the state; this owns the
 * arithmetic.
 */

let lineCounter = 0;

export function newLineId(): string {
	lineCounter += 1;
	return `line-${lineCounter}`;
}

export function lineNet(line: CartLine): number {
	const gross = line.rate * line.qty;
	const discount = gross * (line.discount_percentage / 100);
	return gross - discount;
}

export function lineDiscount(line: CartLine): number {
	return line.rate * line.qty * (line.discount_percentage / 100);
}

export function cartTotals(
	lines: CartLine[],
	additionalDiscount = 0,
): CartTotals {
	let qty = 0;
	let subtotal = 0;
	let itemDiscount = 0;

	for (const line of lines) {
		qty += line.qty;
		subtotal += line.rate * line.qty;
		itemDiscount += lineDiscount(line);
	}

	const afterLineDiscounts = subtotal - itemDiscount;
	// An additional discount larger than the bill would produce a negative
	// total, which the backend rejects — clamp instead of surfacing it later.
	const applied = Math.min(
		Math.max(additionalDiscount, 0),
		afterLineDiscounts,
	);

	return {
		count: lines.length,
		qty,
		subtotal,
		itemDiscount,
		total: afterLineDiscounts - applied,
	};
}

export function lineFromItem(item: PosItem, qty = 1): CartLine {
	return {
		uid: newLineId(),
		item_code: item.item_code,
		item_name: item.item_name,
		stock_uom: item.stock_uom,
		rate: Number(item.rate) || 0,
		qty,
		discount_percentage: 0,
	};
}
