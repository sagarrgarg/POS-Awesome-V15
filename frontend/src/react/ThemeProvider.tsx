import { Theme } from "@radix-ui/themes";
import { useEffect, useState, type PropsWithChildren } from "react";

/**
 * Radix Themes root, configured the way Raven configures its own.
 *
 * Appearance follows the Frappe desk rather than being a separate setting: the
 * desk writes `data-theme` on <html>, so the POS is dark exactly when the rest
 * of the desk is, with no third switch for a cashier to get wrong.
 */
function readDeskAppearance(): "light" | "dark" {
	const desk = document.documentElement.getAttribute("data-theme");
	if (desk === "dark" || desk === "light") return desk;
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

export function PosThemeProvider({ children }: PropsWithChildren) {
	const [appearance, setAppearance] = useState<"light" | "dark">(
		readDeskAppearance,
	);

	useEffect(() => {
		const sync = () => setAppearance(readDeskAppearance());

		// The desk toggles the attribute in place, so an attribute observer is
		// the only way to hear about it.
		const observer = new MutationObserver(sync);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		media.addEventListener("change", sync);

		return () => {
			observer.disconnect();
			media.removeEventListener("change", sync);
		};
	}, []);

	return (
		<Theme
			appearance={appearance}
			accentColor="indigo"
			grayColor="slate"
			panelBackground="solid"
			radius="medium"
			// 90% shrinks every Radix space/size step at once, which is how the
			// whole screen gets denser without hand-tuning each component.
			scaling="90%"
			className="posnext-root"
		>
			{children}
		</Theme>
	);
}
