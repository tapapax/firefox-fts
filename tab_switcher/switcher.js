let selectedString;
let allTabsSorted;
let allTabKeywords;
let isSettingKeyword = false;

async function reloadTabs(query) {
	const tabs = await getAllTabs();
	allTabsSorted = await sortTabsMru(tabs);
	allTabKeywords = await getAllTabKeywords();
	updateVisibleTabs(query, true);
}

async function getAllTabs() {
	const allTabs = await browser.tabs.query({ windowType: 'normal' });
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
		{ type: 'getWindowsLastAccess' });

	const sortKey = tab => {
		if (tab.active) {
			return windowsLastAccess.get(tab.windowId);
		} else {
			return tab.lastAccessed;
		}
	};

	const sorted = tabs.sort((a, b) => sortKey(b) - sortKey(a));
	return sorted;
}

function updateVisibleTabs(query, preserveSelectedTabIndex) {
	let tabs = allTabsSorted;
	if (query) {
		tabs = tabs.filter(tabsFilter(query));
		const keywordTab = allTabKeywords[query];
		if (keywordTab) {
			tabs.splice(0, 0, keywordTab);
		}
	}

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


	const tbody = document.getElementById('tabs_table').querySelector('tbody');
	tbody.innerHTML = ''; // Clear existing content

	tabs.forEach((tab, tabIndex) => {
		// Create table row
		const tr = document.createElement('tr');

		// Set data attributes
		tr.setAttribute('data-index', tabIndex);
		tr.setAttribute('data-tab-id', tab.id);

		// Click event listener
		tr.addEventListener('click', () => setSelectedString(tabIndex));

		// Double click event listener
		tr.addEventListener('dblclick', () => activateTab(tab.id));

		// Create table cells
		const td1 = document.createElement('td');
		if (tab.favIconUrl) {
			const img = document.createElement('img');
			img.width = 16;
			img.height = 16;
			img.src = !tab.incognito ? tab.favIconUrl : '/icons/mask16.svg';
			td1.appendChild(img);
		}

		const td2 = document.createElement('td');
		td2.textContent = tab.title;

		const td3 = document.createElement('td');
		td3.textContent = tab.url;

		// Append cells to row
		tr.appendChild(td1);
		tr.appendChild(td2);
		tr.appendChild(td3);

		// Append row to tbody
		tbody.appendChild(tr);
	});

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
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const keyword = await browser.sessions.getTabValue(tabs[0].id, "keyword");

	// Hide tabs table container
	const tabsTableContainer = document.getElementById('tabs_table__container');
	tabsTableContainer.style.display = 'none';

	// Show keyword label
	const keywordLabel = document.getElementById('keyword_label');
	keywordLabel.style.display = 'block';

	// Set aria-labelledby attribute for search input
	const searchInput = document.getElementById('search_input');
	searchInput.setAttribute('aria-labelledby', 'keyword_label');

	// Set value and select text in search input
	searchInput.value = keyword || '';
	searchInput.select();
}



async function setTabKeyword() {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const keyword = document.getElementById('search_input').value;
	await browser.sessions.setTabValue(tabs[0].id, "keyword", keyword);
	window.close();
}



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
				: getNextPageDownIndex(1);
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
				state = States.disabled;
			}
		}
	});
}


function setSelectedString(index) {
	const table = document.querySelector('#tabs_table tbody');
	const selector = `tr:nth-child(${index + 1})`;

	if (selectedString) {
		selectedString.classList.remove('tabs_table__selected');
	}

	selectedString = table.querySelector(selector);
	if (selectedString) {
		selectedString.classList.add('tabs_table__selected');
	}

	scrollIntoView();
}


function getSelectedTabIndex() {
	const selected = document.querySelector('#tabs_table .tabs_table__selected');
	if (!selected) {
		return 0;
	} else {
		return parseInt(selected.getAttribute('data-index'));
	}
}


function getNextPageDownIndex(stepSize) {
	const tabIndex = getSelectedTabIndex();
	const numVisibleTabs = document.querySelectorAll('#tabs_table tbody tr').length;
	return (tabIndex + stepSize) % numVisibleTabs;
}


function getNextPageUpIndex(stepSize) {
	const tabIndex = getSelectedTabIndex();
	const numVisibleTabs = document.querySelectorAll('#tabs_table tbody tr').length;
	return (tabIndex - stepSize + numVisibleTabs) % numVisibleTabs;
}


function scrollIntoView() {
	const container = document.getElementById('tabs_table__container');
	const scrollTop = container.scrollTop;
	const scrollBottom = scrollTop + container.clientHeight;

	const elem = selectedString;
	const elemTop = elem.offsetTop;
	const elemBottom = elemTop + elem.offsetHeight;

	if (elemBottom > scrollBottom) {
		container.scrollTop = scrollTop + (elemBottom - scrollBottom);
	} else if (elemTop < scrollTop) {
		container.scrollTop = elemTop;
	}
}


async function activateTab() {
	// Ensure selectedString is defined and has the required data attribute
	if (selectedString && selectedString.dataset.tabId) {
		const tabId = selectedString.dataset.tabId;
		const tab = await browser.tabs.get(parseInt(tabId));

		if (tab) {
			await browser.tabs.update(tab.id, { active: true });

			const currentWin = await browser.windows.getCurrent();
			if (currentWin.id !== tab.windowId) {
				await browser.windows.update(tab.windowId, { focused: true });
			} else {
				window.close();
			}
		}
	}
}

async function closeTab() {
	// Ensure selectedString is defined and has the required data attribute
	if (selectedString && selectedString.dataset.tabId) {
		const tabId = selectedString.dataset.tabId;
		await browser.tabs.remove(parseInt(tabId));
		reloadTabs();
	}
}

// Add DOMContentLoaded event listener for window
//

window.addEventListener("DOMContentLoaded", () => {
	reloadTabs();

	document.getElementById('search_input').addEventListener('input', function(event) {
		if (isSettingKeyword) {
			return;
		}
		if (event.target.value === "=") {
			beginSetTabKeyword();
		} else {
			updateVisibleTabs(event.target.value, false);
		}
	});

	// Focus on search input
	document.getElementById('search_input').focus();

	enableQuickSwitch();


	window.addEventListener('keydown', event => {
		const key = event.key;

		if ((key === 'ArrowDown') ||
			(event.ctrlKey && key === 'n')) {
			setSelectedString(getNextPageDownIndex(1));
			event.preventDefault();
		} else if ((key === 'ArrowUp') ||
			(event.ctrlKey && key === 'p')) {
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
			closeTab();
			event.preventDefault();
		}
	});

});

// document.addEventListener("DOMContentLoaded", function() {
// 	const container = document.getElementById('switcher_container');
//
// 	const screenWidth = window.screen.availWidth;
// 	const screenHeight = window.screen.availHeight;
// 	console.log("--->", screenHeight, screenWidth);
// 	const popupWidth = 800;
// 	const popupHeight = 600;
// 	const left = (screenWidth - popupWidth) / 2;
// 	const top = (screenHeight - popupHeight) / 2;
//
// 	container.style.width = popupWidth + 'px';
// 	container.style.height = popupHeight + 'px';
// 	container.style.left = left + 'px';
// 	container.style.top = top + 'px';
// });
