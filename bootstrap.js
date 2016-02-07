
Components.utils.import("resource://gre/modules/devtools/Console.jsm");

function Preferences() {
	this.root = Components.classes["@mozilla.org/preferences;1"]
		.getService(Components.interfaces.nsIPrefBranch);
	this.prefix = "extensions.tabswitcher@volinsky.net.";
	this.getModifiers = function() {
		return ["control", "alt", "shift"].filter(
			function(mod) { 
				return this.root.getBoolPref(this.prefix + "openkey." + mod);
			}, this).join(" ");
	}
}

function updateWinInject(window, activate) {
	var KEY_ID = "key_opentabswitcher";
	var KEYSET_ID = "keyset_tabswitcher";

	var document = window.document;
	
	var keyset = document.getElementById(KEYSET_ID);
	if (keyset) {
		keyset.parentElement.removeChild(keyset);
	} else {
		keyset = document.createElement("keyset");
		keyset.id = KEYSET_ID;
	}

	if (activate) {
		while (keyset.firstChild) {
			keyset.removeChild(keyset.firstChild);
		}

		var prefs = new Preferences;

		key = document.createElement("key");
		key.id = KEY_ID;
		key.setAttribute("modifiers", prefs.getModifiers());
		key.setAttribute("key", prefs.root.getCharPref(prefs.prefix + "openkey.key"));
		key.setAttribute("oncommand",
			"window.open('chrome://tabswitcher/content/switcher.xul', \
				'TabswitcherMainWindow', \
				'chrome,centerscreen,width=1000,height=500,resizable');");
		keyset.appendChild(key);

		var mainKeyset = document.getElementById("mainKeyset");
		mainKeyset.parentElement.insertBefore(keyset, mainKeyset);
	}
}

function windowsObserver(window, topic) {
	if (topic !== "domwindowopened") {
		return;
	}

	window.addEventListener("load", function() {
		this.removeEventListener("load", arguments.callee, false);
		if (window.location.href == 'chrome://browser/content/browser.xul') {
			updateWinInject(window, true);
		}
	}, false);
}

function injectIntoWindows() {
	var wwClass = Components.classes["@mozilla.org/embedcomp/window-watcher;1"];
	var ww = wwClass.getService(Components.interfaces.nsIWindowWatcher);
	ww.registerNotification(windowsObserver);
	
	var wmClass = Components.classes["@mozilla.org/appshell/window-mediator;1"];
	var wm = wmClass.getService(Components.interfaces.nsIWindowMediator);
	enumerator = wm.getEnumerator("navigator:browser");
	while (enumerator.hasMoreElements()) {
		var window = enumerator.getNext();
		updateWinInject(window, true);
	}
}

function clearWindowsInjection() {
	var wwClass = Components.classes["@mozilla.org/embedcomp/window-watcher;1"];
	var ww = wwClass.getService(Components.interfaces.nsIWindowWatcher);
	ww.unregisterNotification(windowsObserver);
	
	var wmClass = Components.classes["@mozilla.org/appshell/window-mediator;1"];
	var wm = wmClass.getService(Components.interfaces.nsIWindowMediator);
	enumerator = wm.getEnumerator("navigator:browser");
	while (enumerator.hasMoreElements()) {
		var window = enumerator.getNext();
		updateWinInject(window, false);
	}
}

var openkeyObserver = {
	observe: function() {
		clearWindowsInjection();
		injectIntoWindows();
	}
};

function startup() {
	injectIntoWindows();

	var prefs = new Preferences;
	prefs.root.addObserver(prefs.prefix + "openkey.", openkeyObserver, false);
}

function shutdown() {
	var prefs = new Preferences;
	prefs.root.removeObserver(prefs.prefix + "openkey.", openkeyObserver);

	clearWindowsInjection();
}

function install() {
	var prefs = new Preferences;
	try {
		prefs.root.getCharPref(prefs.prefix + "openkey.key");
	} catch (e) {
		prefs.root.setCharPref(prefs.prefix + "openkey.key", "D");
		prefs.root.setBoolPref(prefs.prefix + "openkey.control", false);
		prefs.root.setBoolPref(prefs.prefix + "openkey.shift", true);
		prefs.root.setBoolPref(prefs.prefix + "openkey.alt", true);
	}
}

function uninstall() { }
