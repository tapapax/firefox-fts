Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://tabswitcher/content/preferences.jsm");

var resultsListbox;
var patternTextbox;

var actionsList = [];

///////////////////////////////////////////////////////////////

function Action(columnsText, options) {
	this.columnsText = columnsText;
	this.options = options;
	this.searchString = columnsText.join(" ").toLowerCase();
}

Action.prototype.perform = function() {
	if (this.options.window && this.options.tab) {
		this.options.window.gBrowser.selectedTab = this.options.tab;
		this.options.window.focus();
	} else if (this.options.url) {
		var win = Services.wm.getMostRecentWindow("navigator:browser");
		if (win) {
			win.delayedOpenTab(this.options.url);
		}
	}
}

Action.prototype.getOrder = function() {
	return this.options.tab ? this.options.tab._lastAccessed : 0;
}

///////////////////////////////////////////////////////////////

function init() {
	resultsListbox = document.getElementById("results-listbox");
	patternTextbox = document.getElementById("pattern-textbox");

	patternTextbox.focus();
	patternTextbox.addEventListener("keypress", function(e) {
		if ([33, 34, 38, 40].indexOf(e.keyCode) !== -1) {
			var event = new KeyboardEvent("keypress", e);
			resultsListbox.dispatchEvent(event);
			e.preventDefault();
		}
	});

	setTimeout(function() {
		collectActions();
		filterResults();
	}, 0);
}

function collectActions() {
	var windows = Services.wm.getEnumerator("navigator:browser");
	while (windows.hasMoreElements()) {
		var window = windows.getNext();
		for (var index = 0; index < window.gBrowser.browsers.length; ++index) {
			var tab = window.gBrowser.tabContainer.childNodes[index];
			var url = window.gBrowser.getBrowserAtIndex(index).currentURI.spec;
			var label = tab.getAttribute("label");

			actionsList.push(new Action([ label, url ], { window, tab }));
		}
	}

	actionsList.sort(function(a, b) {
		return b.getOrder() - a.getOrder();
	});

	if (Preferences.getExtensionBranch().getBoolPref("bookmarksActions")) {
		for (var bookmark of collectBookmarks()) {
			actionsList.push(new Action(
				[ bookmark.label, bookmark.url ],
				{ url: bookmark.url }
			));
		}
	}
}

function filterResults() {
	while (resultsListbox.getRowCount()) {
		resultsListbox.removeItemAt(0);
	}

	var patterns = patternTextbox.value.toLowerCase().split(" ");
	
	for (var action of actionsList) {
		if (patterns.every(pattern => action.searchString.indexOf(pattern) !== -1)) {
			var item = addItemToList(resultsListbox, action.columnsText);
			item.actionData = action;
			item.addEventListener("dblclick", performAction);
		}
	}

	resultsListbox.selectedIndex = 0;
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

function collectBookmarks() {
	var bs =
		Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
  		.getService(Components.interfaces.nsINavBookmarksService);

  var array = [];

	var folderRecurser = function(currentParent) {
	  var index = 0;
	  while (true) {
			var id = bs.getIdForItemAt(currentParent, index);
			if (id === -1) break;

			var item_type = bs.getItemType(id);
			if (item_type === bs.TYPE_BOOKMARK) {
				array.push({
					url: bs.getBookmarkURI(id).spec,
					label: bs.getItemTitle(id)
				});
			} else if (item_type === bs.TYPE_FOLDER) {
				folderRecurser(id);
			}

			++index;
	  }
	};

	folderRecurser(bs.bookmarksMenuFolder);

	return array;
}
