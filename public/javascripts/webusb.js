const status = $('#status');
const input = $('#input');
const output = $('#output');
const selectButton = $('#selectdevice');
const clearButton = $('#clearbutton');
const baud = $('#baud');

let deviceTarget;
let isConnected = false;

// set status text to a given state
function setStatus(state) {
    console.log(state);
    status.text(state);
}

// choose a webUSB device filtered using micro:bit's vendor ID
function selectDevice() {
    if(isConnected) {
        setStatus("Select Device")
        selectButton.text("Select Device")
        input.prop('readonly', true);
        $('#baud option:not(:selected)').prop('disabled', false);

        isConnected = false;
        deviceTarget.stopSerialRead();
        deviceTarget.disconnect();

        return;
    }

    setStatus("Selecting device...");

    navigator.usb.requestDevice({
        filters: [{vendorId: 0xD28}]
    })
    .then(device => connect(device, baud.val()))
    .catch(error => {
        setStatus(error);
    });
}

// connect to given device with chosen baud rate
function connect(device, baud) {
    const transport = new DAPjs.WebUSB(device);
    const target = new DAPjs.DAPLink(transport);

    navigator.usb.addEventListener("disconnect", () => {
        setStatus("Disconnected");
        target.stopSerialRead();
        target.disconnect();
        selectButton.hidden = false;
    });

    target.on(DAPjs.DAPLink.EVENT_SERIAL_DATA, data => {
        let trimmed = data.trim();

        if(trimmed !== '') {
            console.log("Received: " + trimmed);
            output.append(trimmed + '\n'); // add data to output textarea
            output.scrollTop(output.prop('scrollHeight') - output.height()); // scroll the output box down as new commands come in
        }
        /*if(data !== "" && data != null && data !== "      " && data !== '\n') {
            console.log("Received: " + data);
            output.append(data); // add data to output textarea
            output.scrollTop(output.prop('scrollHeight') - output.height()); // scroll the output box down as new commands come in
        }*/
    });

    return target.connect()
        .then(() => {
            setStatus("Connected to " + device.productName);
            selectButton.text("Disconnect")

            // enable input and disable changing baud rate
            input.prop('readonly', false);
            $('#baud option:not(:selected)').prop('disabled', true);

            // set connection true and set the baud rate
            isConnected = true;
            target.setSerialBaudrate(baud); // set the baud rate after connecting
            return target.getSerialBaudrate();
        })
        .then(baud => {
            target.startSerialRead();
            console.log(`Listening at ${baud} baud...`);
            deviceTarget = target;
        });
}

/**
 * button click listeners
 */
// clicking select/disconnect button
selectButton.click(selectDevice);

// clicking clear button
clearButton.click(() => {
    output.html('')
});

/**
 * keyboard listeners
 */
// pressing return on the input field
input.on('keypress', (evt) => {
    // if enter pressed
    if(evt.which === 13) {
        deviceTarget.serialWrite(input.val() + "\n");
        input.val('');
    }
});