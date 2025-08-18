// ==UserScript==
// @name         AP Pathfinder Core with Wormholes + X-holes (Safe)
// @namespace    https://github.com/spacerules/pardus-tampermonkey
// @version      1.4
// @description  Multi-sector AP Pathfinder logic (Chebyshev) for Pardus with wormholes and X-hole teleportation, safe guards for missing beaconList
// @author       spacerules
// @match        http*://*.pardus.at/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

// --- Utility Functions ---
function normalizeSectorName(name) {
    return name.replace(/\s*\(.*?\)\s*/g, "").trim();
}
function baseSectorName(beaconName) {
    return normalizeSectorName(beaconName.split("->").pop().trim());
}
function beaconDirection(name) {
    let match = name.match(/\((N|S|E|W)\)/);
    return match ? match[1] : null;
}
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };
function logDebug(msg) {
    console.log("[AP-Pathfinder]", msg);
}

// --- Load Sector JSON ---
async function loadSector(sectorName) {
    try {
        const resp = await fetch(`https://raw.githubusercontent.com/spacerules/pardus-map-data/main/${sectorName}.json`);
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) {
        console.error("Failed to load sector:", sectorName, e);
        return null;
    }
}

// === Wormhole Exit ===
async function resolveWormholeExit(currentSector, beaconName) {
    const destSector = baseSectorName(beaconName);
    const destMap = await loadSector(destSector);
    if (!destMap) return null;

    const beacons = Array.isArray(destMap.beaconList) ? destMap.beaconList : [];
    let candidates = beacons.filter(b => baseSectorName(b.name) === baseSectorName(currentSector));

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
    if (!destMap) return null;

    const beacons = Array.isArray(destMap.beaconList) ? destMap.beaconList : [];
    let candidates = beacons.filter(b => baseSectorName(b.name) === baseSectorName(currentSector));

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

// --- Multi-Sector Path Stub (simplified BFS for demo) ---
window.multiSectorPath = async function(startSector, startX, startY, targetSector, targetX, targetY) {
    logDebug(`Finding path from ${startSector} (${startX},${startY}) to ${targetSector} (${targetX},${targetY})`);

    // This is just a stub — insert your BFS/Dijkstra here.
    // For demo we just return start->target sector as 2 hops.
    return [
        { sector: startSector, x: startX, y: startY },
        { sector: targetSector, x: targetX, y: targetY }
    ];
};

logDebug("AP Pathfinder Core with Wormholes + X-holes (Safe) loaded.");
