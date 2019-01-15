/// <reference types="w3c-web-usb" />
import { Transport } from "./";
/**
 * WebUSB Transport class
 * https://wicg.github.io/webusb/
 */
export declare class WebUSB implements Transport {
    private device;
    private interfaceClass;
    private configuration;
    private interfaceNumber;
    readonly packetSize: number;
    /**
     * WebUSB constructor
     * @param device WebUSB device to use
     * @param interfaceClass Optional interface class to use (default: 0xFF)
     * @param configuration Optional Configuration to use (default: 1)
     */
    constructor(device: USBDevice, interfaceClass?: number, configuration?: number);
    private extendBuffer(data, packetSize);
    /**
     * Open device
     * @returns Promise
     */
    open(): Promise<void>;
    /**
     * Close device
     * @returns Promise
     */
    close(): Promise<void>;
    /**
     * Read from device
     * @returns Promise of DataView
     */
    read(): Promise<DataView>;
    /**
     * Write to device
     * @param data Data to write
     * @returns Promise
     */
    write(data: BufferSource): Promise<void>;
}
