"use strict";
/*
* DAPjs
* Copyright Arm Limited 2018
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/
Object.defineProperty(exports, "__esModule", { value: true });
var proxy_1 = require("../proxy");
var cmsis_dap_1 = require("../proxy/cmsis-dap");
/**
 * Arm Debug Interface class
 */
var ADI = /** @class */ (function () {
    function ADI(transportOrDap, mode, clockFrequency) {
        if (mode === void 0) { mode = 0 /* DEFAULT */; }
        if (clockFrequency === void 0) { clockFrequency = cmsis_dap_1.DEFAULT_CLOCK_FREQUENCY; }
        this.selectedAddress = null;
        this.cswValue = null;
        function isTransport(test) {
            return test.open !== undefined;
        }
        this.proxy = isTransport(transportOrDap) ? new proxy_1.CmsisDAP(transportOrDap, mode, clockFrequency) : transportOrDap;
    }
    ADI.prototype.delay = function (timeout) {
        return new Promise(function (resolve, _reject) {
            setTimeout(resolve, timeout);
        });
    };
    /**
     * Continually run a function until it returns true
     * @param fn The function to run
     * @param timer The millisecoinds to wait between each run
     * @param timeout Optional timeout to wait before giving up and rejecting
     * @returns Promise
     */
    ADI.prototype.waitDelay = function (fn, timer, timeout) {
        var _this = this;
        if (timer === void 0) { timer = 100; }
        if (timeout === void 0) { timeout = 0; }
        var running = true;
        var chain = function (condition) {
            if (running) {
                return condition
                    ? Promise.resolve()
                    : _this.delay(timer)
                        .then(fn)
                        .then(chain);
            }
        };
        return new Promise(function (resolve, reject) {
            if (timeout > 0) {
                setTimeout(function () {
                    running = false;
                    reject("Wait timed out");
                }, timeout);
            }
            return chain(false)
                .then(function () { return resolve(); });
        });
    };
    ADI.prototype.concatTypedArray = function (arrays) {
        // Only one array exists
        if (arrays.length === 1)
            return arrays[0];
        // Determine array length
        var length = 0;
        for (var _i = 0, arrays_1 = arrays; _i < arrays_1.length; _i++) {
            var array = arrays_1[_i];
            length += array.length;
        }
        // Concat the arrays
        var result = new Uint32Array(length);
        for (var i = 0, j = 0; i < arrays.length; i++) {
            result.set(arrays[i], j);
            j += arrays[i].length;
        }
        return result;
    };
    ADI.prototype.readDPCommand = function (register) {
        return [{
                mode: 2 /* READ */,
                port: 0 /* DEBUG */,
                register: register
            }];
    };
    ADI.prototype.writeDPCommand = function (register, value) {
        if (register === 8 /* SELECT */) {
            if (value === this.selectedAddress) {
                return [];
            }
            this.selectedAddress = value;
        }
        return [{
                mode: 0 /* WRITE */,
                port: 0 /* DEBUG */,
                register: register,
                value: value
            }];
    };
    ADI.prototype.readAPCommand = function (register) {
        var address = (register & 4278190080 /* APSEL */) | (register & 240 /* APBANKSEL */);
        return this.writeDPCommand(8 /* SELECT */, address).concat({
            mode: 2 /* READ */,
            port: 1 /* ACCESS */,
            register: register
        });
    };
    ADI.prototype.writeAPCommand = function (register, value) {
        if (register === 0 /* CSW */) {
            if (value === this.cswValue) {
                return [];
            }
            this.cswValue = value;
        }
        var address = (register & 4278190080 /* APSEL */) | (register & 240 /* APBANKSEL */);
        return this.writeDPCommand(8 /* SELECT */, address).concat({
            mode: 0 /* WRITE */,
            port: 1 /* ACCESS */,
            register: register,
            value: value
        });
    };
    ADI.prototype.readMem16Command = function (register) {
        return this.writeAPCommand(0 /* CSW */, 587202640 /* VALUE */ | 1 /* SIZE_16 */)
            .concat(this.writeAPCommand(4 /* TAR */, register))
            .concat(this.readAPCommand(12 /* DRW */));
    };
    ADI.prototype.writeMem16Command = function (register, value) {
        return this.writeAPCommand(0 /* CSW */, 587202640 /* VALUE */ | 1 /* SIZE_16 */)
            .concat(this.writeAPCommand(4 /* TAR */, register))
            .concat(this.writeAPCommand(12 /* DRW */, value));
    };
    ADI.prototype.readMem32Command = function (register) {
        return this.writeAPCommand(0 /* CSW */, 587202640 /* VALUE */ | 2 /* SIZE_32 */)
            .concat(this.writeAPCommand(4 /* TAR */, register))
            .concat(this.readAPCommand(12 /* DRW */));
    };
    ADI.prototype.writeMem32Command = function (register, value) {
        return this.writeAPCommand(0 /* CSW */, 587202640 /* VALUE */ | 2 /* SIZE_32 */)
            .concat(this.writeAPCommand(4 /* TAR */, register))
            .concat(this.writeAPCommand(12 /* DRW */, value));
    };
    ADI.prototype.transferSequence = function (operations) {
        var _this = this;
        // Flatten operations into single array
        var merged = [].concat.apply([], operations);
        var chain = Promise.resolve([]);
        var _loop_1 = function () {
            var sequence = merged.splice(0, this_1.proxy.operationCount);
            chain = chain.then(function (results) { return _this.proxy.transfer(sequence).then(function (result) { return results.concat([result]); }); });
        };
        var this_1 = this;
        // Split operations into sequences no longer than operation count
        while (merged.length) {
            _loop_1();
        }
        return chain
            .then(function (arrays) { return _this.concatTypedArray(arrays); });
    };
    /**
     * Connect to target device
     * @returns Promise
     */
    ADI.prototype.connect = function () {
        var _this = this;
        var mask = 536870912 /* CDBGPWRUPACK */ | -2147483648 /* CSYSPWRUPACK */;
        return this.proxy.connect()
            .then(function () { return _this.readDP(0 /* DPIDR */); })
            .then(function () { return _this.transferSequence([
            _this.writeDPCommand(0 /* ABORT */, 4 /* STKERRCLR */),
            _this.writeDPCommand(8 /* SELECT */, 0 /* CSW */),
            _this.writeDPCommand(4 /* CTRL_STAT */, 1073741824 /* CSYSPWRUPREQ */ | 268435456 /* CDBGPWRUPREQ */)
        ]); })
            .then(function () { return _this.waitDelay(function () {
            return _this.readDP(4 /* CTRL_STAT */)
                .then(function (status) { return ((status & mask) === mask); });
        }); });
    };
    /**
     * Disconnect from target device
     * @returns Promise
     */
    ADI.prototype.disconnect = function () {
        return this.proxy.disconnect();
    };
    /**
     * Reconnect to target device
     * @returns Promise
     */
    ADI.prototype.reconnect = function () {
        var _this = this;
        return this.disconnect()
            .then(function () { return _this.delay(100); })
            .then(function () { return _this.connect(); });
    };
    /**
     * Reset target device
     * @returns Promise
     */
    ADI.prototype.reset = function () {
        return this.proxy.reset();
    };
    /**
     * Read from a debug port register
     * @param register DP register to read
     * @returns Promise of register value
     */
    ADI.prototype.readDP = function (register) {
        return this.proxy.transfer(this.readDPCommand(register))
            .then(function (result) { return result[0]; });
    };
    /**
     * Write to a debug port register
     * @param register DP register to write
     * @param value Value to write
     * @returns Promise
     */
    ADI.prototype.writeDP = function (register, value) {
        return this.proxy.transfer(this.writeDPCommand(register, value))
            .then(function () { return undefined; });
    };
    /**
     * Read from an access port register
     * @param register AP register to read
     * @returns Promise of register value
     */
    ADI.prototype.readAP = function (register) {
        return this.proxy.transfer(this.readAPCommand(register))
            .then(function (result) { return result[0]; });
    };
    /**
     * Write to an access port register
     * @param register AP register to write
     * @param value Value to write
     * @returns Promise
     */
    ADI.prototype.writeAP = function (register, value) {
        return this.proxy.transfer(this.writeAPCommand(register, value))
            .then(function () { return undefined; });
    };
    /**
     * Read a 16-bit word from a memory access port register
     * @param register ID of register to read
     * @returns Promise of register data
     */
    ADI.prototype.readMem16 = function (register) {
        return this.proxy.transfer(this.readMem16Command(register))
            .then(function (result) { return result[0]; });
    };
    /**
     * Write a 16-bit word to a memory access port register
     * @param register ID of register to write to
     * @param value The value to write
     * @returns Promise
     */
    ADI.prototype.writeMem16 = function (register, value) {
        value = value << ((register & 0x02) << 3);
        return this.proxy.transfer(this.writeMem16Command(register, value))
            .then(function () { return undefined; });
    };
    /**
     * Read a 32-bit word from a memory access port register
     * @param register ID of register to read
     * @returns Promise of register data
     */
    ADI.prototype.readMem32 = function (register) {
        return this.proxy.transfer(this.readMem32Command(register))
            .then(function (result) { return result[0]; });
    };
    /**
     * Write a 32-bit word to a memory access port register
     * @param register ID of register to write to
     * @param value The value to write
     * @returns Promise
     */
    ADI.prototype.writeMem32 = function (register, value) {
        return this.proxy.transfer(this.writeMem32Command(register, value))
            .then(function () { return undefined; });
    };
    /**
     * Read a block of 32-bit words from a memory access port register
     * @param register ID of register to read from
     * @param count The count of values to read
     * @returns Promise of register data
     */
    ADI.prototype.readBlock = function (register, count) {
        var _this = this;
        var chain = this.transferSequence([
            this.writeAPCommand(0 /* CSW */, 587202640 /* VALUE */ | 2 /* SIZE_32 */),
            this.writeAPCommand(4 /* TAR */, register),
        ])
            .then(function () { return []; });
        // Split into requests no longer than block size
        var remainder = count;
        var _loop_2 = function () {
            var chunkSize = Math.min(remainder, this_2.proxy.blockSize);
            chain = chain.then(function (results) { return _this.proxy.transferBlock(1 /* ACCESS */, 12 /* DRW */, chunkSize)
                .then(function (result) { return results.concat([result]); }); });
            remainder -= chunkSize;
        };
        var this_2 = this;
        while (remainder > 0) {
            _loop_2();
        }
        return chain
            .then(function (arrays) { return _this.concatTypedArray(arrays); });
    };
    /**
     * Write a block of 32-bit words to a memory access port register
     * @param register ID of register to write to
     * @param values The values to write
     * @returns Promise
     */
    ADI.prototype.writeBlock = function (register, values) {
        var _this = this;
        var chain = this.transferSequence([
            this.writeAPCommand(0 /* CSW */, 587202640 /* VALUE */ | 2 /* SIZE_32 */),
            this.writeAPCommand(4 /* TAR */, register),
        ])
            .then(function () { return undefined; });
        // Split values into chunks no longer than block size
        var index = 0;
        var _loop_3 = function () {
            var chunk = values.slice(index, index + this_3.proxy.blockSize);
            chain = chain.then(function () { return _this.proxy.transferBlock(1 /* ACCESS */, 12 /* DRW */, chunk); });
            index += this_3.proxy.blockSize;
        };
        var this_3 = this;
        while (index < values.length) {
            _loop_3();
        }
        return chain;
    };
    return ADI;
}());
exports.ADI = ADI;

//# sourceMappingURL=adi.js.map
