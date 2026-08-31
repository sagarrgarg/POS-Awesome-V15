import { useCallback, useEffect, useMemo, useState } from "react";
import { CartPanel } from "./components/CartPanel";
import { ItemGrid } from "./components/ItemGrid";
import { PaymentSheet } from "./components/PaymentSheet";
import { PosHeader } from "./components/PosHeader";
import { useCart } from "./hooks/useCart";
import { useItems } from "./hooks/useItems";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { usePosSession } from "./hooks/usePosSession";
import { t } from "./lib/frappe";
import {
	paymentModes,
	saveDraft,
	submitSale,
	type DraftInvoice,
	type InvoicePayment,
} from "./lib/sale";
import type { PosItem } from "./lib/types";

/** Below this the cart becomes a bottom sheet instead of a second column. */
const SPLIT_MIN_WIDTH = 900;

function useIsSplit(): boolean {
	const [split, setSplit] = useState(
		() => window.innerWidth >= SPLIT_MIN_WIDTH,
	);
	useEffect(() => {
		// matchMedia rather than a resize listener: this fires only when the
		// threshold is actually crossed, not once per resize frame.
		const query = window.matchMedia(`(min-width: ${SPLIT_MIN_WIDTH}px)`);
		const onChange = (e: MediaQueryListEvent) => setSplit(e.matches);
		setSplit(query.matches);
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);
	return split;
}

export default function App() {
	const online = useOnlineStatus();
	const session = usePosSession();
	const split = useIsSplit();

	const [group, setGroup] = useState("ALL");
	const [search, setSearch] = useState("");
	const [cartOpen, setCartOpen] = useState(false);

	const { items, groups, loading, error } = useItems(
		session.profile,
		group,
		search,
	);
	const cart = useCart();

	const [paying, setPaying] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [draft, setDraft] = useState<DraftInvoice | null>(null);
	const [payError, setPayError] = useState<string | null>(null);

	const currency = session.profile?.currency ?? "";
	const customer = (session.profile?.customer as string) ?? "";
	const modes = useMemo(
		() => (session.profile ? paymentModes(session.profile) : []),
		[session.profile],
	);

	// Depend on the individual callbacks rather than the cart object so the
	// handlers below keep a stable identity across unrelated re-renders.
	const addToCart = cart.add;
	const clearCart = cart.clear;

	/**
	 * Enter in the search box commits the single remaining match, which is what
	 * a hardware scanner produces: a code, then Return.
	 */
	const onSearchEnter = useCallback(() => {
		if (items.length === 1) {
			addToCart(items[0]);
			setSearch("");
		}
	}, [items, addToCart]);

	// Stable identity, so the memoised item tiles are not all re-rendered every
	// time anything unrelated on the screen changes.
	const onPick = useCallback((item: PosItem) => addToCart(item), [addToCart]);

	/**
	 * Save the draft before showing the tender sheet, so the amount due is the
	 * server's grand total (taxes included) rather than a browser estimate.
	 */
	const startPayment = useCallback(async () => {
		if (!session.profile || !cart.lines.length) return;
		setPayError(null);
		setSubmitting(true);
		try {
			const saved = await saveDraft(
				cart.lines,
				session.profile,
				customer,
				draft,
			);
			setDraft(saved);
			setPaying(true);
		} catch (e) {
			setPayError(e instanceof Error ? e.message : String(e));
			setPaying(true);
		} finally {
			setSubmitting(false);
		}
	}, [cart.lines, session.profile, customer, draft]);

	const confirmPayment = useCallback(
		async (payments: InvoicePayment[]) => {
			if (!draft || !session.profile) return;
			setSubmitting(true);
			setPayError(null);
			try {
				await submitSale(draft, payments, session.profile);
				clearCart();
				setDraft(null);
				setPaying(false);
				setCartOpen(false);
				setSearch("");
			} catch (e) {
				setPayError(e instanceof Error ? e.message : String(e));
			} finally {
				setSubmitting(false);
			}
		},
		[draft, session.profile, clearCart],
	);

	if (session.loading) {
		return (
			<div className="posnext-root items-center justify-center">
				<p className="text-xs text-muted">{t("Loading POS…")}</p>
			</div>
		);
	}

	if (!session.profile) {
		return (
			<div className="posnext-root items-center justify-center gap-2">
				<p className="text-sm font-semibold">
					{t("No open POS shift")}
				</p>
				<p className="max-w-xs text-center text-xs text-muted">
					{t(
						"Open a shift from the classic POS screen, then reload this page.",
					)}
				</p>
				<button
					type="button"
					onClick={session.reload}
					className="pn-tap pn-focus rounded border border-line-strong px-3 py-1.5 text-xs font-semibold"
				>
					{t("Retry")}
				</button>
			</div>
		);
	}

	// Due is the server's grand total once a draft exists; before that the cart
	// subtotal is only ever used to enable the button, never to take money.
	const due = Number(
		draft?.rounded_total || draft?.grand_total || cart.totals.total,
	);

	const cartPanel = (
		<CartPanel
			lines={cart.lines}
			totals={cart.totals}
			currency={currency}
			customerName={customer}
			busy={submitting}
			onStep={cart.step}
			onRemove={cart.remove}
			onClear={cart.clear}
			onPay={startPayment}
		/>
	);

	return (
		<div className="posnext-root">
			<PosHeader profileName={session.profile.name} online={online} />

			<main
				className={
					split
						? "grid min-h-0 flex-1 grid-cols-[1fr_360px] overflow-hidden"
						: "flex min-h-0 flex-1 flex-col overflow-hidden"
				}
			>
				<ItemGrid
					items={items}
					groups={groups}
					group={group}
					search={search}
					loading={loading}
					error={error}
					currency={currency}
					onGroupChange={setGroup}
					onSearchChange={setSearch}
					onPick={onPick}
					onSearchEnter={onSearchEnter}
				/>

				{split && cartPanel}
			</main>

			{/* Compact: the cart is a sheet, and a fixed bar keeps the total and
			    the pay action one tap away without stealing grid height. */}
			{!split && (
				<>
					<div
						className={[
							"fixed inset-x-0 bottom-0 z-40 flex flex-col bg-surface transition-transform duration-200",
							cartOpen ? "translate-y-0" : "translate-y-full",
						].join(" ")}
						style={{ top: "var(--posnext-top)" }}
						aria-hidden={!cartOpen}
					>
						<button
							type="button"
							onClick={() => setCartOpen(false)}
							className="pn-tap h-8 shrink-0 border-b border-line text-xs font-semibold text-muted"
						>
							{t("Close cart")}
						</button>
						<div className="flex min-h-0 flex-1 flex-col">
							{cartPanel}
						</div>
					</div>

					<div className="flex h-14 shrink-0 items-center gap-2 border-t border-line bg-surface px-2">
						<button
							type="button"
							onClick={() => setCartOpen(true)}
							className="pn-tap pn-focus relative h-10 rounded border border-line-strong px-3 text-xs font-bold"
						>
							{t("Cart")}
							{cart.totals.count > 0 && (
								<span className="pn-num absolute -right-1.5 -top-1.5 rounded-full bg-crayon-orange px-1.5 text-2xs font-bold text-white">
									{cart.totals.count}
								</span>
							)}
						</button>
						<span className="pn-num flex-1 truncate text-lg font-extrabold">
							{cart.totals.total.toFixed(2)}
						</span>
						<button
							type="button"
							onClick={startPayment}
							disabled={!cart.lines.length || submitting}
							className="pn-tap pn-focus h-10 rounded-md bg-crayon-green px-5 text-sm font-extrabold uppercase text-white disabled:bg-line-strong disabled:text-muted"
						>
							{t("Pay")}
						</button>
					</div>
				</>
			)}

			<PaymentSheet
				open={paying}
				due={due}
				currency={currency}
				modes={modes}
				submitting={submitting}
				error={payError}
				onCancel={() => {
					setPaying(false);
					setPayError(null);
				}}
				onConfirm={confirmPayment}
			/>
		</div>
	);
}
