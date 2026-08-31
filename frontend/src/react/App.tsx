import {
	Badge,
	Box,
	Button,
	Flex,
	Grid,
	Separator,
	Spinner,
	Text,
} from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CartPanel } from "./components/CartPanel";
import { ItemGrid } from "./components/ItemGrid";
import { PaymentSheet } from "./components/PaymentSheet";
import { PosHeader } from "./components/PosHeader";
import { useCart } from "./hooks/useCart";
import { useItems } from "./hooks/useItems";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { usePosSession } from "./hooks/usePosSession";
import { currencySymbol, formatCurrency } from "./lib/format";
import { t } from "./lib/frappe";
import {
	paymentModes,
	saveDraft,
	submitSale,
	type DraftInvoice,
	type InvoicePayment,
} from "./lib/sale";
import type { PosItem } from "./lib/types";

/** Below this the cart becomes a sheet instead of a second column. */
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
			<Flex align="center" justify="center" gap="2" flexGrow="1">
				<Spinner />
				<Text size="2" color="gray">
					{t("Loading POS…")}
				</Text>
			</Flex>
		);
	}

	if (!session.profile) {
		return (
			<Flex
				align="center"
				justify="center"
				direction="column"
				gap="2"
				flexGrow="1"
				p="4"
			>
				<Text size="3" weight="bold">
					{t("No open POS shift")}
				</Text>
				<Text
					size="1"
					color="gray"
					align="center"
					style={{ maxWidth: "22rem" }}
				>
					{t(
						"Open a shift from the classic POS screen, then reload this page.",
					)}
				</Text>
				<Button size="2" variant="soft" onClick={session.reload}>
					{t("Retry")}
				</Button>
			</Flex>
		);
	}

	// Due is the server's grand total once a draft exists; before that the cart
	// subtotal is only ever used to enable the button, never to take money.
	// `rounded_total` is legitimately 0 when rounding is disabled, so falling
	// through on a falsy value is the behaviour we want here.
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
		<>
			<PosHeader profileName={session.profile.name} online={online} />

			{split ? (
				<Grid
					columns="1fr 360px"
					flexGrow="1"
					minHeight="0"
					overflow="hidden"
					asChild
				>
					<main>
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
						{cartPanel}
					</main>
				</Grid>
			) : (
				<Flex
					direction="column"
					flexGrow="1"
					minHeight="0"
					overflow="hidden"
					asChild
				>
					<main>
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
					</main>
				</Flex>
			)}

			{/* Compact: the cart slides over, and a fixed bar keeps the total and
			    the pay action one tap away without stealing grid height. */}
			{!split && (
				<>
					<Box
						position="fixed"
						left="0"
						right="0"
						bottom="0"
						aria-hidden={!cartOpen}
						style={{
							top: "var(--posnext-top)",
							zIndex: 40,
							display: "flex",
							flexDirection: "column",
							background: "var(--color-panel-solid)",
							transform: cartOpen
								? "translateY(0)"
								: "translateY(100%)",
							// `visibility` (not `display`) so the closed sheet keeps
							// its size — opening is one compositor frame — while
							// still being untabbable and hidden from screen readers.
							visibility: cartOpen ? "visible" : "hidden",
							transition: cartOpen
								? "transform 200ms ease-out, visibility 0s"
								: "transform 200ms ease-in, visibility 0s 200ms",
						}}
					>
						<Button
							size="1"
							variant="ghost"
							color="gray"
							className="pn-tap"
							style={{ margin: "var(--space-2)" }}
							onClick={() => setCartOpen(false)}
						>
							{t("Close cart")}
						</Button>
						<Separator size="4" />
						<Flex direction="column" flexGrow="1" minHeight="0">
							{cartPanel}
						</Flex>
					</Box>

					<Separator size="4" />
					<Flex
						align="center"
						gap="2"
						px="2"
						py="2"
						flexShrink="0"
						style={{ background: "var(--color-panel-solid)" }}
					>
						<Button
							size="2"
							variant="soft"
							color="gray"
							className="pn-tap"
							onClick={() => setCartOpen(true)}
						>
							{t("Cart")}
							{cart.totals.count > 0 && (
								<Badge
									color="orange"
									radius="full"
									size="1"
									className="pn-num"
								>
									{cart.totals.count}
								</Badge>
							)}
						</Button>
						<Text
							size="5"
							weight="bold"
							className="pn-num"
							truncate
							style={{ flex: 1 }}
						>
							{currencySymbol(currency)}
							{formatCurrency(cart.totals.total)}
						</Text>
						<Button
							size="3"
							color="green"
							className="pn-tap"
							disabled={!cart.lines.length || submitting}
							loading={submitting}
							onClick={startPayment}
						>
							{t("Pay")}
						</Button>
					</Flex>
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
		</>
	);
}
