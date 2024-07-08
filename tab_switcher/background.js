
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
// // Function to center the popup window
// function centerPopup() {
// 	console.log("hi");
// 	// Get the screen's width and height
// 	const screenWidth = window.screen.availWidth;
// 	const screenHeight = window.screen.availHeight;
//
// 	// Set the desired width and height of your popup
// 	const popupWidth = 800;
// 	const popupHeight = 600;
//
// 	// Calculate the position to center the window
// 	const left = Math.round((screenWidth / 2) - (popupWidth / 2));
// 	const top = Math.round((screenHeight / 2) - (popupHeight / 2));
//
// 	// Resize and move the popup window
// 	browser.windows.update(browser.windows.WINDOW_ID_CURRENT, {
// 		left: Math.max(left, 0),
// 		top: Math.max(top, 0),
// 		width: popupWidth,
// 		height: popupHeight
// 	});
// }
//
// centerPopup();
// // Add event listener for when the DOM content is loaded
// window.addEventListener("DOMContentLoaded", () => {
// 	centerPopup();
// });
//
