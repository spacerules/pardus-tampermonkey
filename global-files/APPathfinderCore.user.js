// ==UserScript==
// @name         AP Pathfinder Core with X-holes
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.4
// @description  Multi-sector AP Pathfinder logic (Chebyshev) for Pardus with X-hole teleportation
// @author       spacerules
// @match        http*://*.pardus.at/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(function() {
    'use strict';

    const OPPOSITE = { N:"S", S:"N", E:"W", W:"E" };

    // === Sector Cache ===
    async function loadSector(sectorName) {
        let cached = GM_getValue("sector_" + sectorName);
        if (cached) return JSON.parse(cached);

        try {
            const resp = await fetch(`https://raw.githubusercontent.com/spacerules/pardus-sector-data/main/${sectorName}.json`);
            if (!resp.ok) return null;
            const data = await resp.json();
            GM_setValue("sector_" + sectorName, JSON.stringify(data));
            return data;
        } catch (e) {
            console.error("Failed to load sector:", sectorName, e);
            return null;
        }
    }

    function normalizeSectorName(name) {
        return name.trim().toLowerCase();
    }

    function baseSectorName(beaconName) {
        return beaconName.split(" ")[0]; // crude but works for "Nex 0004 WH"
    }

    function beaconDirection(name) {
        let parts = name.split(" ");
        return parts.length > 1 ? parts[parts.length-1] : null;
    }

    function logDebug(msg) {
        console.log("[AP-Pathfinder]", msg);
    }

    // === Wormhole Exit ===
    async function resolveWormholeExit(currentSector, beaconName) {
        const destSector = baseSectorName(beaconName);
        const destMap = await loadSector(destSector);
        if (!destMap || !destMap.beaconList) return null;

        let candidates = destMap.beaconList.filter(b => baseSectorName(b.name) === baseSectorName(currentSector));

        if (candidates.length === 1) {
            return { sector: destSector, x: candidates[0].x, y: candidates[0].y };
        }

        if (candidates.length > 1) {
            const hereDir = beaconDirection(beaconName);
            if (hereDir && OPPOSITE[hereDir]) {
                const exact = candidates.find(b => beaconDirection(b.name) === OPPOSITE[hereDir]);
                if (exact) return { sector: destSector, x: exact.x, y: exact.y };
            }
            return { sector: destSector, x: candidates[0].x, y: candidates[0].y };
        }

        return null;
    }

    // === X-Hole Exit ===
    async function resolveXholeExit(currentSector, beaconName) {
        const destSector = baseSectorName(beaconName);

        // 🚫 Prevent continuing outward if X-hole loops to same sector
        if (normalizeSectorName(destSector) === normalizeSectorName(currentSector)) {
            logDebug(`X-hole exit loops back into ${currentSector}. Path disallowed.`);
            return null;
        }

        const destMap = await loadSector(destSector);
        if (!destMap || !destMap.beaconList) return null;

        let candidates = destMap.beaconList.filter(b => baseSectorName(b.name) === baseSectorName(currentSector));

        if (candidates.length === 1) {
            return { sector: destSector, x: candidates[0].x, y: candidates[0].y };
        }

        if (candidates.length > 1) {
            const hereDir = beaconDirection(beaconName);
            if (hereDir && OPPOSITE[hereDir]) {
                const exact = candidates.find(b => beaconDirection(b.name) === OPPOSITE[hereDir]);
                if (exact) return { sector: destSector, x: exact.x, y: exact.y };
            }
            return { sector: destSector, x: candidates[0].x, y: candidates[0].y };
        }

        return null;
    }

    // === Core Pathfinding ===
    async function multiSectorPath(start, goal) {
        logDebug(`Pathfinding from ${start.sector} (${start.x},${start.y}) to ${goal.sector} (${goal.x},${goal.y})`);

        if (normalizeSectorName(start.sector) === normalizeSectorName(goal.sector)) {
            return [`Path within ${start.sector}`];
        }

        // stub: implement A* or BFS across sectors
        return [`Cross-sector path ${start.sector} -> ${goal.sector}`];
    }

    // === Expose ===
    window.multiSectorPath = multiSectorPath;
    window.resolveWormholeExit = resolveWormholeExit;
    window.resolveXholeExit = resolveXholeExit;

})();
