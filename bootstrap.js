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

		keyElement = document.createElement("key");
		keyElement.id = KEY_ID;

		var modifiers = ["control", "alt", "shift"].filter(
				mod => Preferences.getExtensionBranch().getBoolPref("openkey." + mod)
			).join(" ");
		keyElement.setAttribute("modifiers", modifiers);

		var key = Preferences.getUCharPref("openkey.key", Preferences.getExtensionBranch());
		keyElement.setAttribute(key.length > 1 ? "keycode" : "key", key);
		keyElement.setAttribute("oncommand",
			"window.open('chrome://tabswitcher/content/switcher.xul', \
				'TabswitcherMainWindow', \
				'chrome,centerscreen,width=1000,height=500,resizable');");

		keyset.appendChild(keyElement);

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

function startup(extData) {
	Components.utils.import("chrome://tabswitcher/content/preferences.jsm");

	doUpgrade(extData);

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

function doUpgrade(extData) {
	try {
		var versionComparator =
			Components.classes["@mozilla.org/xpcom/version-comparator;1"]
	    .getService(Components.interfaces.nsIVersionComparator);

	  if (extData.oldVersion
	  	&& versionComparator.compare("1.0.4", extData.oldVersion) > 0)
	  {
	  	var extBranch = Preferences.getExtensionBranch();
	  	for (var name of ["key", "control", "shift", "alt"]) {
	  		if (extBranch.prefHasUserValue("openkey." + name)) {
	  			return;
	  		}
	  	}

	  	Preferences.setGenericPref(extBranch, "openkey.key", "D");
	  	Preferences.setGenericPref(extBranch, "openkey.shift", true);
	  	Preferences.setGenericPref(extBranch, "openkey.alt", true);
	  	Preferences.setGenericPref(extBranch, "openkey.control", false);
	  }
	} catch (e) { }
}
