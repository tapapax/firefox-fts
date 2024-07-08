/*
 license: The MIT License, Copyright (c) 2018 YUKI "Piro" Hiroshi
 original:
   http://github.com/piroor/webextensions-lib-shortcut-customize-ui
*/

// eslint-disable-next-line no-unused-vars
const ShortcutCustomizeUI = {
  available: (
    typeof browser.commands.update == 'function' &&
    typeof browser.commands.reset == 'function'
  ),
  uniqueKey: parseInt(Math.random() * Math.pow(2, 16)),
  get commonClass() {
    delete this.commonClass;
    return this.commonClass = `shortcut-customize-ui-${this.uniqueKey}`;
  },

  async build(options) {
    const defaultOptions = {
      showDescriptions: true
    };
    options        = Object.assign({}, defaultOptions, options || {});
    const isMac    = /^Mac/i.test(navigator.platform);
    const commands = await browser.commands.getAll();
    const list     = document.createElement('ul');
    list.classList.add(this.commonClass);
    list.classList.add('shortcuts');
    const items    = [];
    for (let command of commands) {
      const initialShortcut = command.shortcut || '';
      command.currentUnmodifedHotkey = initialShortcut.replace(/(Alt|Control|Ctrl|Command|Meta|Shift)\+/gi, '').trim();

      const item = document.createElement('li');
      item.classList.add(this.commonClass);
      item.classList.add('shortcut');

      if (options.showDescriptions) {
        const name = `${command.description || command.name}: `
          .replace(/__MSG_(.+?)__/g, aMatched => browser.i18n.getMessage(aMatched.slice(6, -2)));
        const nameLabel = item.appendChild(document.createElement('label'));
        nameLabel.classList.add(this.commonClass);
        nameLabel.textContent = name;
      }

      const keyCombination = item.appendChild(document.createElement('span'));
      keyCombination.classList.add(this.commonClass);
      keyCombination.classList.add('key-combination');


      const keyField   = keyCombination.appendChild(document.createElement('input'));
      const ctrlLabel  = this.buildCheckBoxWithLabel(this.getLocalizedKey(isMac ? 'MacCtrl' : 'Ctrl') || isMac ? 'Control' : 'Ctrl');
      const metaLabel  = this.buildCheckBoxWithLabel(this.getLocalizedKey('Command') || isMac ? '⌘' : 'Meta');
      const altLabel   = this.buildCheckBoxWithLabel(this.getLocalizedKey('Alt') || 'Alt');
      const shiftLabel = this.buildCheckBoxWithLabel(this.getLocalizedKey('Shift') || 'Shift');
      const checkboxes = isMac ? [metaLabel, ctrlLabel, altLabel, shiftLabel] : [ctrlLabel, altLabel, shiftLabel /* , metaLabel */] ;

      const createEvent = (aName, aShortcut) => {
        return new CustomEvent('ShortcutChanged', {
          detail: {
            name: aName,
            key:  aShortcut
          }
        })
      };

      const update = () => {
        const key = this.normalizeKey(keyField.value);
        if (!key)
          return;
        const shortcut = [];
        if (altLabel.checkbox.checked)
          shortcut.push('Alt');
        if (ctrlLabel.checkbox.checked)
          shortcut.push(isMac ? 'MacCtrl' : 'Ctrl');
        if (metaLabel.checkbox.checked)
          shortcut.push('Command');
        if (shiftLabel.checkbox.checked)
          shortcut.push('Shift');
        shortcut.push(key);
        command.currentUnmodifedHotkey = key;
        const fullShortcut = shortcut.join('+');
        try {
          browser.commands.update({
            name:     command.name,
            shortcut: fullShortcut
          });
          item.classList.remove('error');
          list.dispatchEvent(createEvent(command.name, fullShortcut));
        }
        catch(_aError) {
          item.classList.add('error');
        }
      };

      const apply = () => {
        let key = command.shortcut || '';
        altLabel.checkbox.checked   = /Alt/i.test(key);
        ctrlLabel.checkbox.checked  = /Ctrl|MacCtrl/i.test(key);
        metaLabel.checkbox.checked  = /Command/i.test(key) || (isMac && /Ctrl/i.test(key));
        shiftLabel.checkbox.checked = /Shift/i.test(key);
        key = key.replace(/(Alt|Control|Ctrl|Command|Meta|Shift)\+/gi, '').trim();
        keyField.value = this.getLocalizedKey(key) || key;
      };

      const reset = () => {
        browser.commands.reset(command.name);
        browser.commands.getAll().then(aCommands => {
          for (const defaultCommand of aCommands) {
            if (defaultCommand.name != command.name)
              continue;
            command = defaultCommand;
            list.dispatchEvent(createEvent(command.name, command.shortcut));
            item.classList.remove('error');
            apply();
            break;
          }
        });
      };

      const cleanKeyField = () => {
        keyField.value = this.getLocalizedKey(command.currentUnmodifedHotkey) || command.currentUnmodifedHotkey;
      }

      for (const checkbox of checkboxes) {
        keyCombination.appendChild(checkbox);
        keyCombination.appendChild(document.createTextNode('+'));
        checkbox.addEventListener('change', update);
      }

      keyField.setAttribute('type', 'text');
      keyField.setAttribute('size', 8);
      keyField.addEventListener('input', update);
      keyField.addEventListener('blur', cleanKeyField);
      if (!this.available)
        keyField.setAttribute('disabled', true);

      if (this.available) {
        const resetButton = keyCombination.appendChild(document.createElement('button'));
        resetButton.style.minWidth = 0;
        resetButton.textContent = '🔄';
        resetButton.setAttribute('title', 'Reset');
        resetButton.addEventListener('key', aEvent => {
          switch (aEvent.key) {
            case 'Enter':
            case ' ':
              reset();
              break;
          }
        });
        resetButton.addEventListener('click', aEvent => {
          switch (aEvent.button) {
            case 0:
              reset();
              break;
          }
        });
      }

      apply();

      items.push(item);
      list.appendChild(item);
    }

    this.installStyleSheet();

    return list;
  },

  buildCheckBoxWithLabel(aLabel) {
    const label = document.createElement('label');
    label.textContent = aLabel;
    label.checkbox = label.insertBefore(document.createElement('input'), label.firstChild);
    label.checkbox.setAttribute('type', 'checkbox');
    if (!this.available)
      label.checkbox.setAttribute('disabled', true);
    return label;
  },

  normalizeKey(aKey) {
    aKey = aKey.trim().toLowerCase();
    const normalizedKey = aKey.replace(/\s+/g, '');
    if (/^[a-z0-9]$/i.test(normalizedKey) ||
        /^F([1-9]|1[0-2])$/i.test(normalizedKey))
      return aKey.toUpperCase();

    switch (normalizedKey) {
      case 'comma':
        return 'Comma';
      case 'period':
        return 'Period';
      case 'home':
        return 'Home';
      case 'end':
        return 'End';
      case 'pageup':
        return 'PageUp';
      case 'pagedown':
        return 'PageDown';
      case 'space':
        return 'Space';
      case 'del':
      case 'delete':
        return 'Delete';
      case 'up':
        return 'Up';
      case 'down':
        return 'Down';
      case 'left':
        return 'Left';
      case 'right':
        return 'right';
      case 'next':
      case 'medianexttrack':
      case 'mediatracknext':
        // KeyboardEvent API defines "MediaTrackNext" and "MediaTrackPrevious",
        // but WebExtensions APIs uses "MediaNextTrack" and "MediaPrevTrack" as
        // valid key names.
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values#Multimedia_keys
        // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/manifest.json/commands#Media_keys
        // https://developer.chrome.com/extensions/commands#usage
        // See also: https://github.com/piroor/webextensions-lib-shortcut-customize-ui/issues/10
        return 'MediaNextTrack';
      case 'play':
      case 'pause':
      case 'mediaplaypause':
        return 'MediaPlayPause';
      case 'prev':
      case 'previous':
      case 'mediaprevtrack':
      case 'mediaprevioustrack':
      case 'mediatrackprev':
      case 'mediatrackprevious':
        return 'MediaPrevTrack';
      case 'stop':
      case 'mediastop':
        return 'MediaStop';

      default:
        for (const map of [this.keyNameMap, this.keyNameMapLocales.global]) {
          for (const key of Object.keys(map)) {
            if (Array.isArray(map[key])) {
              if (map[key].some(aLocalizedKey => aLocalizedKey.toLowerCase() == aKey))
                return key;
            }
            else {
              if (map[key] &&
                  map[key].toLowerCase() == aKey)
                return key;
            }
          }
        }
        break;
    }
    return '';
  },
  getLocalizedKey(aKey) {
    for (const map of [this.keyNameMap, this.keyNameMapLocales.global]) {
      if (aKey in map)
        return Array.isArray(map[aKey]) ? map[aKey][0] : map[aKey];
    }
    return '';
  },

  installStyleSheet() {
    if (this.style)
      return;
    this.style = document.createElement('style');
    this.style.setAttribute('type', 'text/css');
    this.style.textContent = `
      li.shortcut.${this.commonClass} {
        border-top: 1px solid ThreeDShadow;
        display: grid;
        grid-template-columns: 1fr max-content;
        margin: 0 0 0.25em;
        padding: 0.25em 0 0;
      }
      li.shortcut.${this.commonClass}:first-child {
        border-top: none;
        margin-top: 0;
        padding-top: 0;
      }
      li.error.${this.commonClass} .key-combination::before {
        background: #ff6060;
        border: solid thin white;
        border-radius: 100%;
        box-shadow: 0.1em 0.1em 0.2em rgba(0, 0, 0, 0.35);
        content: "!";
        color: white;
        display: inline-block;
        font-weight: bold;
        min-width: 1em;
        text-align: center;
      }
    `;
    document.head.appendChild(this.style);
  },

  keyNameMapLocales: {
    global: {
      Comma:  [','],
      Period: ['.'],
      Space:  ['Space', ' '],
      Up:     ['↑'],
      Down:   ['↓'],
      Left:   ['←', '<=', '<-'],
      Right:  ['→', '=>', '->'],
    },
    // define tables with https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/i18n/LanguageCode
    ja: {
      // key: valid key name listed at https://developer.mozilla.org/en-US/Add-ons/WebExtensions/manifest.json/commands#Shortcut_values
      // value: array of localized key names
      Up:    ['上'],
      Down:  ['下'],
      Left:  ['左'],
      Right: ['右'],
      // you can localize modifier keys also.
      // Alt:     ['オルト'],
      // Ctrl:    ['コントロール'],
      // MacCtrl: ['コントロール'], // for macOS
      // Command: ['コマンド`], // for macOS
      // Shift:   ['シフト`],
    },
    ru: {
      // key: valid key name listed at https://developer.mozilla.org/en-US/Add-ons/WebExtensions/manifest.json/commands#Shortcut_values
      // value: array of localized key names
      Up:    ['Вверх'],
      Down:  ['Вниз'],
      Left:  ['Влево'],
      Right: ['Вправо'],
      Comma: ['Запятая'],
      Period: ['Точка'],
      Space: ['Пробел'],
      MediaNextTrack: ['Следующий трек'],
      MediaPrevTrack: ['Предыдущий трек'],
      MediaPlayPause: ['Пауза проигрывания'],
      MediaStop: ['Остановка проигрывания']
    },
    // de: {...},
    // fr: {...},
  },
  get keyNameMap() {
    delete this.keyNameMap;
    return this.keyNameMap = (
      this.keyNameMapLocales[browser.i18n.getUILanguage()] ||
      this.keyNameMapLocales[browser.i18n.getUILanguage().replace(/[-_].+$/, '')] ||
      {}
    );
  }
};
