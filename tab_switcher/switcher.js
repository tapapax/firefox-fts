
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
		setSelectedString(getSelectedString() + 1);
		event.preventDefault();
	} else if (key === 'ArrowUp') {
		setSelectedString(getSelectedString() - 1);
		event.preventDefault();
	} else if (key === 'PageDown') {
		setSelectedString(Math.min(getSelectedString() + 13, getTableSize() - 1));
		event.preventDefault();
	} else if (key === 'PageUp') {
		setSelectedString(Math.max(getSelectedString() - 13, 0));
		event.preventDefault();
	} else if (key === 'Escape') {
		browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
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

	const tableContainer = $('#tabs_table__container');
	const stringOffset = selectedString[0].offsetTop;
	const scrollMax = stringOffset - 20;
	const scrollMin = stringOffset + selectedString.height() - tableContainer.height() + 20;

	const scrollValue = Math.max(scrollMin,
		Math.min(scrollMax, tableContainer.scrollTop()));
	tableContainer.scrollTop(scrollValue);
}

function getTableSize() {
	return $('#tabs_table tbody tr').length;
}

function getSelectedString() {
	return selectedString ? selectedString.data('index') : undefined;
}

async function activateTab() {
	if (!selectedString) {
		return;
	}

	const tabId = selectedString.data('tabId');

	await browser.tabs.update(tabId, {active: true});

	const tab = await browser.tabs.get(tabId);
	await browser.windows.update(tab.windowId, {focused: true});
}

async function firefox57WorkaroundForBlankPanel() {
	// https://bugzilla.mozilla.org/show_bug.cgi?id=1425829
	// browser. windows. create () displays blank windows (panel, popup or detached_panel)
	// The trick to display content is to resize the window...

	const currentWindow = await browser.windows.getCurrent();
	const updateInfo = {
		width: currentWindow.width,
		height: currentWindow.height + 1, // 1 pixel more than original size...
	};
	browser.windows.update(currentWindow.id, updateInfo);
}

firefox57WorkaroundForBlankPanel();
