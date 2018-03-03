
let selectedString;

async function reloadTabs(query) {
	let tabs = await browser.tabs.query({windowType: 'normal'});
	if (query) {
		tabs = tabs.filter(tabsFilter(query));
	}

	$('#tabs_table tbody').empty().append(
		tabs.map((tab, tabIndex) =>
			$('<tr></tr>').append(
				$('<td></td>').append(
					tab.favIconUrl
						? $('<img width="16" height="16">')
							.attr('src', tab.favIconUrl)
						: null
				),
				$('<td></td>').text(tab.title),
				$('<td></td>').text(tab.url),
			)
			.data('index', tabIndex)
			.data('tabId', tab.id)
			.on('click', () => setSelectedString(tabIndex))
		)
	);

	setSelectedString(0);
}

function tabsFilter(query) {
	const patterns = query.toLowerCase().split(" ");
	return tab => patterns.every(
		pattern => tab.url.indexOf(pattern) !== -1
			|| tab.title.indexOf(pattern) !== -1);
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

	newSelected.addClass('tabs_table__selected');
	if (selectedString) {
		selectedString.removeClass('tabs_table__selected');
	}

	selectedString = newSelected;

	const tableContainer = table.parent();
	const stringOffset = selectedString[0].offsetTop;
	const scrollMax = stringOffset - 20;
	const scrollMin = stringOffset + selectedString.height() - tableContainer.height() + 20;

	const scrollValue = Math.max(scrollMin,
		Math.min(scrollMax, tableContainer.scrollTop()));
	tableContainer.scrollTop(scrollValue);
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
