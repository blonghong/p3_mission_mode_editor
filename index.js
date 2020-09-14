const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');

const spawn = require('child_process').spawn;

const { app, BrowserWindow, Menu, dialog } = electron;

const msgRegions = ['EUDut', 'EUEng', 'EUFre', 'EUGer', 'EUIta', 'EUPor', 'EURus', 'EUSpa', 'JPJpn', 'USEng', 'USFre',
    'USPor', 'USSpa'];

let mainWindow;

// Listen for app to be ready
app.on('ready', function(){
    // Create new window
    mainWindow = new BrowserWindow({
        title: 'Pikmin 3 Mission Mode Editor',
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
function createWindow() {
    const response = dialog.showOpenDialogSync({
        title: 'Select your Pikmin 3 root directory',
        buttonLabel: 'Select Folder',
        properties: [
            'openDirectory'
        ]
    });

    if (response) {
        const requiredFiles = ['\\CMCmn\\system\\mis_order.szs', '\\CMCmn\\system\\mission_set'];
        const errors = [];
        let addContent = false;
        for (let i = 0; i < requiredFiles.length; i++) {
            if (!fs.existsSync(response + requiredFiles[i])) {
                addContent = true;
                if (!fs.existsSync(response + "\\content" + requiredFiles[i])) errors.push(requiredFiles[i]);
            }
        }
        if (errors.length > 0) return errorLoadingContent(errors);
        else {
            contentDir = response + (addContent ? "\\content\\" : "\\");
            loadPiknum();
            //loadMessage();
        }
    }
}

function errorLoadingContent(errors) {
    if (dialog.showMessageBoxSync({
        type: 'error',
        title: 'Missing Files',
        detail: 'The following files/folders were missing from the selected folder:\n\n' + errors.join('\n'),
        buttons: ["Cancel", "Retry"]
    }) == 1) return createWindow();
}

function loadPiknum() {
    const unpack = spawn('python', [path.join(__dirname, 'sarc.py'), contentDir + "CMCmn\\system\\mis_order.szs"]);
    unpack.stdout.on('data', (data) => {
        if (data.toString().includes("unpacked successfully")) {
            
        }
    })
}

function loadMessage() {
    const messageUnpack = spawn('python', [path.join(__dirname, 'sarc.py'), contentDir + "EUEng\\system\\message.szs"]);
    const missionFn = `${contentDir}EUEng\\system\\message.szs_ext\\MissionName`;
    messageUnpack.stdout.on('data', (data) => {
        if (data.toString().includes("exited sarc.py with success")) {
            if (fs.existsSync(contentDir + "EUEng\\system\\message.szs_ext\\MissionName.msbt")) {






                const messageConvert = spawn('python', [path.join(__dirname, 'sarc.py'), '-x', '-y', '-j',
                    `"${missionFn}.json"`, `"${missionFn}.msbt"`]);
                
                messageConvert.stdout.on('data', (data) => {
                    console.log(data.toString());
                    if (data.toString().toLowerCase().includes("all good!")) {
                        console.log("you won the vbux!!!!");
                    } else return errorLoadingContent(['CONVERTING: EUEng\\system\\message.szs_ext\\MissionName.msbt']);
                })
            } else return errorLoadingContent(['EUEng\\system\\message.szs_ext\\MissionName.msbt']);
        }
    })
}



function loadMsbt(msbt) {
    const messageConvert = spawn('python', [path.join(__dirname, 'sarc.py'), '-x', '-y', '-j',
        `"${contentDir}EUEng\\system\\message.szs_ext\\MissionName.json"`,
        `"${contentDir}EUEng\\system\\message.szs_ext\\MissionName.msbt"`]);
    messageConvert.on('data', (data) => {
        if (data.toString().toLowerCase().includes("all good!")) return true;
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
                    createWindow();
                }
            }
        ]
    }
];

// Platform-specific menus
if (process.platform == 'darwin') {
    // Mac menu
    mainMenuTemplate.unshift({
        submenu: [
            { role: 'about' },
            { role: 'seperator' },
            {
                label: 'Preferences...',
                accelerator: 'Command+,',
                click(){
                    showPreferences();
                }
            },
            { role: 'seperator' },
            { role: 'services' },
            { role: 'seperator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { role: 'seperator' },
            { role: 'quit' }
        ]
    });
} else {
    // Windows/Linux menu
    mainMenuTemplate[0].submenu.push(
        { role: 'seperator' },
        { role: 'close' }
    );
}

// Add dev tools if not in production
if (process.env.NODE_ENV !== 'production') {
    mainMenuTemplate.push({
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