// ==UserScript==
// @name         glPardusCookies
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.0
// @description  Global cookie get and set scripts
// @author       spacerules
// @match        http://*.pardus.at/*
// @match        https://*.pardus.at/*
// @include      http*://*.pardus.at/*
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/refs/heads/main/global-files/cookies.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/refs/heads/main/global-files/cookies.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd */
(function () {
    'use strict';

    /**
	 * Reads a cookie from the browser.
	 *
	 * @function readCookie
	 * @param {string} name - The key for the cookie.
	 * @returns {string} The value of the cookie. If not found, returns a single space `" "`.
	 */
	function readCookie(name) {
		try {
			var nameEQ = name + "=";
			var ca = document.cookie.split(';');
			for (var i = 0; i < ca.length; i++) {
				var c = ca[i];
				while (c.charAt(0) === ' ') {
					c = c.substring(1, c.length);
				}
				if (c.indexOf(nameEQ) === 0) {
					return c.substring(nameEQ.length, c.length);
				}
			}
		} catch (ex) {
			logError(ex);
		}
		logError(true, nameEQ + " not found as a cookie.");
		return " ";
	}

	/**
	 * Writes a cookie to the browser.
	 *
	 * @function writeCookie
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value to store in the cookie.
	 * @param {number} [days] - Optional. Number of days until the cookie expires. If omitted, it's a session cookie.
	 *
	 * @example
	 * writeCookie("username", "Chris", 7);       // Expires in 7 days
	 * writeCookie("sessionToken", "abc123");     // Session cookie
	 * writeCookie("username", "", -1);           // Deletes the cookie
	 */
	function writeCookie(name, value, days) {
		try {
			let expires = "";
			if (days) {
				const date = new Date();
				date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
				expires = "; expires=" + date.toUTCString();
			}
			document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/";
		} catch (ex) {
			logError(ex);
		}
	}

	// Expose to window
	window.readCookie = readCookie;
	window.writeCookie = writeCookie;

})();
