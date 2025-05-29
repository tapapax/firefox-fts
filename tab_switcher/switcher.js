let selectedString;
let allTabsSorted;
// Maps keywords to tabs.
let allTabKeywords;
let isSettingKeyword = false;

/**
 * Always reloads the browser tabs and stores them to `allTabsSorted`
 * in most-recently-used order.
 */
async function reloadTabs(query) {
	const tabs = await getAllTabs();
	allTabsSorted = await sortTabsMru(tabs);
	allTabKeywords = await getAllTabKeywords();
	updateVisibleTabs(query, true);
}

async function getAllTabs() {
	const allTabs = await browser.tabs.query({windowType: 'normal'});
	return allTabs;
}

async function getAllTabKeywords() {
	const keywords = {};
	for (let tab of allTabsSorted) {
		let keyword = await browser.sessions.getTabValue(tab.id, "keyword");
		if (keyword) {
			keywords[keyword] = tab;
		}
	}
	return keywords;
}

async function sortTabsMru(tabs) {
	const windowsLastAccess = await browser.runtime.sendMessage(
		{type: 'getWindowsLastAccess'});

	const sortKey = tab => {
		if (tab.active) {
			// lastAccessed of active tab is always current time
			// so we are using it's window last access
			return windowsLastAccess.get(tab.windowId);
		} else {
			return tab.lastAccessed;
		}
	};

	const sorted = tabs.sort((a, b) => sortKey(b) - sortKey(a));
	return sorted;
}

/**
 * Filters the visible tabs using the given query.
 * If `preserveSelectedTabIndex` is set to `true`, will preserve
 * the previously selected position, if any.
 */
function updateVisibleTabs(query, preserveSelectedTabIndex) {
	let tabs = allTabsSorted;
	if (query) {
		tabs = tabs.filter(tabsFilter(query));
		// Check if this query matched a keyword for a tab.
		const keywordTab = allTabKeywords[query];
		if (keywordTab) {
			// Put this at the top.
			tabs.splice(0, 0, keywordTab);
		}
	}

	// Determine the index of a tab to highlight
	let tabIndex = 0;
	const prevTabIndex = getSelectedTabIndex();
	if (preserveSelectedTabIndex && prevTabIndex) {
		const numVisibleTabs = tabs.length;
		if (prevTabIndex < numVisibleTabs) {
			tabIndex = prevTabIndex;
		} else {
			tabIndex = numVisibleTabs - 1;
		}
	}

	// Update the body of the table with filtered tabs
	const tbody = document.querySelector('#tabs_table tbody');
	tbody.innerHTML = '';

	tabs.forEach((tab, tabIndex) => {
		const tr = document.createElement('tr');

		// First column (favicon)
		const tdIcon = document.createElement('td');
		if (tab.favIconUrl) {
			const img = document.createElement('img');
			img.width = 16;
			img.height = 16;
			img.src = !tab.incognito ? tab.favIconUrl : '/icons/mask16.svg';
			tdIcon.appendChild(img);
		}
		tr.appendChild(tdIcon);

		// Second column (title)
		const tdTitle = document.createElement('td');
		tdTitle.textContent = tab.title;
		tr.appendChild(tdTitle);

		// Third column (url)
		const tdUrl = document.createElement('td');
		tdUrl.textContent = tab.url;
		tr.appendChild(tdUrl);

		// Store data attributes and add event listeners
		tr.dataset.index = tabIndex;
		tr.dataset.tabId = tab.id;
		tr.addEventListener('click', () => setSelectedString(tabIndex));
		tr.addEventListener('dblclick', () => activateTab());

		tbody.appendChild(tr);
	});

	// Highlight the selected tab
	setSelectedString(tabIndex);
}

function tabsFilter(query) {
	const patterns = query.toLowerCase().split(" ");
	return tab => patterns.every(
		pattern => (tab.url || '').toLowerCase().indexOf(pattern) !== -1
			|| (tab.title || '').toLowerCase().indexOf(pattern) !== -1);
}

async function beginSetTabKeyword() {
	isSettingKeyword = true;
	const tabs = await browser.tabs.query({active: true, currentWindow: true});
	const keyword = await browser.sessions.getTabValue(tabs[0].id, "keyword");
	document.getElementById("tabs_table__container").style.display = "none";
	document.getElementById("keyword_label").style.display = "block";

	const searchInput = document.getElementById("search_input");
	searchInput.setAttribute("aria-labelledby", "keyword_label");
	// If there's an existing keyword, let the user see/edit it.
	searchInput.value = keyword || "";
	// Select it so the user can simply type over it to enter a new one.
	searchInput.select();
}

async function setTabKeyword() {
	const tabs = await browser.tabs.query({active: true, currentWindow: true});
	let keyword = document.getElementById('search_input').value;
	await browser.sessions.setTabValue(tabs[0].id, "keyword", keyword);
	window.close();
}

reloadTabs();

const searchInput = document.getElementById('search_input');
searchInput.focus();
searchInput.addEventListener('input', event => {
	if (isSettingKeyword) {
		return;
	}
	if (event.target.value == "=") {
		beginSetTabKeyword();
	} else {
		updateVisibleTabs(event.target.value, false);
	}
});

enableQuickSwitch();

window.addEventListener('keydown', event => {
	const key = event.key;

	if ((key === 'ArrowDown') ||
	    (event.ctrlKey && key === 'n'))
	{
		setSelectedString(getNextPageDownIndex(1));
		event.preventDefault();
	} else if ((key === 'ArrowUp') ||
	           (event.ctrlKey && key === 'p'))
	{
		setSelectedString(getNextPageUpIndex(1));
		event.preventDefault();
	} else if (key === 'PageDown') {
		setSelectedString(getNextPageDownIndex(13));
		event.preventDefault();
	} else if (key === 'PageUp') {
		setSelectedString(getNextPageUpIndex(13));
		event.preventDefault();
	} else if (key === 'Escape') {
		window.close();
	} else if (key === 'Enter') {
		if (isSettingKeyword) {
			setTabKeyword();
		} else {
			activateTab();
		}
  } else if ((event.ctrlKey && key === 'Delete') ||
             (event.metaKey && key === 'Backspace')) {
    /*
    Windows -- ideal combo: Ctrl+Delete -- alternate: Windows+Backspace
    (`meta` is the Windows key)

    OSX -- ideal combo: Cmd+Delete -- alternate: Fn+Ctrl+Delete
    (Delete key is treated as `Backspace` unless Fn modifier is pressed)
    */
		closeTab();
		event.preventDefault();
	}
});


/**
 * After opening with Ctrl+Space press Space again while Ctrl is still
 * held to move selection down the list, and releasing makes the switch
*/
function enableQuickSwitch() {
	const States = {
		pending: 0,
		enabled: 1,
		disabled: 2,
	};

	let state = States.pending;

	window.addEventListener('keydown', event => {
		const key = event.key;

		if (key === ' ' && state !== States.disabled && event.ctrlKey) {
			state = States.enabled;
			const stringToSelect = event.shiftKey
				? getNextPageUpIndex(1)
				: getNextPageDownIndex(1)
			;
			setSelectedString(stringToSelect);
			event.preventDefault();
		}
		if (key === 'Control') {
			state = States.disabled;
		}
	});

	window.addEventListener('keyup', event => {
		const key = event.key;

		if (key === 'Control') {
			if (state === States.enabled) {
				activateTab();
			} else {
				state = States.disable;
			}
		}
	});
}

function setSelectedString(index) {
	const table = document.querySelector('#tabs_table tbody');

	const newSelected = table.querySelector(`tr:nth-child(${index+1})`);
	if (!newSelected || index < 0) {
		return;
	}

	if (selectedString) {
		selectedString.classList.remove('tabs_table__selected');
	}

	newSelected.classList.add('tabs_table__selected');

	selectedString = newSelected;

	scrollToSelection();
}

function scrollToSelection() {
	if (!selectedString) {
		return;
	}

	const scrollPadding = 20;

	const tableContainer = document.getElementById('tabs_table__container');
	const stringOffset = selectedString.offsetTop;
	const scrollMax = stringOffset - scrollPadding;
	const scrollMin = stringOffset
		+ selectedString.offsetHeight - tableContainer.offsetHeight + scrollPadding;

	if (scrollMax < scrollMin) {
		// Resetting scroll since there is no enough space
		tableContainer.scrollTop = 0;
		return;
	}

	const scrollValue = Math.max(0, scrollMin,
		Math.min(scrollMax, tableContainer.scrollTop));
	tableContainer.scrollTop = scrollValue;
}

/**
 * Returns an index of the next tab in the list, if we go pageSize _up_ the list.
 * If we are already at the top, then the next index is the index of the last (bottom) tab.
 */
function getNextPageUpIndex(pageSize) {
	const currentSelectedIndex = getSelectedTabIndex();
	if (currentSelectedIndex === 0) {
		return getTableSize() - 1;
	} else {
		return Math.max(currentSelectedIndex - pageSize, 0);
	}
}

/**
 * Returns an index of the next tab in the list, if we go pageSize _down_ the list.
 * If we are already at the bottom, then the next index is the index of the first (top) tab.
 */
function getNextPageDownIndex(pageSize) {
	const currentSelectedIndex = getSelectedTabIndex();
	const lastElementIndex = getTableSize() - 1;
	if (currentSelectedIndex === lastElementIndex) {
		return 0;
	} else {
	    return Math.min(currentSelectedIndex + pageSize, lastElementIndex)
	}
}

function getTableSize() {
	return document.querySelectorAll('#tabs_table tbody tr').length;
}

/**
 * Returns the index of the currently selected tab, or `undefined` if none is selected.
 */
function getSelectedTabIndex() {
	return selectedString ? parseInt(selectedString.dataset.index) : undefined;
}

async function activateTab() {
	if (!selectedString) {
		return;
	}

	const tabId = getSelectedTabId();
	const tab = await browser.tabs.get(tabId);

	// Switch to the target tab
	await browser.tabs.update(tabId, {active: true});

	// Check if we should focus other browser window
	const currentWin = await browser.windows.getCurrent();
	if (currentWin.id !== tab.windowId) {
		// Focus on the browser window containing the tab
		await browser.windows.update(tab.windowId, {focused: true});

		// Popup will close itself on window switch.
		// And if we call window.close() here
		// origin browser window will become foreground again.
	} else {
		// Close the tab switcher pop up
		window.close();
	}
}

async function closeTab() {
	if (!selectedString) {
		return;
	}

	// Close the selected tab
	const tabId = getSelectedTabId();
	await browser.tabs.remove(tabId);

	// Reload tabs, using the current query
	const query = document.getElementById('search_input').value;
	await reloadTabs(query);

	// Ensure the extension popup remains focused after potential tab switch
	window.focus();
}

/**
 * Returns the browser identifier of the currently selected tab,
 * or `undefined` if none is selected.
 */
function getSelectedTabId() {
	return selectedString ? parseInt(selectedString.dataset.tabId) : undefined;
}
