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

//# sourceMappingURL=cortex-m.js.map
