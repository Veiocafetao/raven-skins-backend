'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPresenceStore } = require('./presence-store');
const sessionA = '01234567-0123-4567-89ab-0123456789ab';
const sessionB = 'fedcba98-7654-4321-89ab-0123456789ab';

test('account switches keep process uptime and remove the previous nickname', () => {
    let now = 100000;
    const store = createPresenceStore(() => now);
    store.heartbeat({ player: 'OfflineAccount', sessionId: sessionA, clientUptimeSeconds: 600 });
    now += 8000;
    assert.equal(store.online()[0].clientUptimeSeconds, 608);
    store.heartbeat({ player: 'PremiumAccount', sessionId: sessionA, clientUptimeSeconds: 608 });
    assert.equal(store.count(), 1);
    assert.equal(store.online()[0].player, 'PremiumAccount');
    assert.equal(store.online()[0].clientUptimeSeconds, 608);
    now += 8000;
    store.heartbeat({ player: 'OtherAccount', sessionId: sessionA, clientUptimeSeconds: 616 });
    assert.equal(store.online()[0].clientUptimeSeconds, 616);
    assert.equal(store.online()[0].sessionId, undefined);
    // A restarted game is a new clock, even when using the same nickname.
    store.heartbeat({ player: 'OtherAccount', sessionId: sessionB, clientUptimeSeconds: 2 });
    store.offline({ player: 'OtherAccount', sessionId: sessionA });
    assert.equal(store.online()[0].clientUptimeSeconds, 2);
    store.offline({ sessionId: sessionB });
    assert.equal(store.count(), 0);
});

test('match clocks advance, completed matches freeze, and waiting rooms clear old timers', () => {
    let now = 0;
    const store = createPresenceStore(() => now);
    store.heartbeat({ player: 'Player', matchElapsedSeconds: 120, matchRunning: true, matchEstimated: true });
    now = 7500;
    assert.equal(store.online()[0].matchElapsedSeconds, 127);
    assert.equal(store.online()[0].sampleAgeSeconds, 7);
    assert.equal(store.online()[0].matchEstimated, true);
    store.heartbeat({ player: 'Player', matchElapsedSeconds: 130, matchRunning: false });
    now += 9000;
    assert.equal(store.online()[0].matchElapsedSeconds, 130);
    store.heartbeat({ player: 'Player', state: 'Iniciando' });
    assert.equal(store.online()[0].matchElapsedSeconds, undefined);
    now += 35001;
    assert.equal(store.count(), 0);
});

test('legacy clients and invalid timer fields remain safe and compatible', () => {
    const store = createPresenceStore(() => 1000);
    assert.equal(store.heartbeat({ player: '../invalid' }), false);
    assert.equal(store.heartbeat({ player: 'Legacy', elapsedTime: '01:20', clientUptimeSeconds: -2,
        matchElapsedSeconds: Infinity, sessionId: 'invalid' }), true);
    const player = store.online()[0];
    assert.equal(player.elapsedTime, '01:20');
    assert.equal(player.clientUptimeSeconds, undefined);
    assert.equal(player.matchElapsedSeconds, undefined);
    assert.equal(player.matchRunning, false);
    store.offline({ player: 'Legacy' });
    assert.equal(store.count(), 0);
});
