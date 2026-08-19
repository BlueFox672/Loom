// Save status readout.
//
// Clean and never saved by us -> "Saved" (the file on disk is untouched).
// Clean and saved by us       -> "Saved now", then ticks to "Saved 8s ago".
// Dirty                       -> "Unsaved Changes" in muted red.
//
// The elapsed time is a text swap on an interval. Nothing moves.

function relativeLabel(timestamp) {
	const seconds = Math.floor((Date.now() - timestamp) / 1000)
	if (seconds < 5) return "Saved now"
	if (seconds < 60) return `Saved ${seconds}s ago`

	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `Saved ${minutes}m ago`

	const hours = Math.floor(minutes / 60)
	return `Saved ${hours}h ago`
}

export function renderSaveStatus(element, tab) {
	if (!tab) {
		element.textContent = ""
		delete element.dataset.dirty
		return
	}

	if (tab.dirty) {
		element.dataset.dirty = "true"
		element.textContent = "Unsaved Changes"
		return
	}

	delete element.dataset.dirty
	element.textContent = tab.lastSaved ? relativeLabel(tab.lastSaved) : "Saved"
}
