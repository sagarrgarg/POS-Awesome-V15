import {
	Button,
	Callout,
	Dialog,
	Flex,
	SegmentedControl,
	Text,
	TextField,
} from "@radix-ui/themes";
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

	// Opening the sheet pre-fills the exact amount, which is overwhelmingly the
	// common case, and selects it so a different figure just overwrites.
	useEffect(() => {
		if (!open) return undefined;
		setMode(modes[0]?.mode_of_payment ?? "Cash");
		setTendered(due ? due.toFixed(2) : "");
		const timer = setTimeout(() => inputRef.current?.select(), 0);
		return () => clearTimeout(timer);
	}, [open, due, modes]);

	const paid = Number(tendered) || 0;
	const change = useMemo(() => Math.max(0, paid - due), [paid, due]);
	// Float tolerance: 19.99 tendered against 19.99 due must not read as short.
	const short = paid + 0.0001 < due;
	const symbol = currencySymbol(currency);

	return (
		<Dialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
			<Dialog.Content size="2" maxWidth="420px">
				<Flex align="baseline" justify="between" mb="3">
					<Dialog.Title size="3" mb="0">
						{t("Take payment")}
					</Dialog.Title>
					<Text size="6" weight="bold" className="pn-num">
						{symbol}
						{formatCurrency(due)}
					</Text>
				</Flex>

				<Dialog.Description size="1" color="gray" mb="3">
					{t(
						"Choose a payment mode and enter the amount handed over.",
					)}
				</Dialog.Description>

				<SegmentedControl.Root
					size="1"
					value={mode}
					onValueChange={setMode}
					mb="3"
					style={{ width: "100%" }}
				>
					{modes.map((m) => (
						<SegmentedControl.Item
							key={m.mode_of_payment}
							value={m.mode_of_payment}
						>
							{m.mode_of_payment}
						</SegmentedControl.Item>
					))}
				</SegmentedControl.Root>

				<Text as="label" size="1" weight="bold" color="gray">
					{t("Tendered")}
					<TextField.Root
						ref={inputRef}
						size="3"
						mt="1"
						mb="2"
						className="pn-num"
						value={tendered}
						inputMode="decimal"
						autoComplete="off"
						aria-label={t("Amount tendered")}
						onChange={(e) =>
							setTendered(e.target.value.replace(/[^0-9.]/g, ""))
						}
					/>
				</Text>

				<Flex gap="1" wrap="wrap" mb="3">
					<Button
						size="1"
						variant="soft"
						color="gray"
						onClick={() => setTendered(due.toFixed(2))}
					>
						{t("Exact")}
					</Button>
					{QUICK_STEPS.map((step) => (
						<Button
							key={step}
							size="1"
							variant="soft"
							color="gray"
							className="pn-num"
							onClick={() =>
								setTendered(
									String((Number(tendered) || 0) + step),
								)
							}
						>
							+{step}
						</Button>
					))}
				</Flex>

				<Callout.Root size="1" color={short ? "red" : "green"} mb="3">
					<Callout.Text>
						<Flex justify="between" gap="3">
							<span>{short ? t("Short by") : t("Change")}</span>
							<span className="pn-num">
								{symbol}
								{formatCurrency(short ? due - paid : change)}
							</span>
						</Flex>
					</Callout.Text>
				</Callout.Root>

				{error && (
					<Callout.Root size="1" color="red" mb="3">
						<Callout.Text>{error}</Callout.Text>
					</Callout.Root>
				)}

				<Flex gap="2">
					<Button
						size="3"
						variant="soft"
						color="gray"
						className="pn-tap"
						style={{ flex: 1 }}
						disabled={submitting}
						onClick={onCancel}
					>
						{t("Cancel")}
					</Button>
					<Button
						size="3"
						color="green"
						className="pn-tap"
						style={{ flex: 2 }}
						disabled={short || submitting}
						loading={submitting}
						onClick={() =>
							onConfirm([
								{
									mode_of_payment: mode,
									// The invoice is settled in full; any excess cash
									// is change, not an overpayment on the document.
									amount: due,
								},
							])
						}
					>
						{t("Complete sale")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
