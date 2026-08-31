/**
 * Frappe page host for the React POS screen.
 *
 * The React bundle is loaded on demand rather than through app_include_js so it
 * costs nothing on every other desk page. It exposes mount/unmount on
 * window.PosAwesomeReact; this file owns when those run.
 */
frappe.pages["posnext"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("POS"),
		single_column: true,
	});

	const container = page.main.get(0);
	// App version, not a timestamp: this is a cache key, and Date.now() would
	// force a re-download of the bundle on every single page load.
	const version = frappe.boot?.versions?.posawesome || "1";

	// frappe.require resolves whether or not the script actually executed (it
	// takes no error callback), so success is decided by the global existing
	// afterwards rather than by the promise settling.
	const load = () =>
		window.PosAwesomeReact
			? Promise.resolve()
			: frappe.require(`/assets/posawesome/dist/react/posnext.js?v=${version}`);

	// Vite emits the stylesheet next to the bundle; the page owns injecting it
	// so the CSS is not parsed on every other desk page.
	if (!document.getElementById("posnext-styles")) {
		const link = document.createElement("link");
		link.id = "posnext-styles";
		link.rel = "stylesheet";
		link.href = `/assets/posawesome/dist/react/posnext.css?v=${version}`;
		document.head.appendChild(link);
	}

	frappe.dom.freeze(__("Loading POS…"));
	load()
		.then(() => {
			frappe.dom.unfreeze();
			if (!window.PosAwesomeReact) {
				frappe.msgprint(__("POS bundle failed to load. Run: bench build --app posawesome"));
				return;
			}
			window.PosAwesomeReact.mount(container);
		})
		.catch((error) => {
			frappe.dom.unfreeze();
			console.error("Failed to load POS bundle", error);
			frappe.msgprint(__("POS bundle failed to load. Run: bench build --app posawesome"));
		});

	// The desk keeps page wrappers alive and re-shows them, so the React root is
	// torn down on hide to avoid a second root on the same container.
	$(wrapper).on("hide", () => window.PosAwesomeReact?.unmount());
};
