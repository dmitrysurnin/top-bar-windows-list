/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const AppFavorites = imports.ui.appFavorites;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const ThisExtension = imports.misc.extensionUtils.getCurrentExtension();
//const LibSettings = ThisExtension.imports.settings;

const schema = "org.gnome.shell.extensions.TopBarWindowsList";

const LEFTBUTTON = 1;
const MIDDLEBUTTON = 2;
const RIGHTBUTTON = 3;
const APPVIEWICON = ThisExtension.path + '/images/appview-button-default.svg';
const ALLWINDOWSVIEWICON = ThisExtension.path + '/images/appview-button-default.svg';

function init(extensionMeta) {
	return new TopBarWindowsList(extensionMeta, schema);
}

function TopBarWindowsList(extensionMeta, schema) {
	this.init(extensionMeta, schema);
}

TopBarWindowsList.prototype = {
	button: null,
	text: null,
	windowsList: [],

	init: function(extensionMeta, schema) {
		this.extensionMeta = extensionMeta;
		this.schema = schema;
	},

	onParamChanged: function() {
		//if (! this.settings.get_boolean("reset-flag")) {
		//	this.disable();
		//	this.enable();
		//}
	},

	enable: function() {
		//let settings = new LibSettings.Settings(this.schema);
		//this.settings = settings.getSettings();

		this.favoritesArray = AppFavorites.getAppFavorites().getFavoriteMap();

		this.changeTopPanel();

		this.addTaskBar();

		this.onPositionChanged();

		this.initWindows();

		this.appearanceOrder();
	},

	disable: function() {
		if (this.boxRunningTasksId !== null) {
			this.boxRunningTasks.disconnect(this.boxRunningTasksId);
			this.boxRunningTasksId = null;
		}

		if (this.windows !== null) {
			this.windows.destruct();
			this.windows = null;
		}
	},

	changeTopPanel: function() {
		this.panelSize = 27;//this.settings.get_int('panel-size');
	},

	addTaskBar: function() {
		this.boxMain = new St.BoxLayout({
			style_class: "tkb-box"
		});

		this.boxMainShowAppsButton = new St.BoxLayout({
			style_class: "tkb-box"
		});

		if (1/*this.settings.get_boolean("display-showapps-button")*/) {
			this.boxMainShowAllWindowsButton = new St.BoxLayout({
				style_class: "tkb-box"
			});
		}

		this.boxRunningTasks = new St.BoxLayout({
			style_class: "tkb-box",
			reactive: true
		});

		this.boxRunningTasksId = this.boxRunningTasks.connect("scroll-event", Lang.bind(this, this.onScrollTaskButton));
	},

	onScrollTaskButton: function() {
	},

	onPositionChanged: function() {
		this.newBox = Main.panel._leftBox;

		this.pbchildren = this.newBox.get_children().length;

		this.newBox.insert_child_at_index(this.boxMain, 1);
	},

	onClickShowAppsButton: function(button, pspec) {
		log('EXTENSION_LOG', 'onClickShowAppsButton');
		let numButton = pspec.get_button();
		this.leftbutton = LEFTBUTTON;
		this.rightbutton = RIGHTBUTTON;

		if (numButton === this.leftbutton) {
			if (! Main.overview.visible) {
				Main.overview.show();
			}
			if (! Main.overview.viewSelector._showAppsButton.checked) {
				Main.overview.viewSelector._showAppsButton.checked = true;
			}
			else {
				Main.overview.hide();
			}
		}
		else if (numButton === this.rightbutton) {
			if (! Main.overview.visible) {
				Main.overview.show();
			}
			else if (Main.overview.viewSelector._showAppsButton.checked) {
				Main.overview.viewSelector._showAppsButton.checked = false;
			}
			else {
				Main.overview.hide();
			}
		}
	},

	initWindows: function() {
		let workspaceManager = global.workspace_manager || global.screen;
		let workspace = workspaceManager.get_active_workspace();
		this.windowAddedId = workspace.connect_after('window-added', Lang.bind(this, this.buildWindowsList));
		this.windowRemovedId = workspace.connect('window-removed', Lang.bind(this, this.buildWindowsList));
	},

	/// полная перестройка всех окон вызывается при: открытии нового окна, закрытии окна,
	buildWindowsList: function() {
		log('EXTENSION_LOG', 'buildWindowsList start');
		this.boxRunningTasks.destroy_all_children(); /// очистить панель
		this.boxRunningTasks.remove_all_children();

		let appSystem = Shell.AppSystem.get_default();
		let runningApps = appSystem.get_running();
    this.runningAppsArray = [];
		for (let i in runningApps) {
		  let app = runningApps[i];
		  let app_id = app.get_id();
		  this.runningAppsArray[app_id] = app;
		  log("EXTENSION_LOG, runningAppsArray app_id", app_id);
		}

		this.backgroundStyleColor = "border-radius: 5px;";
		this.backgroundStyleColor += "background-color: #cccccc;";
		this.backgroundStyleColor += "border: 1px solid gray;";

		this.inactiveBackgroundStyleColor = "border-radius: 5px;";
		this.inactiveBackgroundStyleColor += "background-color: transparent;";
		this.inactiveBackgroundStyleColor += "border: 1px solid transparent;";

//		for (let app_id in this.favoritesArray) {
//		  log("EXTENSION_LOG, favoritesArray app_id", app_id);
//		}

		/// сначала пройдёмся по приложениям в избранном
		for (let app_id in this.favoritesArray) {
			if (app_id in this.runningAppsArray) {
				this.addWindowOnPanel(app_id);
		  }
		}

		/// потом те приложения, которые не в избранном
		for (app_id in this.runningAppsArray) {
			if (! (app_id in this.favoritesArray)) {
				log('EXTENSION_LOG, not in favorites', app_id, this.runningAppsArray[app_id].get_windows().length);
				this.addWindowOnPanel(app_id);
			}
		}
	},

	addWindowOnPanel: function(app_id) {
		let app = this.runningAppsArray[app_id];
		let app_windows = app.get_windows();
		app_windows.sort(function(a, b) {
			return a.get_stable_sequence() > b.get_stable_sequence() ? 1 : -1;
		});
		for (let j in app_windows) {
			let window = app_windows[j];

			if (! window.is_skip_taskbar()) {
				log("EXTENSION_LOG, window_title", window.get_title());

				if (this.searchWindowInList(window) === null) {
					this.windowsList.push(window);
					window.connect("notify::appears-focused", Lang.bind(this, this.onWindowChanged));
					window.connect("notify::minimized", Lang.bind(this, this.onWindowChanged));
				}

				let buttonTaskLayout = new St.BoxLayout({
					style_class: "top-bar-windows-list-task-button"
				});
				let buttonTask = new St.Button({
					style_class: "top-bar-windows-list-task-button",
					child: buttonTaskLayout,
					x_align: St.Align.START
				});
				buttonTaskLayout.add_actor(app.create_icon_texture(22));
				buttonTask.connect("button-press-event", Lang.bind(this, this.onClickTaskButton, window));

				window._buttonTask = buttonTask;
				if (window.has_focus()) {
					log("EXTENSION_LOG, window.has_focus", window.get_title(), app_id);
					buttonTask.set_style(this.backgroundStyleColor);
				}
				else {
					buttonTask.set_style(this.inactiveBackgroundStyleColor);
				}

				this.boxRunningTasks.insert_child_above(buttonTask, null);
			}
		}
	},

	searchWindowInList: function(window) {
		for (let i in this.windowsList) {
			if (this.windowsList[i] === window) {
				return i;
			}
		}
		return null;
	},

	onClickTaskButton: function(button, pspec, window) {
		if (window) {
			if (! window.has_focus()) {
				window.activate(global.get_current_time());
			}
			else {
				window.minimize();
			}
		}
	},

	onWindowsListChanged: function(windowsList, type, window) {
		windowsList.forEach(function(window) {
			log('EXTENSION_LOG windowsList.forEach', window.get_title());
		}, this);
	},

	onWindowChanged: function(window) {
		let tracker = Shell.WindowTracker.get_default();
		let app = tracker.get_window_app(window);
		let app_id = app.get_id();
		log('EXTENSION_LOG onWindowChanged', window.get_title(), app_id);

		buttonTask = window._buttonTask;
		if (window.has_focus()) {
		  log("EXTENSION_LOG, window.has_focus", window.get_title());
			buttonTask.set_style(this.backgroundStyleColor);
		}
		else {
			buttonTask.set_style(this.inactiveBackgroundStyleColor);
		}
	},

	appearanceOrder: function() {
		this.boxMain.add_actor(this.boxMainShowAllWindowsButton);
		this.boxMain.add_actor(this.boxMainShowAppsButton);
		this.boxMain.add_actor(this.boxRunningTasks);
	},

};
