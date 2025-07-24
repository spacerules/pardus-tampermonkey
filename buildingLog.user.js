// ==UserScript==
// @name         Building List
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  try to take over the world!
// @author       You
// @match        http*://*.pardus.at/*
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/buildingLog.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/buildingLog.user.js
// ==/UserScript==

(function() {
    'use strict';

function log(...args) {
    const debug = false;
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

    if (text.includes("production") && prodColIndex == -1) {
      prodColIndex = i;
      log("It worked: Found 'prodColIndex' at index", i);
    }

    if (text.includes("info") && infoColIndex == -1) {
      infoColIndex = i;
      log("It worked: Found 'infoColIndex' at index", i);
    }
  }

   // Step 2: loop throug each table row.
     const rows = buildingtable.querySelectorAll(':scope > tbody > tr');

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

        //get the total comodities of each row
        const prodRows = cells[prodColIndex].querySelectorAll('td');
        var prodtotal = 0;

        for (let j = 0; j < prodRows.length; j++) { // skip the header row
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


            const ratio1 = (cap * upkeepcurrentnum) / Math.max(upkeeptotal, prodtotal);
            const ratio2 = (((cap * upkeepcurrentnum) / Math.max(upkeeptotal, prodtotal)).toFixed(0)) - upkeepstockcells;

            const rounded1 = ratio1 % 1 === 0 ? ratio1.toFixed(0) : ratio1.toFixed(2);
            upkeepRows[j].insertAdjacentText('beforeend', " (" + rounded1 + ")");
            upkeepStockRows[j].insertAdjacentText('beforeend', " (" + ratio2 + ")");
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
     return;
}


  pardusBuildingInit();
})();
