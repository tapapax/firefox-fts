
Components.utils.import("resource://gre/modules/Services.jsm");

var EXPORTED_SYMBOLS = [ "Injector" ];

var Injector = { };

Injector.inject = function(callback) {
	this._windowsObserver =
		(window, topic) => windowsObserver(callback, window, topic);
	this._callback = callback;

	Services.ww.registerNotification(this._windowsObserver);
	
	this.forEachWindow((window) => {
		this._callback(window, true);
	});
}

Injector.cleanup = function() {
	Services.ww.unregisterNotification(this._windowsObserver);
	
	this.forEachWindow((window) => {
		this._callback(window, false);
	});
}

Injector.reload = function() {
	this.forEachWindow((window) => {
		this._callback(window, false);
		this._callback(window, true);
	});
}

Injector.forEachWindow = function(callback) {
	var enumerator = Services.wm.getEnumerator("navigator:browser");
	while (enumerator.hasMoreElements()) {
		var window = enumerator.getNext();
		callback(window);
	}
}

/////////////////////////////////////////////////

function windowsObserver(callback, window, topic) {
	if (topic !== "domwindowopened") {
		return;
	}

	window.addEventListener("load", function() {
		this.removeEventListener("load", arguments.callee, false);
		if (window.location.href == 'chrome://browser/content/browser.xul') {
			callback(window, true);
		}
	}, false);
}
