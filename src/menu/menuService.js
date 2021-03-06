import { app, BrowserWindow, Menu, ipcMain } from "electron";
import { fileMenuTemplate } from "./fileMenuTemplate";
import { editMenuTemplate } from "./editMenuTemplate";
import { deviceMenuTemplate } from "./deviceMenuTemplate";
import { viewMenuTemplate } from "./viewMenuTemplate";
import { helpMenuTemplate } from "./helpMenuTemplate";
import jetpack from "fs-jetpack";
import "../helpers/hash";

const isMacOS = process.platform === "darwin";
const maxFiles = 7;
const userDataDir = jetpack.cwd(app.getPath("userData"));
const recentFilesJson = "recent-files.json";
let fileMenuIndex = 0;
let recentMenuIndex = 2;
let recentFiles;
let menuTemplate;
// External Functions
export function createMenu() {
    menuTemplate = [ fileMenuTemplate, editMenuTemplate, deviceMenuTemplate, viewMenuTemplate, helpMenuTemplate ];
    if (isMacOS) {
        const fileMenu = menuTemplate[0].submenu;
        fileMenu.splice(fileMenu.length - 2, 2);
        menuTemplate.unshift({ role: "appMenu" });
        fileMenuIndex = 1;
    }
    restoreRecentFiles();
    rebuildMenu(true);
}

export function getChannelIds() {
    return recentFiles.ids;
}

export function getPackages() {
    return recentFiles.zip;
}

export function getRecentPackage(index) {
    return recentFiles.zip[index];
}

export function getRecentId(index) {
    return recentFiles.ids[index];
}

export function getRecentName(index) {
    return recentFiles.names[index];
}

export function getRecentVersion(index) {
    return recentFiles.versions[index];
}

export function getRecentSource(index) {
    return recentFiles.brs[index];
}

export function clearRecentFiles() {
    recentFiles = { ids: [], zip: [], names:[], versions:[], brs: [] };
    saveRecentFiles();
    rebuildMenu();
}

// Events
ipcMain.on("addRecentPackage", (event, currentChannel) => {
    let idx = recentFiles.ids.indexOf(currentChannel.id);
    if (idx >= 0) {
        recentFiles.ids.splice(idx, 1);
        recentFiles.zip.splice(idx, 1);
        recentFiles.names.splice(idx, 1);
        recentFiles.versions.splice(idx, 1);
    }
    recentFiles.ids.unshift(currentChannel.id);
    recentFiles.zip.unshift(currentChannel.file);
    recentFiles.names.unshift(currentChannel.title);
    recentFiles.versions.unshift(currentChannel.version);
    saveRecentFiles();
    rebuildMenu();
});

ipcMain.on("addRecentSource" , (event, filePath) => {
    let idx = recentFiles.brs.indexOf(filePath);
    if (idx >= 0) {
        recentFiles.brs.splice(idx, 1);
    }
    recentFiles.brs.unshift(filePath);
    saveRecentFiles();
    rebuildMenu();
});

// Internal functions
function restoreRecentFiles() {
    let recentFilesDefault = { ids: [], zip: [], names: [], versions: [], brs: [] };
    try {
        recentFiles = userDataDir.read(recentFilesJson, "json");
    } catch (err) {
        console.error("error reading recent files json");
    }
    recentFiles = recentFiles || recentFilesDefault;
    if (!recentFiles.ids) {
        Object.assign(recentFiles, {ids: new Array(recentFiles.zip.length)});
        recentFiles.zip.forEach( (value, index) => {
            recentFiles.ids[index] = value.hashCode();
        });
    }
    if (!recentFiles.names) {
        const names = new Array(recentFiles.zip.length).fill("No Title");
        Object.assign(recentFiles, {names: names});
    }
    if (!recentFiles.versions) {
        const versions = new Array(recentFiles.zip.length).fill("v0.0.0");
        Object.assign(recentFiles, {versions: versions});
    }
}

function saveRecentFiles() {
    try {
        userDataDir.write(recentFilesJson, recentFiles, { atomic: true });
    } catch (err) {
        console.error("error saving recent files json");
    }
}

function rebuildMenu(template = false) {
    if (isMacOS || template) {
        const recentMenu = menuTemplate[fileMenuIndex].submenu[recentMenuIndex].submenu;
        for (let index = 0; index < maxFiles; index++) {
            let fileMenu = recentMenu[index];
            if (index < recentFiles.zip.length) {
                fileMenu.label = recentFiles.zip[index];
                fileMenu.visible = true;
            } else {
                fileMenu.visible = false;
            }
        }
        for (let index = 0; index < maxFiles; index++) {
            let fileMenu = recentMenu[index + maxFiles + 2];
            if (index < recentFiles.brs.length) {
                fileMenu.label = recentFiles.brs[index];
                fileMenu.visible = true;
            } else {
                fileMenu.visible = false;
            }
        }
        const brsEnd = maxFiles * 2 + 2;
        recentMenu[maxFiles].visible = recentFiles.zip.length === 0;
        recentMenu[brsEnd].visible = recentFiles.brs.length === 0;
        recentMenu[recentMenu.length - 1].enabled = recentFiles.zip.length + recentFiles.brs.length > 0;
        Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
        let window = BrowserWindow.fromId(1);
        if (isMacOS && window) {
            window.webContents.send("updateMenu");
        }
    } else {
        const appMenu = app.applicationMenu;
        const recentMenu = appMenu.getMenuItemById("file-open-recent").submenu;
        for (let index = 0; index < maxFiles; index++) {
            let fileMenu = recentMenu.getMenuItemById(`zip-${index}`);
            if (index < recentFiles.zip.length) {
                fileMenu.label = recentFiles.zip[index];
                fileMenu.visible = true;
            } else {
                fileMenu.visible = false;
            }
        }
        for (let index = 0; index < maxFiles; index++) {
            let fileMenu = recentMenu.getMenuItemById(`brs-${index}`);
            if (index < recentFiles.brs.length) {
                fileMenu.label = recentFiles.brs[index];
                fileMenu.visible = true;
            } else {
                fileMenu.visible = false;
            }
        }
        recentMenu.getMenuItemById("zip-empty").visible = recentFiles.zip.length === 0;
        recentMenu.getMenuItemById("brs-empty").visible = recentFiles.brs.length === 0;
        recentMenu.getMenuItemById("file-clear").enabled = recentFiles.zip.length + recentFiles.brs.length > 0;
    }
}
