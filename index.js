const setupEvents = require('./installers/setupEvents');
if (setupEvents.handleSquirrelEvent()) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
}

const electron = require('electron');
const { app, BrowserWindow, Menu, dialog } = electron;
const url = require('url');
const path = require('path');
const fs = require('fs');
const spawn = require('child_process').spawn;
const exec = require('child_process').exec

const msgRegions = ['EUDut', 'EUEng', 'EUFre', 'EUGer', 'EUIta', 'EUPor', 'EURus', 'EUSpa', 'JPJpn', 'USEng', 'USFre',
    'USPor', 'USSpa'];

let mainWindow;

function openUrl(url) {
    const start = process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open';
    exec(`${start} ${url}`);
}

// Listen for app to be ready
app.on('ready', function(){
    // Create new window
    mainWindow = new BrowserWindow({
        frame: true,
        webPreferences: {
            nodeIntegration: true
        }
    });
    // Load html into window
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'mainWindow.html'),
        protocol: 'file',
        slashes: true
    }));
    // Quit app when closed
    mainWindow.on('closed', function(){
        app.quit();
    })

    // Build menu from template
    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    // Insert Menu
    Menu.setApplicationMenu(mainMenu);
});

function showPreferences() {
    console.log("show preferences");
}


let contentDir;

// Handle load directory
function loadRoot() {
    const response = dialog.showOpenDialogSync({
        title: 'Select your Pikmin 3 root directory',
        buttonLabel: 'Select Folder',
        properties: [
            'openDirectory'
        ]
    });

    if (response) {
        const requiredFiles = ['/CMCmn/system/mis_order.szs', '/CMCmn/system/mission_set'];
        const errors = [];
        let addContent = false;
        for (let i = 0; i < requiredFiles.length; i++) {
            console.log(`checking: '${response + requiredFiles[i]}'`);
            if (!fs.existsSync(response + requiredFiles[i])) {
                addContent = true;
                if (!fs.existsSync(response + "/content" + requiredFiles[i])) {
                    errors.push(requiredFiles[i]);
                }
            }
        }
        if (errors.length > 0) return errorLoadingContent(errors);
        else {
            contentDir = response + (addContent ? "/content/" : "/");
            loadMissions();
        }
    }
}

function errorLoadingContent(errors) {
    if (dialog.showMessageBoxSync({
        type: 'error',
        title: 'Missing Files',
        detail: 'The following files/folders were missing from the selected folder:\n\n' + errors.join('\n'),
        buttons: ["Cancel", "Retry"]
    }) == 1) return loadRoot();
}

function loadMissions() {
    const unpack = spawn('python', [path.join(__dirname, 'sarc.py'), contentDir + "CMCmn\\system\\mis_order.szs"]);
    unpack.stdout.on('data', (data) => {
        if (data.toString().includes("exit-code=0")) {
            console.log("finished extracting mis_order.szs!");
        }
    })
}

// Create all-platforms menu template
const mainMenuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Load Pikmin 3',
                accelerator: 'CmdOrCtrl+O',
                click(){
                    loadRoot();
                }
            }
        ]
    },
    {
        label: 'Edit',
        submenu: [
            {
                label: 'test'
            }
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: "Discord Servers",
                enabled: false
            },
            {
                label: "Jimble's Café",
                click(){
                    openUrl('http://discord.gg/s475Xnc');
                }
            },
            {
                label: "Hocotate Hacker",
                click(){
                    openUrl('https://discord.gg/G7Pgkdh');
                }
            }
        ]
    }
];

// Platform-specific menus
if (process.platform == 'darwin') {
    // Mac menu
    mainMenuTemplate.unshift({
        label: '',
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            {
                label: 'Preferences...',
                accelerator: 'Command+,',
                click(){
                    showPreferences();
                }
            },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    });
} else {
    // Windows/Linux menu
    mainMenuTemplate[0].submenu.push(
        { type: 'separator' },
        { role: 'close' }
    );
}

// Add dev tools if not in production
if (process.env.NODE_ENV !== 'production') {
    mainMenuTemplate.splice(-1, 0, {
        label: 'Developer Tools',
        submenu: [
            {
                label: 'Toggle DevTools',
                accelerator: 'CmdOrCtrl+I',
                click(item, focusedWindow){
                    focusedWindow.toggleDevTools();
                }
            },
            {
                role: 'reload'
            }
        ]
    })
}