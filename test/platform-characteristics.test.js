'use strict';

const assert = require('assert');

class Characteristic {
    constructor(displayName, uuid) {
        this.displayName = displayName;
        this.UUID = uuid;
    }

    setProps(props) {
        this.props = props;
    }

    getDefaultValue() {
        return null;
    }
}

const homebridge = {
    hap: {
        Characteristic: Characteristic
    },
    platformAccessory: function PlatformAccessory() {}
};

describe('custom power characteristics', function() {
    it('can be instantiated when Homebridge exposes Characteristic as a class', function() {
        // Other test files register their own stubs with the same module
        const FritzPlatform = require('../lib/platform')(homebridge);
        const powerUsage = new FritzPlatform.PowerUsage();

        assert(powerUsage instanceof Characteristic);
        assert.strictEqual(powerUsage.UUID, 'AE48F447-E065-4B31-8050-8FB06DB9E087');
        assert.deepStrictEqual(powerUsage.props, {
            format: 'float',
            unit: 'W',
            perms: ['pr', 'ev']
        });
    });
});
