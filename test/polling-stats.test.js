'use strict';

const assert = require('node:assert');

const Characteristic = function() {};
const homebridge = { hap: { Service: {}, Characteristic } };
const FritzPlatform = require('../lib/platform')(homebridge);
const FritzAccessory = require('../lib/accessory')(homebridge);

function createPlatform(fritz) {
    const log = Object.assign(() => {}, { debug() {}, info() {}, warn() {}, error() {} });
    const accessory = { UUID: 'uuid', reachable: true, context: { ain: 'ain1', type: 'thermostat' } };
    const platform = Object.create(FritzPlatform.prototype);

    Object.assign(platform, {
        sid: 'sid',
        log,
        fritz,
        accessories: [accessory],
        accessoryInstances: new Map(),
        pollingStats: { sensors: { success: 0, errors: 0, errorDevices: new Set() } }
    });

    const instance = Object.create(FritzAccessory.prototype);
    Object.assign(instance, {
        platform,
        ain: 'ain1',
        name: 'Thermostat',
        services: { Thermostat: { getCharacteristic: () => ({ updateValue() {} }) } }
    });
    platform.accessoryInstances.set(accessory.UUID, instance);

    return platform;
}

describe('pollSensorData statistics', function() {
    it('counts an answered request as success', async function() {
        const platform = createPlatform(() => Promise.resolve(20));

        await platform.pollSensorData();

        assert.strictEqual(platform.pollingStats.sensors.success, 1);
        assert.strictEqual(platform.pollingStats.sensors.errors, 0);
    });

    it('counts a failed request as error', async function() {
        const platform = createPlatform(() => Promise.reject(new Error('ETIMEDOUT')));

        await platform.pollSensorData();

        assert.strictEqual(platform.pollingStats.sensors.success, 0);
        assert.strictEqual(platform.pollingStats.sensors.errors, 1);
    });

    it('does not count a request that is still pending', async function() {
        const platform = createPlatform(() => new Promise(() => {}));

        platform.pollSensorData();
        await new Promise(resolve => setImmediate(resolve));

        assert.strictEqual(platform.pollingStats.sensors.success, 0);
    });
});
