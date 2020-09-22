const { Themebar } = require('custom-electron-titlebar');
const customTitlebar = require('custom-electron-titlebar');
 
window.addEventListener('DOMContentLoaded', () => {
    new customTitlebar.Titlebar({
        backgroundColor: customTitlebar.Color.fromHex('#222228'),
        shadow: true,
        icon: './assets/icons/png/icon.png',
        unfocusEffect: false,
        menuPosition: 'left',
        titleHorizontalAlignment: 'left'
    });
 
    // ...
})