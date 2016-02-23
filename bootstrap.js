Components.utils.import("resource://gre/modules/Services.jsm");

function getInitialTabOrder() {
	var tabOrder = [];
	Injector.forEachWindow(function(window) {
		for (var tab of window.gBrowser.tabContainer.childNodes) {
			tabOrder.push(tab);
		}
	});
	tabOrder.sort((a, b) => a._lastAccessed - b._lastAccessed);
	return tabOrder;
}

function updateTabOrder(event) {
	var tabOrder = TabswitcherData.tabOrder;
	var index = tabOrder.indexOf(event.target);
	if (index !== -1) {
		tabOrder.splice(index, 1);
	}
	if (event.type !== "TabClose") {
		tabOrder.push(event.target);
	}
}

function onWinUnload(event) {
	for (var tab of event.currentTarget.gBrowser.tabContainer.childNodes) {
		updateTabOrder({ type: "TabClose", target: tab });
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

	var tabEvents = [ "TabSelect", "TabClose", "TabOpen" ];
	tabEvents.forEach((event) => {
		window.gBrowser.tabContainer.removeEventListener(event, updateTabOrder);
	});

	window.removeEventListener("unload", onWinUnload);

	if (activate) {
		for (var tab of window.gBrowser.tabContainer.childNodes) {
			if (TabswitcherData.tabOrder.indexOf(tab) === -1) {
				TabswitcherData.tabOrder.push(tab);
			}
		}

		tabEvents.forEach((event) => {
			window.gBrowser.tabContainer.addEventListener(event, updateTabOrder);
		});

		window.addEventListener("unload", onWinUnload);

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

var openkeyObserver = {
	observe: function() {
		Injector.reload();
	}
};

function startup(extData) {
	Components.utils.import("chrome://tabswitcher/content/preferences.jsm");
	Components.utils.import("chrome://tabswitcher/content/libs/injector.jsm");
	Components.utils.import("chrome://tabswitcher/content/tabswitcher_data.jsm");

	doUpgrade(extData);

	Preferences.loadDefaults();

	TabswitcherData.tabOrder = getInitialTabOrder();
	Injector.inject(updateWinInject);

	Services.prefs.addObserver(
		Preferences.getExtPrefix() + "openkey.", openkeyObserver, false);
}

function shutdown() {
	Services.prefs.removeObserver(
		Preferences.getExtPrefix() + "openkey.", openkeyObserver);

	Injector.cleanup();
}

function doUpgrade(extData) {
	if (extData.oldVersion) {
		var win = Services.wm.getMostRecentWindow("navigator:browser");
		if (win) {
			win.delayedOpenTab("http://tapapax.github.io/firefox-fts/");
		}
	}
}
