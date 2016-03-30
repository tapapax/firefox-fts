
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://tabswitcher/content/tabswitcher_data.jsm");
Components.utils.import("chrome://tabswitcher/content/preferences.jsm");

var EXPORTED_SYMBOLS = [ "LazyActionsGetter" ];

var ActionsEnums = {
	TABS: 1,
	BOOKMARKS: 2,

	DONE: 3 // should be last
};

var EnumStatuses = {
	INITIAL: 0,
	STARTED: 1
};

///////////////////////////////////////////////////////////////
// class Action

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

///////////////////////////////////////////////////////////////
// class LazyActionsGetter

function LazyActionsGetter() {
	this.enum = ActionsEnums.TABS;
	this.enumStatus = EnumStatuses.INITIAL;
	this.enableBookmarks =
		Preferences.getExtensionBranch().getBoolPref("bookmarksActions");
}

LazyActionsGetter.prototype.Acquire = function(actions, count) {
	var initialCount = count;
	while (count > 0) {
		var actionsLengthBefore = actions.length;

		switch (this.enum) {
		case ActionsEnums.TABS:
			this.AcquireTabs(actions, count);
			break;
		case ActionsEnums.BOOKMARKS:
			if (this.enableBookmarks) {
				this.AcquireBookmarks(actions, count);
			}
			break;
		default:
			return initialCount - count;
		}

		count -= actions.length - actionsLengthBefore;

		if (count > 0) {
			this.enum++;
			this.enumStatus = EnumStatuses.INITIAL;
		}
	}

	return initialCount - count;
};

LazyActionsGetter.prototype.AcquireTabs = function(actions, count) {
	if (this.enumStatus === EnumStatuses.INITIAL) {
		this.enumStatus = EnumStatuses.STARTED;
		this.state = { nextIndex: TabswitcherData.tabOrder.length - 1 };
	}

	for (; this.state.nextIndex >= 0 && count > 0; this.state.nextIndex--, count--) {
		var tab = TabswitcherData.tabOrder[this.state.nextIndex];
		var window = tab.ownerGlobal;
		var uri = tab.linkedBrowser.currentURI;
		var urlString = uri ? uri.spec : "";
		var label = tab.getAttribute("label");

		actions.push(new Action([ label, urlString ], { window: window, tab: tab }));
	}
};

LazyActionsGetter.prototype.AcquireBookmarks = function(actions, count) {
	if (this.enumStatus === EnumStatuses.INITIAL) {
		this.enumStatus = EnumStatuses.STARTED;
		
		var bs = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
  		.getService(Components.interfaces.nsINavBookmarksService)
		this.state = { bs: bs,
			folderStack: [ { folder: bs.bookmarksMenuFolder, nextIndex: 0 } ] };
	}

	var bs = this.state.bs;

	if (this.state.folderStack.length <= 0) {
		return;
	}

	while (count > 0) {
		var stackElem = this.state.folderStack[this.state.folderStack.length - 1];
		var id = bs.getIdForItemAt(stackElem.folder, stackElem.nextIndex++);
		if (id === -1) {
			this.state.folderStack.pop();
			if (this.state.folderStack.length <= 0) {
				break;
			}
		} else {
			var item_type = bs.getItemType(id);
			if (item_type === bs.TYPE_FOLDER) {
				this.state.folderStack.push( { folder: id, nextIndex: 0 } );
			} else if (item_type === bs.TYPE_BOOKMARK) {
				var url = bs.getBookmarkURI(id).spec;
				var label = bs.getItemTitle(id);
				actions.push(new Action([ label, url ], { url: url }));
				count--;
			}
		}
	}
};
