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

//# sourceMappingURL=usb.js.map
