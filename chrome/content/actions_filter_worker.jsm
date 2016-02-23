
Components.utils.import("chrome://tabswitcher/content/lazy_actions_getter.jsm");

EXPORTED_SYMBOLS = [ "ActionsFilterWorker" ];

function ActionsFilterWorker() {
	this.actions = [];
	this.lazyActionsGetter = new LazyActionsGetter;
	this.acquiredAll = false;
}

ActionsFilterWorker.prototype.startSearch = function(query) {
	this.patterns = query.toLowerCase().split(" ");
	this.searchedActions = 0;
};

ActionsFilterWorker.prototype.work = function(actionsToProceed, found) {
	if (!this.acquiredAll) {
		this.acquiredAll =
			(this.lazyActionsGetter.Acquire(this.actions, actionsToProceed) === 0);
	}

	var toBeSearched = Math.min(
		this.searchedActions + actionsToProceed, this.actions.length);
	
	if (toBeSearched <= this.searchedActions) {
		return false;
	}

	for (; this.searchedActions < toBeSearched; ++this.searchedActions) {
		var action = this.actions[this.searchedActions];
		if (this.isSatisfying(action)) {
			found.push(action);
		}
	}

	return true;
};

ActionsFilterWorker.prototype.isSatisfying = function(action) {
	return this.patterns.every(
		(pattern) => action.searchString.indexOf(pattern) !== -1);
};
