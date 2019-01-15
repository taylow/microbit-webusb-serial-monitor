import { CmsisDAP, Proxy } from "../proxy";
/**
 * DAPLink Class
 */
export declare class DAPLink extends CmsisDAP implements Proxy {
    /**
     * Progress event
     * @event
     */
    static EVENT_PROGRESS: string;
    /**
     * Serial read event
     * @event
     */
    static EVENT_SERIAL_DATA: string;
    private timer;
    /**
     * Detect if buffer contains text or binary data
     */
    private isBufferBinary(buffer);
    private writeBuffer(buffer, offset?);
    /**
     * Flash the target
     * @param buffer The image to flash
     * @returns Promise
     */
    flash(buffer: BufferSource): Promise<void>;
    /**
     * Get the serial baud rate setting
     * @returns Promise of baud rate
     */
    getSerialBaudrate(): Promise<number>;
    /**
     * Set the serial baud rate setting
     * @param baudrate The baudrate to use (defaults to 9600)
     * @returns Promise
     */
    setSerialBaudrate(baudrate?: number): Promise<void>;
    /**
     * Start listening for serial data
     */
    startSerialRead(): void;
    /**
     * Stop listening for serial data
     */
    stopSerialRead(): void;
    /**
     * Write serial data
     * @param data The data to write
     * @returns Promise
     */
    serialWrite(data: string): Promise<void>;
}
