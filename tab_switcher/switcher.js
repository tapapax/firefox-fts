
let selectedString;
let allTabsSorted;

async function reloadTabs(query) {
	if (allTabsSorted === undefined) {
		const allTabs = await browser.tabs.query({windowType: 'normal'});
		allTabsSorted = allTabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
	}

	let tabs = allTabsSorted;
	if (query) {
		tabs = tabs.filter(tabsFilter(query));
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
				$('<td></td>').text(tab.url),
			)
			.data('index', tabIndex)
			.data('tabId', tab.id)
			.on('click', () => setSelectedString(tabIndex))
			.on('dblclick', e => activateTab())
		)
	);

	setSelectedString(0);
}

function tabsFilter(query) {
	const patterns = query.toLowerCase().split(" ");
	return tab => patterns.every(
		pattern => (tab.url || '').toLowerCase().indexOf(pattern) !== -1
			|| (tab.title || '').toLowerCase().indexOf(pattern) !== -1);
}

reloadTabs();

$('#search_input')
	.focus()
	.on('input', e => reloadTabs(e.target.value));

$(window).on('keydown', event => {
	const key = event.originalEvent.key;

	if (key === 'ArrowDown') {
		setSelectedString(getNextPageDownIndex(1));
		event.preventDefault();
	} else if (key === 'ArrowUp') {
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
		activateTab();
	}
});

function setSelectedString(index) {
	const table = $('#tabs_table tbody');

	const selector = String.raw`tr:nth-child(${index+1})`;
	const newSelected = table.find(selector);
	if (!newSelected.length || index < 0) {
		return;
	}

	if (selectedString) {
		selectedString.removeClass('tabs_table__selected');
	}

	newSelected.addClass('tabs_table__selected');

	selectedString = newSelected;

	scrollToSelection();
}

function scrollToSelection() {
	if (!selectedString) {
		return;
	}

	const scrollPadding = 20;

	const tableContainer = $('#tabs_table__container');
	const stringOffset = selectedString[0].offsetTop;
	const scrollMax = stringOffset - scrollPadding;
	const scrollMin = stringOffset
		+ selectedString.height() - tableContainer.height() + scrollPadding;

	if (scrollMax < scrollMin) {
		// Resetting scroll since there is no enough space
		tableContainer.scrollTop(0);
		return;
	}

	const scrollValue = Math.max(0, scrollMin,
		Math.min(scrollMax, tableContainer.scrollTop()));
	tableContainer.scrollTop(scrollValue);
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
	return $('#tabs_table tbody tr').length;
}

function getSelectedTabIndex() {
	return selectedString ? selectedString.data('index') : undefined;
}

async function activateTab() {
	if (!selectedString) {
		return;
	}

	const tabId = selectedString.data('tabId');
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
