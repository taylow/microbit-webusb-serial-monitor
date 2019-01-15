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

//# sourceMappingURL=cmsis-dap.js.map
