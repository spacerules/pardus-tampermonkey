// ==UserScript==
// @name         Pardus Log Total List
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  adds a total to th;e log files
// @author       Spacerules
// @match        http*://*.pardus.at/*
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/LogTotalList.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/LogTotalList.user.js
// ==/UserScript==

(function() {
    'use strict';

function log(...args) {
    const debug = false;
    if (debug) {
        console.log(...args);
    }
}


function readCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i = 0;i < ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) === ' ') { c = c.substring(1,c.length); }
		if (c.indexOf(nameEQ) === 0) { return c.substring(nameEQ.length,c.length); }
	}
	return null;
}




function parduslogtotals(logtable) {
  const firstRow = logtable?.querySelector('tr');
  const columnCount = firstRow ? firstRow.children.length : 0;

  log('Number of columns:', columnCount);

  let totalColIndex = -1;
  let actionColIndex = -1;
  let pilotColIndex = -1;

  let username = "";

  // get username
    try {
        if (readCookie('server') !== null && (readCookie('uni').match('Orion') || readCookie('uni').match('Artemis') || readCookie('uni').match('Pegasus'))) {
		// Lets Find out your Current Location in the Padusian Universe
		if (readCookie('user') !== null){
            username = readCookie('user');
            log(username);
		}
	   }
    } catch(ex) { log(ex); }

  // Step 1: Find the "Total" column index
  for (let i = 0; i < firstRow.children.length; i++) {
    const text = firstRow.children[i].textContent.trim().toLowerCase();
    if (text.includes("total") ||
        text.includes("price") ||
        text.includes("reward")) {
      totalColIndex = i;
      log("It worked: Found 'total' at index", i);
    }

    if (text.includes("action")) {
      actionColIndex = i;
      log("It worked: Found 'action' at index", i);
    }
    if (text.includes("pilot")) {
      pilotColIndex = i;
      log("It worked: Found 'pilotColIndex' at index", i);
    }


  }

  // Step 2: Sum values in that column
  let totalSum = 0;

  const rows = logtable.querySelectorAll('tr');
  for (let i = 1; i < rows.length; i++) { // skip the header row
    const cells = rows[i].children;
    if (cells.length <= totalColIndex) continue;

    const cellTexttotal = cells[totalColIndex].textContent.trim().replace(/,/g, '');
    if (actionColIndex > -1) {
      const cellTextAction = cells[actionColIndex].textContent.trim().replace(/,/g, '');
      log("action:",cellTextAction);
      if (pilotColIndex > -1) {
          const cellTexPilot = cells[pilotColIndex].textContent.trim().replace(/,/g, '');
          if (cellTexPilot === username) {
              if (cellTextAction.toLowerCase().includes("bought") ||
                  cellTextAction.toLowerCase().includes("repaired")
                 ) {
                  const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                  totalSum -= num;
              } else {
                  const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                  totalSum += num;
              }
          } else {
              if (cellTextAction.toLowerCase().includes("bought") ||
                  cellTextAction.toLowerCase().includes("repaired")
                 ) {
                  const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                  totalSum += num;
              } else {
                  const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
                  totalSum -= num;
              }
          }
      } else
      if (cellTextAction.toLowerCase().includes("bought") ||
          cellTextAction.toLowerCase().includes("repaired")
         ) {
          const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
          totalSum -= num;
      } else {
          const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
          totalSum += num;
      }

    } else {
    const num = parseFloat(cellTexttotal) || 0; // blank or NaN = 0
    totalSum += num;
    }
  }

  // Step 3: Build the final row
  const finalTotalTR = document.createElement('tr');
  const finalTotalCredits = document.createElement('img');
    finalTotalCredits.src = "//static.pardus.at/img/stdhq/credits.png";
    finalTotalCredits.title = "Credits";
    finalTotalCredits.alt = "Credits";

  for (let i = 0; i < columnCount; i++) {
    const finalTotalTD = document.createElement('td');

    if (i === totalColIndex) {
      finalTotalTD.align = "right";
      finalTotalTD.style.color = "#A2EAF6";
      finalTotalTD.textContent = totalSum.toLocaleString() + " ";
      finalTotalTD.appendChild(finalTotalCredits);
    } else
    if (i === totalColIndex-1) {
      finalTotalTD.align = "right";
      finalTotalTD.style.color = "#A2EAF6";
      finalTotalTD.textContent = "Total";
      finalTotalTD.appendChild(finalTotalCredits);
    } else {
      finalTotalTD.innerHTML = "&nbsp;";
    }

    finalTotalTR.appendChild(finalTotalTD);
  }

  logtable.querySelector('tbody').appendChild(finalTotalTR);

}

    // Your code here..
function pardusSubtotalInit() {
    // Load Document data into short variables
    var doc = document;
    var loc = doc.location.href;
    var search = doc.location.search.substring(doc.location.search.indexOf("=")+1);
    log('script running');
    if (loc.match('overview_tl_res.php') ||
        loc.match('overview_tl_eq.php') ||
        loc.match('overview_missions_log.php') ||
        loc.match('overview_payment_log.php') ||
        loc.match('overview_tl_eq.php')) {
        var logtable = document.querySelectorAll('table.messagestyle')[1];
        log('location matched:', loc);
        if (typeof logtable != 'undefined') {
            parduslogtotals(logtable);
        }
    }
     return;
}


  pardusSubtotalInit();
})();
