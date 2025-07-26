/**
 * Custom Logger with Conditional Output and Manual Grouping
 *
 * Usage Example:
 *
 *   // Define a global constant for the file to enable/disable logging easily
 *   const LOGGING_ENABLED = true;
 *
 *   // Start a group (e.g. file or function start)
 *   logGroupStart(LOGGING_ENABLED, 'File: myScript.js');
 *
 *   // Conditional logging: first arg boolean controls if log shows
 *   logInfo(LOGGING_ENABLED, 'Starting file...');
 *
 *   // Nested group for a function
 *   logGroupStart(LOGGING_ENABLED, 'Function: foo');
 *   logDebug(LOGGING_ENABLED, 'Inside foo function');
 *   logGroupEnd(LOGGING_ENABLED);
 *
 *   logSuccess(LOGGING_ENABLED, 'File finished');
 *
 *   // End outer group
 *   logGroupEnd(LOGGING_ENABLED);
 *
 * Logging functions:
 *   logInfo(show:boolean, ...args)
 *   logWarn(show:boolean, ...args)
 *   logError(show:boolean, ...args)
 *   logSuccess(show:boolean, ...args)
 *   logDebug(show:boolean, ...args)
 *
 * Manual grouping:
 *   logGroupStart(show:boolean, groupName:string)
 *   logGroupEnd(show:boolean)
 */

(function () {
    'use strict';

    const baseStyle = 'padding: 2px 4px; border-radius: 2px; font-weight: bold;';

    function isTabular(value) {
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

    function styledLog(label, style, ...args) {
        if (args.length === 1 && isTabular(args[0])) {
            console.groupCollapsed(`%c${label}`, style);
            console.table(args[0]);
            console.groupEnd();
        } else {
            console.log(`%c${label}`, style, ...args);
        }
    }

    function conditionalLog(label, style, ...args) {
        if (args.length === 0) return;

        const showLog = args[0];
        if (typeof showLog !== 'boolean') {
            styledLog(label, style, ...args);
            return;
        }
        if (!showLog) return;

        styledLog(label, style, ...args.slice(1));
    }

    window.logInfo = (...args) =>
        conditionalLog('ℹ INFO', baseStyle + 'color: white; background: #2196F3;', ...args);

    window.logWarn = (...args) =>
        conditionalLog('⚠ WARN', baseStyle + 'color: black; background: #FFEB3B;', ...args);

    window.logError = (...args) =>
        conditionalLog('⛔ ERROR', baseStyle + 'color: white; background: #f44336;', ...args);

    window.logSuccess = (...args) =>
        conditionalLog('✔ SUCCESS', baseStyle + 'color: white; background: #4CAF50;', ...args);

    window.logDebug = (...args) =>
        conditionalLog('🐞 DEBUG', baseStyle + 'color: white; background: #9E9E9E;', ...args);

    // Shorthand
    window.log = logInfo;

    // Manual group control with conditional show parameter
    window.logGroupStart = function(show, name) {
        if (typeof show === 'boolean') {
            if (!show) return;
            if (typeof name === 'string') {
                console.group(name);
            } else {
                console.group();
            }
        } else {
            // If first arg is not boolean, treat as group name and start group
            console.group(show);
        }
    };

    window.logGroupEnd = function(show) {
        if (typeof show === 'boolean') {
            if (!show) return;
            console.groupEnd();
        } else {
            // If no boolean provided, just end group
            console.groupEnd();
        }
    };

})();
