var elResults;
var elPattern;

var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	.getService(Components.interfaces.nsIWindowMediator);

var actionsList = [];

Components.utils.import("resource://gre/modules/devtools/Console.jsm");

function init() {
	elResults = document.getElementById("results-listbox");
	elPattern = document.getElementById("pattern-textbox");

	elPattern.focus();
	elPattern.addEventListener("keypress", function(e) {
		if ([33, 34, 38, 40].indexOf(e.keyCode) !== -1) {
			var event = new KeyboardEvent("keypress", e);
			elResults.dispatchEvent(event);
			e.preventDefault();
		}
	});

	var windows = windowMediator.getEnumerator("navigator:browser");
	while (windows.hasMoreElements()) {
		var window = windows.getNext();
		for (var index = 0; index < window.gBrowser.browsers.length; ++index) {
			var tab = window.gBrowser.tabContainer.childNodes[index];
			var url = window.gBrowser.getBrowserAtIndex(index).currentURI.spec;
			var label = tab.getAttribute("label");

			actionsList.push({ window, tab, strings : [ label, url ] });
		}
	}

	actionsList.sort(function(a, b) {
		return b.tab._lastAccessed - a.tab._lastAccessed;
	});

	for (var bookmark of collectBookmarks()) {
		actionsList.push({
			strings: [ bookmark.label, bookmark.url ],
			url: bookmark.url
		});
	}

	performFind();
}

function performFind() {
	while (elResults.getRowCount()) {
		elResults.removeItemAt(0);
	}

	var re = new RegExp(elPattern.value, 'i');
	for (var action of actionsList) {
		if (action.strings.some(re.test, re)) {
			var item = addItemToList(elResults, action.strings);
			item.tabData = action
			item.setAttribute("ondblclick", "goSelected();");
		}
	}

	elResults.selectedIndex = 0;
}

function goSelected() {
	var tabData = elResults.selectedItem.tabData;
	if (tabData.window && tabData.tab) {
		tabData.window.gBrowser.selectedTab = tabData.tab;
		tabData.window.focus();
	} else if (tabData.url) {
		var win = windowMediator.getMostRecentWindow("navigator:browser");
		if (win) {
			win.delayedOpenTab(tabData.url);
		}
	}

	window.close();
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
