// Loom application shell: state, disk operations, and wiring.

import * as disk from "./fs.js"
import * as code from "./editor.js"
import { renderTree } from "./tree.js"
import { renderTabs, renderBreadcrumb } from "./tabs.js"
import { renderSaveStatus } from "./save.js"

const byId = (id) => document.getElementById(id)

const els = {
	header: byId("app-header"),
	emptyState: byId("empty-state"),
	openFolder: byId("open-folder"),
	emptyEyebrow: byId("empty-eyebrow"),
	emptyTitle: byId("empty-title"),
	workspace: byId("workspace"),
	rootName: byId("root-name"),
	tree: byId("tree"),
	newFile: byId("new-file"),
	newFolder: byId("new-folder"),
	collapseAll: byId("collapse-all"),
	tabstrip: byId("tabstrip"),
	breadcrumb: byId("breadcrumb"),
	saveStatus: byId("save-status"),
	saveText: byId("save-text"),
	saveButton: byId("save-btn"),
	editorMount: byId("editor-mount"),
	editorPlaceholder: byId("editor-placeholder"),
	contextMenu: byId("context-menu"),
}

const state = {
	root: null,
	rootName: "",
	nodes: [],
	expanded: new Set(),
	tabs: [],
	activePath: null,
	editorReady: false,
}

/* ---------- helpers ---------- */

const activeTab = () => state.tabs.find((tab) => tab.path === state.activePath) || null

function parentPathOf(path) {
	const index = path.lastIndexOf("/")
	return index === -1 ? "" : path.slice(0, index)
}

function findNode(path, nodes = state.nodes) {
	for (const node of nodes) {
		if (node.path === path) return node
		if (node.children) {
			const hit = findNode(path, node.children)
			if (hit) return hit
		}
	}
	return null
}

// A dirty file also reddens every folder above it.
function dirtyPaths() {
	const paths = new Set()
	for (const tab of state.tabs) {
		if (!tab.dirty) continue
		paths.add(tab.path)
		const segments = tab.path.split("/")
		segments.pop()
		let accumulated = ""
		for (const segment of segments) {
			accumulated = accumulated ? `${accumulated}/${segment}` : segment
			paths.add(accumulated)
		}
	}
	return paths
}

function fail(message, error) {
	console.error(message, error)
	window.alert(message)
}

/* ---------- rendering ---------- */

function render() {
	renderTree(els.tree, state.nodes, {
		expanded: state.expanded,
		activePath: state.activePath,
		dirtyPaths: dirtyPaths(),
		onSelect: selectNode,
		onContext: showContextMenu,
	})

	renderTabs(els.tabstrip, state.tabs, {
		activePath: state.activePath,
		onSelect: activateTab,
		onClose: closeTab,
		onNewFile: () => createEntry(null, "file"),
	})

	renderBreadcrumb(els.breadcrumb, state.rootName, state.activePath)

	const tab = activeTab()
	els.saveStatus.hidden = !tab
	els.editorPlaceholder.hidden = Boolean(tab)
	renderSaveStatus(els.saveText, tab)
}

/* ---------- workspace ---------- */

async function openFolder() {
	let handle
	try {
		handle = await disk.pickDirectory()
	} catch (error) {
		// The user dismissing the picker is not an error.
		if (error && error.name === "AbortError") return
		fail("Could not open that folder.", error)
		return
	}

	state.root = handle
	state.rootName = handle.name
	state.expanded = new Set()
	state.tabs = []
	state.activePath = null
	els.rootName.textContent = handle.name
	els.rootName.title = handle.name

	try {
		await refreshTree()
	} catch (error) {
		fail("Could not read that folder.", error)
		return
	}

	els.emptyState.hidden = true
	els.workspace.hidden = false
	els.header.dataset.workspace = "true"
}

async function refreshTree() {
	state.nodes = await disk.readDirectory(state.root)
	reconcileTabs()
	render()
}

// Handles go stale after a disk change, and files may have vanished entirely.
function reconcileTabs() {
	for (const tab of [...state.tabs]) {
		const node = findNode(tab.path)
		if (!node || node.kind !== "file") {
			dropTab(tab.path)
			continue
		}
		tab.handle = node.handle
	}
	if (state.activePath && !state.tabs.some((tab) => tab.path === state.activePath)) {
		state.activePath = state.tabs.length ? state.tabs[state.tabs.length - 1].path : null
	}
	syncEditorModel()
}

/* ---------- tabs and editing ---------- */

function syncEditorModel() {
	if (!state.editorReady) return
	const tab = activeTab()
	code.setActiveModel(tab ? code.getModel(tab.path) : null)
}

function dropTab(path) {
	state.tabs = state.tabs.filter((tab) => tab.path !== path)
	code.disposeModel(path)
}

function closeTab(path) {
	const index = state.tabs.findIndex((tab) => tab.path === path)
	if (index === -1) return
	dropTab(path)
	if (state.activePath === path) {
		const next = state.tabs[index] || state.tabs[index - 1] || null
		state.activePath = next ? next.path : null
	}
	syncEditorModel()
	render()
}

async function selectNode(node) {
	if (node.kind === "directory") {
		if (state.expanded.has(node.path)) state.expanded.delete(node.path)
		else state.expanded.add(node.path)
		render()
		return
	}
	await openFile(node)
}

async function ensureEditor() {
	if (state.editorReady) return
	await code.mount(els.editorMount)
	state.editorReady = true
}

async function openFile(node) {
	try {
		if (!state.tabs.some((tab) => tab.path === node.path)) {
			const contents = await disk.readFile(node.handle)
			await ensureEditor()
			await code.createModel(node.path, node.name, contents, markDirty)
			state.tabs.push({
				path: node.path,
				name: node.name,
				handle: node.handle,
				dirty: false,
				lastSaved: null,
			})
		} else {
			await ensureEditor()
		}
		state.activePath = node.path
		syncEditorModel()
		render()
		code.focus()
	} catch (error) {
		fail(`Could not open "${node.name}".`, error)
	}
}

function activateTab(path) {
	state.activePath = path
	syncEditorModel()
	render()
	code.focus()
}

function markDirty(path) {
	const tab = state.tabs.find((entry) => entry.path === path)
	if (!tab || tab.dirty) return
	tab.dirty = true
	render()
}

async function saveActive() {
	const tab = activeTab()
	if (!tab) return
	try {
		await disk.writeFile(tab.handle, code.getValue(tab.path))
		tab.dirty = false
		tab.lastSaved = Date.now()
		render()
	} catch (error) {
		fail(`Could not save "${tab.name}".`, error)
	}
}

/* ---------- file operations ---------- */

async function createEntry(dirNode, kind) {
	if (!state.root) return
	const target = dirNode || { handle: state.root, path: "" }
	const isFile = kind === "file"
	const input = window.prompt(isFile ? "New file name" : "New folder name", isFile ? "untitled.js" : "new-folder")
	if (!input) return
	const name = input.trim()
	if (!name) return

	try {
		if (isFile) await disk.createFile(target.handle, name)
		else await disk.createDirectory(target.handle, name)
		if (target.path) state.expanded.add(target.path)
		await refreshTree()
	} catch (error) {
		fail(`Could not create "${name}".`, error)
	}
}

async function renameNode(node) {
	const input = window.prompt("Rename to", node.name)
	if (!input) return
	const name = input.trim()
	if (!name || name === node.name) return

	try {
		await disk.rename(node, name)
	} catch (error) {
		fail(`Could not rename "${node.name}".`, error)
		return
	}

	const parent = parentPathOf(node.path)
	const newPath = parent ? `${parent}/${name}` : name
	const previousActive = state.activePath

	for (const tab of state.tabs) {
		if (tab.path === node.path) {
			code.remapModel(tab.path, newPath, name, markDirty)
			if (previousActive === tab.path) state.activePath = newPath
			tab.path = newPath
			tab.name = name
		} else if (tab.path.startsWith(`${node.path}/`)) {
			const moved = newPath + tab.path.slice(node.path.length)
			code.remapModel(tab.path, moved, tab.name, markDirty)
			if (previousActive === tab.path) state.activePath = moved
			tab.path = moved
		}
	}

	if (state.expanded.has(node.path)) {
		state.expanded.delete(node.path)
		state.expanded.add(newPath)
	}

	await refreshTree()
}

async function deleteNode(node) {
	if (!window.confirm(`Delete "${node.name}"? This cannot be undone.`)) return

	try {
		await disk.remove(node.parent, node.name)
	} catch (error) {
		fail(`Could not delete "${node.name}".`, error)
		return
	}

	for (const tab of [...state.tabs]) {
		if (tab.path === node.path || tab.path.startsWith(`${node.path}/`)) dropTab(tab.path)
	}
	state.expanded.delete(node.path)
	await refreshTree()
}

/* ---------- context menu ---------- */

function showContextMenu(node, x, y) {
	const items = []
	if (node.kind === "directory") {
		items.push({ label: "New file", run: () => createEntry(node, "file") })
		items.push({ label: "New folder", run: () => createEntry(node, "directory") })
	}
	items.push({ label: "Rename", run: () => renameNode(node) })
	items.push({ label: "Delete", run: () => deleteNode(node), danger: true })

	els.contextMenu.innerHTML = ""
	for (const item of items) {
		const button = document.createElement("button")
		button.type = "button"
		button.className = "context-item"
		if (item.danger) button.dataset.danger = "true"
		button.textContent = item.label
		button.addEventListener("click", () => {
			hideContextMenu()
			item.run()
		})
		els.contextMenu.appendChild(button)
	}

	els.contextMenu.style.left = `${x}px`
	els.contextMenu.style.top = `${y}px`
	els.contextMenu.hidden = false

	// Keep the menu inside the viewport.
	const rect = els.contextMenu.getBoundingClientRect()
	els.contextMenu.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`
	els.contextMenu.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`
}

function hideContextMenu() {
	els.contextMenu.hidden = true
}

/* ---------- boot ---------- */

function init() {
	if (!disk.isSupported()) {
		els.emptyEyebrow.textContent = "Browser not supported"
		els.emptyTitle.textContent = "Open Loom in Chrome or Edge"
		els.emptyState.dataset.unsupported = "true"
		els.openFolder.disabled = true
		return
	}

	els.openFolder.addEventListener("click", openFolder)
	els.newFile.addEventListener("click", () => createEntry(null, "file"))
	els.newFolder.addEventListener("click", () => createEntry(null, "directory"))
	els.collapseAll.addEventListener("click", () => {
		state.expanded.clear()
		render()
	})
	els.saveButton.addEventListener("click", saveActive)

	document.addEventListener("click", (event) => {
		if (!els.contextMenu.contains(event.target)) hideContextMenu()
	})
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") hideContextMenu()
	})

	// Keeps "Saved 8s ago" current. Text only.
	window.setInterval(() => renderSaveStatus(els.saveText, activeTab()), 1000)
}

init()
