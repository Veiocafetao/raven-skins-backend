'use strict';

const PLAYER_NAME = /^[a-zA-Z0-9_]{1,16}$/;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL_MS = 35000;
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max ? value : undefined;
const seconds = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 31536000
    ? Math.floor(value) : undefined;

// Transient per-process session IDs only associate account switches during this game launch.
// They are not authentication credentials and are never included in the public directory.
function createPresenceStore(clock = Date.now) {
    const players = new Map();
    function cleanup() {
        const now = clock();
        for (const [key, entry] of players) if (now - entry.lastSeen > TTL_MS) players.delete(key);
    }
    function heartbeat(body = {}) {
        const { player, skin, ping, server, mode, subMode, map, state, elapsedTime } = body;
        if (typeof player !== 'string' || !PLAYER_NAME.test(player)) return false;
        cleanup();
        const sessionId = typeof body.sessionId === 'string' && SESSION_ID.test(body.sessionId) ? body.sessionId : undefined;
        if (sessionId) {
            for (const [key, entry] of players)
                if (entry.sessionId === sessionId && key !== player.toLowerCase()) players.delete(key);
        }
        const matchElapsedSeconds = seconds(body.matchElapsedSeconds);
        players.set(player.toLowerCase(), {
            player, skin: text(skin, 16) || 'Padrão',
            ping: typeof ping === 'number' && Number.isFinite(ping) && ping >= 0 && ping < 9999 ? Math.round(ping) : 0,
            server: text(server, 64) || 'Lobby', mode: text(mode, 64), subMode: text(subMode, 64),
            map: text(map, 64), state: text(state, 64), elapsedTime: text(elapsedTime, 32),
            sessionId, clientUptimeSeconds: seconds(body.clientUptimeSeconds), matchElapsedSeconds,
            matchRunning: matchElapsedSeconds !== undefined && body.matchRunning === true,
            matchEstimated: matchElapsedSeconds !== undefined && body.matchEstimated === true,
            lastSeen: clock()
        });
        return true;
    }
    function online() {
        cleanup();
        const now = clock();
        return Array.from(players.values(), entry => {
            const { sessionId, lastSeen, ...result } = entry;
            const age = Math.max(0, Math.floor((now - lastSeen) / 1000));
            result.sampleAgeSeconds = age;
            if (result.clientUptimeSeconds !== undefined) result.clientUptimeSeconds += age;
            if (result.matchRunning) result.matchElapsedSeconds += age;
            return result;
        });
    }
    function offline(body = {}) {
        const sessionId = typeof body.sessionId === 'string' && SESSION_ID.test(body.sessionId) ? body.sessionId : undefined;
        if (sessionId) {
            for (const [key, entry] of players) if (entry.sessionId === sessionId) players.delete(key);
        } else if (typeof body.player === 'string') {
            const key = body.player.toLowerCase();
            // An old process shutting down must not erase a new process using the same account.
            if (players.has(key) && !players.get(key).sessionId) players.delete(key);
        }
    }
    return { heartbeat, online, offline, cleanup, count: () => { cleanup(); return players.size; } };
}

module.exports = { createPresenceStore };
