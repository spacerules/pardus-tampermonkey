// ==UserScript==
// @name         DealMaker
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      0.0.3
// @description  try to take over the world!
// @author       Sam Haffner
// @match        https://*.pardus.at/index_buildings.php
// @match        http://*.pardus.at/index_buildings.php
// @include      http*://*.pardus.at/index_buildings.php*
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/Logger.js
// @require      https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/global-files/cookies.js
// @icon         https://avatars.githubusercontent.com/u/2374313?v=4
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/DealMaker2000.user.js
// @downloadURL  https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/main/userjs/DealMaker2000.user.js
// ==/UserScript==

/* global logSuccess, logError, logInfo, logWarn, logDebug, logGroupStart, logGroupEnd, logEnabled, logTable */
/* global readCookie, writeCookie */


/*
   -- Version 0.1
         --Sinple 1 sector at a time with only deals happening locally
         --  only going to do simple average calc for distances in movement, no A-star

         -- Math that only checks min and max of prices and no hard calcs on highest performers

  -- Version 0.5
       -- Update the calcs on the best deals for the sector based on AP and quantities availible

   -- Version 1.0
         -- multi sector loaded and cached up by users so that cross sectors sales are clc
         -- calc the distance for the type of movement square costs

  -- Versiom 2.0
        -- cache the sales of the people within the buildings so that our data is the most up to date for users individually. Maybe load building sales logs?

  -- Versiom 3.0
        -- globally store data on github server so that price updates are instant across all users.
*/
(function() {
    'use strict';

    const actionType = Object.freeze({
      SELLING: "SELLING",
      BUYING: "BUYING",
      REJECTED: "REJECTED",
    });

    var imageData = [];

    var SectorBuildingData = [];
    var LoadedBestCommodities = [];

    function dis(p1,p2){
        return Math.ceil(Math.abs(Math.hypot(p2.x - p1.x, p2.y - p1.y)));
    }
    function findStart() {

      for(var hNum = 1; hNum < 5; hNum++){
          var tableLoc = document.getElementsByTagName('h' + hNum);
          for(var i=0;i<tableLoc.length;i++){
              if(tableLoc[i].innerHTML.includes("Building")){
                  return tableLoc[i].parentElement;
              }
          }
      }
        return undefined;
    }



    function fetchAll(){
         fetch("https://raw.githubusercontent.com/spacerules/pardus-tampermonkey/refs/heads/main/resources/Commodity.json")
             .then(res => res.json())
             .then(data => {
             for(var i=0; i<data.length; i++){
                 imageData[data[i].name.toLowerCase()] = data[i].img;
             }

             console.log("Fetched JSON:", imageData);
             addButton(); // BUTTON IS ADDED ONCE IMAGE GETTING IS DONE
         });
    }
    function loadData() {
        logGroupStart( 'function loadData');
        // Your code here...
        var tableBase = findStart();
        //console.log(tableLoc);

        for (const child of tableBase.children) { // LOOP though each table in the building index
            if (child.tagName === 'TABLE' && child.id == "") {

                var tableLoc = child.children[0];

                for(var buildingSlot=1;buildingSlot<tableLoc.childElementCount;buildingSlot++){

                    var SingleBuildingRecord = [];
                    var buildingRow = tableLoc.children[buildingSlot];
                    SingleBuildingRecord.base = buildingRow; //element storage

                    SingleBuildingRecord.position = [];
                    SingleBuildingRecord.buildingName = buildingRow.children[0].children[0].alt;
                    SingleBuildingRecord.buildingImage = buildingRow.children[0].children[0].src;

                    var positionStr = buildingRow.children[1].innerHTML;
                    SingleBuildingRecord.position.x = parseInt(positionStr.substring(1,positionStr.indexOf(","))); //positions in map
                    SingleBuildingRecord.position.y = parseInt(positionStr.substring(positionStr.indexOf(",")+1)); //positions in map=
                    SingleBuildingRecord.position.data = positionStr; //positions in map

                    SingleBuildingRecord.data = buildingRow.children[3]; // start of buildings list
                    var buildingSales = []

                    for(var buildingDataI = 0; buildingDataI < SingleBuildingRecord.data.childElementCount; buildingDataI++){
                        var buildingData = SingleBuildingRecord.data.children[buildingDataI];
                        if(buildingData.children[0] != undefined){
                            var actionName = buildingData.children[0].children[0].children[0].children[0].innerHTML;

                            if(actionName.toUpperCase().includes(actionType.BUYING) || actionName.toUpperCase().includes(actionType.SELLING)){
                                var allBuildingInfo = []
                                var SalesData = buildingData.children[0].children[0];
                                var itemsData = [];

                                allBuildingInfo.action = actionName.substring(0,actionName.length-1).toUpperCase(); // SalesData.children[0].children[0].innerHTML;//name of the action

                                for(var itemI = 1; itemI < SalesData.childElementCount; itemI++){
                                    var singleItem = []
                                    singleItem.name = SalesData.children[itemI].children[0].alt;
                                    singleItem.count = parseInt(SalesData.children[itemI].childNodes[1].nodeValue.substring(3));
                                    singleItem.price = parseInt(SalesData.children[itemI].children[2].childNodes[1].nodeValue.substring(1));
                                    itemsData.push(singleItem);
                                }
                                allBuildingInfo.item = itemsData; //buildingData.children[0].children[0].children[0].children[1].innerHTML;//name of the action
                                buildingSales.push(allBuildingInfo)
                            }
                        }
                    }
                    SingleBuildingRecord.salesData = buildingSales;

                    SectorBuildingData.push(SingleBuildingRecord)

                }
            }
        }


        logInfo(SectorBuildingData);

        logGroupEnd();
    } // END OF LOADDATA

    function findBestDeal(){


        logGroupStart('function findBestDeal Test');
        var bestCommodities = []

        for(var i=0; i < SectorBuildingData.length; i++){
            var singleCommodityLoc = SectorBuildingData[i];


            for(var j=0; j < singleCommodityLoc.salesData.length; j++){
                //logInfo(singleCommodityLoc);
                //logInfo(singleCommodityLoc.salesData[j]);

                for(var k=0; k < singleCommodityLoc.salesData[j].item.length; k++){

                    var itemName = singleCommodityLoc.salesData[j].item[k];
                    itemName.position = singleCommodityLoc.position;
                    itemName.buildingName = singleCommodityLoc.buildingName;
                    itemName.buildingImage = singleCommodityLoc.buildingImage;
                    var tempItem = [];

                    if(bestCommodities[itemName.name] != undefined){
                        tempItem = bestCommodities[itemName.name];
                    }else{
                        tempItem.allBuyers = [];
                        tempItem.allSellers = [];
                    }


                    switch(singleCommodityLoc.salesData[j].action){
                        case actionType.BUYING:
                            tempItem.allBuyers.push(itemName);
                            break;
                        case actionType.SELLING:
                            tempItem.allSellers.push(itemName);
                            break;
                    }

                    //logInfo(singleCommodityLoc.salesData[j].action, itemName, tempItem);
                    bestCommodities[itemName.name] = tempItem;
                }
            }
        }

        for (var commName in bestCommodities){
            var currItem = bestCommodities[commName];
            logInfo(currItem);
            bestCommodities[commName].allBuyers.sort((a, b) => b.price - a.price);
            bestCommodities[commName].allSellers.sort((a, b) => a.price - b.price);
        }

        logInfo(bestCommodities);
        logGroupEnd();
        return bestCommodities;
    }
    function addButton(){

        // Create the button element
        const button = document.createElement("button");
        button.textContent = "DealMaker Dialog"; // Set button text
        button.id = "dealMakerWindowOpen"; // Optional: set an ID

        //button.style.cssFloat = "right"; // or use button.style.float = "right";

        button.style.position = "fixed";
        button.style.top = "20px";
        button.style.right = "20px";


        var startLoc = findStart();

        // Select the target div
        const targetDiv = startLoc; // Replace with your div's ID

        // Append the button to the end of the div

        targetDiv.insertBefore(button, targetDiv.firstChild);

        button.addEventListener("click", function() {
             openFakePage();

        });


    }
    
    function openFakePage() {
        var webpage =
`<!DOCTYPE html>
<html>
   <head>
        <title>Deal Maker 2000</title>
        <link rel="stylesheet" href="//static.pardus.at/img/stdhq/main.css">
   </head>
   <body style="text-align:center;background-image:url(//static.pardus.at/img/stdhq/bgoutspace1.gif);">
       <h1 style="font-size:50px;">Deal Maker 2000</h1>
       <table border="1" style="width:100%;background:url(//static.pardus.at/img/std/bg.gif);padding:15px;" >
           <tr>
               <th> Commodity </th>
               <th > Buying: </th>
               <th> Selling: </th>
           </tr>
`;

        var alterRow = false;
        for (var commName in LoadedBestCommodities){

            var currItem = LoadedBestCommodities[commName];

            var alterData = alterRow ? ` class="alternating"` : "" ;
            alterRow = !alterRow;

            //column1 name
            webpage +=
`          <tr${alterData}>
              <td style="text-align:center"><img src="${imageData[commName.toLowerCase()]}" style="height:26px;width:26px;"> <pre style="font-size:16px;font-weight:bold;"> ${commName} </pre> </td>`

            //column 2 Buyers
            webpage +=
`              <td style="vertical-align: top">

<table border="1" style="width:100%;padding:5px;" >
  <tr>
    <th>Store</th>
    <th style="width:35px;text-align:center;">Credits</th>
    <th style="width:35px;text-align:center;">Count</th>
  </tr>
`
            for(var i=0; i < currItem.allSellers.length; i++){
                // for( var sellers of currItem.allSellers){
                var sellerEntry = currItem.allSellers[i];

                webpage += `<tr>
<td> <img src="${sellerEntry.buildingImage}" style="height:26px;width:26px;"> ${ sellerEntry.buildingName } at (${sellerEntry.position.x}, ${sellerEntry.position.y})  </td>
<td style="width:35px;text-align:center;font-weight:bold;"> ${ sellerEntry.price }</td>
<td style="width:35px;text-align:center;font-weight:bold;"> ${ sellerEntry.count }</td>
</tr>
`
            }

            webpage += `</table>
</td> `


            //column 3 Sellers
            webpage +=
`              <td style="vertical-align: top">

<table border="1" style="width:100%;padding:5px;" >
  <tr>
    <th>Store</th>
    <th style="width:35px;text-align:center;">Credits</th>
    <th style="width:35px;text-align:center;">Count</th>
  </tr>
`
            for(i=0; i < currItem.allBuyers.length; i++){
                // for( var sellers of currItem.allBuyers){
                var buyerEntry = currItem.allBuyers[i];

                webpage += `<tr>
<td> <img src="${buyerEntry.buildingImage}" style="height:26px;width:26px;"> ${ buyerEntry.buildingName } at (${buyerEntry.position.x}, ${buyerEntry.position.y})  </td>
<td style="width:35px;text-align:center;font-weight:bold;"> ${ buyerEntry.price }</td>
<td style="width:35px;text-align:center;font-weight:bold;"> ${ buyerEntry.count }</td>
</tr>
`
            }

            webpage += `</table>
</td> `
            //end cap
            webpage +=
`           </tr>
`

        }


            webpage +=
`           </table> </body> </html>
`

      const newWindow = window.open("", "_blank", "width=1200,height=1200");
      newWindow.document.write(webpage);

        //console.log(bestCommodities);


      newWindow.document.close();

        }


    function main(){
        fetchAll();

        logEnabled(false);
        loadData();
        LoadedBestCommodities = findBestDeal();

// BUTTON FOR DISPLAYING DIALOG IS LOADED IN THE FETCH OF


    }




    main();
})();
