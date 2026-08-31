import {
	Box,
	Button,
	Flex,
	IconButton,
	ScrollArea,
	Separator,
	Text,
} from "@radix-ui/themes";
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
		<Flex
			align="center"
			gap="2"
			px="2"
			py="1"
			asChild
			// The row rule is a border rather than a <Separator> sibling: a bare
			// <div> between <li>s is invalid inside a <ul>.
			style={{ borderBottom: "1px solid var(--gray-a5)" }}
		>
			<li>
				<Box minWidth="0" flexGrow="1">
					<Text as="div" size="1" weight="bold" truncate>
						{line.item_name}
					</Text>
					<Text as="div" size="1" color="gray" className="pn-num">
						{currencySymbol(currency)}
						{formatCurrency(line.rate)}
						{line.discount_percentage > 0
							? ` · −${formatQty(line.discount_percentage)}%`
							: ""}
					</Text>
				</Box>

				{/* Stepper. Minus on the last unit removes the line, which is
					    what a cashier means by decrementing to zero. */}
				<Flex align="center" gap="1" flexShrink="0">
					<IconButton
						size="1"
						variant="soft"
						color="red"
						className="pn-tap"
						aria-label={t("Decrease quantity")}
						onClick={() => onStep(line.uid, -1)}
					>
						−
					</IconButton>
					<Text
						size="2"
						weight="bold"
						className="pn-num"
						style={{ minWidth: "2ch", textAlign: "center" }}
					>
						{formatQty(line.qty, 2)}
					</Text>
					<IconButton
						size="1"
						variant="soft"
						color="green"
						className="pn-tap"
						aria-label={t("Increase quantity")}
						onClick={() => onStep(line.uid, 1)}
					>
						+
					</IconButton>
				</Flex>

				<Text
					size="2"
					weight="bold"
					className="pn-num"
					style={{ minWidth: "5ch", textAlign: "end" }}
				>
					{formatCurrency(lineNet(line))}
				</Text>

				<IconButton
					size="1"
					variant="ghost"
					color="gray"
					className="pn-tap"
					aria-label={t("Remove item")}
					onClick={() => onRemove(line.uid)}
				>
					×
				</IconButton>
			</li>
		</Flex>
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
		<Flex
			direction="column"
			minHeight="0"
			minWidth="0"
			aria-label={t("Cart")}
			style={{
				background: "var(--color-panel-solid)",
				// The divider lives here rather than as a third grid child, so the
				// two-column track definition stays honest.
				borderInlineStart: "1px solid var(--gray-a6)",
			}}
			asChild
		>
			<section>
				{/* Fixed cart header. */}
				<Flex
					align="center"
					justify="between"
					gap="2"
					px="2"
					py="1"
					flexShrink="0"
				>
					<Box minWidth="0">
						<Text as="div" size="1" weight="bold" truncate>
							{customerName || t("Walk-in Customer")}
						</Text>
						<Text as="div" size="1" color="gray" className="pn-num">
							{totals.count}{" "}
							{totals.count === 1 ? t("line") : t("lines")} ·{" "}
							{formatQty(totals.qty, 2)} {t("qty")}
						</Text>
					</Box>
					<Button
						size="1"
						variant="soft"
						color="red"
						className="pn-tap"
						disabled={!lines.length}
						onClick={onClear}
					>
						{t("Clear")}
					</Button>
				</Flex>

				<Separator size="4" />

				{/* The only scrollable region on this side of the screen. */}
				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ flex: 1, minHeight: 0 }}
				>
					<Box asChild>
						<ul
							style={{ listStyle: "none", margin: 0, padding: 0 }}
						>
							{lines.length === 0 ? (
								<Box p="4">
									<Text
										as="div"
										size="1"
										color="gray"
										align="center"
									>
										{t("Tap an item to start a sale.")}
									</Text>
								</Box>
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
					</Box>
				</ScrollArea>

				<Separator size="4" />

				{/* Fixed totals and the primary action. */}
				<Box p="2" flexShrink="0">
					<Flex direction="column" gap="1" mb="2">
						<Flex justify="between">
							<Text size="1" color="gray">
								{t("Subtotal")}
							</Text>
							<Text size="1" color="gray" className="pn-num">
								{symbol}
								{formatCurrency(totals.subtotal)}
							</Text>
						</Flex>
						{totals.itemDiscount > 0 && (
							<Flex justify="between">
								<Text size="1" color="orange">
									{t("Discount")}
								</Text>
								<Text
									size="1"
									color="orange"
									className="pn-num"
								>
									−{symbol}
									{formatCurrency(totals.itemDiscount)}
								</Text>
							</Flex>
						)}
						<Flex align="baseline" justify="between" pt="1">
							<Text size="1" weight="bold" color="gray">
								{t("Total")}
							</Text>
							<Text size="7" weight="bold" className="pn-num">
								{symbol}
								{formatCurrency(totals.total)}
							</Text>
						</Flex>
					</Flex>

					<Button
						size="3"
						color="green"
						className="pn-tap"
						style={{ width: "100%" }}
						disabled={!lines.length || busy}
						loading={busy}
						onClick={onPay}
					>
						{t("Pay")}
					</Button>
				</Box>
			</section>
		</Flex>
	);
}
