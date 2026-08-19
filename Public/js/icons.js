// Inline icon set. Stroke-based, currentColor, no motion.

const svg = (body, size) =>
	`<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

const FILE_BODY =
	'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'

export const ICONS = {
	chevronRight: svg('<path d="m9 18 6-6-6-6"/>', 14),
	chevronDown: svg('<path d="m6 9 6 6 6-6"/>', 14),
	folder: svg(
		'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
		14,
	),
	folderOpen: svg(
		'<path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6A2 2 0 0 1 18.46 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>',
		14,
	),
	file: svg(FILE_BODY, 14),
	fileCode: svg(`${FILE_BODY}<path d="m10 12.5-1.6 1.6L10 15.7"/><path d="m14 12.5 1.6 1.6L14 15.7"/>`, 14),
	close: svg('<path d="M18 6 6 18"/><path d="M6 6l12 12"/>', 12),
	plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>', 14),
}

// Mirrors the design: scripting and data files read as code, prose and styles
// read as plain documents.
const CODE_EXTENSIONS = new Set([
	"js",
	"mjs",
	"cjs",
	"jsx",
	"ts",
	"tsx",
	"json",
	"py",
	"rb",
	"go",
	"rs",
	"java",
	"c",
	"h",
	"cpp",
	"cs",
	"php",
	"sh",
	"bash",
	"sql",
])

export function extensionOf(name) {
	const parts = name.split(".")
	return parts.length > 1 ? parts.pop().toLowerCase() : ""
}

export function fileIcon(name) {
	return CODE_EXTENSIONS.has(extensionOf(name)) ? ICONS.fileCode : ICONS.file
}
