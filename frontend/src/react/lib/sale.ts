import { call } from "./frappe";
import { lineNet } from "./cart";
import type { CartLine, PosProfile } from "./types";

/**
 * Turning a cart into a submitted invoice.
 *
 * Deliberately thin: the draft is saved server-side first and every total,
 * tax and rounding value is read back off that saved document. Recomputing
 * grand totals in the browser is how a POS ends up taking the wrong amount of
 * money, so nothing here does arithmetic the server already owns.
 *
 * Not handled by this path (still only in the Vue screen): offers and coupons,
 * batch/serial selection, product bundles, multi-currency, returns and
 * loyalty. Those flows have not been ported yet.
 */

export interface DraftInvoice {
	name?: string;
	doctype?: string;
	grand_total?: number;
	rounded_total?: number;
	payments?: InvoicePayment[];
	[key: string]: unknown;
}

export interface InvoicePayment {
	mode_of_payment: string;
	amount: number;
	default?: 0 | 1;
	[key: string]: unknown;
}

function invoiceItems(lines: CartLine[], profile: PosProfile) {
	return lines.map((line) => ({
		item_code: line.item_code,
		item_name: line.item_name,
		qty: line.qty,
		uom: line.stock_uom,
		stock_uom: line.stock_uom,
		conversion_factor: 1,
		rate: line.rate,
		price_list_rate: line.rate,
		discount_percentage: line.discount_percentage,
		amount: lineNet(line),
		warehouse: profile.warehouse,
	}));
}

/**
 * Persist the cart as a draft and return the server's version of it, which is
 * the first point at which taxes and the grand total are known.
 */
export async function saveDraft(
	lines: CartLine[],
	profile: PosProfile,
	customer: string,
	existing?: DraftInvoice | null,
): Promise<DraftInvoice> {
	const doc: DraftInvoice = {
		...(existing?.name ? existing : {}),
		doctype: profile.create_pos_invoice_instead_of_sales_invoice
			? "POS Invoice"
			: "Sales Invoice",
		is_pos: 1,
		update_stock: 1,
		ignore_pricing_rule: 1,
		company: profile.company,
		pos_profile: profile.name,
		currency: profile.currency,
		conversion_rate: 1,
		price_list_currency: profile.currency,
		plc_conversion_rate: 1,
		selling_price_list: profile.selling_price_list,
		customer,
		is_return: 0,
		items: invoiceItems(lines, profile),
	};

	return call<DraftInvoice>(
		"posawesome.posawesome.api.invoices.update_invoice",
		{
			data: JSON.stringify(doc),
		},
	);
}

/** Submit a saved draft with the tendered payments attached. */
export async function submitSale(
	invoice: DraftInvoice,
	payments: InvoicePayment[],
	profile: PosProfile,
): Promise<DraftInvoice> {
	const doc: DraftInvoice = { ...invoice, payments };

	return call<DraftInvoice>(
		"posawesome.posawesome.api.invoices.submit_invoice",
		{
			invoice: doc,
			data: JSON.stringify({
				pos_profile: profile.name,
				// The server subtracts change from the tendered cash line; a sale that
				// is tendered exactly has none.
				total_change: 0,
				credit_change: 0,
				redeemed_customer_credit: 0,
				customer_credit_dict: [],
				is_cashback: 0,
			}),
		},
	);
}

/**
 * Payment modes for the tender sheet.
 *
 * Read off the POS Profile's own child table rather than a separate call, so
 * the modes always match what the shift was opened against.
 */
export function paymentModes(profile: PosProfile): InvoicePayment[] {
	const rows = (profile.payments as InvoicePayment[] | undefined) ?? [];
	if (!rows.length)
		return [{ mode_of_payment: "Cash", amount: 0, default: 1 }];
	return rows.map((row) => ({
		mode_of_payment: row.mode_of_payment,
		amount: 0,
		default: row.default,
	}));
}
