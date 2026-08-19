// Sidebar file tree rendering. Pure view layer — all behavior arrives via ctx.

import { ICONS, fileIcon } from "./icons.js"

const INDENT_BASE = 8
const INDENT_STEP = 14

// Chevron column + gap + icon column + gap. Keeps "No files yet" aligned with
// the labels of the rows it sits among instead of hanging under their icons.
const LABEL_OFFSET = 44

const indent = (depth) => INDENT_BASE + depth * INDENT_STEP

export function renderTree(container, nodes, ctx) {
	container.innerHTML = ""
	container.appendChild(buildLevel(nodes, ctx, 0))
}

function buildLevel(nodes, ctx, depth) {
	const fragment = document.createDocumentFragment()
	for (const node of nodes) {
		fragment.appendChild(buildRow(node, ctx, depth))
		if (node.kind !== "directory" || !ctx.expanded.has(node.path)) continue
		if (node.children.length === 0) {
			fragment.appendChild(buildEmpty(depth + 1))
		} else {
			fragment.appendChild(buildLevel(node.children, ctx, depth + 1))
		}
	}
	return fragment
}

function buildEmpty(depth) {
	const row = document.createElement("div")
	row.className = "tree-empty"
	row.style.paddingLeft = `${indent(depth) + LABEL_OFFSET}px`
	row.textContent = "No files yet"
	return row
}

function buildRow(node, ctx, depth) {
	const row = document.createElement("div")
	row.className = "tree-row"
	row.dataset.kind = node.kind
	row.dataset.path = node.path
	row.style.paddingLeft = `${indent(depth)}px`
	row.setAttribute("role", "treeitem")
	if (ctx.activePath === node.path) row.setAttribute("aria-selected", "true")
	if (ctx.dirtyPaths.has(node.path)) row.dataset.dirty = "true"

	const open = node.kind === "directory" && ctx.expanded.has(node.path)

	const chevron = document.createElement("span")
	chevron.className = "tree-chevron"
	if (node.kind === "directory") {
		chevron.innerHTML = open ? ICONS.chevronDown : ICONS.chevronRight
	} else {
		chevron.dataset.empty = "true"
	}
	row.appendChild(chevron)

	const icon = document.createElement("span")
	icon.className = "tree-icon"
	icon.innerHTML =
		node.kind === "directory" ? (open ? ICONS.folderOpen : ICONS.folder) : fileIcon(node.name)
	row.appendChild(icon)

	const label = document.createElement("span")
	label.className = "tree-label"
	label.textContent = node.name
	row.appendChild(label)

	row.addEventListener("click", () => ctx.onSelect(node))
	row.addEventListener("contextmenu", (event) => {
		event.preventDefault()
		ctx.onContext(node, event.clientX, event.clientY)
	})

	return row
}
