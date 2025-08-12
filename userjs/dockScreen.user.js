// ==UserScript==
// @name         Quick Links
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.1
// @description  Quick Links
// @author       Spacerules
// @match        http://*.pardus.at/main.php
// @match        https://*.pardus.at/main.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/quickLinks.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/quickLinks.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */
(function() {
    'use strict';

  logEnabled(false);

var orionCustomLinks = [
  "https://pardusmapper.com/" + readCookie("uni") + "/" + readCookie("sector"),
  'https://pardus.maxisoft.org/monsters.html',
  'http://pardus.maxisoft.org/monsterskillfinder.html',
  'https://docs.google.com/spreadsheets/d/1UaITDxjb2eQEtApp4N5h3L4bDd7Z5BJsl4H6bI8cmJU/edit?pli=1&gid=0#gid=0',
  'https://thewaistelands.info/pardus-clock/'
];

var orionCustomLinkNames = [
  'Map',
  'Monsters',
  'Monster Skill Finder',
  'Enemy&nbsp;Bible',
  "Clocks"
];

// Locate the original table
var originalTable = document.getElementById('yourship');
var clonedTable = originalTable.cloneNode(true);
clonedTable.id = 'yourship_custom_links';

// Replace content inside the internal content <div>
var contentDiv = clonedTable.querySelector('#yourship_content');

var customLinksHTML = '<table border="0" align="center"><tbody>';
for (let i = 0; i < orionCustomLinks.length; i++) {
  customLinksHTML += `
    <tr>
      <td colspan="2" style="text-align:center">
        <a href="${orionCustomLinks[i]}" target="_blank">
          <font size="1">${orionCustomLinkNames[i]}</font>
        </a>
      </td>
    </tr>
  `;
}
customLinksHTML += '</tbody></table>';
contentDiv.innerHTML = customLinksHTML;

// Replace the ship image
var imageElem = clonedTable.querySelector('#yourship_image');
if (imageElem) {
  imageElem.src = 'https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/resources/links.png';
}

// Insert two <br> elements and the modified table after the original
var br1 = document.createElement('br');
var br2 = document.createElement('br');
originalTable.parentNode.insertBefore(br1, originalTable.nextSibling);
originalTable.parentNode.insertBefore(br2, br1.nextSibling);
originalTable.parentNode.insertBefore(clonedTable, br2.nextSibling);


})();
