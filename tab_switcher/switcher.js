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

	$('#tabs_table tbody').empty().append(
		tabs.map((tab, tabIndex) =>
			$('<tr></tr>').append(
				$('<td></td>').append(
					tab.favIconUrl
						? $('<img width="16" height="16">')
							.attr('src',
								!tab.incognito
									? tab.favIconUrl
									: '/icons/mask16.svg'
							)
						: null
				),
				$('<td></td>').text(tab.title),
				$('<td></td>').text(tab.url)
			)
				.data('index', tabIndex)
				.data('tabId', tab.id)
				.on('click', () => setSelectedString(tabIndex))
				.on('dblclick', e => activateTab())
		)
	);

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
	$("#tabs_table__container").hide();
	$("#keyword_label").show();
	$("#search_input").attr("aria-labelledby", "keyword_label")
		.val(keyword)
		.select();
}

async function setTabKeyword() {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	let keyword = $('#search_input').val();
	await browser.sessions.setTabValue(tabs[0].id, "keyword", keyword);
	window.close();
}

reloadTabs();

$('#search_input')
	.focus()
	.on('input', event => {
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

$(window).on('keydown', event => {
	const key = event.originalEvent.key;

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

function enableQuickSwitch() {
	const States = {
		pending: 0,
		enabled: 1,
		disabled: 2,
	};

	let state = States.pending;

	$(window).on('keydown', event => {
		const key = event.originalEvent.key;

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

	$(window).on('keyup', event => {
		const key = event.originalEvent.key;

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
	const table = $('#tabs_table tbody');
	const selector = String.raw`tr:nth-child(${index + 1})`;

	if (selectedString) {
		selectedString.removeClass('tabs_table__selected');
	}
	selectedString = table.find(selector).addClass('tabs_table__selected');
	scrollIntoView();
}

function getSelectedTabIndex() {
	const selected = $('#tabs_table .tabs_table__selected');
	if (selected.length === 0) {
		return 0;
	} else {
		return selected.data('index');
	}
}

function getNextPageDownIndex(stepSize) {
	const tabIndex = getSelectedTabIndex();
	const numVisibleTabs = $('#tabs_table tbody tr').length;
	return (tabIndex + stepSize) % numVisibleTabs;
}

function getNextPageUpIndex(stepSize) {
	const tabIndex = getSelectedTabIndex();
	const numVisibleTabs = $('#tabs_table tbody tr').length;
	return (tabIndex - stepSize + numVisibleTabs) % numVisibleTabs;
}

function scrollIntoView() {
	const container = $('#tabs_table__container');
	const scrollTop = container.scrollTop();
	const scrollBottom = scrollTop + container.height();

	const elem = selectedString;
	const elemTop = elem.position().top;
	const elemBottom = elemTop + elem.height();

	if (elemBottom > scrollBottom) {
		container.scrollTop(scrollTop + elemBottom - scrollBottom);
	} else if (elemTop < 0) {
		container.scrollTop(scrollTop + elemTop);
	}
}

async function activateTab() {
	const tabId = selectedString.data('tabId');
	const tab = await browser.tabs.get(tabId);
	await browser.tabs.update(tab.id, { active: true });
	await browser.windows.update(tab.windowId, { focused: true });
	window.close();
}

async function closeTab() {
	const tabId = selectedString.data('tabId');
	await browser.tabs.remove(tabId);
	reloadTabs();
}

