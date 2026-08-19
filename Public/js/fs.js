// File System Access API wrapper.
// Real folders on the user's disk — not uploads, not a virtual tree.
// Chromium only; callers must check isSupported() first.

export function isSupported() {
	return typeof window !== "undefined" && "showDirectoryPicker" in window
}

// Opens the native OS folder picker. The user can select an existing folder or
// create a new one from inside the dialog. Requests write access up front so
// saving later does not trigger a second permission prompt.
export function pickDirectory() {
	return window.showDirectoryPicker({ mode: "readwrite" })
}

function sortNodes(nodes) {
	return nodes.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1
		return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
	})
}

// Reads the whole tree eagerly so the sidebar matches the folder immediately.
export async function readDirectory(dirHandle, basePath = "") {
	const nodes = []
	for await (const [name, handle] of dirHandle.entries()) {
		const path = basePath ? `${basePath}/${name}` : name
		if (handle.kind === "directory") {
			nodes.push({
				kind: "directory",
				name,
				path,
				handle,
				parent: dirHandle,
				children: await readDirectory(handle, path),
			})
		} else {
			nodes.push({ kind: "file", name, path, handle, parent: dirHandle })
		}
	}
	return sortNodes(nodes)
}

export async function readFile(fileHandle) {
	const file = await fileHandle.getFile()
	return file.text()
}

export async function writeFile(fileHandle, contents) {
	const writable = await fileHandle.createWritable()
	await writable.write(contents)
	await writable.close()
}

export function createFile(dirHandle, name) {
	return dirHandle.getFileHandle(name, { create: true })
}

export function createDirectory(dirHandle, name) {
	return dirHandle.getDirectoryHandle(name, { create: true })
}

export function remove(parentHandle, name) {
	return parentHandle.removeEntry(name, { recursive: true })
}

async function copyFile(srcHandle, destParent, name) {
	const file = await srcHandle.getFile()
	const target = await destParent.getFileHandle(name, { create: true })
	await writeFile(target, await file.arrayBuffer())
}

async function copyDirectory(srcHandle, destParent, name) {
	const target = await destParent.getDirectoryHandle(name, { create: true })
	for await (const [childName, handle] of srcHandle.entries()) {
		if (handle.kind === "file") await copyFile(handle, target, childName)
		else await copyDirectory(handle, target, childName)
	}
}

// The API has no universal rename. Newer Chromium exposes handle.move(); where
// it is missing or refuses a directory, fall back to a recursive copy + delete.
export async function rename(node, newName) {
	if (typeof node.handle.move === "function") {
		try {
			await node.handle.move(newName)
			return
		} catch (error) {
			console.warn("handle.move() unavailable for this entry, copying instead", error)
		}
	}
	if (node.kind === "file") await copyFile(node.handle, node.parent, newName)
	else await copyDirectory(node.handle, node.parent, newName)
	await remove(node.parent, node.name)
}
