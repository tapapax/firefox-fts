
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

ActionsFilterWorker.prototype.work = function(actionsToSearch, found) {
	var totalToSearch = this.searchedActions + actionsToSearch;

	if (!this.acquiredAll) {
		var actionsToAcquire = totalToSearch - this.actions.length + 1;
		this.acquiredAll =
			(this.lazyActionsGetter.Acquire(this.actions, actionsToAcquire) === 0);
	}

	totalToSearch = Math.min(totalToSearch, this.actions.length);
	
	for (var i = this.searchedActions; i < totalToSearch; ++i) {
		var action = this.actions[i];
		if (this.isSatisfying(action)) {
			found.push(action);
		}
	}

	this.searchedActions = totalToSearch;

	return this.searchedActions < this.actions.length;
};

ActionsFilterWorker.prototype.isSatisfying = function(action) {
	return this.patterns.every(
		(pattern) => action.searchString.indexOf(pattern) !== -1);
};
