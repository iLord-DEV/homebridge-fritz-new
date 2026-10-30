'use strict';

const assert = require('node:assert');

const homebridge = { hap: { Service: {}, Characteristic: function() {} } };
const FritzPlatform = require('../lib/platform')(homebridge);

function createPlatform(deviceList) {
    const platform = Object.create(FritzPlatform.prototype);
    const removed = [];

    Object.assign(platform, {
        log: Object.assign(() => {}, { debug() {} }),
        config: {},
        deviceList,
        accessories: [{ UUID: 'uuid', context: { ain: 'ain1', type: 'thermostat' } }],
        accessoryInstances: new Map(),
        api: { unregisterPlatformAccessories: (plugin, platformName, list) => removed.push(...list) }
    });

    return { platform, removed };
}

describe('removeStaleAccessories', function() {
    it('keeps all accessories when the device list is empty', function() {
        const { platform, removed } = createPlatform([]);

        platform.removeStaleAccessories();

        assert.strictEqual(removed.length, 0);
        assert.strictEqual(platform.accessories.length, 1);
    });

    it('removes an accessory that is missing from a filled list', function() {
        const { platform, removed } = createPlatform([{ identifier: 'ain2' }]);

        platform.removeStaleAccessories();

        assert.strictEqual(removed.length, 1);
        assert.strictEqual(platform.accessories.length, 0);
    });
});
