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

//# sourceMappingURL=hid.js.map
