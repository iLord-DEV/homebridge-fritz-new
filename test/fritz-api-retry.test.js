'use strict';

const assert = require('node:assert');
const axios = require('axios');
const sinon = require('sinon');
const fritz = require('../lib/fritz-api');

const SID = '1234567890abcdef';

function login(url) {
    if (url.includes('login_sid.lua')) {
        const body = `<SessionInfo><SID>${SID}</SID><Challenge>abc</Challenge><BlockTime>0</BlockTime></SessionInfo>`;
        return Promise.resolve({ data: body });
    }
    return null;
}

function failWith(code) {
    const error = new Error(code);
    error.code = code;
    return Promise.reject(error);
}

// A deadlock never settles, so a test must fail on its own instead of hanging
function withinTime(promise) {
    let timer;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Request did not settle: queue is blocked')), 1000);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

describe('makeRequest retry after a session error', function() {
    let get;
    let hkrCalls;

    beforeEach(function() {
        hkrCalls = [];
        get = sinon.stub(axios, 'get');
        fritz.clearSession();
        fritz.init({
            log: Object.assign(() => {}, { debug() {}, info() {}, warn() {}, error() {} }),
            sid: SID,
            config: { username: 'user', password: 'secret' },
            options: { url: 'http://box.test' }
        });
    });

    afterEach(function() {
        sinon.restore();
    });

    function answer(responses) {
        get.callsFake((url, config) => {
            const loginResponse = login(url);
            if (loginResponse) {
                return loginResponse;
            }
            hkrCalls.push(config.params);
            const next = responses.shift();
            return typeof next === 'function' ? next() : Promise.resolve({ data: next });
        });
    }

    it('retries a read and returns its result', async function() {
        answer([() => failWith('ETIMEDOUT'), '42']);

        const result = await withinTime(fritz.makeRequest('getTempTarget', 'ain1', {}));

        assert.strictEqual(result, 21);
        assert.strictEqual(hkrCalls.length, 2);
    });

    it('retries a target temperature with the same value', async function() {
        answer([() => failWith('ETIMEDOUT'), '42']);

        await withinTime(fritz.makeRequest('setTempTarget', 'ain1', 21));

        assert.deepStrictEqual(hkrCalls.map(params => params.param), ['42', '42']);
    });

    it('retries switching a thermostat off', async function() {
        answer([() => failWith('ETIMEDOUT'), '253']);

        await withinTime(fritz.makeRequest('setTempTarget', 'ain1', 'off'));

        assert.deepStrictEqual(hkrCalls.map(params => params.param), ['253', '253']);
    });

    it('rejects when the retry fails too, without trying again', async function() {
        answer([() => failWith('ETIMEDOUT'), () => failWith('ETIMEDOUT')]);

        await assert.rejects(withinTime(fritz.makeRequest('getTempTarget', 'ain1', {})), /ETIMEDOUT/);

        assert.strictEqual(hkrCalls.length, 2);
    });

    it('uses the configured url for commands without AIN', async function() {
        get.callsFake(url => login(url) || Promise.resolve({ data: `<devicelist><device identifier="ain1"></device></devicelist>`, url }));

        await withinTime(fritz.makeRequest('getDeviceList', undefined, {}));

        const urls = get.getCalls().map(call => call.args[0]);
        assert.ok(urls.includes('http://box.test/webservices/homeautoswitch.lua'), urls.join());
    });

    it('keeps processing later commands after a retry', async function() {
        answer([() => failWith('ETIMEDOUT'), '42', '44']);

        const first = fritz.makeRequest('getTempTarget', 'ain1', {});
        const second = fritz.makeRequest('getTempTarget', 'ain2', {});

        assert.strictEqual(await withinTime(first), 21);
        assert.strictEqual(await withinTime(second), 22);
    });
});
