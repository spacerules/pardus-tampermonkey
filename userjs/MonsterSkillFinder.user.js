// ==UserScript==
// @name         Monster Skill Finder
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.0.1
// @description  try to take over the world!
// @author       Spacerules
// @match        http://*.pardus.at/overview_stats.php
// @match        https://*.pardus.at/overview_stats.php
// @match        http://pardus.maxisoft.org/monsterskillfinder.html
// @match        https://pardus.maxisoft.org/monsterskillfinder.html
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/MonsterSkillFinder.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/MonsterSkillFinder.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */

/* global CalcSkill */

(function() {
    'use strict';

    logEnabled(false);

    logGroupStart('File: MonsterSkillFinder.js');

    var tactics = 10;
    var hit = 10;
    var maneuver = 10;
    var weaponry = 10;
    var engineering = 10;


    function SeteValue(currentSkillEle){
      logGroupStart('Function: SeteValue | currentSkillEle=' + currentSkillEle);

      var doc = document;
      var skillvalue = 10;

      switch(currentSkillEle) {
        case "5":
          skillvalue = tactics;
          break;
        case "3":
          skillvalue = hit;
          break;
        case "4":
          skillvalue = maneuver;
          break;
        case "6":
          skillvalue = weaponry;
          break;
        case "2":
          skillvalue = engineering;
          break;
        default:
          break;
      }


      logInfo("Skill Value= ", skillvalue);

      doc.getElementById("eValue").value = skillvalue;
      doc.getElementById("eValue").textContent = skillvalue;

      CalcSkill();

      logGroupEnd();
    }

    // Your code here...
    function pardusSetSkills() {
      logGroupStart('Function: pardusSetSkills');
      var doc = document;
      tactics = doc.getElementById("tactics_actual").innerText;
      hit = doc.getElementById("hit_actual").innerText;
      maneuver = doc.getElementById("maneuver_actual").innerText;
      weaponry = doc.getElementById("weaponry_actual").innerText;
      engineering = doc.getElementById("engineering_actual").innerText;

      GM_setValue("MSF_tactics", tactics);
      GM_setValue("MSF_hit", hit);
      GM_setValue("MSF_maneuver", maneuver);
      GM_setValue("MSF_weaponry", weaponry);
      GM_setValue("MSF_engineering", engineering);

      logInfo("Tactics set: " + tactics);
      logInfo("hit set: " + hit);
      logInfo("maneuver set: " + maneuver);
      logInfo("weaponry set: " + weaponry);
      logInfo("engineering set: " + engineering);


      logGroupEnd();
    }

    function MonsterFillSkills() {
      logGroupStart('Function: MonsterFillSkills');
      var doc = document;
      tactics = GM_getValue("MSF_tactics", 10);
      hit = GM_getValue("MSF_hit", 10);
      maneuver = GM_getValue("MSF_maneuver", 10);
      weaponry = GM_getValue("MSF_weaponry", 10);
      engineering = GM_getValue("MSF_engineering", 10);

      logInfo("Tactics got: " + tactics);
      logInfo("hit got: " + hit);
      logInfo("maneuver got: " + maneuver);
      logInfo("weaponry got: " + weaponry);
      logInfo("engineering got: " + engineering);

      const currentSkillEle = doc.getElementById("eSkill");
      SeteValue(currentSkillEle.value);

      currentSkillEle.addEventListener("change", function () {
            SeteValue(this.value);
      });

      logGroupEnd();
    }


    function pardusMonsterInit() {
    // Load Document data into short variables
    var doc = document;
    var loc = doc.location.href;

    logGroupStart('Function: pardusMonsterInit | loc=' + loc);
    //  not used in this script but want to keep it for potential mods.
    //  var search = doc.location.search.substring(doc.location.search.indexOf("=") + 1);

    //if (loc.match('game.php')) {
    //  registerSettings();
    //}
    if (loc.match('overview_stats.php')) {
      pardusSetSkills();
    }
    if (loc.match('pardus.maxisoft.org/monsterskillfinder.html')) {
      MonsterFillSkills();
    }

    logGroupEnd();

  }

    pardusMonsterInit();

    logGroupEnd();
})();
