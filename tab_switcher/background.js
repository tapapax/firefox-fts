
const WINDOW_ID_NONE = browser.windows.WINDOW_ID_NONE;

let focusedWindowId = WINDOW_ID_NONE;
const windowsLastAccess = new Map();

browser.windows.onFocusChanged.addListener(windowId => {
	if (focusedWindowId !== WINDOW_ID_NONE) {
		// Remember current time for previously focused window as last access
		windowsLastAccess.set(focusedWindowId, (new Date).getTime());
	}
	focusedWindowId = windowId;
});

browser.windows.onRemoved.addListener(windowId => {
	windowsLastAccess.delete(windowId);

	if (focusedWindowId === windowId) {
		// Clear previously focused window id
		// to prevent writing it in map in onFocusChanged again
		focusedWindowId = WINDOW_ID_NONE;
	}
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'getWindowsLastAccess') {
		if (focusedWindowId !== WINDOW_ID_NONE) {
			// Set current time for currently focused window
			// since it is accessed right now
			windowsLastAccess.set(focusedWindowId, (new Date).getTime());
		}

		sendResponse(windowsLastAccess);
	}
});
