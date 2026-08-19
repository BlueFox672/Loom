// Tab strip and breadcrumb rendering. Pure view layer.

import { ICONS, fileIcon } from "./icons.js"

export function renderTabs(container, tabs, ctx) {
	container.innerHTML = ""

	for (const tab of tabs) {
		const element = document.createElement("div")
		element.className = "tab"
		element.dataset.path = tab.path
		element.setAttribute("role", "tab")
		if (tab.path === ctx.activePath) element.setAttribute("aria-selected", "true")
		if (tab.dirty) element.dataset.dirty = "true"

		const icon = document.createElement("span")
		icon.className = "tab-icon"
		icon.innerHTML = fileIcon(tab.name)
		element.appendChild(icon)

		const label = document.createElement("span")
		label.className = "tab-label"
		label.textContent = tab.name
		element.appendChild(label)

		// Only the active tab carries a close button. Revealing it on pointer
		// entry would be a hover effect, and showing one on every tab crowds the
		// strip, so it follows selection instead.
		if (tab.path === ctx.activePath) {
			const close = document.createElement("button")
			close.type = "button"
			close.className = "tab-close"
			close.title = `Close ${tab.name}`
			close.innerHTML = ICONS.close
			close.addEventListener("click", (event) => {
				event.stopPropagation()
				ctx.onClose(tab.path)
			})
			element.appendChild(close)
		}

		element.addEventListener("click", () => ctx.onSelect(tab.path))
		container.appendChild(element)
	}

	const add = document.createElement("button")
	add.type = "button"
	add.className = "tab-add"
	add.title = "New file"
	add.innerHTML = ICONS.plus
	add.addEventListener("click", ctx.onNewFile)
	container.appendChild(add)
}

export function renderBreadcrumb(element, rootName, path) {
	element.textContent = path ? [rootName, ...path.split("/")].join("  /  ") : ""
}
