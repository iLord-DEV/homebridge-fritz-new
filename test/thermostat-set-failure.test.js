'use strict';

const assert = require('node:assert');

const Characteristic = function() {};
Characteristic.TargetHeatingCoolingState = { OFF: 0, HEAT: 1 };
Characteristic.CurrentHeatingCoolingState = { OFF: 0, HEAT: 1 };
Characteristic.TargetTemperature = 'TargetTemperature';
const homebridge = { hap: { Service: {}, Characteristic } };
const FritzThermostatAccessory = require('../lib/accessories/thermostat')(homebridge);

function createThermostat(fritz) {
    const log = { debug() {}, info() {}, warn() {}, error() {} };
    const thermostat = Object.create(FritzThermostatAccessory.prototype);

    Object.assign(thermostat, {
        ain: 'ain1',
        type: 'thermostat',
        name: 'Thermostat',
        platform: { log, fritz, config: {} },
        lastActiveTargetTemperature: 20,
        services: {
            Thermostat: {
                fritzCurrentTemperature: 18,
                fritzTargetTemperature: 20,
                fritzTargetHeatingCoolingState: Characteristic.TargetHeatingCoolingState.OFF,
                fritzCurrentHeatingCoolingState: Characteristic.CurrentHeatingCoolingState.OFF,
                getCharacteristic: () => ({ updateValue() {} })
            }
        }
    });

    return thermostat;
}

const failing = () => Promise.reject(new Error('ETIMEDOUT'));

describe('failed thermostat commands', function() {
    it('reports a failed heating state and keeps the previous one', async function() {
        const thermostat = createThermostat(failing);
        const service = thermostat.services.Thermostat;

        await assert.rejects(thermostat.setTargetHeatingCoolingState(Characteristic.TargetHeatingCoolingState.HEAT), /ETIMEDOUT/);

        assert.strictEqual(service.fritzTargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
    });

    it('reports a failed temperature and keeps the previous values', async function() {
        const thermostat = createThermostat(failing);
        const service = thermostat.services.Thermostat;

        await assert.rejects(thermostat.setTargetTemperature(23), /ETIMEDOUT/);

        assert.strictEqual(service.fritzTargetTemperature, 20);
        assert.strictEqual(thermostat.lastActiveTargetTemperature, 20);
        assert.strictEqual(service.fritzTargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.OFF);
        assert.strictEqual(service.fritzCurrentHeatingCoolingState, Characteristic.CurrentHeatingCoolingState.OFF);
    });
});
