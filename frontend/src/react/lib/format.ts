/**
 * Number and currency formatting.
 *
 * Uses Intl rather than Frappe's formatters so the grid can format thousands of
 * cells without a round trip through the desk's locale machinery. Formatter
 * instances are memoised because constructing Intl.NumberFormat is the
 * expensive part, not calling it.
 */

const currencyFormatters = new Map<string, Intl.NumberFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(precision: number): Intl.NumberFormat {
	const key = String(precision);
	let formatter = currencyFormatters.get(key);
	if (!formatter) {
		formatter = new Intl.NumberFormat(undefined, {
			minimumFractionDigits: precision,
			maximumFractionDigits: precision,
		});
		currencyFormatters.set(key, formatter);
	}
	return formatter;
}

export function formatCurrency(value: unknown, precision = 2): string {
	const amount = Number(value);
	return currencyFormatter(precision).format(
		Number.isFinite(amount) ? amount : 0,
	);
}

export function formatQty(value: unknown, precision = 0): string {
	const key = String(precision);
	let formatter = numberFormatters.get(key);
	if (!formatter) {
		formatter = new Intl.NumberFormat(undefined, {
			maximumFractionDigits: precision,
		});
		numberFormatters.set(key, formatter);
	}
	const amount = Number(value);
	return formatter.format(Number.isFinite(amount) ? amount : 0);
}

/**
 * Currency symbols for the codes a till realistically sees, falling back to the
 * ISO code itself. Intl's `currencyDisplay: "narrowSymbol"` would be nicer but
 * throws on the non-ISO codes some ERPNext installs use.
 */
const SYMBOLS: Record<string, string> = {
	INR: "₹",
	USD: "$",
	EUR: "€",
	GBP: "£",
	AED: "د.إ",
	SAR: "﷼",
	KES: "KSh",
	NGN: "₦",
	JPY: "¥",
	CNY: "¥",
	AUD: "A$",
	CAD: "C$",
};

export function currencySymbol(code?: string): string {
	if (!code) return "";
	return SYMBOLS[code.toUpperCase()] ?? code;
}
