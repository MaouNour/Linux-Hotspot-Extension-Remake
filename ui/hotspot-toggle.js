import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
const HotspotMenuToggle = GObject.registerClass(class HotspotMenuToggle extends QuickSettings.QuickMenuToggle {
    constructor(extensionObject) {
        super({
            title: _('Hotspot'),
            subtitle: _('enable/disable hotspot'),
            iconName: 'selection-mode-symbolic',
            toggleMode: true,
        });
        this._refreshTimer = 0;
        this.title = _('Hotspot');
        this.subtitle = _('Off');
        this._devices = new Map();
        this._infoSection = new PopupMenu.PopupMenuSection();
        this._deviceSection = new PopupMenu.PopupMenuSection();
        this._deviceCount = new PopupMenu.PopupMenuItem(_('Connected devices: 0'));
        this._deviceCount.reactive = false;
        this._usage = new PopupMenu.PopupMenuItem('');
        this._usage.reactive = false;
        this._uptime = new PopupMenu.PopupMenuItem('');
        this._uptime.reactive = false;
        this._infoSection.addMenuItem(this._deviceCount);
        this._infoSection.addMenuItem(this._deviceSection);
        this._infoSection.addMenuItem(this._usage);
        this._infoSection.addMenuItem(this._uptime);
        this.menu.addMenuItem(this._infoSection);
        // Add an entry-point for more settings
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._menuOpenId = this.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen) {
                this._syncStatus();
                this._refreshTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                    this._syncStatus();
                    return GLib.SOURCE_CONTINUE;
                });
            }
            else if (this._refreshTimer) {
                GLib.source_remove(this._refreshTimer);
                this._refreshTimer = 0;
            }
        });
        //TODO fix updating and syncing the hotspot when the Quickmenu is opened 
        // While it doesn't sync when it is not
        //Current version is that it updates only when you open the options 
        //TODO Fix the hotspot off / on subtitle because it doesn't always updates
        const settingsItem = this.menu.addAction('More Settings', () => this.runCommand(["gui"], () => { console.log("hi"); }));
        settingsItem.visible = Main.sessionMode.allowSettings;
        this.menu._settingsActions[extensionObject.uuid] = settingsItem;
        this._commandRunning = false;
        this.clickedId = this.connect('clicked', () => {
            this.runCommand([this.checked ? 'enable' : 'disable'], () => this._syncStatus());
        });
        this._quickSettingsOpenId =
            Main.panel.statusArea.quickSettings.menu.connect('open-state-changed', (_menu, isOpen) => {
                if (isOpen)
                    this._syncStatus();
            });
    }
    _syncStatus() {
        if (this._refreshing)
            return;
        this._refreshing = true;
        this.runCommand(['info', '--json', '--once'], (success, output) => {
            this._refreshing = false;
            if (!success)
                return;
            try {
                const info = JSON.parse(output);
                this.checked = info.online;
                this.title = info.ssid || _('Hotspot');
                this.subtitle = info.online ? _('On') : _('Off');
                this._deviceCount.label.text =
                    `Connected devices: ${info.device_count}`;
                this._usage.label.text =
                    `↓ ${this._formatBytes(info.total_download_bytes)}  ↑ ${this._formatBytes(info.total_upload_bytes)}`;
                this._uptime.label.text =
                    `Uptime: ${this._formatDuration(info.uptime_seconds)}`;
                this._updateDevices(info.devices);
            }
            catch (error) {
                console.error(`Hotspot status: ${error.message}`);
            }
        });
    }
    _updateDevices(devices) {
        const current = new Set(devices.map(device => device.mac));
        for (const [mac, entry] of this._devices) {
            if (!current.has(mac)) {
                this._deviceSection.removeMenuItem(entry.item);
                this._devices.delete(mac);
            }
        }
        for (const device of devices) {
            let entry = this._devices.get(device.mac);
            if (!entry) {
                const item = new PopupMenu.PopupSubMenuMenuItem(device.name || device.mac);
                const details = [
                    new PopupMenu.PopupMenuItem(''),
                    new PopupMenu.PopupMenuItem(''),
                    new PopupMenu.PopupMenuItem(''),
                    new PopupMenu.PopupMenuItem(''),
                    new PopupMenu.PopupMenuItem(''),
                ];
                for (const row of details) {
                    row.reactive = false;
                    item.menu.addMenuItem(row);
                }
                entry = { item, details };
                this._devices.set(device.mac, entry);
                this._deviceSection.addMenuItem(item);
            }
            entry.item.label.text = device.name || device.mac;
            const values = [
                `IP: ${device.ip || '—'}`,
                `MAC: ${device.mac}`,
                `Signal: ${device.signal_dbm ?? '—'} dBm`,
                `Download: ${this._formatBytes(device.download_bytes)}`,
                `Upload: ${this._formatBytes(device.upload_bytes)}`,
            ];
            entry.details.forEach((row, i) => {
                row.label.text = values[i];
            });
        }
    }
    _formatBytes(bytes = 0) {
        const units = ['B', 'KiB', 'MiB', 'GiB'];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
            bytes /= 1024;
            i++;
        }
        return `${bytes.toFixed(1)} ${units[i]}`;
    }
    _formatDuration(seconds = 0) {
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        return hours
            ? `${hours}h ${minutes % 60}m`
            : `${minutes}m ${seconds % 60}s`;
    }
    runCommand(args, callback) {
        const proc = Gio.Subprocess.new(['hotspot-toggle', ...args], Gio.SubprocessFlags.STDOUT_PIPE |
            Gio.SubprocessFlags.STDERR_PIPE);
        proc.communicate_utf8_async(null, null, (proc, result) => {
            const [, stdout, stderr] = proc.communicate_utf8_finish(result);
            callback(proc.get_successful(), stdout.trim(), stderr.trim());
        });
    }
    destroy() {
        if (this._refreshTimer) {
            GLib.source_remove(this._refreshTimer);
            this._refreshTimer = 0;
        }
        if (this._menuOpenId) {
            this.menu.disconnect(this._menuOpenId);
            this._menuOpenId = 0;
        }
        if (this._clickedId) {
            this.disconnect(this._clickedId);
            this._clickedId = 0;
        }
        if (this._quickSettingsOpenId) {
            Main.panel.statusArea.quickSettings.menu.disconnect(this._quickSettingsOpenId);
            this._quickSettingsOpenId = 0;
        }
        this._devices.clear();
        this._devices = null;
        this._deviceCount = null;
        this._deviceSection = null;
        this._infoSection = null;
        this._usage = null;
        this._uptime = null;
        super.destroy();
    }
});
export const HotspotIndicator = GObject.registerClass(class HotspotIndicator extends QuickSettings.SystemIndicator {
    constructor(extensionObject) {
        //The default indicator from the gjs doc i will be using it to add indicator near the wifi in the next update 
        //TODO make idicator shows hotspot icon only when hotspot is on
        super();
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'selection-mode-symbolic';
        this._settings = extensionObject.getSettings();
        this._settings.bind('hotspot-quickmenu-enabled', this._indicator, 'visible', Gio.SettingsBindFlags.DEFAULT);
        this.quickSettingsItems.push(new HotspotMenuToggle(extensionObject));
    }
    destroy() {
        this._settings?.unbind(this._indicator, 'visible');
        this.quickSettingsItems.forEach(item => item.destroy());
        this.quickSettingsItems = [];
        this._settings = null;
        this._indicator = null;
        super.destroy();
    }
});
