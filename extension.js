import Gio from 'gi://Gio';
import St from 'gi://St';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { HotspotIndicator } from './ui/hotspot-toggle.js';
export default class ExampleExtension extends Extension {
    enable() {
        this._indicator = new HotspotIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }
    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
