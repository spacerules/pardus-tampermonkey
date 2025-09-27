// ==UserScript==
// @name         QuickLink ShortCuts
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.1
// @description  Shortcuts for trading and returning. Makes trading twice as fast
// @author       Sammy Haffy
// @match        http://*.pardus.at/*
// @match        https://*.pardus.at/*
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.user.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.user.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @tag          Pardus
// @tag          Sam
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/QuickLinkShortCuts.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/QuickLinkShortCuts.js
// ==/UserScript==


/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */
var allMenus = ["building_management.php", "building_trade.php", "starbase_trade.php"];
(function() {
    'use strict';
    logEnabled(false);

    document.addEventListener('keydown', function(e) {
        if (e.key === "Escape") {
            e.preventDefault(); // Stop default Escape behavior like exiting fullscreen

            if (parent && parent.main) {
                parent.main.location.href = "main.php";
                parent.main.focus();
            } else {
                window.location.href = "main.php";
            }
        }
        if (e.key === "T") {

            e.preventDefault(); // Stop default Escape behavior like exiting fullscreen

            var content = document.getElementById("commands_content").children[0];

            allMenus.forEach((item) => {
                if (content.outerHTML.includes(item)){
                    if (parent && parent.main) {
                        parent.main.location.href = item;
                        parent.main.focus();
                    } else {
                        window.location.href = item;
                    }
                    return;
                }
            });
        }
    });
})();






