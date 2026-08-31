import { useEffect, useMemo, useRef, useState } from "react";
import { currencySymbol, formatCurrency } from "../lib/format";
import { t } from "../lib/frappe";
import type { InvoicePayment } from "../lib/sale";

interface PaymentSheetProps {
	open: boolean;
	due: number;
	currency: string;
	modes: InvoicePayment[];
	submitting: boolean;
	error: string | null;
	onCancel: () => void;
	onConfirm: (payments: InvoicePayment[]) => void;
}

/** Notes a cashier is handed most often; saves typing the common exact amounts. */
const QUICK_STEPS = [50, 100, 200, 500, 2000];

export function PaymentSheet({
	open,
	due,
	currency,
	modes,
	submitting,
	error,
	onCancel,
	onConfirm,
}: PaymentSheetProps) {
	const [mode, setMode] = useState(() => modes[0]?.mode_of_payment ?? "Cash");
	const [tendered, setTendered] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	// Opening the sheet pre-fills the exact amount, which is the overwhelmingly
	// common case, and selects it so a different figure just overwrites.
	useEffect(() => {
		if (!open) return;
		setMode(modes[0]?.mode_of_payment ?? "Cash");
		setTendered(due ? String(due.toFixed(2)) : "");
		const timer = setTimeout(() => inputRef.current?.select(), 0);
		return () => clearTimeout(timer);
	}, [open, due, modes]);

	const paid = Number(tendered) || 0;
	const change = useMemo(() => Math.max(0, paid - due), [paid, due]);
	const short = paid + 0.0001 < due;
	const symbol = currencySymbol(currency);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center">
			<div
				role="dialog"
				aria-modal="true"
				aria-label={t("Take payment")}
				className="w-full max-w-md rounded-t-lg border border-line bg-surface p-3 sm:rounded-lg"
			>
				<div className="mb-2 flex items-baseline justify-between">
					<h2 className="text-sm font-bold">{t("Take payment")}</h2>
					<span className="pn-num text-xl font-extrabold">
						{symbol}
						{formatCurrency(due)}
					</span>
				</div>

				<div className="mb-2 flex flex-wrap gap-1">
					{modes.map((m) => (
						<button
							key={m.mode_of_payment}
							type="button"
							onClick={() => setMode(m.mode_of_payment)}
							aria-pressed={m.mode_of_payment === mode}
							className={[
								"pn-tap pn-focus rounded border px-2.5 py-1.5 text-xs font-semibold",
								m.mode_of_payment === mode
									? "border-crayon-blue bg-crayon-blue text-white"
									: "border-line-strong bg-white text-ink",
							].join(" ")}
						>
							{m.mode_of_payment}
						</button>
					))}
				</div>

				<label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted">
					{t("Tendered")}
				</label>
				<input
					ref={inputRef}
					value={tendered}
					onChange={(e) =>
						setTendered(e.target.value.replace(/[^0-9.]/g, ""))
					}
					inputMode="decimal"
					autoComplete="off"
					className="pn-num pn-focus mb-2 h-11 w-full rounded border border-line-strong px-2 text-lg font-bold outline-none"
					aria-label={t("Amount tendered")}
				/>

				<div className="mb-2 flex flex-wrap gap-1">
					<button
						type="button"
						onClick={() => setTendered(due.toFixed(2))}
						className="pn-tap pn-focus rounded border border-line-strong px-2 py-1 text-2xs font-semibold"
					>
						{t("Exact")}
					</button>
					{QUICK_STEPS.map((step) => (
						<button
							key={step}
							type="button"
							onClick={() =>
								setTendered(
									String((Number(tendered) || 0) + step),
								)
							}
							className="pn-tap pn-focus pn-num rounded border border-line-strong px-2 py-1 text-2xs font-semibold"
						>
							+{step}
						</button>
					))}
				</div>

				<div className="mb-2 flex justify-between rounded bg-canvas px-2 py-1.5 text-xs">
					<span className="font-semibold text-muted">
						{short ? t("Short by") : t("Change")}
					</span>
					<span
						className={`pn-num font-bold ${short ? "text-crayon-red" : "text-crayon-green"}`}
					>
						{symbol}
						{formatCurrency(short ? due - paid : change)}
					</span>
				</div>

				{error && (
					<p className="mb-2 text-xs text-crayon-red">{error}</p>
				)}

				<div className="flex gap-2">
					<button
						type="button"
						onClick={onCancel}
						disabled={submitting}
						className="pn-tap pn-focus h-11 flex-1 rounded-md border border-line-strong text-sm font-bold disabled:opacity-40"
					>
						{t("Cancel")}
					</button>
					<button
						type="button"
						onClick={() =>
							onConfirm([
								{
									mode_of_payment: mode,
									// The invoice is settled in full; any excess cash is
									// change, not an overpayment on the document.
									amount: due,
								},
							])
						}
						disabled={short || submitting}
						className="pn-tap pn-focus h-11 flex-[2] rounded-md bg-crayon-green text-sm font-extrabold uppercase tracking-wide text-white disabled:bg-line-strong disabled:text-muted"
					>
						{submitting ? t("Submitting…") : t("Complete sale")}
					</button>
				</div>
			</div>
		</div>
	);
}
