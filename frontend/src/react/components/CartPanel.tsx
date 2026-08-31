import { memo } from "react";
import { lineNet } from "../lib/cart";
import { currencySymbol, formatCurrency, formatQty } from "../lib/format";
import { t } from "../lib/frappe";
import type { CartLine, CartTotals } from "../lib/types";

interface LineRowProps {
	line: CartLine;
	currency: string;
	onStep: (uid: string, delta: number) => void;
	onRemove: (uid: string) => void;
}

const LineRow = memo(function LineRow({
	line,
	currency,
	onStep,
	onRemove,
}: LineRowProps) {
	return (
		<li className="flex items-center gap-2 border-b border-line px-2 py-1.5">
			<div className="min-w-0 flex-1">
				<p className="truncate text-xs font-semibold leading-tight">
					{line.item_name}
				</p>
				<p className="pn-num text-2xs text-muted">
					{currencySymbol(currency)}
					{formatCurrency(line.rate)}
					{line.discount_percentage > 0
						? ` · −${formatQty(line.discount_percentage)}%`
						: ""}
				</p>
			</div>

			{/* Stepper. Minus on the last unit removes the line, which is what a
			    cashier means by decrementing to zero. */}
			<div className="flex items-center gap-0.5">
				<button
					type="button"
					onClick={() => onStep(line.uid, -1)}
					aria-label={t("Decrease quantity")}
					className="pn-tap pn-focus h-7 w-7 rounded border border-line-strong bg-white text-sm font-bold text-crayon-red"
				>
					−
				</button>
				<span className="pn-num w-8 text-center text-sm font-bold">
					{formatQty(line.qty, 2)}
				</span>
				<button
					type="button"
					onClick={() => onStep(line.uid, 1)}
					aria-label={t("Increase quantity")}
					className="pn-tap pn-focus h-7 w-7 rounded border border-line-strong bg-white text-sm font-bold text-crayon-green"
				>
					+
				</button>
			</div>

			<span className="pn-num w-16 shrink-0 text-right text-sm font-bold">
				{formatCurrency(lineNet(line))}
			</span>

			<button
				type="button"
				onClick={() => onRemove(line.uid)}
				aria-label={t("Remove item")}
				className="pn-tap pn-focus h-7 w-6 shrink-0 rounded text-muted hover:text-crayon-red"
			>
				×
			</button>
		</li>
	);
});

interface CartPanelProps {
	lines: CartLine[];
	totals: CartTotals;
	currency: string;
	customerName: string;
	busy: boolean;
	onStep: (uid: string, delta: number) => void;
	onRemove: (uid: string) => void;
	onClear: () => void;
	onPay: () => void;
}

export function CartPanel({
	lines,
	totals,
	currency,
	customerName,
	busy,
	onStep,
	onRemove,
	onClear,
	onPay,
}: CartPanelProps) {
	const symbol = currencySymbol(currency);

	return (
		<section
			className="flex min-h-0 min-w-0 flex-col border-l border-line bg-surface"
			aria-label={t("Cart")}
		>
			{/* Fixed cart header. */}
			<header className="flex items-center justify-between gap-2 border-b border-line px-2 py-1.5">
				<div className="min-w-0">
					<p className="truncate text-xs font-semibold">
						{customerName || t("Walk-in Customer")}
					</p>
					<p className="pn-num text-2xs text-muted">
						{totals.count}{" "}
						{totals.count === 1 ? t("line") : t("lines")} ·{" "}
						{formatQty(totals.qty, 2)} {t("qty")}
					</p>
				</div>
				<button
					type="button"
					onClick={onClear}
					disabled={!lines.length}
					className="pn-tap pn-focus shrink-0 rounded border border-line-strong px-2 py-1 text-2xs font-semibold text-crayon-red disabled:opacity-40"
				>
					{t("Clear")}
				</button>
			</header>

			{/* The only scrollable region on this side of the screen. */}
			<ul className="pn-scroll min-h-0 flex-1">
				{lines.length === 0 ? (
					<li className="p-4 text-center text-xs text-muted">
						{t("Tap an item to start a sale.")}
					</li>
				) : (
					lines.map((line) => (
						<LineRow
							key={line.uid}
							line={line}
							currency={currency}
							onStep={onStep}
							onRemove={onRemove}
						/>
					))
				)}
			</ul>

			{/* Fixed totals + primary action. */}
			<footer className="border-t border-line px-2 py-2">
				<dl className="mb-2 space-y-0.5 text-xs">
					<div className="flex justify-between text-muted">
						<dt>{t("Subtotal")}</dt>
						<dd className="pn-num">
							{symbol}
							{formatCurrency(totals.subtotal)}
						</dd>
					</div>
					{totals.itemDiscount > 0 && (
						<div className="flex justify-between text-crayon-orange">
							<dt>{t("Discount")}</dt>
							<dd className="pn-num">
								−{symbol}
								{formatCurrency(totals.itemDiscount)}
							</dd>
						</div>
					)}
					<div className="flex items-baseline justify-between pt-1">
						<dt className="text-2xs font-bold uppercase tracking-wide text-muted">
							{t("Total")}
						</dt>
						<dd className="pn-num text-2xl font-extrabold leading-none">
							{symbol}
							{formatCurrency(totals.total)}
						</dd>
					</div>
				</dl>

				<button
					type="button"
					onClick={onPay}
					disabled={!lines.length || busy}
					className="pn-tap pn-focus h-12 w-full rounded-md bg-crayon-green text-base font-extrabold uppercase tracking-wide text-white transition-transform duration-100 active:scale-[0.99] disabled:bg-line-strong disabled:text-muted"
				>
					{busy ? t("Working…") : t("Pay")}
				</button>
			</footer>
		</section>
	);
}
