import { memo } from "react";
import { crayonFor } from "../lib/palette";
import { currencySymbol, formatCurrency, formatQty } from "../lib/format";
import { t } from "../lib/frappe";
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
 */
const ItemTile = memo(function ItemTile({
	item,
	currency,
	onPick,
}: ItemTileProps) {
	const colour = crayonFor(item.item_group ?? item.item_code);
	const stock = Number(item.actual_qty ?? 0);

	return (
		<button
			type="button"
			onClick={() => onPick(item)}
			style={{ backgroundColor: colour }}
			className="pn-tap pn-focus flex h-[76px] flex-col justify-between rounded-md p-2 text-left text-white transition-transform duration-100 active:scale-[0.97]"
			title={`${item.item_name} · ${item.item_code}`}
		>
			<span className="line-clamp-2 text-xs font-semibold leading-tight">
				{item.item_name}
			</span>
			<span className="flex items-baseline justify-between gap-1">
				<span className="pn-num text-sm font-bold">
					{currencySymbol(currency)}
					{formatCurrency(item.rate)}
				</span>
				{/* Negative stock is the one thing worth flagging on the tile. */}
				<span
					className={`pn-num text-2xs ${stock < 0 ? "font-bold text-white" : "text-white/70"}`}
				>
					{formatQty(stock)}
				</span>
			</span>
		</button>
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
		<section
			className="flex min-h-0 min-w-0 flex-col"
			aria-label={t("Items")}
		>
			{/* Fixed header: search + groups never scroll away. */}
			<div className="flex flex-col gap-1.5 border-b border-line bg-surface p-2">
				<input
					type="search"
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") onSearchEnter();
					}}
					placeholder={t("Scan barcode or search items")}
					autoFocus
					autoComplete="off"
					className="pn-focus h-9 w-full rounded border border-line-strong bg-white px-2.5 text-sm outline-none placeholder:text-muted"
					aria-label={t("Search items")}
				/>

				<div className="pn-scroll flex gap-1 overflow-x-auto pb-0.5">
					{groups.map((name) => {
						const active = name === group;
						return (
							<button
								key={name}
								type="button"
								onClick={() => onGroupChange(name)}
								aria-pressed={active}
								className={[
									"pn-tap pn-focus shrink-0 rounded-full border px-2.5 py-1 text-2xs font-semibold",
									active
										? "border-crayon-blue bg-crayon-blue text-white"
										: "border-line-strong bg-white text-muted",
								].join(" ")}
							>
								{name}
							</button>
						);
					})}
				</div>
			</div>

			{/* The only scrollable region on this side of the screen. */}
			<div className="pn-scroll min-h-0 flex-1 p-2">
				{error ? (
					<p className="p-3 text-xs text-crayon-red">{error}</p>
				) : loading ? (
					<div className="grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-1.5">
						{Array.from({ length: 18 }, (_, i) => (
							<div
								key={i}
								className="h-[76px] animate-pulse rounded-md bg-slate-200"
							/>
						))}
					</div>
				) : items.length === 0 ? (
					<p className="p-3 text-xs text-muted">
						{t("No items match this search.")}
					</p>
				) : (
					<div className="grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-1.5">
						{items.map((item) => (
							<ItemTile
								key={item.item_code}
								item={item}
								currency={currency}
								onPick={onPick}
							/>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
