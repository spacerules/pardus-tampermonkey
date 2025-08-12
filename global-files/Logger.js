// ==UserScript==
// @name         glPardusLogger
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.0
// @description  Global logger for styled console output and structured debugging across all scripts
// @author       spacerules
// @match        http://*.pardus.at/*
// @match        https://*.pardus.at/*
// @include      http*://*.pardus.at/*
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/refs/heads/main/global-files/Logger.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/refs/heads/main/global-files/Logger.js
// ==/UserScript==


/**
 * USAGE EXAMPLE:
 * 
 * const LOGGING_ENABLED = true;
 * 
 * logGroupStart(LOGGING_ENABLED, 'Function: pardusBuildingInit');
 * 
 * logInfo(LOGGING_ENABLED, 'Starting task with data:', someData);
 * logWarn(LOGGING_ENABLED, 'Low fuel warning for ship:', shipName);
 * logError(LOGGING_ENABLED, 'Failed to parse JSON:', error);
 * logSuccess(LOGGING_ENABLED, 'Mission accomplished!');
 * logDebug(LOGGING_ENABLED, 'Debugging ship object:', ship);
 * 
 * logGroupEnd(LOGGING_ENABLED);
 *
 *
 * USERSCRIPT EXAMPLE (Note: we have 1 for the file and 1 per function):
 * 
 * (function () {
 *   'use strict';
 *   const LOGGING_ENABLED = true;
 *   
 *   logGroupStart(LOGGING_ENABLED, 'File: myScript.js');
 * 
 *   function pardusBuildingInit() {
 *     // Load Document data into short variables
 *     var doc = document;
 *     var loc = doc.location.href;
 * 
 *     logGroupStart(LOGGING_ENABLED, 'Function: pardusBuildingInit | loc=' + loc);
 *	   
 *     if (loc.match('game.php')) {
 *       logSuccess(LOGGING_ENABLED,'location matched:', loc);
 *       registerSettings();
 *     }
 * 
 *     logGroupEnd(LOGGING_ENABLED);
 *   }
 *
 *   pardusBuildingInit();
 *
 *   logGroupEnd(LOGGING_ENABLED);
 * })();
 */

(function () {
    'use strict';

    const baseStyle = 'padding: 2px 4px; border-radius: 2px; font-weight: bold;';
	let isEnabled = false;
	let isTableActive = false;

    /**
     * Determines whether the value should be displayed as a table.
     * @param {*} value - The value to check.
     * @returns {boolean} True if the value is an object or array suitable for console.table.
     */
    function isTabular(value) {
		if (!isTableActive) return isTableActive;
		
        return (
            Array.isArray(value) &&
            value.length > 0 &&
            typeof value[0] === 'object' &&
            !Array.isArray(value[0])
        ) || (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
        );
    }

    /**
     * Logs a styled message to the console, optionally in a table if the value supports it.
     * @param {boolean} enabled - Whether to output the log.
     * @param {string} label - The label shown in the log.
     * @param {string} style - The CSS style string applied to the label.
     * @param {...*} args - Additional arguments to log.
     */
    function styledLog(enabled, label, style, ...args) {
        if (!enabled) return;

        if (args.length === 1 && isTabular(args[0])) {
            console.groupCollapsed(`%c${label}`, style);
            console.table(args[0]);
            console.groupEnd();
        } else {
            console.log(`%c${label}`, style, ...args);
        }
    }

    /**
     * Logs an informational message.
     * @param {boolean} enabled - Whether to output the log.
     * @param {...*} args - Arguments to log.
     */
    window.logInfo = (...args) =>
        styledLog(isEnabled, 'ℹ INFO', baseStyle + 'color: black; background: #d6edff;', ...args);

    /**
     * Logs a warning message.
     * @param {boolean} enabled - Whether to output the log.
     * @param {...*} args - Arguments to log.
     */
    window.logWarn = (...args) =>
        styledLog(isEnabled, '⚠ WARN', baseStyle + 'color: black; background: #f7f1b5;', ...args);

    /**
     * Logs an error message.
     * @param {boolean} enabled - Whether to output the log.
     * @param {...*} args - Arguments to log.
     */
    window.logError = (...args) => {
        styledLog(isEnabled, '⛔ ERROR', baseStyle + 'color: black; background: #f5a59f;', ...args);
        console.trace();
    }

    /**
     * Logs a success message.
     * @param {boolean} enabled - Whether to output the log.
     * @param {...*} args - Arguments to log.
     */
    window.logSuccess = (...args) =>
        styledLog(isEnabled, '✔ SUCCESS', baseStyle + 'color: black; background: #d2fcd3;', ...args);

    /**
     * Logs a debug message.
     * @param {boolean} enabled - Whether to output the log.
     * @param {...*} args - Arguments to log.
     */
    window.logDebug = (...args) =>
        styledLog(isEnabled, '🐞 DEBUG', baseStyle + 'color: black; background: #dbdbdb;', ...args);

    /**
     * Begins a collapsed console group with a styled label.
     * @param {boolean} enabled - Whether to show the group.
     * @param {string} title - The title of the group.
     */
    window.logGroupStart = (title) => {
        if (!isEnabled) return;
        console.groupCollapsed(`📁 %c${title}`, baseStyle + 'color: black; background: #aec6d1;');
    };

    /**
     * Ends the most recently opened console group.
     * @param {boolean} enabled - Whether to end the group (noop if disabled).
     */
    window.logGroupEnd =  function() {
        if (!isEnabled) return;
        console.groupEnd();
    };
	
	/**
     * Ends the most recently opened console group.
     * @param {boolean} enabled - Whether to end the group (noop if disabled).
     */
    window.logEnabled =  (enabled) => {
        isEnabled = enabled;
    };
	
	/**
     * Ends the most recently opened console group.
     * @param {boolean} enabled - Whether to end the group (noop if disabled).
     */
    window.logtable =  (enabled) => {
        isTableActive = enabled;
    };

    // Optional: Set default `log` alias for info-level
    window.log = window.logInfo;

})();
