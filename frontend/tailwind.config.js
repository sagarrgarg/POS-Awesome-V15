export default {
	// Vue bundle only. The React screen (src/react) is styled entirely by Radix
	// Themes and deliberately has no Tailwind layer.
	content: ["./src/posapp/**/*.{vue,js}", "./src/*.{js,html}"],
	theme: {
		extend: {},
	},
	plugins: [],
};
