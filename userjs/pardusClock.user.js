// ==UserScript==
// @name         Pardus Clock from game.php
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      0.5.0
// @description  Insert clock into msgframe from game.php
// @author       Spacerules
// @match        http://*.pardus.at/msgframe.php
// @match        https://*.pardus.at/msgframe.php
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        none
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/pardusClock.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/pardusClock.user.js
// ==/UserScript==


/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd */
(function () {
  'use strict';

  const LOGGING_ENABLED = false;

  logGroupStart(LOGGING_ENABLED, 'File: pardusClock.js');

  const positionAlongMenuToInsertPardusClock = 0;

  function getHTMLForClock() {
    return `<span id="pardus-clock" style="color: #00FF00; font-weight: bold;">${new Date().toUTCString()}</span>`;
  }

  function tickClock() {
    const msgDoc = window.frames.msgframe.document;
    const clockEl = msgDoc.getElementById('pardus-clock');
    if (clockEl) {
      clockEl.textContent = new Date().toUTCString();
      setTimeout(tickClock, 1000);
    }
  }

  function insertClockIntoMsgFrame() {
    const msgFrame = window.frames.msgframe.document;
    if (!msgFrame) {
      logError(LOGGING_ENABLED, 'msgframe not found');
      return;
    }

    // Wait until the frame has fully loaded its DOM
    const checkReady = setInterval(() => {
      try {
        const msgDoc = msgFrame.document;
        const table = msgDoc.getElementsByTagName('table')[0];
        if (!table) return;

        const tds = table.getElementsByTagName('td');
        if (tds.length === 0) return;

        clearInterval(checkReady);
        logSuccess(LOGGING_ENABLED,  Injecting clock into msgframe');

        let cell;
        const insertIndex = Math.abs(positionAlongMenuToInsertPardusClock * 2);
        if (insertIndex >= tds.length) {
          cell = tds[tds.length - 1];
        } else {
          cell = tds[insertIndex];
        }

        cell.innerHTML += `<br>${getHTMLForClock()}`;
        tickClock();
      } catch (e) {
        // Cross-origin or other failure
        logError(LOGGING_ENABLED, 'Could not access msgframe:', e);
      }
    }, 200);
  }


    var pardusNavClock = {
		'localTime': false, 'GMTTime': false, 'serverReset': false,
		'APTick': false, 'buildingTick': false, 'planetTick': false,
		'starbaseTick': false, 'monsterTick': false, 'eMatterTick': false
	};


	var clocksToDisplay = ['APTick', 'buildingTick', 'planetTick', 'starbaseTick', 'serverReset', 'monsterTick', 'eMatterTick'];
	//var clocksToDisplay = ['localTime', 'GMTTime', 'serverReset', 'APTick', 'buildingTick', 'planetTick', 'starbaseTick', 'monsterTick', 'eMatterTick']; // show all possible clocks
	//var clocksToDisplay = ['localTime', 'GMTTime', 'serverReset', 'APTick', 'buildingTick', 'planetTick', 'starbaseTick', 'monsterTick'];
	var paddingSpaceAboveClock = 8;
	var fontSizeForClockLabels = 11;
	var fontSizeForClocks = 12;
	var fontFamilyForClockLabels = 'Verdana,Arial,Helvetica,sans-serif';
	var fontFamilyForClocks = 'Verdana,Arial,Helvetica,sans-serif';
	pardusNavClock.language = 'en';
	var showExtraInformationWhenHoveringOnLabels = true;
	var showSecondsInTheClocks = true;
	var FREQUENCY_OF_CLOCK_TICK = 1000; // tick every 1000 milliseconds (every second)

    pardusNavClock.i18nData = {
		// English (en) language translations (default)
		'en':{
			'clockLabelNames': {
				'localTime':'Your Time',
				'GMTTime':'GMT/UTC',
				'serverReset':'Server Reset',
				'APTick':'APs',
				'buildingTick':'Building',
				'planetTick':'Planet',
				'starbaseTick':'Starbase',
				'monsterTick':'Monsters',
				'eMatterTick':'E Matter'
			},
			'errorMsg':{
				'title':'Pardus Nav Menu Clock Error - No clocks are set to display',
				'description':'See the documentation inside the script for details'
			},
			'extraInfoLabels':{
				'localTime':'Your local time',
				'GMTTime':'Pardus uses GMT as a time reference',
				'serverReset':'Pardus servers restart at 0530 GMT daily',
				'APTick':'APs tick every 6 mins',
				'buildingTick':'Buildings tick every 6 hrs',
				'planetTick':'Planets tick every 3 hrs',
				'starbaseTick':'Starbases tick every 3 hrs',
				'monsterTick':'Monsters tick every 9 mins',
				'eMatterTick':'Jeff Foam ticks every 90 mins'
			}
		}
	}

// Facade used by tickPardusNavClock() to set the colour of a single label/timer column
	function setColor(id, yrate, rrate) {
		changeColor("msg_" + id, yrate, rrate);
	};


	// Facade to update the HTML for a particular clock with supplied text
	function updateHTML(id, text) {
		if(document.getElementById("msg_" + id)) document.getElementById("msg_" + id).innerHTML = text;
	};


	// Set the colour of a single label/timer column based on how close it is to ending
	function changeColor(id, yrate, rrate) {
		var x = document.getElementById(id);
		var y = document.getElementById(id + "lbl");
		var timer = Number(document.getElementById(id).innerHTML.replace(':', '').replace(':', ''));
		yrate = Number(yrate);
		rrate = Number(rrate);
		if (timer > yrate) {
			x.style.color = '#CDCED8';
			y.style.color = '#CDCED8';
		}
		if (timer <= yrate && timer > rrate) {
			x.style.color = 'yellow';
			y.style.color = 'yellow';
		}
		if (timer <= rrate) {
			if (id == 'msg_ap') {
				x.style.color = 'green';
				y.style.color = 'green';
			} else {
				x.style.color = 'red';
				y.style.color = 'red';
			}
		}
	};

    // Format the time output into hh:mm:ss by default
	// if 'x' is passed in as the first variable then it formats the time as mm:ss
	function formatTime(hours, minutes, seconds) {
		var timeSeparator = ':';
		var result = hours == 'x' ? padNumber(minutes) : hours + timeSeparator + padNumber(minutes);
		if (showSecondsInTheClocks) result += timeSeparator + padNumber(seconds)
		return result;
	};


	// Used by formatTime() to give single digits a leading zero.
	function padNumber(number) {
		return (number > 9) ? '' + number : '0' + number;
	};
	// Update each clock that is enabled - called every second to function like a real clock.
	function tickPardusNavClock() {
		var theCurrentTime = new Date;
		var minutes = theCurrentTime.getMinutes();
		var seconds = theCurrentTime.getSeconds();
		var hours = theCurrentTime.getHours();

		// local time
		if (pardusNavClock.localTime) {
			updateHTML("tim", formatTime(hours, minutes, seconds));
		}

		// pardus uses GMT for reference
		if (pardusNavClock.GMTTime) {
			var _gmtHours = theCurrentTime.getUTCHours();
			updateHTML("gmt", formatTime(_gmtHours, minutes, seconds));
		}

		// we now count down so switch our variables over
		seconds = 59 - seconds;

		// APs tick every 6 minutes
		if(pardusNavClock.APTick) {
			var _apMinutes = 5 - minutes % 6;
			updateHTML("ap", formatTime('x', _apMinutes, seconds));
			setColor("ap", "000100", "000010");
		}

		// monster tick happens every 9 minutes
		if (pardusNavClock.monsterTick) {
			var _monstMinutes = 8 - minutes % 9;
			updateHTML("mon", formatTime('x', _monstMinutes, seconds));
			setColor("mon", "000200", "000030");
		}

		// exotic matter ticks every 90 minutes
		if(pardusNavClock.eMatterTick) {
			var _emHours = 0;
			var _emMinutes = 89 - minutes % 60;
			if (_emMinutes > 60) {
				_emMinutes = _emMinutes - 60;
				_emHours = _emHours + 1;
			}
			updateHTML("em", formatTime(_emHours, _emMinutes, seconds));
			setColor("em", "000500", "000200");
		}


		if(pardusNavClock.buildingTick || pardusNavClock.planetTick || pardusNavClock.starbaseTick) {
			// starbase, building and planet ticks happen at 25 minutes past the hour
			theCurrentTime = new Date();
			var _tmpMinutes = theCurrentTime.getMinutes();
			_tmpMinutes -= 25;
			if (_tmpMinutes < 0) {
				_tmpMinutes += 60;
				theCurrentTime.setHours(theCurrentTime.getHours() - 1);
			}
			theCurrentTime.setMinutes(_tmpMinutes);
			minutes = 59-theCurrentTime.getMinutes();
			seconds = 59-theCurrentTime.getSeconds();
			theCurrentTime.setHours(theCurrentTime.getUTCHours() + 5);

			// starbase ticks happen every 3 hours starting at hour 00 GMT/UTC
			if(pardusNavClock.starbaseTick) {
				var _hoursPerTick = 3;
				var _hoursOffset = 1;
				hours = _hoursPerTick - 1 - ((theCurrentTime.getHours() + _hoursOffset) % _hoursPerTick);
				updateHTML("sb", formatTime(hours, minutes, seconds));
				setColor("sb", "001000", "000500");
			}

			// building ticks happen every 6 hours starting at hour 01 GMT/UTC
			if(pardusNavClock.buildingTick) {
				var _hoursPerTick = 6;
				var _hoursOffset = 0;
				hours = _hoursPerTick - 1 - ((theCurrentTime.getHours() + _hoursOffset) % _hoursPerTick);
				updateHTML("bui", formatTime(hours, minutes, seconds));
				setColor("bui", "001000", "000500");
			}

			// planet ticks happen every 3 hours starting at hour 02 GMT/UTC
			if(pardusNavClock.planetTick) {
				var _hoursPerTick = 3;
				var _hoursOffset = 2;
				hours = _hoursPerTick - 1 - ((theCurrentTime.getHours() + _hoursOffset) % _hoursPerTick);
				updateHTML("pl", formatTime(hours, minutes, seconds));
				setColor("pl", "001000", "000500");
			}
		}

		// server reset happens every 24 hours starting at 0530 GMT/UTC
		// first get the minutes set correctly
		if(pardusNavClock.serverReset) {
			theCurrentTime = new Date();
			var _tmpMinutes = theCurrentTime.getMinutes();
			_tmpMinutes -= 30;
			if (_tmpMinutes < 0) {
				_tmpMinutes += 60;
				theCurrentTime.setHours(theCurrentTime.getHours() - 1);
			}
			theCurrentTime.setMinutes(_tmpMinutes);
			minutes = 59-theCurrentTime.getMinutes();
			seconds = 59-theCurrentTime.getSeconds();
			// now the hours
			var UTCHours = theCurrentTime.getUTCHours();
			var _hoursPerTick = 24;
			var _hoursOffset = 5;
			hours = (_hoursPerTick - (UTCHours - _hoursOffset) % _hoursPerTick - 1) % 24;
			updateHTML("reset", formatTime(hours, minutes, seconds));
			setColor("reset", "001000", "000500");
		}

/*
		// another way to get the server reset countdown working...
		if(pardusNavClock.serverReset) {
			// set up the minutes
			var _now = new Date;
			var _tmpMinutes = _now.getMinutes() - 30;
			if (_tmpMinutes < 30) {
				_tmpMinutes += 60;
				theCurrentTime.setUTCHours(theCurrentTime.getUTCHours()-1);
			}
			theCurrentTime.setMinutes(_tmpMinutes);
			minutes = 59 - theCurrentTime.getMinutes();
			// now the hours
			var UTCHours = theCurrentTime.getUTCHours();
			var _hoursPerTick = 24;
			var _hoursOffset = 5;
			hours = (_hoursPerTick - (UTCHours - _hoursOffset) % _hoursPerTick - 1) % 24;
			updateHTML("reset", formatTime(hours, minutes, seconds));
			setColor("reset", "001000", "000500");
		}
*/

		// run this method again in the interval supplied (in milliseconds) - make it tick
		setTimeout(tickPardusNavClock, FREQUENCY_OF_CLOCK_TICK);
	};

function getLocalisedMsg(key) {
		var retVal = key;
		try {
			var _sectkey = key.split('.')[0];
			var _valkey = key.split('.')[1];
			if (pardusNavClock.i18nData[pardusNavClock.language][_sectkey][_valkey]) {
				retVal = pardusNavClock.i18nData[pardusNavClock.language][_sectkey][_valkey];
			} else {
				retVal = pardusNavClock.i18nData['en'][_sectkey][_valkey];
			}
		} catch(ex) {
			logError(LOGGING_ENABLED, '\ngetLocalisedMsg() was unable to parse the key, ' + key);
		}
		return retVal;
	};

// Return the upper and lower HTML fragment for a requested clock when requested by getHTMLForAllClocks()
	function getHTMLFragmentForAClock(clock) {
		var result = {'top':'','bottom':''};
		switch (clock) {
			case 'localTime' :
				result.top = '<td nowrap id="msg_timlbl"' + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.localTime') + '"' : '') + '>' + getLocalisedMsg('clockLabelNames.localTime') + '</td>';
				result.bottom = '<td><span id="msg_tim"'  + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.localTime') + '"' : '') + '>88:88:88</span></td>';
				break;
			case 'GMTTime' :
				result.top = '<td nowrap id="msg_gmtlbl"' + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.GMTTime') + '"' : '') + '>' + getLocalisedMsg('clockLabelNames.GMTTime') + '</td>';
				result.bottom = '<td><span id="msg_gmt"'  + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.GMTTime') + '"' : '') + '>88:88:88</span></td>';
				break;
			case 'serverReset' :
				result.top = '<td nowrap id="msg_resetlbl"' + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.serverReset') + '"' : '') + '>' + getLocalisedMsg('clockLabelNames.serverReset') + '</td>';
				result.bottom = '<td><span id="msg_reset"'  + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.serverReset') + '"' : '') + '>88:88:88</span></td>';
				break;
			case 'APTick' :
				result.top = '<td nowrap id="msg_aplbl"' + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.APTick') + '"' : '') + '>' + getLocalisedMsg('clockLabelNames.APTick') + '</td>';
				result.bottom = '<td><span id="msg_ap"'  + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.APTick') + '"' : '') + '>88:88</span></td>';
				break;
			case 'buildingTick' :
				result.top = '<td nowrap id="msg_builbl"' + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.buildingTick') + '"' : '') + '>' + getLocalisedMsg('clockLabelNames.buildingTick') + '</td>';
				result.bottom = '<td><span id="msg_bui"'  + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.buildingTick') + '"' : '') + '>88:88:88</span></td>';
				break;
			case 'planetTick' :
				result.top = '<td nowrap id="msg_pllbl"' + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.planetTick') + '"' : '') + '>' + getLocalisedMsg('clockLabelNames.planetTick') + '</td>';
				result.bottom = '<td><span id="msg_pl"'  + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.planetTick') + '"' : '') + '>88:88:88</span></td>';
				break;
			case 'starbaseTick' :
				result.top = '<td nowrap id="msg_sblbl"' + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.starbaseTick') + '"' : '') + '>' + getLocalisedMsg('clockLabelNames.starbaseTick') + '</td>';
				result.bottom = '<td><span id="msg_sb"'  + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.starbaseTick') + '"' : '') + '>88:88:88</span></td>';
				break;
			case 'monsterTick' :
				result.top = '<td nowrap id="msg_monlbl"' + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.monsterTick') + '"' : '') + '>' + getLocalisedMsg('clockLabelNames.monsterTick') + '</td>';
				result.bottom = '<td><span id="msg_mon"'  + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.monsterTick') + '"' : '') + '>88:88</span></td>';
				break;
			case 'eMatterTick' :
				result.top = '<td nowrap id="msg_emlbl"' + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.eMatterTick') + '"' : '') + '>' + getLocalisedMsg('clockLabelNames.eMatterTick') + '</td>';
				result.bottom = '<td><span id="msg_em"'  + (showExtraInformationWhenHoveringOnLabels? ' title="' + getLocalisedMsg('extraInfoLabels.eMatterTick') + '"' : '') + '>88:88:88</span></td>';
				break;
		}
		return result;
	};

    function getHTMLForAllClocks() {
		var upperClockHTML = '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:' + paddingSpaceAboveClock+ 'px;"><thead><tr' + (showExtraInformationWhenHoveringOnLabels? ' style="cursor:help;font-family:' + fontFamilyForClockLabels + ';font-size:' + fontSizeForClockLabels + 'px;"' : '') + '>';
		var lowerClockHTML = '<tbody><tr style="font-family:' + fontFamilyForClocks + ';font-size:' + fontSizeForClocks + 'px;' + (showExtraInformationWhenHoveringOnLabels? 'cursor:help;' : '') + '">';
		if (typeof clocksToDisplay != 'undefined' && clocksToDisplay.length) {
			for (var loop=0; loop<clocksToDisplay.length; loop++) {
				pardusNavClock[clocksToDisplay[loop]] = true;
				var clockHTML = getHTMLFragmentForAClock(clocksToDisplay[loop]);
				upperClockHTML += clockHTML.top; lowerClockHTML += clockHTML.bottom;
			}
		} else {
			upperClockHTML += '<td>Pardus Nav Menu Clock Error - No clocks are set to display</td>';
			lowerClockHTML += '<td>See the documentation inside the Pardus Nav Menu Clock script for details</td>';
		}
		upperClockHTML += '</tr></thead>';
		lowerClockHTML += '</tr></tbody></table>';
		return upperClockHTML + lowerClockHTML;
	};


function pardusClockInit() {
	// Load Document data into short variables
	var doc = document;
	var loc = doc.location.href;

  logGroupStart(LOGGING_ENABLED, 'Function: pardusBuildingInit | loc=' + loc);
  //  not used in this script but want to keep it for potential mods.
  //  var search = doc.location.search.substring(doc.location.search.indexOf("=") + 1);

	if (loc.match('msgframe.php')) {
    logSuccess(LOGGING_ENABLED, 'location matched:', loc);
    var html = getHTMLForAllClocks();
    doc.getElementsByTagName('table')[0].getElementsByTagName('td')[1].innerHTML += html;
                //' | <a href="javascript:activate(\'activate\');"><img border="0" id="tightwad_mapper_activate" src="https://pardusmapper.com/images/green.png" title="Tightwad\'s Pardus Mapper Active"/></a>';
    if (typeof clocksToDisplay != 'undefined') {
			tickPardusNavClock();
		}
	}

  logGroupEnd(LOGGING_ENABLED);
}


  pardusClockInit();

  logGroupEnd(LOGGING_ENABLED);
})();
