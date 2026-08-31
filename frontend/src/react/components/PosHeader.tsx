import { t } from "../lib/frappe";
import { StatusPill } from "./StatusPill";

interface PosHeaderProps {
	profileName: string;
	online: boolean;
}

/**
 * One slim bar. Everything the old navbar carried — database usage, server CPU,
 * cache meters, the drawer, the second page — is gone; what remains is the
 * shift context and whether the till can reach the server.
 */
export function PosHeader({ profileName, online }: PosHeaderProps) {
	return (
		<header className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-surface px-2">
			<span className="text-xs font-bold tracking-tight">{t("POS")}</span>
			<span className="truncate text-2xs text-muted">{profileName}</span>
			<span className="ml-auto">
				<StatusPill online={online} />
			</span>
		</header>
	);
}
