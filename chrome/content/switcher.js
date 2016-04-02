"use strict";

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://tabswitcher/content/preferences.jsm");
Components.utils.import("chrome://tabswitcher/content/actions_filter_worker.jsm");

///////////////////////////////////////////////////////////////

const MAX_RESULTS = 20;

var Switcher = { };

Switcher.init = function() {
	this.resultsListbox = document.getElementById("results-listbox");
	this.patternTextbox = document.getElementById("pattern-textbox");
	this.progressImage = document.getElementById("progress-image");
	this.performCommand = document.getElementById("perform-command");

	this.patternTextbox.focus();
	this.addListeners();

	this.actionsFilter = new ActionsFilterWorker;
	this.filterResults();
};

Switcher.addListeners = function() {
	this.performCommand.addEventListener("command", this.performAction.bind(this));
	this.patternTextbox.addEventListener("input", this.filterResults.bind(this));
	this.patternTextbox.addEventListener("keypress", this.textboxListener.bind(this));
	this.resultsListbox.addEventListener("dblclick", this.performAction.bind(this));

	window.addEventListener("deactivate", () => window.close());
};

Switcher.textboxListener = function(e) {
	if ([33, 34, 38, 40].indexOf(e.keyCode) !== -1) {
		var event;
		try {
			event = new KeyboardEvent("keypress", e);
		} catch (ex) {
			event = document.createEvent("KeyboardEvent");
			event.initKeyEvent("keypress", true, true, null, false, false, false,
				false, e.keyCode, 0);
		}
		this.resultsListbox.dispatchEvent(event);
		e.preventDefault();
	}
};

Switcher.stopFiltering = function() {
	if (this.filteringTimeout) {
		clearTimeout(this.filteringTimeout);
	}
};

Switcher.filterResults = function() {
	this.stopFiltering();

	while (this.resultsListbox.getRowCount()) {
		this.resultsListbox.removeItemAt(0);
	}

	this.maxResults = MAX_RESULTS;
	this.actionsFilter.startSearch(this.patternTextbox.value);
	this.doFilterSome();
};

Switcher.doFilterSome = function() {
	const ACTIONS_TO_PROCEED = 100;
	var filtered = [];
	var moreActions = this.actionsFilter.work(ACTIONS_TO_PROCEED, filtered);
	for (var item of filtered) {
		var listItem = addItemToList(this.resultsListbox, item.columnsText);
		listItem.perform = item.perform.bind(item);
	}

	var inProgress = moreActions
		&& this.resultsListbox.getRowCount() < this.maxResults;
	this.progressImage.hidden = !inProgress;
	if (inProgress) {
		this.filteringTimeout = setTimeout(this.doFilterSome.bind(this), 0);
	} else if (moreActions) {
		addItemToList(this.resultsListbox, ["Show more..."])
			.perform = this.showMoreResults.bind(this);
	}

	if (this.resultsListbox.selectedIndex === -1) {
		this.resultsListbox.selectedIndex = 0;
	}
};

Switcher.showMoreResults = function() {
	this.maxResults = this.resultsListbox.getRowCount() + MAX_RESULTS;
	var lastItemIndex = this.resultsListbox.getRowCount() - 1;
	this.resultsListbox.removeItemAt(lastItemIndex);
	this.resultsListbox.selectedIndex = lastItemIndex - 1;
	this.doFilterSome();
};

Switcher.performAction = function() {
	var selectedItem = this.resultsListbox.selectedItem;
	var action = selectedItem ? selectedItem.perform : null;
	if (action) {
		this.stopFiltering();
		if (action()) {
			window.close();
		}
	}
};

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
