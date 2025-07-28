// ==UserScript==
// @name         Building List
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.1.0
// @description  gives the calculated production upkeep for the buildings
// @author       You
// @match        http*://*.pardus.at/*
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/buildingList.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/buildingList.user.js
// ==/UserScript==

(function() {
    'use strict';

function log(...args) {
    const debug = true;
    if (debug) {
        console.log(...args);
    }
}

function pardusBuildingMax(buildingtable) {
  const firstRow = buildingtable?.querySelector('tr');
  const columnCount = firstRow ? firstRow.children.length : 0;

  log('Number of columns:', columnCount);

  let capColIndex = -1;
  let upkeepColIndex = -1;
  let upkeepStockColIndex = -1;
  let prodColIndex = -1;
  let comColIndex = -1; //commodities
  let infoColIndex = -1;

  // Step 1: Find the "Total" column index
  for (let i = 0; i < firstRow.children.length; i++) {
    const text = firstRow.children[i].textContent.trim().toLowerCase();
    if (text.includes("capacity") && capColIndex == -1) {
      capColIndex = i;
      log("It worked: Found 'capacity' at index", i);
    }

    if (text.includes("upkeep") && upkeepColIndex == -1) {
      upkeepColIndex = i;
      log("It worked: Found 'upkeep' at index", i);
    }

    if (text.includes("upkeep stock") && upkeepStockColIndex == -1) {
      upkeepStockColIndex = i;
      log("It worked: Found 'upkeep' at index", i);
    }

    //get the last production found
    if (text.includes("production")) {
      prodColIndex = i;
      log("It worked: Found 'prodColIndex' at index", i);
    }

    if (text.includes("info") && infoColIndex == -1) {
      infoColIndex = i;
      log("It worked: Found 'infoColIndex' at index", i);
    }

    if (text.includes("commodities") && comColIndex == -1) {
      comColIndex = i;
      log("It worked: Found 'commodity' at index", i);
    }
  }

   // Step 2: loop throug each table row.
     const rows = buildingtable.querySelectorAll(':scope > tbody > tr');


     const rowhd = buildingtable.querySelectorAll(':scope > tbody > tr');
    //add the comment to stock total
    log(rowhd[0].children);
    if (settings.excludedCommodities && settings.includedCommodities) {
    rowhd[0].children[upkeepStockColIndex].innerHTML += " (w/o Com | w/ Com)";
    } else if (!settings.excludedCommodities && settings.includedCommodities) {
    rowhd[0].children[upkeepStockColIndex].innerHTML += " (w/ Com)";
    } else if (settings.excludedCommodities && !settings.includedCommodities) {
    rowhd[0].children[upkeepStockColIndex].innerHTML += " (w/o Com)";
    }


    for (let i = 1; i < rows.length; i++) { // skip the header row
        const cells = rows[i].children;

        //get the capacity of each row
        const cellTexttotal = cells[capColIndex].textContent.trim().replace(/,/g, '');
        const cap = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
        log("cap value:", cap);
        var upkeeptotal = 0;

        //get the total comodities of each row
        const upkeepRows = cells[upkeepColIndex].querySelectorAll('td');
        const upkeepStockRows = cells[upkeepStockColIndex].querySelectorAll('td');

        for (let j = 0; j < upkeepRows.length; j++) { // skip the header row
            const upkeepcells = upkeepRows[j].textContent.trim().replace(/[^0-9.\-]/g, '');
            log("upkeepcells value:", upkeepRows[j].textContent);
            const upkeeptotalnum = parseFloat(upkeepcells) || 0; // blank or NaN = 0
            log(parseFloat(upkeepcells) || 0);
            upkeeptotal += upkeeptotalnum;
        }
        log("upkeeptotal value:", upkeeptotal);

        var comtotal = 0;

        //get the total comodities of each row
        const comRows = cells[comColIndex]?.querySelectorAll('td') || [];


        for (let j = 0; j < comRows.length; j++) { // skip the header row
            const comcells = comRows[j].textContent.trim().replace(/[^0-9.\-]/g, '');
            log("comcells value:", comRows[j].textContent);
            const comtotalnum = parseFloat(comcells) || 0; // blank or NaN = 0
            log(parseFloat(comcells) || 0);
            comtotal += comtotalnum;
        }
        log("upkeeptotal value:", upkeeptotal);

        //get the total comodities of each row
        const prodRows = cells[prodColIndex].querySelectorAll('td');
        var prodtotal = 0;

        for (let j = 0; j < prodRows.length; j++) { // skip the header row
            log("1) prodcellcontent: ",prodRows[j].textContent);
            const prodcells = prodRows[j].textContent.trim().replace(/[^0-9.\-]/g, '');
            log("prodcells value:", prodRows[j].textContent);
            const prodtotalnum = parseFloat(prodcells) || 0; // blank or NaN = 0
            log(parseFloat(prodcells) || 0);
            prodtotal += prodtotalnum;
        }
        log("prodtotal value:", prodtotal);

        //get set the values to have (max suggested amount rounded to 2 decimals in ())
        //go through upkeep rows again (this is so we dont accidently add stuff we dont want)
        for (let j = 0; j < upkeepRows.length; j++) { // skip the header row
            const upkeepcells = upkeepRows[j].textContent.trim().replace(/[^0-9.\-]/g, '');
            const upkeepstockcells = upkeepStockRows[j].textContent.trim().replace(/[^0-9.\-]/g, '');
            log("upkeepcells value:", upkeepRows[j].textContent);
            const upkeepcurrentnum = parseFloat(upkeepcells) || 0; // blank or NaN = 0


            const ratio1 = Math.floor((((cap - comtotal) * upkeepcurrentnum) / Math.max(upkeeptotal, prodtotal))/upkeepcurrentnum)*upkeepcurrentnum;
            const ratio2 = Math.floor(ratio1)-upkeepstockcells;
            const ratio3 = Math.floor(((cap * upkeepcurrentnum) / Math.max(upkeeptotal, prodtotal))/upkeepcurrentnum)*upkeepcurrentnum;
            const ratio4 = Math.floor(ratio3)-upkeepstockcells;

            if (settings.excludedCommodities && settings.includedCommodities) {
            upkeepRows[j].insertAdjacentText('beforeend', " (" + ratio1 + "|" + ratio3 + ")");
            upkeepStockRows[j].insertAdjacentText('beforeend', " (" + ratio2 + "|" + ratio4 + ")");
            } else if (!settings.excludedCommodities && settings.includedCommodities) {
            upkeepRows[j].insertAdjacentText('beforeend', " (" + ratio3 + ")");
            upkeepStockRows[j].insertAdjacentText('beforeend', " (" + ratio4 + ")");
            } else if (settings.excludedCommodities && !settings.includedCommodities) {
            upkeepRows[j].insertAdjacentText('beforeend', " (" + ratio1 + ")");
            upkeepStockRows[j].insertAdjacentText('beforeend', " (" + ratio2 + ")");
            }
        }

        const infotext = cells[infoColIndex].textContent.trim().replace(/,/g, '');
            const ratio1 = (Math.floor(cap / Math.max(upkeeptotal, prodtotal)));
            const ratioText = document.createTextNode("/" + ratio1 + "");
        // Find the <a> tag
         const link = cells[infoColIndex].querySelector('a');

// Insert the text before the <a> tag
if (link) {
    cells[infoColIndex].insertBefore(ratioText, link);
} else {
    // fallback: just append it
    cells[infoColIndex].appendChild(ratioText);
}
             //cells[infoColIndex].insertAdjacentText('beforeend', " (" + ratio1 + ")");
            log(infotext);
    }
}
//global variables
const defaultSettings = {
    excludedCommodities: true,
    includedCommodities: true
  };

  // Load or initialize settings
const settings = {
    excludedCommodities: GM_getValue('excludedCommodities', defaultSettings.excludedCommodities),
    includedCommodities: GM_getValue('includedCommodities', defaultSettings.includedCommodities)
  };

function registerSettings(){

  // Register a menu command to edit settings
  GM_registerMenuCommand("⚙️ Edit Settings", () => {
    //const excludedCommodities = confirm("Display upkeep Max values WITHOUT accounting for current Comodities?") ? true : false;
    //const includedCommodities = confirm("Display upkeep Max values INCLUDING accounting for current Comodities?") ? true : false;
      const choice = prompt(
        "Choose commodity display mode:\n" +
        "0 = Turn off\n" +
        "1 = Exclude current commodities\n" +
        "2 = Include current commodities\n" +
        "3 = Display Both with and without current commodities\n" +
        "4 = Cancel / No change"
    );

    switch (choice) {
        case "0":
            GM_setValue('excludedCommodities', false);
            GM_setValue('includedCommodities', false);
            window.top.location.reload();
            break;
        case "1":
            GM_setValue('excludedCommodities', true);
            GM_setValue('includedCommodities', false);
            window.top.location.reload();
            break;
        case "2":
            GM_setValue('excludedCommodities', false);
            GM_setValue('includedCommodities', true);
            window.top.location.reload();
            break;
        case "3":
            GM_setValue('excludedCommodities', true);
            GM_setValue('includedCommodities', true);
            window.top.location.reload();
            break;
        default:
            alert("No changes made to commodity display settings.");
    }


  });
}


    // Your code here..
function pardusBuildingInit() {
    // Load Document data into short variables
    var doc = document;
    var loc = doc.location.href;
    var search = doc.location.search.substring(doc.location.search.indexOf("=")+1);
    if (loc.match('overview_buildings.php')) {
        var buildingtable = document.querySelectorAll('table.messagestyle')[0];
       log('location matched:', loc);
        if (typeof buildingtable != 'undefined') {
            pardusBuildingMax(buildingtable);
        }
    }
    if (loc.match('game.php')) {
        registerSettings();
    }
     return;
}


  pardusBuildingInit();
})();
