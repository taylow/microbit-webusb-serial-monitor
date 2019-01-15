(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.DAPjs = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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



},{"../proxy":7,"../proxy/cmsis-dap":6}],2:[function(require,module,exports){
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
var adi_1 = require("./adi");
exports.ADI = adi_1.ADI;



},{"./adi":1}],3:[function(require,module,exports){
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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var proxy_1 = require("../proxy");
/**
 * @hidden
 */
var DEFAULT_BAUDRATE = 9600;
/**
 * @hidden
 */
var SERIAL_DELAY = 200;
/**
 * @hidden
 */
var PAGE_SIZE = 62;
/**
 * DAPLink Class
 */
var DAPLink = /** @class */ (function (_super) {
    __extends(DAPLink, _super);
    function DAPLink() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.timer = null;
        return _this;
    }
    /**
     * Detect if buffer contains text or binary data
     */
    DAPLink.prototype.isBufferBinary = function (buffer) {
        var bufferString = String.fromCharCode.apply(null, new Uint16Array(buffer, 0, 50));
        for (var i = 0; i < bufferString.length; i++) {
            var charCode = bufferString.charCodeAt(i);
            // 65533 is a code for unknown character
            // 0-8 are codes for control characters
            if (charCode === 65533 || charCode <= 8) {
                return true;
            }
        }
        return false;
    };
    DAPLink.prototype.writeBuffer = function (buffer, offset) {
        var _this = this;
        if (offset === void 0) { offset = 0; }
        var end = Math.min(buffer.byteLength, offset + PAGE_SIZE);
        var page = buffer.slice(offset, end);
        var data = new Uint8Array(page.byteLength + 1);
        data.set([page.byteLength]);
        data.set(new Uint8Array(page), 1);
        return this.send(140 /* WRITE */, data)
            .then(function () {
            _this.emit(DAPLink.EVENT_PROGRESS, offset / buffer.byteLength);
            if (end < buffer.byteLength) {
                return _this.writeBuffer(buffer, end);
            }
        });
    };
    /**
     * Flash the target
     * @param buffer The image to flash
     * @returns Promise
     */
    DAPLink.prototype.flash = function (buffer) {
        var _this = this;
        function isView(source) {
            return source.buffer !== undefined;
        }
        var arrayBuffer = isView(buffer) ? buffer.buffer : buffer;
        var streamType = this.isBufferBinary(arrayBuffer) ? 0 : 1;
        return this.send(138 /* OPEN */, new Uint32Array([streamType]))
            .then(function (result) {
            // An error occurred
            if (result.getUint8(1) !== 0)
                return;
            return _this.writeBuffer(arrayBuffer);
        })
            .then(function () {
            _this.emit(DAPLink.EVENT_PROGRESS, 1.0);
            return _this.send(139 /* CLOSE */);
        })
            .then(function (result) {
            // An error occurred
            if (result.getUint8(1) !== 0)
                return;
            return _this.send(137 /* RESET */);
        })
            .then(function () { return undefined; });
    };
    /**
     * Get the serial baud rate setting
     * @returns Promise of baud rate
     */
    DAPLink.prototype.getSerialBaudrate = function () {
        return this.send(129 /* READ_SETTINGS */)
            .then(function (result) {
            return result.getUint32(1, true);
        });
    };
    /**
     * Set the serial baud rate setting
     * @param baudrate The baudrate to use (defaults to 9600)
     * @returns Promise
     */
    DAPLink.prototype.setSerialBaudrate = function (baudrate) {
        if (baudrate === void 0) { baudrate = DEFAULT_BAUDRATE; }
        return this.send(130 /* WRITE_SETTINGS */, new Uint32Array([baudrate]))
            .then(function () { return undefined; });
    };
    /**
     * Start listening for serial data
     */
    DAPLink.prototype.startSerialRead = function () {
        var _this = this;
        this.stopSerialRead();
        this.timer = setInterval(function () {
            return _this.send(131 /* READ */)
                .then(function (serialData) {
                if (serialData.byteLength > 0) {
                    // check if there is any data returned from the device
                    // first byte contains the vendor code
                    // second byte contains the actual length of data read from the device
                    var dataLength = serialData.getUint8(1);
                    if (dataLength !== 0) {
                        var offset = 2;
                        var dataArray = serialData.buffer.slice(offset, offset + dataLength);
                        var data = String.fromCharCode.apply(null, new Uint8Array(dataArray));
                        _this.emit(DAPLink.EVENT_SERIAL_DATA, data);
                    }
                }
            });
        }, SERIAL_DELAY);
    };
    /**
     * Stop listening for serial data
     */
    DAPLink.prototype.stopSerialRead = function () {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    };
    /**
     * Write serial data
     * @param data The data to write
     * @returns Promise
     */
    DAPLink.prototype.serialWrite = function (data) {
        var arrayData = data.split("").map(function (e) { return e.charCodeAt(0); });
        arrayData.unshift(arrayData.length);
        return this.send(132 /* WRITE */, new Uint8Array(arrayData).buffer)
            .then(function () { return undefined; });
    };
    /**
     * Progress event
     * @event
     */
    DAPLink.EVENT_PROGRESS = "progress";
    /**
     * Serial read event
     * @event
     */
    DAPLink.EVENT_SERIAL_DATA = "serial";
    return DAPLink;
}(proxy_1.CmsisDAP));
exports.DAPLink = DAPLink;



},{"../proxy":7}],4:[function(require,module,exports){
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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var dap_1 = require("../dap");
/**
 * @hidden
 */
var EXECUTE_TIMEOUT = 10000;
/**
 * @hidden
 */
var BKPT_INSTRUCTION = 0xBE2A;
/**
 * @hidden
 */
var GENERAL_REGISTER_COUNT = 12;
/**
 * Cortex M class
 */
var CortexM = /** @class */ (function (_super) {
    __extends(CortexM, _super);
    function CortexM() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CortexM.prototype.enableDebug = function () {
        return this.writeMem32(3758157296 /* DHCSR */, -1604386816 /* DBGKEY */ | 1 /* C_DEBUGEN */);
    };
    CortexM.prototype.readCoreRegisterCommand = function (register) {
        return this.writeMem32Command(3758157300 /* DCRSR */, register)
            .concat(this.readMem32Command(3758157296 /* DHCSR */))
            .concat(this.readMem32Command(3758157304 /* DCRDR */));
    };
    CortexM.prototype.writeCoreRegisterCommand = function (register, value) {
        return this.writeMem32Command(3758157304 /* DCRDR */, value)
            .concat(this.writeMem32Command(3758157300 /* DCRSR */, register | 65536 /* REGWnR */));
    };
    /**
     * Get the state of the processor core
     * @returns Promise of CoreState
     */
    CortexM.prototype.getState = function () {
        var _this = this;
        return this.readMem32(3758157296 /* DHCSR */)
            .then(function (dhcsr) {
            var state;
            if (dhcsr & 524288 /* S_LOCKUP */)
                state = 1 /* LOCKUP */;
            else if (dhcsr & 262144 /* S_SLEEP */)
                state = 2 /* SLEEPING */;
            else if (dhcsr & 131072 /* S_HALT */)
                state = 3 /* DEBUG */;
            else
                state = 4 /* RUNNING */;
            if (dhcsr & 33554432 /* S_RESET_ST */) {
                // The core has been reset, check if an instruction has run
                return _this.readMem32(3758157296 /* DHCSR */)
                    .then(function (newDhcsr) {
                    if (newDhcsr & 33554432 /* S_RESET_ST */ && !(newDhcsr & 16777216 /* S_RETIRE_ST */)) {
                        return 0 /* RESET */;
                    }
                    else {
                        return state;
                    }
                });
            }
            else {
                return state;
            }
        });
    };
    /**
     * Whether the target is halted
     * @returns Promise of halted state
     */
    CortexM.prototype.isHalted = function () {
        return this.readMem32(3758157296 /* DHCSR */)
            .then(function (dhcsr) {
            return !!(dhcsr & 131072 /* S_HALT */);
        });
    };
    /**
     * Halt the target
     * @param wait Wait until halted before returning
     * @param timeout Milliseconds to wait before aborting wait
     * @returns Promise
     */
    CortexM.prototype.halt = function (wait, timeout) {
        var _this = this;
        if (wait === void 0) { wait = true; }
        if (timeout === void 0) { timeout = 0; }
        return this.isHalted()
            .then(function (halted) {
            if (halted)
                return;
            return _this.writeMem32(3758157296 /* DHCSR */, -1604386816 /* DBGKEY */ | 1 /* C_DEBUGEN */ | 2 /* C_HALT */)
                .then(function () {
                if (!wait)
                    return;
                return _this.waitDelay(function () { return _this.isHalted(); }, 100, timeout);
            });
        });
    };
    /**
     * Resume a target
     * @param wait Wait until resumed before returning
     * @param timeout Milliseconds to wait before aborting wait
     * @returns Promise
     */
    CortexM.prototype.resume = function (wait, timeout) {
        var _this = this;
        if (wait === void 0) { wait = true; }
        if (timeout === void 0) { timeout = 0; }
        return this.isHalted()
            .then(function (halted) {
            if (!halted)
                return;
            return _this.writeMem32(3758157104 /* DFSR */, 4 /* DWTTRAP */ | 2 /* BKPT */ | 1 /* HALTED */)
                .then(function () { return _this.enableDebug(); })
                .then(function () {
                if (!wait)
                    return;
                return _this.waitDelay(function () { return _this.isHalted().then(function (result) { return !result; }); }, 100, timeout);
            });
        });
    };
    /**
     * Read from a core register
     * @param register The register to read
     * @returns Promise of value
     */
    CortexM.prototype.readCoreRegister = function (register) {
        var _this = this;
        return this.transferSequence([
            this.writeMem32Command(3758157300 /* DCRSR */, register),
            this.readMem32Command(3758157296 /* DHCSR */)
        ])
            .then(function (results) {
            var dhcsr = results[0];
            if (!(dhcsr & 65536 /* S_REGRDY */)) {
                throw new Error("Register not ready");
            }
            return _this.readMem32(3758157304 /* DCRDR */);
        });
    };
    /**
     * Read an array of core registers
     * @param registers The registers to read
     * @returns Promise of register values in an array
     */
    CortexM.prototype.readCoreRegisters = function (registers) {
        var _this = this;
        var chain = Promise.resolve([]);
        registers.forEach(function (register) {
            chain = chain.then(function (results) { return _this.readCoreRegister(register).then(function (result) { return results.concat([result]); }); });
        });
        return chain;
    };
    /**
     * Write to a core register
     * @param register The register to write to
     * @param value The value to write
     * @returns Promise
     */
    CortexM.prototype.writeCoreRegister = function (register, value) {
        return this.transferSequence([
            this.writeMem32Command(3758157304 /* DCRDR */, value),
            this.writeMem32Command(3758157300 /* DCRSR */, register | 65536 /* REGWnR */),
            this.readMem32Command(3758157296 /* DHCSR */)
        ])
            .then(function (results) {
            var dhcsr = results[0];
            if (!(dhcsr & 65536 /* S_REGRDY */)) {
                throw new Error("Register not ready");
            }
        });
    };
    /**
     * Exucute code at a specified memory address
     * @param address The address to put the code
     * @param code The code to use
     * @param stackPointer The stack pointer to use
     * @param programCounter The program counter to use
     * @param linkRegister The link register to use (defaults to address + 1)
     * @param registers Values to add to the general purpose registers, R0, R1, R2, etc.
     */
    CortexM.prototype.execute = function (address, code, stackPointer, programCounter, linkRegister) {
        var _this = this;
        if (linkRegister === void 0) { linkRegister = address + 1; }
        var registers = [];
        for (var _i = 5; _i < arguments.length; _i++) {
            registers[_i - 5] = arguments[_i];
        }
        // Ensure a breakpoint exists at the end of the code
        if (code[code.length - 1] !== BKPT_INSTRUCTION) {
            var newCode = new Uint32Array(code.length + 1);
            newCode.set(code);
            newCode.set([BKPT_INSTRUCTION], code.length - 1);
            code = newCode;
        }
        // Create sequence of core register writes
        var sequence = [
            this.writeCoreRegisterCommand(13 /* SP */, stackPointer),
            this.writeCoreRegisterCommand(15 /* PC */, programCounter),
            this.writeCoreRegisterCommand(14 /* LR */, linkRegister)
        ];
        // Add in register values R0, R1, R2, etc.
        for (var i = 0; i < Math.min(registers.length, GENERAL_REGISTER_COUNT); i++) {
            sequence.push(this.writeCoreRegisterCommand(i, registers[i]));
        }
        return this.halt() // Halt the target
            .then(function () { return _this.transferSequence(sequence); }) // Write the registers
            .then(function () { return _this.writeBlock(address, code); }) // Write the code to the address
            .then(function () { return _this.resume(false); }) // Resume the target, without waiting
            .then(function () { return _this.waitDelay(function () { return _this.isHalted(); }, 100, EXECUTE_TIMEOUT); }) // Wait for the target to halt on the breakpoint
            .then(function () { return undefined; }); // Return
    };
    return CortexM;
}(dap_1.ADI));
exports.CortexM = CortexM;



},{"../dap":2}],5:[function(require,module,exports){
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
var cortex_m_1 = require("./cortex-m");
exports.CortexM = cortex_m_1.CortexM;



},{"./cortex-m":4}],6:[function(require,module,exports){
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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
/**
 * @hidden
 */
exports.DEFAULT_CLOCK_FREQUENCY = 10000000;
/**
 * @hidden
 */
var SWD_SEQUENCE = 0xE79E;
/**
 * @hidden
 */
var JTAG_SEQUENCE = 0xE73C;
/**
 * @hidden
 */
var BLOCK_HEADER_SIZE = 4;
/**
 * @hidden
 */
var TRANSFER_HEADER_SIZE = 2;
/**
 * @hidden
 */
var TRANSFER_OPERATION_SIZE = 5;
/**
 * CMSIS-DAP class
 * https://www.keil.com/pack/doc/CMSIS/DAP/html/group__DAP__Commands__gr.html
 */
var CmsisDAP = /** @class */ (function (_super) {
    __extends(CmsisDAP, _super);
    /**
     * CMSIS-DAP constructor
     * @param transport Debug transport to use
     * @param mode Debug mode to use
     * @param clockFrequency Communication clock frequency to use (default 10000000)
     */
    function CmsisDAP(transport, mode, clockFrequency) {
        if (mode === void 0) { mode = 0 /* DEFAULT */; }
        if (clockFrequency === void 0) { clockFrequency = exports.DEFAULT_CLOCK_FREQUENCY; }
        var _this = _super.call(this) || this;
        _this.transport = transport;
        _this.mode = mode;
        _this.clockFrequency = clockFrequency;
        // Determine the block size
        _this.blockSize = _this.transport.packetSize - BLOCK_HEADER_SIZE - 1; // -1 for the DAP_TRANSFER_BLOCK command
        // Determine the operation count possible
        var operationSpace = _this.transport.packetSize - TRANSFER_HEADER_SIZE - 1; // -1 for the DAP_TRANSFER command
        _this.operationCount = Math.floor(operationSpace / TRANSFER_OPERATION_SIZE);
        return _this;
    }
    CmsisDAP.prototype.delay = function (timeout) {
        return new Promise(function (resolve, _reject) {
            setTimeout(resolve, timeout);
        });
    };
    CmsisDAP.prototype.bufferSourceToUint8Array = function (prefix, data) {
        if (!data) {
            return new Uint8Array([prefix]);
        }
        function isView(source) {
            return source.buffer !== undefined;
        }
        var arrayBuffer = isView(data) ? data.buffer : data;
        var result = new Uint8Array(arrayBuffer.byteLength + 1);
        result.set([prefix]);
        result.set(new Uint8Array(arrayBuffer), 1);
        return result;
    };
    /**
     * Switches the CMSIS-DAP unit to use SWD
     * http://infocenter.arm.com/help/index.jsp?topic=/com.arm.doc.ddi0316d/Chdhfbhc.html
     */
    CmsisDAP.prototype.selectProtocol = function (protocol) {
        var _this = this;
        var sequence = protocol === 2 /* JTAG */ ? JTAG_SEQUENCE : SWD_SEQUENCE;
        return this.swjSequence(new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])) // Sequence of 1's
            .then(function () { return _this.swjSequence(new Uint16Array([sequence])); }) // Send protocol sequence
            .then(function () { return _this.swjSequence(new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])); }) // Sequence of 1's
            .then(function () { return _this.swjSequence(new Uint8Array([0x00])); });
    };
    /**
     * Send a command
     * @param command Command to send
     * @param data Data to use
     * @returns Promise of DataView
     */
    CmsisDAP.prototype.send = function (command, data) {
        var _this = this;
        var array = this.bufferSourceToUint8Array(command, data);
        return this.transport.write(array)
            .then(function () { return _this.transport.read(); })
            .then(function (response) {
            if (response.getUint8(0) !== command) {
                throw new Error("Bad response for " + command + " -> " + response.getUint8(0));
            }
            switch (command) {
                case 3 /* DAP_DISCONNECT */:
                case 8 /* DAP_WRITE_ABORT */:
                case 9 /* DAP_DELAY */:
                case 10 /* DAP_RESET_TARGET */:
                case 17 /* DAP_SWJ_CLOCK */:
                case 18 /* DAP_SWJ_SEQUENCE */:
                case 19 /* DAP_SWD_CONFIGURE */:
                case 29 /* DAP_SWD_SEQUENCE */:
                case 23 /* DAP_SWO_TRANSPORT */:
                case 24 /* DAP_SWO_MODE */:
                case 26 /* DAP_SWO_CONTROL */:
                case 21 /* DAP_JTAG_CONFIGURE */:
                case 22 /* DAP_JTAG_ID_CODE */:
                case 4 /* DAP_TRANSFER_CONFIGURE */:
                    if (response.getUint8(1) !== 0 /* DAP_OK */) {
                        throw new Error("Bad status for " + command + " -> " + response.getUint8(1));
                    }
            }
            return response;
        });
    };
    /**
     * Get DAP information
     * @param request Type of information to get
     * @returns Promise of DataView
     */
    CmsisDAP.prototype.dapInfo = function (request) {
        return this.send(0 /* DAP_INFO */, new Uint8Array([request]))
            .then(function (result) {
            var length = result.getUint8(1);
            if (length === 0) {
                return null;
            }
            switch (request) {
                case 240 /* CAPABILITIES */:
                case 254 /* PACKET_COUNT */:
                case 255 /* PACKET_SIZE */:
                case 253 /* SWO_TRACE_BUFFER_SIZE */:
                    // Byte
                    if (length === 1)
                        return result.getUint8(2);
                    // Short
                    if (length === 2)
                        return result.getUint16(2);
                    // Word
                    if (length === 4)
                        return result.getUint32(2);
            }
            var ascii = new Uint8Array(result.buffer, 2, length);
            return String.fromCharCode.apply(null, ascii);
        });
    };
    /**
     * Send an SWJ Sequence
     * https://www.keil.com/pack/doc/CMSIS/DAP/html/group__DAP__SWJ__Sequence.html
     * @param sequence The sequence to send
     * @returns Promise
     */
    CmsisDAP.prototype.swjSequence = function (sequence) {
        var bitLength = sequence.byteLength * 8;
        var data = this.bufferSourceToUint8Array(bitLength, sequence);
        return this.send(18 /* DAP_SWJ_SEQUENCE */, data)
            .then(function () { return undefined; });
    };
    /**
     * Configure Transfer
     * https://www.keil.com/pack/doc/CMSIS/DAP/html/group__DAP__TransferConfigure.html
     * @param idleCycles Number of extra idle cycles after each transfer
     * @param waitRetry Number of transfer retries after WAIT response
     * @param matchRetry Number of retries on reads with Value Match in DAP_Transfer
     * @returns Promise
     */
    CmsisDAP.prototype.configureTransfer = function (idleCycles, waitRetry, matchRetry) {
        var data = new Uint8Array(5);
        var view = new DataView(data.buffer);
        view.setUint8(0, idleCycles);
        view.setUint16(1, waitRetry, true);
        view.setUint16(3, matchRetry, true);
        return this.send(4 /* DAP_TRANSFER_CONFIGURE */, data)
            .then(function () { return undefined; });
    };
    /**
     * Connect to target device
     * @returns Promise
     */
    CmsisDAP.prototype.connect = function () {
        var _this = this;
        return this.transport.open()
            .then(function () { return _this.send(17 /* DAP_SWJ_CLOCK */, new Uint32Array([_this.clockFrequency])); })
            .then(function () { return _this.send(2 /* DAP_CONNECT */, new Uint8Array([_this.mode])); })
            .then(function (result) {
            if (result.getUint8(1) === 0 /* FAILED */ || _this.mode !== 0 /* DEFAULT */ && result.getUint8(1) !== _this.mode) {
                throw new Error("Mode not enabled.");
            }
        })
            .then(function () { return _this.configureTransfer(0, 100, 0); })
            .then(function () { return _this.selectProtocol(1 /* SWD */); });
    };
    /**
     * Disconnect from target device
     * @returns Promise
     */
    CmsisDAP.prototype.disconnect = function () {
        var _this = this;
        return this.send(3 /* DAP_DISCONNECT */)
            .then(function () {
            return _this.transport.close();
        });
    };
    /**
     * Reconnect to target device
     * @returns Promise
     */
    CmsisDAP.prototype.reconnect = function () {
        var _this = this;
        return this.disconnect()
            .then(function () { return _this.delay(100); })
            .then(function () { return _this.connect(); });
    };
    /**
     * Reset target device
     * @returns Promise of whether a device specific reset sequence is implemented
     */
    CmsisDAP.prototype.reset = function () {
        return this.send(10 /* DAP_RESET_TARGET */)
            .then(function (response) { return response.getUint8(2) === 1 /* RESET_SEQUENCE */; });
    };
    CmsisDAP.prototype.transfer = function (portOrOps, mode, register, value) {
        var operations;
        if (typeof portOrOps === "number") {
            operations = [{
                    port: portOrOps,
                    mode: mode,
                    register: register,
                    value: value
                }];
        }
        else {
            operations = portOrOps;
        }
        var data = new Uint8Array(TRANSFER_HEADER_SIZE + (operations.length * TRANSFER_OPERATION_SIZE));
        var view = new DataView(data.buffer);
        // DAP Index, ignored for SWD
        view.setUint8(0, 0);
        // Transfer count
        view.setUint8(1, operations.length);
        operations.forEach(function (operation, index) {
            var offset = TRANSFER_HEADER_SIZE + (index * TRANSFER_OPERATION_SIZE);
            // Transfer request
            view.setUint8(offset, operation.port | operation.mode | operation.register);
            // Transfer data
            view.setUint32(offset + 1, operation.value, true);
        });
        return this.send(5 /* DAP_TRANSFER */, data)
            .then(function (result) {
            // Transfer count
            if (result.getUint8(1) !== operations.length) {
                throw new Error("Transfer count mismatch");
            }
            // Transfer response
            var response = result.getUint8(2);
            if (response === 2 /* WAIT */) {
                throw new Error("Transfer response WAIT");
            }
            if (response === 4 /* FAULT */) {
                throw new Error("Transfer response FAULT");
            }
            if (response === 8 /* PROTOCOL_ERROR */) {
                throw new Error("Transfer response PROTOCOL_ERROR");
            }
            if (response === 16 /* VALUE_MISMATCH */) {
                throw new Error("Transfer response VALUE_MISMATCH");
            }
            if (response === 7 /* NO_ACK */) {
                throw new Error("Transfer response NO_ACK");
            }
            if (typeof portOrOps === "number") {
                return result.getUint32(3, true);
            }
            else {
                var length_1 = operations.length * 4;
                return new Uint32Array(result.buffer.slice(3, 3 + length_1));
            }
        });
    };
    CmsisDAP.prototype.transferBlock = function (port, register, countOrValues) {
        var operationCount;
        var mode;
        var dataSize = BLOCK_HEADER_SIZE;
        if (typeof countOrValues === "number") {
            operationCount = countOrValues;
            mode = 2 /* READ */;
        }
        else {
            operationCount = countOrValues.length;
            mode = 0 /* WRITE */;
            dataSize += countOrValues.byteLength;
        }
        var data = new Uint8Array(dataSize);
        var view = new DataView(data.buffer);
        // DAP Index, ignored for SWD
        view.setUint8(0, 0);
        // Transfer count
        view.setUint16(1, operationCount, true);
        // Transfer request
        view.setUint8(3, port | mode | register);
        if (typeof countOrValues !== "number") {
            // Transfer data
            data.set(countOrValues, BLOCK_HEADER_SIZE);
        }
        return this.send(6 /* DAP_TRANSFER_BLOCK */, view)
            .then(function (result) {
            // Transfer count
            if (result.getUint16(1, true) !== operationCount) {
                throw new Error("Transfer count mismatch");
            }
            // Transfer response
            var response = result.getUint8(3);
            if (response & 2 /* WAIT */) {
                throw new Error("Transfer response WAIT");
            }
            if (response & 4 /* FAULT */) {
                throw new Error("Transfer response FAULT");
            }
            if (response & 8 /* PROTOCOL_ERROR */) {
                throw new Error("Transfer response PROTOCOL_ERROR");
            }
            if (response & 7 /* NO_ACK */) {
                throw new Error("Transfer response NO_ACK");
            }
            if (typeof countOrValues === "number") {
                return new Uint32Array(result.buffer.slice(4));
            }
        });
    };
    return CmsisDAP;
}(events_1.EventEmitter));
exports.CmsisDAP = CmsisDAP;



},{"events":16}],7:[function(require,module,exports){
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
var cmsis_dap_1 = require("./cmsis-dap");
exports.CmsisDAP = cmsis_dap_1.CmsisDAP;



},{"./cmsis-dap":6}],8:[function(require,module,exports){
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
var os_1 = require("os");
var node_hid_1 = require("node-hid");
/**
 * HID Transport class
 */
var HID = /** @class */ (function () {
    /**
     * HID constructor
     * @param path Path to HID device to use
     */
    function HID(deviceOrPath) {
        this.os = os_1.platform();
        this.path = null;
        this.device = null;
        this.packetSize = 64;
        function isDevice(source) {
            return source.path !== undefined;
        }
        this.path = isDevice(deviceOrPath) ? deviceOrPath.path : deviceOrPath;
    }
    /**
     * Open device
     * @returns Promise
     */
    HID.prototype.open = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!_this.path.length) {
                return reject("No path specified");
            }
            try {
                _this.device = new node_hid_1.HID(_this.path);
                resolve();
            }
            catch (ex) {
                reject(ex);
            }
        });
    };
    /**
     * Close device
     * @returns Promise
     */
    HID.prototype.close = function () {
        var _this = this;
        return new Promise(function (resolve, _reject) {
            if (_this.device) {
                _this.device.close();
                _this.device = null;
            }
            resolve();
        });
    };
    /**
     * Read from device
     * @returns Promise of DataView
     */
    HID.prototype.read = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.device.read(function (error, data) {
                if (error) {
                    return reject(error);
                }
                var buffer = new Uint8Array(data).buffer;
                resolve(new DataView(buffer));
            });
        });
    };
    /**
     * Write to device
     * @param data Data to write
     * @returns Promise
     */
    HID.prototype.write = function (data) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            function isView(source) {
                return source.buffer !== undefined;
            }
            var arrayBuffer = isView(data) ? data.buffer : data;
            var array = Array.prototype.slice.call(new Uint8Array(arrayBuffer));
            // Pad to packet size
            while (array.length < _this.packetSize)
                array.push(0);
            // Windows requires the prepend of an extra byte
            // https://github.com/node-hid/node-hid/blob/master/README.md#prepend-byte-to-hid_write
            if (_this.os === "win32") {
                array.unshift(0); // prepend throwaway byte
            }
            var bytesWritten = _this.device.write(array);
            if (bytesWritten !== array.length)
                return reject("Incorrect bytecount written");
            resolve();
        });
    };
    return HID;
}());
exports.HID = HID;



},{"node-hid":14,"os":18}],9:[function(require,module,exports){
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
var hid_1 = require("./hid");
exports.HID = hid_1.HID;
var usb_1 = require("./usb");
exports.USB = usb_1.USB;
var webusb_1 = require("./webusb");
exports.WebUSB = webusb_1.WebUSB;



},{"./hid":8,"./usb":10,"./webusb":11}],10:[function(require,module,exports){
(function (Buffer){
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
var usb_1 = require("usb");
/**
 * @hidden
 */
var DEFAULT_CONFIGURATION = 1;
/**
 * @hidden
 */
var DEFAULT_CLASS = 0xFF;
/**
 * @hidden
 */
var GET_REPORT = 0x01;
/**
 * @hidden
 */
var SET_REPORT = 0x09;
/**
 * @hidden
 */
var OUT_REPORT = 0x200;
/**
 * @hidden
 */
var IN_REPORT = 0x100;
/**
 * USB Transport class
 */
var USB = /** @class */ (function () {
    /**
     * USB constructor
     * @param device USB device to use
     * @param interfaceClass Optional interface class to use (default: 0xFF)
     * @param configuration Optional Configuration to use (default: 1)
     * @param alwaysControlTransfer Whether to always use control transfer instead of endpoints (default: false)
     */
    function USB(device, interfaceClass, configuration, alwaysControlTransfer) {
        if (interfaceClass === void 0) { interfaceClass = DEFAULT_CLASS; }
        if (configuration === void 0) { configuration = DEFAULT_CONFIGURATION; }
        if (alwaysControlTransfer === void 0) { alwaysControlTransfer = false; }
        this.device = device;
        this.interfaceClass = interfaceClass;
        this.configuration = configuration;
        this.alwaysControlTransfer = alwaysControlTransfer;
        this.packetSize = 64;
    }
    USB.prototype.bufferToDataView = function (buffer) {
        var arrayBuffer = new Uint8Array(buffer).buffer;
        return new DataView(arrayBuffer);
    };
    USB.prototype.bufferSourceToBuffer = function (bufferSource) {
        function isView(source) {
            return source.buffer !== undefined;
        }
        var arrayBuffer = isView(bufferSource) ? bufferSource.buffer : bufferSource;
        return new Buffer(arrayBuffer);
    };
    USB.prototype.extendBuffer = function (data, packetSize) {
        function isView(source) {
            return source.buffer !== undefined;
        }
        var arrayBuffer = isView(data) ? data.buffer : data;
        var length = Math.min(arrayBuffer.byteLength, packetSize);
        var result = new Uint8Array(length);
        result.set(new Uint8Array(arrayBuffer));
        return result;
    };
    /**
     * Open device
     * @returns Promise
     */
    USB.prototype.open = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.device.open();
            _this.device.setConfiguration(_this.configuration, function (error) {
                if (error)
                    return reject(error);
                var interfaces = _this.device.interfaces.filter(function (iface) {
                    return iface.descriptor.bInterfaceClass === _this.interfaceClass;
                });
                if (!interfaces.length) {
                    throw new Error("No valid interfaces found.");
                }
                var selectedInterface = interfaces[0];
                _this.interfaceNumber = selectedInterface.interfaceNumber;
                // If we always want to use control transfer, don't find/set endpoints and claim interface
                if (!_this.alwaysControlTransfer) {
                    var endpoints = selectedInterface.endpoints;
                    _this.endpointIn = null;
                    _this.endpointOut = null;
                    for (var _i = 0, endpoints_1 = endpoints; _i < endpoints_1.length; _i++) {
                        var endpoint = endpoints_1[_i];
                        if (endpoint.direction === "in")
                            _this.endpointIn = endpoint;
                        else
                            _this.endpointOut = endpoint;
                    }
                    // If endpoints are found, claim the interface
                    if (_this.endpointIn || _this.endpointOut) {
                        // If the interface can't be claimed, use control transfer
                        try {
                            selectedInterface.claim();
                        }
                        catch (_e) {
                            _this.endpointIn = null;
                            _this.endpointOut = null;
                        }
                    }
                }
                resolve();
            });
        });
    };
    /**
     * Close device
     * @returns Promise
     */
    USB.prototype.close = function () {
        var _this = this;
        return new Promise(function (resolve, _reject) {
            _this.device.close();
            resolve();
        });
    };
    /**
     * Read from device
     * @returns Promise of DataView
     */
    USB.prototype.read = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            // Use endpoint if it exists
            if (_this.endpointIn) {
                return _this.endpointIn.transfer(_this.packetSize, function (error, buffer) {
                    if (error)
                        return reject(error);
                    resolve(_this.bufferToDataView(buffer));
                });
            }
            // Fallback to using control transfer
            _this.device.controlTransfer(usb_1.LIBUSB_ENDPOINT_IN | usb_1.LIBUSB_REQUEST_TYPE_CLASS | usb_1.LIBUSB_RECIPIENT_INTERFACE, GET_REPORT, IN_REPORT, _this.interfaceNumber, _this.packetSize, function (error, buffer) {
                if (error)
                    return reject(error);
                resolve(_this.bufferToDataView(buffer));
            });
        });
    };
    /**
     * Write to device
     * @param data Data to write
     * @returns Promise
     */
    USB.prototype.write = function (data) {
        var _this = this;
        var extended = this.extendBuffer(data, this.packetSize);
        var buffer = this.bufferSourceToBuffer(extended);
        return new Promise(function (resolve, reject) {
            // Use endpoint if it exists
            if (_this.endpointOut) {
                return _this.endpointOut.transfer(buffer, function (error) {
                    if (error)
                        return reject(error);
                    resolve();
                });
            }
            // Fallback to using control transfer
            _this.device.controlTransfer(usb_1.LIBUSB_ENDPOINT_OUT | usb_1.LIBUSB_REQUEST_TYPE_CLASS | usb_1.LIBUSB_RECIPIENT_INTERFACE, SET_REPORT, OUT_REPORT, _this.interfaceNumber, buffer, function (error) {
                if (error)
                    return reject(error);
                resolve();
            });
        });
    };
    return USB;
}());
exports.USB = USB;



}).call(this,require("buffer").Buffer)
},{"buffer":15,"usb":14}],11:[function(require,module,exports){
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
/**
 * @hidden
 */
var DEFAULT_CONFIGURATION = 1;
/**
 * @hidden
 */
var DEFAULT_CLASS = 0xFF;
/**
 * @hidden
 */
var GET_REPORT = 0x01;
/**
 * @hidden
 */
var SET_REPORT = 0x09;
/**
 * @hidden
 */
var OUT_REPORT = 0x200;
/**
 * @hidden
 */
var IN_REPORT = 0x100;
/**
 * WebUSB Transport class
 * https://wicg.github.io/webusb/
 */
var WebUSB = /** @class */ (function () {
    /**
     * WebUSB constructor
     * @param device WebUSB device to use
     * @param interfaceClass Optional interface class to use (default: 0xFF)
     * @param configuration Optional Configuration to use (default: 1)
     */
    function WebUSB(device, interfaceClass, configuration) {
        if (interfaceClass === void 0) { interfaceClass = DEFAULT_CLASS; }
        if (configuration === void 0) { configuration = DEFAULT_CONFIGURATION; }
        this.device = device;
        this.interfaceClass = interfaceClass;
        this.configuration = configuration;
        this.packetSize = 64;
    }
    WebUSB.prototype.extendBuffer = function (data, packetSize) {
        function isView(source) {
            return source.buffer !== undefined;
        }
        var arrayBuffer = isView(data) ? data.buffer : data;
        var length = Math.min(arrayBuffer.byteLength, packetSize);
        var result = new Uint8Array(length);
        result.set(new Uint8Array(arrayBuffer));
        return result;
    };
    /**
     * Open device
     * @returns Promise
     */
    WebUSB.prototype.open = function () {
        var _this = this;
        return this.device.open()
            .then(function () { return _this.device.selectConfiguration(_this.configuration); })
            .then(function () {
            var interfaces = _this.device.configuration.interfaces.filter(function (iface) {
                return iface.alternates[0].interfaceClass === _this.interfaceClass;
            });
            if (!interfaces.length) {
                throw new Error("No valid interfaces found.");
            }
            _this.interfaceNumber = interfaces[0].interfaceNumber;
            return _this.device.claimInterface(_this.interfaceNumber);
        });
    };
    /**
     * Close device
     * @returns Promise
     */
    WebUSB.prototype.close = function () {
        return this.device.close();
    };
    /**
     * Read from device
     * @returns Promise of DataView
     */
    WebUSB.prototype.read = function () {
        return this.device.controlTransferIn({
            requestType: "class",
            recipient: "interface",
            request: GET_REPORT,
            value: IN_REPORT,
            index: this.interfaceNumber
        }, this.packetSize)
            .then(function (result) { return result.data; });
    };
    /**
     * Write to device
     * @param data Data to write
     * @returns Promise
     */
    WebUSB.prototype.write = function (data) {
        var buffer = this.extendBuffer(data, this.packetSize);
        return this.device.controlTransferOut({
            requestType: "class",
            recipient: "interface",
            request: SET_REPORT,
            value: OUT_REPORT,
            index: this.interfaceNumber
        }, buffer)
            .then(function () { return undefined; });
    };
    return WebUSB;
}());
exports.WebUSB = WebUSB;



},{}],12:[function(require,module,exports){
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
var transport_1 = require("./transport");
exports.HID = transport_1.HID;
exports.USB = transport_1.USB;
exports.WebUSB = transport_1.WebUSB;
var proxy_1 = require("./proxy");
exports.CmsisDAP = proxy_1.CmsisDAP;
var daplink_1 = require("./daplink");
exports.DAPLink = daplink_1.DAPLink;
var dap_1 = require("./dap");
exports.ADI = dap_1.ADI;
var processor_1 = require("./processor");
exports.CortexM = processor_1.CortexM;



},{"./dap":2,"./daplink":3,"./processor":5,"./proxy":7,"./transport":9}],13:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],14:[function(require,module,exports){

},{}],15:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":13,"ieee754":17}],16:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],17:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],18:[function(require,module,exports){
exports.endianness = function () { return 'LE' };

exports.hostname = function () {
    if (typeof location !== 'undefined') {
        return location.hostname
    }
    else return '';
};

exports.loadavg = function () { return [] };

exports.uptime = function () { return 0 };

exports.freemem = function () {
    return Number.MAX_VALUE;
};

exports.totalmem = function () {
    return Number.MAX_VALUE;
};

exports.cpus = function () { return [] };

exports.type = function () { return 'Browser' };

exports.release = function () {
    if (typeof navigator !== 'undefined') {
        return navigator.appVersion;
    }
    return '';
};

exports.networkInterfaces
= exports.getNetworkInterfaces
= function () { return {} };

exports.arch = function () { return 'javascript' };

exports.platform = function () { return 'browser' };

exports.tmpdir = exports.tmpDir = function () {
    return '/tmp';
};

exports.EOL = '\n';

exports.homedir = function () {
	return '/'
};

},{}]},{},[12])(12)
});

//# sourceMappingURL=dap.bundle.js.map
