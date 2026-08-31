/** Shapes returned by the posawesome API, narrowed to what this screen uses. */

export interface PosProfile {
	name: string;
	company: string;
	currency: string;
	warehouse: string;
	selling_price_list: string;
	customer?: string;
	posa_input_qty?: 0 | 1;
	posa_hide_variants_items?: 0 | 1;
	posa_allow_return?: 0 | 1;
	posa_allow_user_to_edit_additional_discount?: 0 | 1;
	posa_use_percentage_discount?: 0 | 1;
	[key: string]: unknown;
}

export interface PosItem {
	item_code: string;
	item_name: string;
	item_group?: string;
	stock_uom?: string;
	rate: number;
	actual_qty?: number;
	image?: string | null;
	description?: string | null;
	barcode?: string | null;
	item_barcode?: Array<{ barcode?: string }> | string | null;
	has_batch_no?: 0 | 1;
	has_serial_no?: 0 | 1;
	variant_of?: string | null;
}

/** A line in the cart. `uid` is local only — the server never sees it. */
export interface CartLine {
	uid: string;
	item_code: string;
	item_name: string;
	stock_uom?: string;
	rate: number;
	qty: number;
	/** Per-line discount as a percentage of `rate`. */
	discount_percentage: number;
}

export interface CartTotals {
	count: number;
	qty: number;
	subtotal: number;
	itemDiscount: number;
	total: number;
}

export interface Customer {
	name: string;
	customer_name: string;
}
