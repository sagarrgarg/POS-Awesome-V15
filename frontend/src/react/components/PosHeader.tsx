import { Flex, Separator, Text } from "@radix-ui/themes";
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
		<>
			<Flex align="center" gap="2" px="3" py="1" flexShrink="0">
				<Text size="2" weight="bold">
					{t("POS")}
				</Text>
				<Text size="1" color="gray" truncate>
					{profileName}
				</Text>
				<Flex ml="auto">
					<StatusPill online={online} />
				</Flex>
			</Flex>
			<Separator size="4" />
		</>
	);
}
