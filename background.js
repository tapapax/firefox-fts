
let ftsWindowId;

function main() {
	browser.commands.onCommand.addListener(proceedCommand);
	browser.browserAction.onClicked.addListener(openFtsWindow);

	browser.windows.onFocusChanged.addListener(onFocusChanged);
	browser.windows.onRemoved.addListener(onWindowRemoved);
}

function proceedCommand(name) {
	if (name === 'open-fts') {
		openFtsWindow();
	}
}

async function openFtsWindow() {
	const height = 500;
	const width = 1000;

	const win = await browser.windows.create({
		height: height,
		width: width,
		left: screen.width / 2 - width / 2,
		top: screen.height / 2 - height / 2,
		type: 'popup',
		url: browser.extension.getURL('tab_switcher/switcher.html'),
		allowScriptsToClose: true,
	});

	ftsWindowId = win.id;
}

function onFocusChanged(windowId) {
	if (ftsWindowId && windowId !== ftsWindowId) {
		//browser.windows.remove(ftsWindowId);
	}
}

function onWindowRemoved(windowId) {
	if (ftsWindowId === windowId) {
		ftsWindowId = undefined;
	}
}

main();
