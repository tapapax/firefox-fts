Components.utils.import("resource://gre/modules/Services.jsm");

var MAX_VERSION_TO_SHOW_CHANGES = "1.0.8";

var ADDON_MODULES = [
	"chrome://tabswitcher/content/actions_filter_worker.jsm"
	,"chrome://tabswitcher/content/lazy_actions_getter.jsm"
	,"chrome://tabswitcher/content/preferences.jsm"
	,"chrome://tabswitcher/content/tabswitcher_data.jsm"
	,"chrome://tabswitcher/content/libs/injector.jsm"
];

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

function onKeyDownFix(event) {
	// REFACTORME: temporary quick workaround for 52 ff version

	if (event.keyCode != 32 || event.metaKey || event.shiftKey || !event.ctrlKey) {
		return;
	}

	if (!event.view || !event.view.open) {
		return;
	}

	event.view.open('chrome://tabswitcher/content/switcher.xul', 
		'TabswitcherMainWindow', 
		'chrome,centerscreen,width=1000,height=500,resizable');

	if (event.preventDefault) {
		event.preventDefault();
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
	window.removeEventListener("keydown", onKeyDownFix);

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
		keyElement.setAttribute("reserved", "true");
		keyElement.setAttribute("oncommand",
			"window.open('chrome://tabswitcher/content/switcher.xul', \
				'TabswitcherMainWindow', \
				'chrome,centerscreen,width=1000,height=500,resizable');");

		if (key == " " && modifiers == "control") {
			window.addEventListener("keydown", onKeyDownFix);
		} else {
			keyset.appendChild(keyElement);
		}

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
	// TODO: remove - temporary unloading modules on install to fix update
	// from previous versions
	unloadAddonModules();

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

	unloadAddonModules();
}

function unloadAddonModules() {
	for (var module of ADDON_MODULES) {
		try {
			Components.utils.unload(module);
		} catch (e) {}
	}
}

function doUpgrade(extData) {
	if (!extData.oldVersion) {
		return;
	}

	if (Services.vc.compare(extData.oldVersion, MAX_VERSION_TO_SHOW_CHANGES) > 0) {
		return;
	}

	var win = Services.wm.getMostRecentWindow("navigator:browser");
	if (win) {
		win.delayedOpenTab("http://tapapax.github.io/firefox-fts/");
	}
}
