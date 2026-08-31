/**
 * Typed access to the Frappe desk globals the POS page runs inside.
 *
 * The React bundle is loaded by a Frappe page, so `frappe` and `__` are already
 * on `window`; nothing here creates them. Everything is defensive because the
 * bundle can also be loaded before the desk finishes booting.
 */

export interface FrappeCallArgs {
	method: string;
	args?: Record<string, unknown>;
}

interface FrappeGlobal {
	call: (opts: {
		method: string;
		args?: Record<string, unknown>;
		callback?: (r: { message?: unknown }) => void;
		error?: (e: unknown) => void;
	}) => Promise<{ message?: unknown }>;
	db: {
		get_doc: (
			doctype: string,
			name?: string,
		) => Promise<Record<string, unknown>>;
	};
	boot?: Record<string, unknown>;
	session?: { user?: string };
	utils?: { is_rtl?: () => boolean };
	realtime?: { on: (evt: string, cb: (...a: unknown[]) => void) => void };
	msgprint?: (msg: string) => void;
	get_route?: () => string[];
	set_route?: (...route: string[]) => void;
}

declare global {
	interface Window {
		frappe?: FrappeGlobal;
		__?: (text: string, replace?: unknown[]) => string;
	}
}

/** Translate. Falls back to the source string outside the desk. */
export function t(text: string, replace?: unknown[]): string {
	const translate = window.__;
	return typeof translate === "function" ? translate(text, replace) : text;
}

export function getFrappe(): FrappeGlobal | undefined {
	return window.frappe;
}

/**
 * Call a whitelisted server method.
 *
 * Returns `message` directly rather than the envelope, and throws on failure so
 * callers can use try/catch instead of checking two shapes.
 */
export async function call<T = unknown>(
	method: string,
	args: Record<string, unknown> = {},
): Promise<T> {
	const frappe = getFrappe();
	if (!frappe?.call) {
		throw new Error("Frappe is not available on this page");
	}
	const response = await frappe.call({ method, args });
	return response?.message as T;
}

export async function getDoc<T = Record<string, unknown>>(
	doctype: string,
	name?: string,
): Promise<T> {
	const frappe = getFrappe();
	if (!frappe?.db?.get_doc) {
		throw new Error("Frappe is not available on this page");
	}
	return (await frappe.db.get_doc(doctype, name)) as T;
}
