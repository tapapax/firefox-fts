Components.utils.import("resource://gre/modules/Services.jsm");

var EXPORTED_SYMBOLS = [ "Preferences" ];

var Preferences = { };

Preferences.getGenericPref = function(branch, prefName) {
  switch (branch.getPrefType(prefName)) {
    default:
    case 0:   return undefined; // PREF_INVALID
    case 32:  return Preferences.getUCharPref(prefName, branch);
    case 64:  return branch.getIntPref(prefName);    // PREF_INT
    case 128: return branch.getBoolPref(prefName);   // PREF_BOOL
  }
};

Preferences.setGenericPref = function(branch, prefName, prefValue) {
  switch (typeof prefValue) {
  case "string":
    Preferences.setUCharPref(prefName, prefValue, branch);
    return;
  case "number":
    branch.setIntPref(prefName, prefValue);
    return;
  case "boolean":
    branch.setBoolPref(prefName, prefValue);
    return;
  }
};

Preferences.setDefaultPref = function(prefName, prefValue) {
  var defaultBranch = Services.prefs.getDefaultBranch(null);
  Preferences.setGenericPref(defaultBranch, prefName, prefValue);
};

Preferences.getUCharPref = function(prefName, branch) {
  branch = branch ? branch : Services.prefs;
  return branch.getComplexValue(prefName,
    Components.interfaces.nsISupportsString).data;
};

Preferences.setUCharPref = function(prefName, text, branch) {
  var string = Components.classes["@mozilla.org/supports-string;1"]
    .createInstance(Components.interfaces.nsISupportsString);
  string.data = text;
 
  branch = branch ? branch : Services.prefs;
  branch.setComplexValue(prefName,
    Components.interfaces.nsISupportsString, string);
};

Preferences.getExtPrefix = function() {
  return "extensions.tabswitcher@volinsky.net.";
};

Preferences.getExtensionBranch = function () {
  return Services.prefs.getBranch(Preferences.getExtPrefix());
};

Preferences.loadDefaults = function() {
  Services.scriptloader.loadSubScript(
    "chrome://tabswitcher/content/defaultprefs.js",
    { pref: this.setDefaultPref }
  );
};
