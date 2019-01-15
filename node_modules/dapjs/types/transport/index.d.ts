/**
 * USB transport
 */
export interface Transport {
    /**
     * Packet size
     */
    packetSize: number;
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
export { HID } from "./hid";
export { USB } from "./usb";
export { WebUSB } from "./webusb";
