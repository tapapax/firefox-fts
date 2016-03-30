"use strict";

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://tabswitcher/content/preferences.jsm");
Components.utils.import("chrome://tabswitcher/content/actions_filter_worker.jsm");

var resultsListbox;
var patternTextbox;
var progressImage;

var actionsFilter = new ActionsFilterWorker;
var filteringTimeout;

///////////////////////////////////////////////////////////////

function init() {
	resultsListbox = document.getElementById("results-listbox");
	patternTextbox = document.getElementById("pattern-textbox");
	progressImage = document.getElementById("progress-image");

	patternTextbox.focus();
	patternTextbox.addEventListener("keypress", function(e) {
		if ([33, 34, 38, 40].indexOf(e.keyCode) !== -1) {
			var event;
			try {
				event = new KeyboardEvent("keypress", e);
			} catch (ex) {
				event = document.createEvent("KeyboardEvent");
				event.initKeyEvent("keypress", true, true, null, false, false, false,
					false, e.keyCode, 0);
			}
			resultsListbox.dispatchEvent(event);
			e.preventDefault();
		}
	});

	window.addEventListener("deactivate", () => window.close());

	filterResults();
}

function filterResults() {
	if (filteringTimeout) {
		clearTimeout(filteringTimeout);
	}

	while (resultsListbox.getRowCount()) {
		resultsListbox.removeItemAt(0);
	}

	actionsFilter.startSearch(patternTextbox.value);

	doFilterSome();

	resultsListbox.selectedIndex = 0;
}

function doFilterSome() {
	const MAX_RESULTS = 20;
	const ACTIONS_TO_PROCEED = 100;
	var filtered = [];
	var moreActions = actionsFilter.work(ACTIONS_TO_PROCEED, filtered);
	for (var item of filtered) {
		var listitem = addItemToList(resultsListbox, item.columnsText);
		listitem.actionData = item;
		listitem.addEventListener("dblclick", performAction);
	}

	var inProgress = resultsListbox.getRowCount() < MAX_RESULTS && moreActions;
	progressImage.hidden = !inProgress;
	if (inProgress) {
		filteringTimeout = setTimeout(doFilterSome, 0);
	} else if (moreActions) {
		addItemToList(resultsListbox, ["..."]);
	}
}

function performAction() {
	try {
		resultsListbox.selectedItem.actionData.perform();
		window.close();
	} catch (e) { }
}

function addItemToList(list, cells) {
	var item = document.createElement("listitem");

	for (var cell of cells) {
		var cellElement = document.createElement("listcell");
		cellElement.setAttribute("label", cell);
		item.appendChild(cellElement);
	}

	list.appendChild(item);

	return item;
}
