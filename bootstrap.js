Components.utils.import("resource://gre/modules/Services.jsm");

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

		key = document.createElement("key");
		key.id = KEY_ID;

		var modifiers = ["control", "alt", "shift"].filter(
				mod => Preferences.getExtensionBranch().getBoolPref("openkey." + mod)
			).join(" ");
		key.setAttribute("modifiers", modifiers);

		key.setAttribute("key",
			Preferences.getUCharPref("openkey.key", Preferences.getExtensionBranch()));
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
	Services.ww.registerNotification(windowsObserver);
	
	var enumerator = Services.wm.getEnumerator("navigator:browser");
	while (enumerator.hasMoreElements()) {
		var window = enumerator.getNext();
		updateWinInject(window, true);
	}
}

function clearWindowsInjection() {
	Services.ww.unregisterNotification(windowsObserver);
	
	var enumerator = Services.wm.getEnumerator("navigator:browser");
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
	Components.utils.import("chrome://tabswitcher/content/preferences.jsm");

	Preferences.loadDefaults();

	injectIntoWindows();

	Services.prefs.addObserver(
		Preferences.getExtPrefix() + "openkey.", openkeyObserver, false);
}

function shutdown() {
	Services.prefs.removeObserver(
		Preferences.getExtPrefix() + "openkey.", openkeyObserver);

	clearWindowsInjection();
}

function install() { }

function uninstall() { }
