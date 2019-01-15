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

//# sourceMappingURL=webusb.js.map
