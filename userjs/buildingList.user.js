// ==UserScript==
// @name         Building List Accurate Max Ticks
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.2.2
// @description  Accurate production/upkeep tick simulation with stored inventory display, floating Pardus-themed settings button, single parentheses display included/excluded, preserves original numbers and links, fixes info duplication, panel closes only on outside click
// @author       Spacerules
// @match        http://*.pardus.at/overview_buildings.php
// @match        https://*.pardus.at/overview_buildings.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @tag          Pardus
// @tag          Spacerules
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */

(function () {
    'use strict';

    // Enable/disable logging (currently disabled)
    logEnabled(false);

    /**
     * Simulate the maximum number of ticks possible for production and upkeep.
     * @param {number[]} inputsPerTick - Array of inputs consumed per tick
     * @param {number[]} outputsPerTick - Array of outputs produced per tick
     * @param {number} capacity - Maximum storage capacity
     * @returns {number} Number of possible ticks
     */
    function simulateMaxTicks(inputsPerTick, outputsPerTick, capacity) {
        logGroupStart('simulateMaxTicks');
        const inputSum = inputsPerTick.reduce((a,b)=>a+b,0);
        const outputSum = outputsPerTick.reduce((a,b)=>a+b,0);
        logInfo('Input sum:', inputSum, 'Output sum:', outputSum);

        let inputMaxTicks = Math.floor(capacity / inputSum);
        let outputMaxTicks = Math.floor(capacity / outputSum);
        let mostPossibleTicks = Math.min(inputMaxTicks, outputMaxTicks);
        logInfo('Max ticks based on input/output:', mostPossibleTicks);

        let storage = 0, cycles = 0;
        for (let i = 0; i < mostPossibleTicks; i++) {
            let afterInput = storage - inputSum;
            if (afterInput < 0) afterInput = 0;
            let afterOutput = afterInput + outputSum;
            if (afterOutput > capacity) break; // stop if storage overflows
            storage = afterOutput;
            cycles++;
        }
        logGroupEnd();
        return cycles;
    }

    /**
     * Calculate ratios for upkeep display based on stored commodities and max production
     * @param {number} capacity - Maximum storage capacity
     * @param {number[]} inputsPerTick - Inputs per tick
     * @param {number[]} outputsPerTick - Outputs per tick
     * @param {number[]} storedInputs - Currently stored inputs
     * @param {number[]} storedComodities - Currently stored commodities
     * @returns {object} maxTicks and array of stock ratios
     */
    function calculateUpkeepRatios(capacity, inputsPerTick, outputsPerTick, storedInputs, storedComodities) {
        logGroupStart('calculateUpkeepRatios');
        logInfo('Capacity:', capacity, 'Inputs:', inputsPerTick, 'Outputs:', outputsPerTick, 'Stored Inputs:', storedInputs, 'Stored Commodities:', storedComodities);

        let maxTicks = simulateMaxTicks(inputsPerTick, outputsPerTick, capacity);
        let maxTicksWithCom = simulateMaxTicks(inputsPerTick, outputsPerTick, capacity - storedComodities.reduce((a,b)=>a+b,0));

        let stockRatios = inputsPerTick.map((input, idx) => {
            let totalInput = input * maxTicks;
            let totalInputCom = input * maxTicksWithCom;
            let stored = storedInputs[idx] || 0;

            return {
                maxProductionCom: totalInputCom,
                maxProduction: totalInput,
                stockmax: Math.min(totalInput, totalInput - stored + input),
                stockcom: Math.min(totalInputCom, totalInputCom - stored + input)
            };
        });

        logInfo('Stock ratios:', stockRatios);
        logGroupEnd();
        return { maxTicks, stockRatios };
    }

    /**
     * Safely insert text into a table cell while preserving links.
     * @param {HTMLElement} cell - Table cell
     * @param {string} text - Text to insert
     */
    function safeInsertText(cell, text) {
        if (!cell) return;
        const link = cell.querySelector('a');
        if (link) link.insertAdjacentText('beforebegin', text);
        else if ('insertAdjacentText' in cell) cell.insertAdjacentText('beforeend', text);
        else if ('textContent' in cell) cell.textContent += text;
    }

    /**
     * Clear previously appended text from a table cell using regex.
     * Regex explanation: \s*\([^)]+\)
     * - \s*      : optional whitespace before the parentheses
     * - \(       : literal '('
     * - [^)]+    : one or more characters that are not ')'
     * - \)       : literal ')'
     * This removes all "(val1/val2)" text from the cell but preserves original numbers.
     * @param {HTMLElement} td - Table cell
     */
    function clearAppendedText(td) {
        td.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE)
                node.textContent = node.textContent.replace(/\s*\([^)]+\)/g, '');
        });
    }

    /**
     * Clear previously appended max tick info from the info cell
     * Regex explanation: \s*\/\d+
     * - \s*    : optional whitespace before the '/'
     * - \/     : literal '/'
     * - \d+    : one or more digits
     * This removes "/123" from the end of the info cell without touching the rest of the text.
     * @param {HTMLElement} cell - Info cell
     */
    function clearInfoCell(cell) {
        cell.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE)
                node.textContent = node.textContent.replace(/\s*\/\d+$/, '');
        });
    }

    /**
     * Main function to process building table and update ticks display
     * @param {HTMLTableElement} buildingtable - The building table element
     */
    function pardusBuildingMax(buildingtable) {
        const firstRow = buildingtable?.querySelector('tr');
        if (!firstRow) return;

        // Get column indices
        const capColIndex = getColumnNr(firstRow, "capacity");
        const upkeepColIndex = getColumnNr(firstRow, "upkeep");
        const upkeepStockColIndex = getColumnNr(firstRow, "upkeep stock");
        const prodColIndex = getColumnNr(firstRow, "production", 2);
        const comColIndex = getColumnNr(firstRow, "commodities");
        const infoColIndex = getColumnNr(firstRow, "info");

        const rows = buildingtable.querySelectorAll(':scope > tbody > tr');

        // Retrieve user settings from GM storage
        const excludedCom = GM_getValue('excludedCommodities', false);
        const includedCom = GM_getValue('includedCommodities', false);

        logInfo('User settings: excludedCommodities=', excludedCom, 'includedCommodities=', includedCom);

        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].children;
            const cap = parseFloat(cells[capColIndex].textContent.trim().replace(/,/g, '')) || 0;

            // Get all relevant td elements in this row
            let upkeepCells = Array.from(cells[upkeepColIndex].querySelectorAll('td'));
            let prodCells = Array.from(cells[prodColIndex].querySelectorAll('td'));
            let stockCells = Array.from(cells[upkeepStockColIndex].querySelectorAll('td'));
            let comodCells = Array.from(cells[comColIndex].querySelectorAll('td'));

            // Store original values to preserve numbers
            upkeepCells.forEach(td => { if (!td.hasAttribute('data-original')) td.setAttribute('data-original', parseFloat(td.textContent.trim().replace(/[^0-9.-]/g,''))||0); });
            prodCells.forEach(td => { if (!td.hasAttribute('data-original')) td.setAttribute('data-original', parseFloat(td.textContent.trim().replace(/[^0-9.-]/g,''))||0); });
            stockCells.forEach(td => { if (!td.hasAttribute('data-original')) td.setAttribute('data-original', parseFloat(td.textContent.trim().replace(/[^0-9.-]/g,''))||0); });
            comodCells.forEach(td => { if (!td.hasAttribute('data-original')) td.setAttribute('data-original', parseFloat(td.textContent.trim().replace(/[^0-9.-]/g,''))||0); });

            let inputsPerTick = upkeepCells.map(td => parseFloat(td.getAttribute('data-original')) || 0);
            let outputsPerTick = prodCells.map(td => parseFloat(td.getAttribute('data-original')) || 0);
            let storedInputs = stockCells.map(td => parseFloat(td.getAttribute('data-original')) || 0);
            let storedComodities = comodCells.map(td => parseFloat(td.getAttribute('data-original')) || 0);

            const { maxTicks, stockRatios } = calculateUpkeepRatios(cap, inputsPerTick, outputsPerTick, storedInputs, storedComodities);

            upkeepCells.forEach(td => clearAppendedText(td));
            stockCells.forEach(td => clearAppendedText(td));
            clearInfoCell(cells[infoColIndex]);

            // --- Single parentheses display included/excluded ---
            upkeepCells.forEach((td, idx) => {
                let valIncluded = includedCom ? stockRatios[idx].maxProductionCom : null;
                let valExcluded = excludedCom ? stockRatios[idx].maxProduction : null;
                let display = null;
                if (valIncluded !== null && valExcluded !== null) display = `${valIncluded}/${valExcluded}`;
                else if (valIncluded !== null) display = `${valIncluded}`;
                else if (valExcluded !== null) display = `${valExcluded}`;
                if (display !== null) safeInsertText(td, ` (${display})`);
            });

            stockCells.forEach((td, idx) => {
                let valIncluded = includedCom ? stockRatios[idx].stockcom : null;
                let valExcluded = excludedCom ? stockRatios[idx].stockmax : null;
                let display = null;
                if (valIncluded !== null && valExcluded !== null) display = `${valIncluded}/${valExcluded}`;
                else if (valIncluded !== null) display = `${valIncluded}`;
                else if (valExcluded !== null) display = `${valExcluded}`;
                if (display !== null) safeInsertText(td, ` (${display})`);
            });

            if (excludedCom || includedCom) safeInsertText(cells[infoColIndex], ` /${maxTicks}`);
        }
    }

    /**
     * Get the column index of a table based on header text
     */
    function getColumnNr(firstRowTR, searchString, searchOccurrence = 1) {
        let foundOccurrence = 0;
        for (let i=0;i<firstRowTR.children.length;i++){
            const text = firstRowTR.children[i].textContent.trim().toLowerCase();
            if (text.includes(searchString.toLowerCase())){
                foundOccurrence++;
                if (searchOccurrence===foundOccurrence) return i;
            }
        }
        return -1;
    }

    /**
     * Initialize building processing
     */
    function pardusBuildingInit() {
        const doc = document;
        const loc = doc.location.href;
        if (loc.match('overview_buildings.php')) {
            const buildingtable = doc.querySelector('table.messagestyle');
            if (buildingtable) pardusBuildingMax(buildingtable);
        }
    }

    /**
     * Create floating Pardus-themed settings button with radio panel
     */
    function createSettingsButton() {
        const btn = document.createElement("button");
        btn.innerText = "⚙️";
        Object.assign(btn.style, {
            position: "fixed", bottom: "20px", right: "20px", zIndex: "9999",
            padding: "10px 14px", borderRadius: "50%", border: "1px solid #555",
            background: "#0b0b1b", color: "#f5f5f5", cursor: "pointer",
            fontSize: "16px", boxShadow: "0 2px 6px rgba(0,0,0,0.5)", fontFamily: "Orbitron, sans-serif"
        });
        document.body.appendChild(btn);

        const panel = document.createElement("div");
        Object.assign(panel.style, {
            position: "fixed", bottom: "70px", right: "20px", zIndex: "9999",
            padding: "12px", borderRadius: "8px", border: "1px solid #555",
            background: "#0b0b1b", color: "#f5f5f5", fontSize: "14px",
            display: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.6)",
            fontFamily: "Orbitron, sans-serif"
        });

        panel.innerHTML = `
            <b>Pardus Commodity Display</b><br>
            <label><input type="radio" name="commodityMode" value="0"> Turn off</label><br>
            <label><input type="radio" name="commodityMode" value="1"> Include commodities</label><br>
            <label><input type="radio" name="commodityMode" value="2"> Exclude commodities</label><br>
            <label><input type="radio" name="commodityMode" value="3"> Show both</label><br>
        `;
        document.body.appendChild(panel);

        const radios = panel.querySelectorAll('input[name="commodityMode"]');

        function syncRadio() {
            const excluded = GM_getValue('excludedCommodities', false);
            const included = GM_getValue('includedCommodities', false);
            let currentMode = "0";
            if (!excluded && included) currentMode = "1";
            else if (excluded && !included) currentMode = "2";
            else if (excluded && included) currentMode = "3";
            radios.forEach(r => r.checked = (r.value === currentMode));
        }

        radios.forEach(radio => {
            radio.addEventListener("change", () => {
                switch(radio.value){
                    case "0": GM_setValue('excludedCommodities', false); GM_setValue('includedCommodities', false); break;
                    case "1": GM_setValue('excludedCommodities', false); GM_setValue('includedCommodities', true); break;
                    case "2": GM_setValue('excludedCommodities', true); GM_setValue('includedCommodities', false); break;
                    case "3": GM_setValue('excludedCommodities', true); GM_setValue('includedCommodities', true); break;
                }
                pardusBuildingInit();
            });
        });

        btn.addEventListener("click", () => {
            panel.style.display = panel.style.display === "none" ? "block" : "none";
            syncRadio();
        });

        document.addEventListener("click", (e) => {
            if (!panel.contains(e.target) && e.target !== btn) panel.style.display = "none";
        });
    }

    // Run initialization
    pardusBuildingInit();
    createSettingsButton();
})();
