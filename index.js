const setupEvents = require('./installers/setupEvents');
if (setupEvents.handleSquirrelEvent()) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
}

const electron = require('electron');
const { app, BrowserWindow, Menu, dialog, ipcMain } = electron;
const url = require('url');
const path = require('path');
const fs = require('fs');
const spawn = require('child_process').spawn;
const exec = require('child_process').exec
const clipboardy = require('clipboardy');
const { parse } = require('path');

require('@treverix/remote/main').initialize();

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
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js')
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




//////////////////////////////
// ------>  EDITOR  <------ //
//////////////////////////////


// Functions
const defaultErrorOptions = {
    type: 'error',
    title: 'Missing Files',
    detail: 'The following files/folders were missing from the selected folder:',
    buttons: ['Cancel', 'Retry']
}
function msgBox(lines, options = defaultErrorOptions) {
    options.detail += `\n\n${lines.join('\n')}`;
    return dialog.showMessageBoxSync(options);
}
function clean_line(line) {
    number_sign_pos = line.indexOf("#");
    if (number_sign_pos != -1) line = line.substring(0, number_sign_pos);
    line = strip(line, " \t\r\n");
    return line;
}
function findWithAttr(array, attr, value) {
    for (var i = 0; i < array.length; i += 1) if(array[i][attr] === value) return i;
    return -1;
}
function strip(str, remove) {
    while (str.length > 0 && remove.indexOf(str.charAt(0)) != -1) str = str.substr(1);
    while (str.length > 0 && remove.indexOf(str.charAt(str.length - 1)) != -1) str = str.substr(0, str.length - 1);
    return str;
}
let currentSzsBatch = 0;
function unpackSzs(fn, callback, callbackArgs = null, errorCallback = msgBox) {
    const unpack = spawn('python', [path.join(__dirname, 'sarc.py'), contentDir + fn]);
    unpack.stdout.on('data', (data) => {
        if (data.toString().includes("exit-code=0")) {
            if (callbackArgs !== null) callback(callbackArgs);
            else callback();
        } else errorCallback([fn]);
    })
}
function unpackedSzs(callback = null) {
    currentSzsBatch -= 1;

    if (currentSzsBatch <= 0) {
        currentSzsBatch = 0;

        console.log('finished batch!');
        if (callback && typeof callback == 'function') callback();
    }
}


// Loading

let contentDir;
let missions = [];
const requiredFiles = [
    '/CMCmn/system/mis_order.szs',
    '/CMCmn/system/mission_set'
];

// Handle load directory
function loadRoot() {
    const response = dialog.showOpenDialogSync({
        title: 'Select your Pikmin 3 root directory',
        buttonLabel: 'Select Folder',
        properties: ['openDirectory']
    });

    if (response) {
        let errors = [];
        console.log(errors);
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
        if (errors.length > 0) {
            console.log(errors);
            if (msgBox(errors) == 1) return loadRoot();
        } else {
            contentDir = response + (addContent ? "/content/" : "/");
            unpackSzs("CMCmn/system/mis_order.szs", loadMissions);
        }
    }
}

function loadMissions() {
    const misOrder = fs.readFileSync(contentDir + "CMCmn/system/mis_order.szs_ext/mis_order.txt").toString()
        .replace(/\#.*$/gm, '').split('\n');

    missions = [];

    let searching_start = true;
    let searching_type = true;
    let current_type;
    let searching_count = true;
    let current_count;

    for (let i = 0; i < misOrder.length; i++) {
        const line = clean_line(misOrder[i]);

        if (searching_start) {
            if (line == '{') searching_start = false;

        } else if (searching_type) {
            if (!isNaN(parseInt(line))) {
                current_type = line;
                missions.push({
                    "type": current_type,
                    "items": []
                })
                searching_type = false;
            }

        } else if (searching_count) {
            if (!isNaN(parseInt(line))) {
                current_count = parseInt(line);
                searching_count = false;
            }

        } else if (line == '}') {
            searching_start = true;
            searching_type = true;
            searching_count = true;

        } else {
            let index = findWithAttr(missions, 'type', current_type);
            missions[index].items.push(line);
        }
    }

    console.log(missions);
    unpackMissionSettings();
}


function unpackMissionSettings() {
    for (let i = 0; i < missions.length; i++) currentSzsBatch += missions[i].items.length * 2; // *2 for piknum as well

    const warnings = [];
    for (let i = 0; i < missions.length; i++) {
        for (let a = 0; a < missions[i].items.length; a++) {

            // Validate mission settings file
            const defSetName = `CMCmn/system/mission_set/miset_${missions[i].items[a]}.szs`;
            if (fs.existsSync(contentDir + defSetName)) {
                // Unpack mission settings file
                unpackSzs(defSetName, unpackedSzs, loadMissionSettings);

            } else {
                // else push warning
                currentSzsBatch -= 1;
                warnings.push(`Missing setting file for: '${missions[i].items[a]}'`);
            }

            // Get piknum filename
            let piknumName = missions[i].items[a];
            if (missions[i].type == '6') {
                switch (missions[i].items[a].toLowerCase()) {
                    case "misboss1": { piknumName = 'mapB_mis_boss1'; } break;
                    case "misboss2": { piknumName = 'mapC_mis_boss'; } break;
                    case "misboss3": { piknumName = 'mapA_mis_boss'; } break;
                    case "misboss4": { piknumName = 'mapD_mis_boss'; } break;
                    case "misboss5": { piknumName = 'mapB_mis_boss2'; } break;
                    case "misboss6": { piknumName = 'mapE_mis_boss'; } break;
                    default: { piknumName = 'undefined'; } break;
                }
            }

            // Validate piknum file
            let defPiknumName = `CMCmn/system/mission_set/miset_${piknumName}_piknum.szs`;
            if (piknumName == 'undefined' || !fs.existsSync(contentDir + defPiknumName)) {
                const altPiknumName = `CMCmn/system/mission_set/miset_${missions[i].items[a]}_piknum.szs`;
                if (fs.existsSync(contentDir + altPiknumName)) defPiknumName = altPiknumName;
                else {
                    currentSzsBatch -= 1;
                    warnings.push(`Missing piknum file for: '${missions[i].items[a]}' ('${piknumName}')`);
                    continue;
                }
            }

            // Unpack mission piknum file given that it's valid
            unpackSzs(defPiknumName, unpackedSzs, loadMissionSettings);
        }
    }

    if (warnings.length > 0) {
        msgBox(warnings, {
            type: 'warning',
            title: 'Warning!',
            detail: "Couldn't find these files:",
            buttons: ['OK']
        });
    }
}

function loadMissionSettings() {
    for (let i = 0; i < missions.length; i++) {
        missions[i].settings = [];
        for (let a = 0; a < missions[i].items.length; a++) {
            const miset = fs.readFileSync(contentDir + 
                `CMCmn/system/mission_set/miset_${missions[i].items[a]}.szs_ext/${missions[i].items[a]}.txt`
            ).toString().replace(/\#.*$/gm, '').split('\n');

            const misetLines = [];
            for (let i = 0; i < miset.length; i++) {
                let line = clean_line(miset[i]);
                if (line.length > 0) {
                    if (line.startsWith('"') && line.endsWith('"')) line = line.substring(1, line.length - 1);
                    misetLines.push(line.toString());
                }
            }

            const settings = {
                type: misetLines[0],
                version: misetLines[1],
                id: misetLines[2],
                mapName: misetLines[3],
                map2dName: misetLines[4],
                genFolder: misetLines[5],
                time: misetLines[7].split(" "),
                unusedPiknum: {
                    purple: misetLines[10].split(" "),
                    blue: misetLines[11].split(" "),
                    red: misetLines[12].split(" "),
                    white: misetLines[13].split(" "),
                    yellow: misetLines[14].split(" "),
                    winged: misetLines[15].split(" "),
                    rock: misetLines[16].split(" "),
                },
                sprays: misetLines[18],
                startHasOnion: misetLines[19],
                startUniteOnion: misetLines[20],
                renderSetting: misetLines[21],
                grades: misetLines[22].split(" "),
                sunMeterRatioForEnv: misetLines[23],
                ruleData: {
                    type: misetLines[25]
                }
            };

            if (settings.ruleData.type == '20130126') {
                settings.ruleData.cid = misetLines[26]
                settings.ruleData.gradeTimes = {
                    platinum: misetLines[27].split(" "),
                    gold: misetLines[28].split(" "),
                    silver: misetLines[29].split(" "),
                    bronze: misetLines[30].split(" ")
                }
            }

            // piknum
            let piknumName = missions[i].items[a];
            if (missions[i].type == '6') {
                switch (missions[i].items[a].toLowerCase()) {
                    case "misboss1": { piknumName = 'mapB_mis_boss1'; } break;
                    case "misboss2": { piknumName = 'mapC_mis_boss'; } break;
                    case "misboss3": { piknumName = 'mapA_mis_boss'; } break;
                    case "misboss4": { piknumName = 'mapD_mis_boss'; } break;
                    case "misboss5": { piknumName = 'mapB_mis_boss2'; } break;
                    case "misboss6": { piknumName = 'mapE_mis_boss'; } break;
                    default: { piknumName = 'undefined'; } break;
                }
            }

            const piknum = fs.readFileSync(contentDir + 
                `CMCmn/system/mission_set/miset_${piknumName}_piknum.szs_ext/${piknumName}_piknum.txt`
            ).toString().replace(/\#.*$/gm, '').split('\n');
            const piknums = piknum[0].split(" ");
            settings.piknum = {
                purple: parseInt(piknums[0]),
                blue: parseInt(piknums[1]),
                red: parseInt(piknums[2]),
                white: parseInt(piknums[3]),
                yellow: parseInt(piknums[4]),
                winged: parseInt(piknums[5]),
                rock: parseInt(piknums[6]),
                purpleCandypop: parseInt(piknums[7]),
                blueCandypop: parseInt(piknums[8]),
                redCandypop: parseInt(piknums[9]),
                whiteCandypop: parseInt(piknums[10]),
                yellowCandypop: parseInt(piknums[11]),
                wingedCandypop: parseInt(piknums[12]),
                rockCandypop: parseInt(piknums[13]),
            }

            missions[i].settings.push(settings);
        }
    }
    mainWindow.webContents.send('mission:update', missions);
}