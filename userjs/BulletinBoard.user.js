// ==UserScript==
// @name         Pardus Multi-Sector AP Pathfinder Bulletin Board
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      0.9
// @description  Show multi-sector AP path info for missions on bulletin board with progress and jump filter
// @match        http*://*.pardus.at/bulletin_board.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/APPathfinderCore.user.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/BulletinBoard.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/BulletinBoard.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */
/* global multiSectorPath */

(function() {
  'use strict';

  logEnabled(false);
  logGroupStart(`File: ${GM_info.script.name}`);

  let jumpLimit = -1; // default: show all jumps
  let missionlist = [];
  let resultsCache = [];

  function waitForElement(selector, cb) {
    const el = document.querySelector(selector);
    if (el) cb(el);
    else requestAnimationFrame(() => waitForElement(selector, cb));
  }

  // --- GM storage helpers ---
  function getGM_list() {
    const storedStr = GM_getValue("missionSettings", null);
    const stored = storedStr ? JSON.parse(storedStr) : {};
    const defaults = {
      checkboxtransport: true,
      checkboxAttack: true,
      checkboxOther: true,
      jumpfilter: -1
    };
    const missionSettings = {
      checkboxtransport: stored.checkboxtransport !== undefined ? stored.checkboxtransport : defaults.checkboxtransport,
      checkboxAttack: stored.checkboxAttack !== undefined ? stored.checkboxAttack : defaults.checkboxAttack,
      checkboxOther: stored.checkboxOther !== undefined ? stored.checkboxOther : defaults.checkboxOther,
      jumpfilter: stored.jumpfilter !== undefined ? stored.jumpfilter : defaults.jumpfilter
    };
    if (!storedStr || Object.keys(stored).length < Object.keys(defaults).length) {
      GM_setValue("missionSettings", JSON.stringify(missionSettings));
    }
    return missionSettings;
  }

  function setGM_list(key, value) {
    const settings = getGM_list();
    settings[key] = value;
    GM_setValue("missionSettings", JSON.stringify(settings));
  }

  // --- Create mission list ---
  function createMissionList() {
    const missions = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"));
    const missionSettings = getGM_list();

    missionlist = missions.map(missionTable => {
      const text = missionTable.textContent.toLowerCase();
      return {
        mission: missionTable,
        checkboxtransport: missionSettings.checkboxtransport,
        checkboxAttack: missionSettings.checkboxAttack,
        checkboxOther: missionSettings.checkboxOther,
        jumpfilter: true,
        type: text.includes("transport") ? "transport" :
        (text.includes("attack") || text.includes("annihilate") ? "attack" : "other")
      };
    });
  }

  // --- Refresh mission visibility ---
  function refreshHidden() {
    missionlist.forEach(missionItem => {
      let checkboxHide = false;
      if (missionItem.type === "transport") checkboxHide = !missionItem.checkboxtransport;
      else if (missionItem.type === "attack") checkboxHide = !missionItem.checkboxAttack;
      else checkboxHide = !missionItem.checkboxOther;

      const jumpHide = missionItem.jumpfilter === false;
      const shouldHide = checkboxHide || jumpHide;

      missionItem.mission.hidden = shouldHide;
      if (missionItem.mission.nextElementSibling) {
        missionItem.mission.nextElementSibling.hidden = shouldHide;
      }
    });
  }

  // --- Setup UI filters ---
  // --- Setup UI filters ---
  function setupFilters() {
    const headerLink = document.querySelector(".messagestyle a");
    if (!headerLink) return;

    const newbr1 = document.createElement("br");
    const newbr2 = document.createElement("br");
    const newspan = document.createElement("span");
    newspan.id = "checkboxfilter";
    headerLink.insertAdjacentElement("afterend", newbr1);
    newbr1.insertAdjacentElement("afterend", newbr2);
    newbr2.insertAdjacentElement("afterend", newspan);

    const missionSettings = getGM_list();
    jumpLimit = missionSettings.jumpfilter; // <-- Initialize jumpLimit from GM storage

    function createCheckbox(labelText, propertyName) {
      const input = document.createElement("input");
      const label = document.createElement("label");
      input.type = "checkbox";
      input.id = propertyName;
      input.checked = missionSettings[propertyName];
      label.textContent = labelText;
      label.htmlFor = propertyName;

      input.addEventListener("change", function() {
        setGM_list(propertyName, this.checked);
        missionlist.forEach(item => item[propertyName] = this.checked);
        refreshHidden();
      });

      newspan.appendChild(input);
      newspan.appendChild(label);
    }

    createCheckbox("Transports","checkboxtransport");
    createCheckbox("Attack", "checkboxAttack");
    createCheckbox("Other", "checkboxOther");

    // Jump filter input
    const jumpDiv = document.createElement("div");
    jumpDiv.style.marginTop = "4px";
    jumpDiv.innerHTML = `Jumps filter: <input type="number" id="jumpFilter" value="${jumpLimit}" style="width:50px"> (-1 = show all)`;
    newspan.appendChild(document.createElement("br"));
    newspan.appendChild(jumpDiv);

    document.getElementById("jumpFilter").addEventListener("input", function() {
      jumpLimit = parseInt(this.value, 10);
      setGM_list("jumpfilter", jumpLimit);
      applyJumpFilter();
    });

    // Progress display
    const progressDiv = document.createElement("div");
    progressDiv.id = "mission-progress";
    progressDiv.style.fontSize = "12px";
    progressDiv.style.marginTop = "4px";
    progressDiv.textContent = "Loading missions: 0/0";
    newspan.insertAdjacentElement("afterend", progressDiv);
  }


  // --- Apply jump filter ---
  function applyJumpFilter() {
    missionlist.forEach(missionItem => {
      const match = resultsCache.find(r => r.table === missionItem.mission);
      missionItem.jumpfilter = match ? (!match.result || jumpLimit === -1 || match.result.jumps <= jumpLimit) : true;
    });
    refreshHidden();
  }

  // --- Main board processing ---
  function runBoard() {
    waitForElement("table.messagestyle", () => {
      const tables = Array.from(document.querySelectorAll("#div_missions > table.messagestyle"));
      const currentSector = readCookie('sector');
      const currentX = parseInt(readCookie('x'), 10);
      const currentY = parseInt(readCookie('y'), 10);
      if (!currentSector || Number.isNaN(currentX) || Number.isNaN(currentY)) return;

      const progressDiv = document.getElementById("mission-progress");
      let completed = 0;
      progressDiv.textContent = `Loading missions: ${completed}/${tables.length}`;

      const promises = tables.map(table => {
        const footerTd = table.querySelector("tr:last-child td:nth-child(2)");
        if (!footerTd) return Promise.resolve({ table, result: null, borderColor: '' });
        footerTd.querySelectorAll("span, br").forEach(e => e.remove());

        const statusSpan = document.createElement("span");
        statusSpan.textContent = "Loading...";
        footerTd.appendChild(document.createElement("br"));
        footerTd.appendChild(statusSpan);
        footerTd.appendChild(document.createElement("br"));

        const tableHTML = table.innerHTML;
        let sectorMatch = tableHTML.match(/sector <b>(.*?)<\/b>/i);
        if (!sectorMatch) sectorMatch = tableHTML.match(/in <b>(.*?)<\/b>/i);

        let coordMatch = null;
        const descTd = table.querySelectorAll("tr")[1]?.querySelectorAll("td")[2];
        if (descTd) coordMatch = descTd.textContent.match(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/);

        if (!sectorMatch || !coordMatch) {
          statusSpan.remove();
          completed++;
          progressDiv.textContent = `Loading missions: ${completed}/${tables.length}`;
          return Promise.resolve({ table, result: null, borderColor: table.style.borderColor || '' });
        }

        const destSector = sectorMatch[1].trim();
        const destX = parseInt(coordMatch[1], 10);
        const destY = parseInt(coordMatch[2], 10);

        return multiSectorPath(
          { sector: currentSector, x: currentX, y: currentY },
          { sector: destSector, x: destX, y: destY }
        ).then(result => {
          const mapperUrl = `https://pardusmapper.com?startSector=${encodeURIComponent(currentSector)}&startX=${currentX}&startY=${currentY}&destSector=${encodeURIComponent(destSector)}&destX=${destX}&destY=${destY}`;
          const link = document.createElement("a");
          link.href = mapperUrl;
          link.target = "_blank";
          link.innerHTML = `${result.jumps} jumps<br>${Math.round(result.cost)} AP`;
          statusSpan.textContent = "";
          statusSpan.appendChild(link);

          completed++;
          progressDiv.textContent = `Loading missions: ${completed}/${tables.length}`;
          return { table, result, borderColor: table.style.borderColor || '' };
        }).catch(err => {
          statusSpan.textContent = "Error";
          completed++;
          progressDiv.textContent = `Loading missions: ${completed}/${tables.length}`;
          return { table, result: null, borderColor: table.style.borderColor || '' };
        });
      });

      Promise.all(promises).then(results => {
        results.forEach(r => {
          // get all rows inside r.table
          const rows = r.table.querySelectorAll("tr");
          if (rows.length > 1) {
            // take the second row (index 1)
            const imgEl = rows[1].querySelector("td img");
            r.imageLink = imgEl ? imgEl.getAttribute("src") : "";
            logInfo(r.imageLink, imgEl);
          } else {
            r.imageLink = "";
          }
        });

        results.sort((a, b) => {
          // 1. borderColor
          if (a.borderColor !== b.borderColor) {
            return b.borderColor.localeCompare(a.borderColor);
          }

          // 2. missing results go first
          if (!a.result && b.result) return -1;
          if (a.result && !b.result) return 1;
          if (!a.result && !b.result) {
            return a.imageLink.localeCompare(b.imageLink);
          }

          // 3. jumps
          if (a.result.jumps !== b.result.jumps) {
            return a.result.jumps - b.result.jumps;
          }

          // 4. imageLink as tiebreaker
          const cmp = a.imageLink.localeCompare(b.imageLink);
          if (cmp !== 0) return cmp;

          // 5. cost
          return a.result.cost - b.result.cost;
        });

        document.querySelectorAll("#div_missions > br").forEach(br => br.remove());
        results.forEach(r => {
          r.table.parentNode.appendChild(document.createElement("br"));
          r.table.parentNode.appendChild(r.table);
        });

        resultsCache = results;
        applyJumpFilter();
        refreshHidden();

        const counterSpan = document.getElementById("mission-progress");
        if (counterSpan) counterSpan.remove();
      });
    });
  }

  createMissionList();
  setupFilters();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runBoard);
  } else {
    runBoard();
  }

})();
