// ==UserScript==
// @name         Dock screen updater
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.3
// @description  gives the calculated production upkeep for the buildings
// @author       Spacerules
// @match        http://*.pardus.at/logout.php
// @match        https://*.pardus.at/logout.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/dockScreen.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/dockScreen.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */

(function() {
    'use strict';

  logEnabled(false);

  logGroupStart('File: dockScreen.js');

  function AddSectorLink() {
    logGroupStart('Function: AddSectorLink');
    var tdStatusSector = document.getElementById("tdStatusSector");

    if (tdStatusSector) {
        // Get the current text inside the td (e.g., " UG 5-093")
        var text = tdStatusSector.textContent.trim();
        logDebug(text);
        // Create the link
        var link = document.createElement("a");
        link.href = "https://pardusmapper.com/" + readCookie("uni") + "/" + encodeURIComponent(text);
        link.target = "_blank"; // Open in new window/tab
        link.rel = "noopener noreferrer"; // Security best practice
        link.innerHTML = text;

        logDebug(link.href);
        // Replace the contents of the td with the link
        tdStatusSector.innerHTML = "&nbsp;";
        tdStatusSector.appendChild(link);
    }

    logGroupEnd();
  }

  function AddUsername() {
    logGroupStart('Function: AddUsername');

    //Main Table > Table Body > TR1 middle row, top row is pictures, td1 middle column aligned middle, First item is the header we are appending to
    var h1data = document.getElementsByTagName("Table")[0].children[0].children[1].children[1].children[0];
      var text = h1data.textContent.trim() +"  " +readCookie("user");
    h1data.innerHTML = text;
    logDebug(text);

    logGroupEnd();

  }
  // Your code here..
  function pardusBuildingInit() {
    // Load Document data into short variables
    var doc = document;
    var loc = doc.location.href;

    logGroupStart('Function: pardusBuildingInit | loc=' + loc);
    //  not used in this script but want to keep it for potential mods.
    //  var search = doc.location.search.substring(doc.location.search.indexOf("=") + 1);

    if (loc.match('logout.php')) {
      logSuccess('location matched:', loc);
        AddUsername();
        AddSectorLink();
    }

    logGroupEnd();

  }

  pardusBuildingInit();

  logGroupEnd();
})();
