let selectedTabElement;
let sortedTabs;
let tabKeywords;
let isKeywordSetting = false;

document.addEventListener("DOMContentLoaded", () => {
	reloadTabs();

	const searchInput = document.getElementById('search_input');
	searchInput.addEventListener('input', handleSearchInput);
	searchInput.focus();

	enableQuickSwitch();

	window.addEventListener('keydown', handleKeyDown);
	window.addEventListener('keyup', handleKeyUp);
});

async function reloadTabs(query = '') {
	const tabs = await browser.tabs.query({ windowType: 'normal' });
	sortedTabs = await sortTabsByMostRecentlyUsed(tabs);
	tabKeywords = await fetchAllTabKeywords();
	updateVisibleTabs(query, true);
}

async function fetchAllTabKeywords() {
	const keywords = {};
	for (const tab of sortedTabs) {
		const keyword = await browser.sessions.getTabValue(tab.id, "keyword");
		if (keyword) {
			keywords[keyword] = tab;
		}
	}
	return keywords;
}

async function sortTabsByMostRecentlyUsed(tabs) {
	const windowsLastAccess = await browser.runtime.sendMessage({ type: 'getWindowsLastAccess' });
	tabs.sort((a, b) => {
		const getSortKey = tab => (tab.active ? windowsLastAccess.get(tab.windowId) : tab.lastAccessed);
		return getSortKey(b) - getSortKey(a);
	});
	return tabs;
}

function updateVisibleTabs(query, preserveSelectedTabIndex) {
	let tabs = sortedTabs;
	if (query) {
		tabs = tabs.filter(tabMatchesQuery(query));
		const keywordTab = tabKeywords[query];
		if (keywordTab) {
			tabs.unshift(keywordTab);
		}
	}

	const prevTabIndex = getSelectedTabIndex();
	const tabIndex = preserveSelectedTabIndex && prevTabIndex < tabs.length ? prevTabIndex : 0;

	const tbody = document.getElementById('tabs_table').querySelector('tbody');
	tbody.innerHTML = ''; // Clear existing content

	tabs.forEach((tab, index) => {
		const tr = document.createElement('tr');
		tr.setAttribute('data-index', index);
		tr.setAttribute('data-tab-id', tab.id);
		tr.addEventListener('click', () => selectTab(index));
		tr.addEventListener('dblclick', () => activateTab(tab.id));

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

		tr.appendChild(td1);
		tr.appendChild(td2);
		tr.appendChild(td3);
		tbody.appendChild(tr);
	});

	selectTab(tabIndex);
}

function tabMatchesQuery(query) {
	const patterns = query.toLowerCase().split(" ");
	return tab => patterns.every(
		pattern => (tab.url || '').toLowerCase().includes(pattern) || (tab.title || '').toLowerCase().includes(pattern)
	);
}

async function beginSetTabKeyword() {
	isKeywordSetting = true;
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const keyword = await browser.sessions.getTabValue(tabs[0].id, "keyword");

	document.getElementById('tabs_table__container').style.display = 'none';
	const keywordLabel = document.getElementById('keyword_label');
	keywordLabel.style.display = 'block';

	const searchInput = document.getElementById('search_input');
	searchInput.setAttribute('aria-labelledby', 'keyword_label');
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
	const States = { pending: 0, enabled: 1, disabled: 2 };
	let state = States.pending;

	window.addEventListener('keydown', event => {
		if (event.key === ' ' && state !== States.disabled && event.ctrlKey) {
			state = States.enabled;
			const nextIndex = event.shiftKey ? getNextPageUpIndex(1) : getNextPageDownIndex(1);
			selectTab(nextIndex);
			event.preventDefault();
		}
		if (event.key === 'Control') state = States.disabled;
	});

	window.addEventListener('keyup', event => {
		if (event.key === 'Control') {
			if (state === States.enabled) {
				activateSelectedTab();
			} else {
				state = States.disabled;
			}
		}
	});
}

function selectTab(index) {
	const table = document.querySelector('#tabs_table tbody');
	const selector = `tr:nth-child(${index + 1})`;

	if (selectedTabElement) {
		selectedTabElement.classList.remove('tabs_table__selected');
	}

	selectedTabElement = table.querySelector(selector);
	if (selectedTabElement) {
		selectedTabElement.classList.add('tabs_table__selected');
	}

	scrollSelectedTabIntoView();
}

function getSelectedTabIndex() {
	const selected = document.querySelector('#tabs_table .tabs_table__selected');
	return selected ? parseInt(selected.getAttribute('data-index')) : 0;
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

function scrollSelectedTabIntoView() {
	const container = document.getElementById('tabs_table__container');
	const scrollTop = container.scrollTop;
	const scrollBottom = scrollTop + container.clientHeight;
	const elem = selectedTabElement;
	const elemTop = elem.offsetTop;
	const elemBottom = elemTop + elem.offsetHeight;

	if (elemBottom > scrollBottom) {
		container.scrollTop = scrollTop + (elemBottom - scrollBottom);
	} else if (elemTop < scrollTop) {
		container.scrollTop = elemTop;
	}
}

async function activateSelectedTab() {
	if (selectedTabElement && selectedTabElement.dataset.tabId) {
		const tabId = selectedTabElement.dataset.tabId;
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

async function closeSelectedTab() {
	if (selectedTabElement && selectedTabElement.dataset.tabId) {
		const tabId = selectedTabElement.dataset.tabId;
		await browser.tabs.remove(parseInt(tabId));
		reloadTabs();
	}
}

function handleSearchInput(event) {
	if (isKeywordSetting) return;
	if (event.target.value === "=") {
		beginSetTabKeyword();
	} else {
		updateVisibleTabs(event.target.value, false);
	}
}

function handleKeyDown(event) {
	const key = event.key;
	if (key === 'ArrowDown' || (event.ctrlKey && key === 'n')) {
		selectTab(getNextPageDownIndex(1));
		event.preventDefault();
	} else if (key === 'ArrowUp' || (event.ctrlKey && key === 'p')) {
		selectTab(getNextPageUpIndex(1));
		event.preventDefault();
	} else if (key === 'PageDown') {
		selectTab(getNextPageDownIndex(13));
		event.preventDefault();
	} else if (key === 'PageUp') {
		selectTab(getNextPageUpIndex(13));
		event.preventDefault();
	} else if (key === 'Escape') {
		window.close();
	} else if (key === 'Enter') {
		if (isKeywordSetting) {
			setTabKeyword();
		} else {
			activateSelectedTab();
		}
	} else if ((event.ctrlKey && key === 'Delete') || (event.metaKey && key === 'Backspace')) {
		closeSelectedTab();
		event.preventDefault();
	}
}

function handleKeyUp(event) {
	if (event.key === 'Control') {
		if (state === States.enabled) {
			activateSelectedTab();
		} else {
			state = States.disabled;
		}
	}
}

