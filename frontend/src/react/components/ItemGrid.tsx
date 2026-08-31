import {
	Box,
	Flex,
	Grid,
	ScrollArea,
	Separator,
	Skeleton,
	Text,
	TextField,
} from "@radix-ui/themes";
import { memo } from "react";
import { currencySymbol, formatCurrency, formatQty } from "../lib/format";
import { t } from "../lib/frappe";
import { crayonFor, solidFill } from "../lib/palette";
import type { PosItem } from "../lib/types";

interface ItemTileProps {
	item: PosItem;
	currency: string;
	onPick: (item: PosItem) => void;
}

/**
 * A solid crayon tile, the way a real till looks: colour carries the category,
 * the name is the only thing that needs reading, and the price sits in a fixed
 * position so the eye can scan a column of them.
 *
 * Painted with Radix's own solid step (`--{scale}-9`) and its matching contrast
 * colour rather than hand-picked hexes, so tiles stay legible in both
 * appearances and inside the design system.
 */
const ItemTile = memo(function ItemTile({
	item,
	currency,
	onPick,
}: ItemTileProps) {
	const stock = Number(item.actual_qty ?? 0);

	return (
		<Box
			asChild
			style={{
				...solidFill(crayonFor(item.item_group ?? item.item_code)),
				border: "none",
				padding: 0,
				cursor: "pointer",
				textAlign: "start",
				borderRadius: "var(--radius-3)",
			}}
		>
			<button
				type="button"
				className="pn-tap"
				onClick={() => onPick(item)}
				title={`${item.item_name} · ${item.item_code}`}
			>
				<Flex
					direction="column"
					justify="between"
					height="72px"
					p="2"
					gap="1"
				>
					<Text size="1" weight="bold" style={{ lineHeight: 1.2 }}>
						{item.item_name}
					</Text>
					<Flex align="baseline" justify="between" gap="1">
						<Text size="2" weight="bold" className="pn-num">
							{currencySymbol(currency)}
							{formatCurrency(item.rate)}
						</Text>
						{/* Negative stock is the one thing worth flagging on a tile. */}
						<Text
							size="1"
							className="pn-num"
							weight={stock < 0 ? "bold" : "regular"}
							style={{ opacity: stock < 0 ? 1 : 0.75 }}
						>
							{formatQty(stock)}
						</Text>
					</Flex>
				</Flex>
			</button>
		</Box>
	);
});

interface ItemGridProps {
	items: PosItem[];
	groups: string[];
	group: string;
	search: string;
	loading: boolean;
	error: string | null;
	currency: string;
	onGroupChange: (group: string) => void;
	onSearchChange: (value: string) => void;
	onPick: (item: PosItem) => void;
	onSearchEnter: () => void;
}

export function ItemGrid({
	items,
	groups,
	group,
	search,
	loading,
	error,
	currency,
	onGroupChange,
	onSearchChange,
	onPick,
	onSearchEnter,
}: ItemGridProps) {
	return (
		<Flex
			direction="column"
			minHeight="0"
			minWidth="0"
			aria-label={t("Items")}
			asChild
		>
			<section>
				{/* Fixed header: search and groups never scroll away. */}
				<Box p="2" flexShrink="0">
					<TextField.Root
						size="2"
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") onSearchEnter();
						}}
						placeholder={t("Scan barcode or search items")}
						aria-label={t("Search items")}
						autoFocus
						autoComplete="off"
					/>

					<ScrollArea
						scrollbars="horizontal"
						type="hover"
						style={{ marginTop: "var(--space-2)" }}
					>
						<Flex gap="1" pb="1">
							{groups.map((name) => {
								const active = name === group;
								return (
									<Box
										key={name}
										asChild
										flexShrink="0"
										px="2"
										py="1"
										style={{
											borderRadius: "var(--radius-6)",
											cursor: "pointer",
											border: "1px solid var(--gray-a6)",
											background: active
												? "var(--accent-9)"
												: "var(--color-panel-solid)",
											color: active
												? "var(--accent-contrast)"
												: "var(--gray-11)",
										}}
									>
										<button
											type="button"
											className="pn-tap"
											aria-pressed={active}
											onClick={() => onGroupChange(name)}
										>
											<Text size="1" weight="bold">
												{name}
											</Text>
										</button>
									</Box>
								);
							})}
						</Flex>
					</ScrollArea>
				</Box>

				<Separator size="4" />

				{/* The only scrollable region on this side of the screen. */}
				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ flex: 1, minHeight: 0 }}
				>
					<Box p="2">
						{error ? (
							<Text size="1" color="red">
								{error}
							</Text>
						) : loading ? (
							<Grid
								columns="repeat(auto-fill, minmax(116px, 1fr))"
								gap="2"
							>
								{Array.from({ length: 18 }, (_, i) => (
									<Skeleton key={i} height="72px" />
								))}
							</Grid>
						) : items.length === 0 ? (
							<Text size="1" color="gray">
								{t("No items match this search.")}
							</Text>
						) : (
							<Grid
								columns="repeat(auto-fill, minmax(116px, 1fr))"
								gap="2"
							>
								{items.map((item) => (
									<ItemTile
										key={item.item_code}
										item={item}
										currency={currency}
										onPick={onPick}
									/>
								))}
							</Grid>
						)}
					</Box>
				</ScrollArea>
			</section>
		</Flex>
	);
}
