// Monaco as the text engine only. Loom owns all surrounding chrome, so Monaco's
// own UI is switched off and its theme is derived from our design tokens.
//
// Every default animation is disabled: no caret blink, no smooth caret, no
// smooth scrolling.

import { extensionOf } from "./icons.js"

const MONACO_BASE = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min"
const VS_PATH = `${MONACO_BASE}/vs`

const LANGUAGES = {
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jsx: "javascript",
	ts: "typescript",
	tsx: "typescript",
	json: "json",
	css: "css",
	scss: "scss",
	less: "less",
	html: "html",
	htm: "html",
	xml: "xml",
	svg: "xml",
	md: "markdown",
	py: "python",
	rb: "ruby",
	go: "go",
	rs: "rust",
	java: "java",
	c: "c",
	h: "c",
	cpp: "cpp",
	cs: "csharp",
	php: "php",
	sh: "shell",
	bash: "shell",
	yml: "yaml",
	yaml: "yaml",
	sql: "sql",
	toml: "ini",
	ini: "ini",
}

export function languageFor(name) {
	return LANGUAGES[extensionOf(name)] || "plaintext"
}

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const bare = (hex) => hex.replace("#", "")

let loading = null
let editor = null
const models = new Map()

function loadScript(src) {
	return new Promise((resolve, reject) => {
		const script = document.createElement("script")
		script.src = src
		script.onload = resolve
		script.onerror = () => reject(new Error(`Failed to load ${src}`))
		document.head.appendChild(script)
	})
}

export function loadMonaco() {
	if (loading) return loading
	loading = (async () => {
		// Monaco's workers cannot be loaded cross-origin directly, so proxy them
		// through a same-origin blob that imports the CDN worker.
		window.MonacoEnvironment = {
			getWorkerUrl() {
				const proxy = `self.MonacoEnvironment={baseUrl:"${MONACO_BASE}/"};importScripts("${VS_PATH}/base/worker/workerMain.js");`
				return URL.createObjectURL(new Blob([proxy], { type: "text/javascript" }))
			},
		}
		await loadScript(`${VS_PATH}/loader.js`)
		window.require.config({ paths: { vs: VS_PATH } })
		await new Promise((resolve) => window.require(["vs/editor/editor.main"], resolve))
		defineTheme(window.monaco)
		return window.monaco
	})()
	return loading
}

// Deliberately restrained highlighting, matching the near-monochrome design.
function defineTheme(monaco) {
	const primary = token("--text-primary")
	monaco.editor.defineTheme("loom", {
		base: "vs-dark",
		inherit: true,
		colors: {
			"editor.background": token("--surface-canvas"),
			"editor.foreground": primary,
			"editorLineNumber.foreground": token("--text-muted"),
			"editorLineNumber.activeForeground": token("--text-secondary"),
			"editor.lineHighlightBackground": token("--surface-row"),
			"editor.lineHighlightBorder": token("--surface-row"),
			"editor.selectionBackground": token("--surface-row-active"),
			"editorCursor.foreground": primary,
			"editorWidget.background": token("--surface-raised"),
			"editorWidget.border": token("--border-default"),
			"editorSuggestWidget.background": token("--surface-raised"),
			"editorSuggestWidget.border": token("--border-default"),
			"scrollbarSlider.background": token("--border-default"),
			"scrollbarSlider.hoverBackground": token("--border-strong"),
			"scrollbarSlider.activeBackground": token("--border-strong"),
		},
		rules: [
			{ token: "", foreground: bare(primary) },
			{ token: "comment", foreground: bare(token("--text-muted")) },
			{ token: "keyword", foreground: "c8ccd4" },
			{ token: "string", foreground: "b7bec9" },
			{ token: "number", foreground: "c3c9d2" },
			{ token: "type", foreground: "d4d7dd" },
			{ token: "delimiter", foreground: "8c9299" },
		],
	})
}

export async function mount(host) {
	const monaco = await loadMonaco()
	editor = monaco.editor.create(host, {
		theme: "loom",
		automaticLayout: true,
		fontFamily: token("--font-mono"),
		fontSize: 13,
		lineHeight: 22,
		fontWeight: "500",
		tabSize: 2,
		// No motion.
		cursorBlinking: "solid",
		cursorSmoothCaretAnimation: "off",
		smoothScrolling: false,
		// Chrome belongs to Loom, not Monaco.
		minimap: { enabled: false },
		contextmenu: false,
		overviewRulerLanes: 0,
		overviewRulerBorder: false,
		hideCursorInOverviewRuler: true,
		glyphMargin: false,
		guides: { indentation: false },
		renderLineHighlight: "line",
		renderWhitespace: "none",
		occurrencesHighlight: "off",
		scrollBeyondLastLine: false,
		lineNumbersMinChars: 4,
		padding: { top: 14, bottom: 14 },
		scrollbar: {
			verticalScrollbarSize: 10,
			horizontalScrollbarSize: 10,
			useShadows: false,
		},
	})
	return editor
}

// One model per path, so each tab keeps its own undo history.
export async function createModel(path, name, contents, onChange) {
	const monaco = await loadMonaco()
	let entry = models.get(path)
	if (!entry) {
		entry = { model: monaco.editor.createModel(contents, languageFor(name)), listener: null }
		models.set(path, entry)
	}
	if (entry.listener) entry.listener.dispose()
	entry.listener = entry.model.onDidChangeContent(() => onChange(path))
	return entry.model
}

export function getModel(path) {
	const entry = models.get(path)
	return entry ? entry.model : null
}

export function setActiveModel(model) {
	if (editor) editor.setModel(model)
}

export function getValue(path) {
	const entry = models.get(path)
	return entry ? entry.model.getValue() : ""
}

export function disposeModel(path) {
	const entry = models.get(path)
	if (!entry) return
	if (entry.listener) entry.listener.dispose()
	entry.model.dispose()
	models.delete(path)
}

// After a rename the change listener must be rebound, otherwise edits would
// still report the old path and mark the wrong tab dirty.
export function remapModel(oldPath, newPath, name, onChange) {
	const entry = models.get(oldPath)
	if (!entry) return
	models.delete(oldPath)
	models.set(newPath, entry)
	if (entry.listener) entry.listener.dispose()
	entry.listener = entry.model.onDidChangeContent(() => onChange(newPath))
	if (window.monaco) window.monaco.editor.setModelLanguage(entry.model, languageFor(name))
}

export function focus() {
	if (editor) editor.focus()
}
