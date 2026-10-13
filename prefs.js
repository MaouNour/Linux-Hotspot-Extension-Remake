import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
export default class ExamplePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        //TODO Make some Options
        //default docs prefs will be used later for customizibility 
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);
        const group = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure the appearance of the extension'),
        });
        page.add(group);
        const row = new Adw.SwitchRow({
            title: _('hotspot-quickmenu-enabled'),
            subtitle: _('Whether to show the panel indicator'),
        });
        group.add(row);
        window._settings = this.getSettings();
        window._settings.bind('hotspot-quickmenu-enabled', row, 'active', Gio.SettingsBindFlags.DEFAULT);
    }
}
