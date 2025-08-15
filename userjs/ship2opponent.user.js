// ==UserScript==
// @name         ship2opponent
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.3
// @description  try to take over the world!
// @author       Spacerules
// @match        http://*.pardus.at/ship2opponent_combat.php
// @match        https://*.pardus.at/ship2opponent_combat.php
// @include      http*://*.pardus.at/ship2opponent_combat.php*
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.user.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/ship2opponent.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/ship2opponent.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */

(function() {
    'use strict';

  logEnabled(false);

    logGroupStart('File: ship2opponent.js');

  function getAttackCookies(buttonId) {

    logGroupStart('Function: getAttackCookies.js | buttonId=' + buttonId);
    var cookieResult = readCookie("spacebuttonId" + buttonId);
    if (cookieResult == " ") {
      if (buttonId == 1) {
        writeCookie("spacebuttonId" + buttonId, 1, 7);
        cookieResult = readCookie("spacebuttonId" + buttonId);
      } else {
        writeCookie("spacebuttonId" + (buttonId), (buttonId - 1) * 5, 7);
        cookieResult = readCookie("spacebuttonId" + buttonId);
      }
    }
    logInfo("cookieResult", cookieResult);
    logGroupEnd();
    return cookieResult;
  }

  function UpdateAttackCookies(buttonId,buttonValue) {

    logGroupStart('Function: getAttackCookies.js | buttonId=' + buttonId);
    writeCookie("spacebuttonId" + buttonId, buttonValue, 7)

    logGroupEnd();
  }

  function attackWithRounds(roundValue) {
    logGroupStart('Function: attackWithRounds.js | roundValue=' + roundValue);
    const select = document.getElementsByName('rounds')[0];
    const submitBtn = document.getElementsByName('ok')[0];

    logInfo("Incoming roundValue:", roundValue);
    if (select && submitBtn) {
        select.value = roundValue;
        submitBtn.click();
    }

    logGroupEnd();
}


    // Your code here...
  function pardusButtonCreate(attacktable) {

    logGroupStart('Function: pardusButtonCreate.js');
    const doc = document;
    const attacktd = attacktable.children[0].children[0].children[0];
    const dropdowndiv = doc.createElement("div");
    const buttondiv = doc.createElement("div");

    dropdowndiv.style.paddingBottom = "8px";
    buttondiv.style.paddingBottom = "8px";

    for (let buttonid = 1; buttonid <= 5; buttonid++) {
        const button = doc.createElement("input");
        const originalSelect = document.getElementsByName('rounds')[0];
        const clonedSelect = originalSelect.cloneNode(true);

        clonedSelect.id = 'custom-rounds-select-' + buttonid;
        clonedSelect.name = clonedSelect.name + buttonid;
        clonedSelect.style.width = "90px";

        // Read initial value from cookie
        let buttonValue = getAttackCookies(buttonid);
        clonedSelect.value = buttonValue;

        // Create button
        button.id = 'spacebutton' + buttonid;
        button.type = "button";
        button.style.width = "90px";
        button.value = buttonValue;

        // On dropdown change, update cookie and button value
        clonedSelect.addEventListener("change", function () {
            UpdateAttackCookies(buttonid, this.value);
            button.value = this.value; // keep button value updated
        });

        // On button click, always read the current value
        button.addEventListener("click", function () {
            attackWithRounds(button.value);
        });

        buttondiv.appendChild(button);
        dropdowndiv.appendChild(clonedSelect);
    }

    attacktd.insertBefore(buttondiv, attacktd.children[2]);
    attacktd.insertBefore(dropdowndiv, attacktd.children[2]);

    logGroupEnd();
  }



  function pardusOpponentInit() {
    // Load Document data into short variables
    var doc = document;
    var loc = doc.location.href;

    logGroupStart('Function: pardusOpponentInit | loc=' + loc);
    //  not used in this script but want to keep it for potential mods.
    //  var search = doc.location.search.substring(doc.location.search.indexOf("=") + 1);

    //if (loc.match('game.php')) {
    //  registerSettings();
    //}
    if (loc.match('ship2opponent_combat.php')) {
      var attacktable = doc.getElementsByClassName("messagestyle")[0];
      var disabledButton = doc.getElementsByClassName("disabled")[0];
      logSuccess('location matched:', loc);
      if (typeof attacktable != 'undefined' && typeof disabledButton != 'undefined') {
        pardusButtonCreate(attacktable);
      }
    }

    logGroupEnd();

  }

    pardusOpponentInit();

    logGroupEnd();
})();
