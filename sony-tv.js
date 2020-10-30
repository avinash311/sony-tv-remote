/*
     Sony TV Web Page Remote
     Uses Sony Bravia TV IRCC (IR like control commands) sent using HTTP POST.

     Works on Chrome, Firefox, Edge.
     Requires Javascript ES2015 (ES6). Works with most browsers in 2020.
     Uses localStorage, for of loop, etc.

     This script runs along with a web page that displays all the commands
     to send.
     Since this has to send a Javascript request to a different IP address,
     it MAY run afoul of same origin policy restrictions. But there seem to be
     edge conditions if the web page is saved locally and accessed using
     file:// URL which then uses Javascript to POST to http:// URL, it works
     fine in latest Chrome, Firefox (Jan 2017).
     In any case, if that fails, here are the options:
     1: Change this script to use node.js or server side scripting which
     does not run afoul of same origin policy.
     2: Load this as a Web Extension which asks for permissions to access
     remote URLs, so avoids cross origin policy cross-domain restrictions.

     There are a number of similar tools available - from command line
     scripts to server side Javascript. Use a web search such as "Sony
     TV IRCC" to find references. Example:
     http://www.openremote.org/display/forums/Sony+TV+HTTP+control?focusedCommentId=23601972#comment-23601972

     Note that the On button from this web page will only work if the TV is
     not on extreme power savings standby which terminates web server on TV.
     Javascript cannot send Wake-On-Lan WOL message required to turn on the
     TV Web Server. To use On button, turn off Eco or Power Saving mode or
     always use physical remote or other app to turn on TV.
*/

'use strict';

// --------------------------------------------------------------------------------

let SONY_TV_IP = ''; // updated from local storage
let SONY_TV_PRESHARED_KEY = '';
// Default list of channels to show as quick-access channel command buttons
// Format of each button is command-or-channel-number : button-name\n
const DEFAULT_COMMAND_BUTTONS = `
2.1 Enter : PBS 2
4.1 Enter : CBS 4
5.1 Enter : ABC 5
7.2 Enter : this 7
15.2 Enter : Cozi
25.3 Enter : LAFF
27.1 Enter : Uni 27
38.1 Enter : MyTV 38
38.3 Enter : Comet
56.1 Enter : CW 56
58.1 Enter : IonLife
66.2 Enter : Bounce
`;
// While console.log, warn, etc are used liberally, messages to the user
// are limited by MESSAGE_LEVEL setting. These are messages displayed in
// a popup (temporarily) div on the page.
let MESSAGE_LEVEL = 2; // displays all LEVEL_ message <= this value

const LEVEL_ERROR = 0; // message level for error messages
const LEVEL_FEEDBACK = 1; // message level for key button click messages
const LEVEL_INFO = 2; // message level for each remote button click

const SONY_TV_URL_PREFIX = 'http://';
const SONY_TV_URL_SUFFIX = '/sony/IRCC';
// Construct the URL as: SONY_TV_URL_PREFIX + SONY_TV_IP + SONY_TV_URL_SUFFIX

// All the web page DOM class names and ids.
const CLASS_TV_COMMAND = 'tv-command';
const ID_TV_SETUP = 'tv-setup'; // form ID to save TV IP and Key
const ID_TV_IP = 'tv-ip-address'; // ID of field that shows/updates TV IP
const ID_TV_KEY = 'tv-key'; // ID of field that shows/updates TV Pre-Shared Key
const ID_MAKE_CUSTOM_BUTTONS = 'make-custom-buttons'; // channel numbers
const ID_CHANNEL_NUMBERS = 'tv-channel-numbers'; // displays channel buttons
const ID_POPUP_TEXT = 'popup-text'; // normally hidden div to display messages
var POPUP_TEXT_ELEMENT = null; // ID_POPUP_TEXT element
const CLASS_TAB_CONTENT = 'tab-content'; // each tab content div (buttons, etc)
const CLASS_TAB_LINK = 'tab-link'; // navigation bar for the tabs
const CSS_TAB_LINK_ACTIVE = 'tab-color-active'; // css of active tab link
const DATASET_COMMANDS = 'stv.commands'; // HTML attribute: data-stv.commands
const ID_TV_COMMAND_INPUT = 'tv-command-input'; // form ID with text box
const ID_TV_TEXT_COMMAND = 'tv-input-1'; // input text box for command entry

// key names used to store data in (local storage or browser.storage)
const STORE_TV_IP = 'SonyTVIP';
const STORE_TV_KEY = 'SonyTVPreSharedKey';
const STORE_CHANNEL_BUTTONS = 'ChannelButtons';

// The TV takes some time to complete commands, even after sending back
// the XMLHttpRequest response. While many commands finish fast,
// some of the command sequences - such as Wide display command - need a
// long delay, 500ms seems to work, 300ms causes Up Up ... keys to be skipped.
const WAIT_AFTER_COMMAND = 600; // milliseconds to wait after sending a code
const STATUS_MESSAGE_TIME = 50; // after commands, show message for this long
const ERROR_MESSAGE_TIME = 2100; // after error, show message for this long

// --------------------------------------------------------------------------------
const WHITESPACE_RE = /\s+/;
const NEWLINE_RE = /\r?\n/;
const CHANNEL_RE = /^([0-9]+\.[0-9]+|[0-9]+)$/;
const COMMAND_AND_NAME_RE = / : /; // "command : name" format for custom buttons

// --------------------------------------------------------------------------------
// Send the IRCCCode code of given COMMAND to the TV using a POST web request.
// Returns a Promise that resolves when the request response is received.
function sendCommand(command) {
  return new Promise(function(resolve, reject) {

    if (SONY_TV_IP == '' || SONY_TV_PRESHARED_KEY == '') {
      const message = 'Error: No Sony TV IP or PreShared Key setup yet.';
      console.error(message);
      reject(new Error(message));
      return;
    }

    const code = commandToCode(command);
    if (!code) {
      const message = 'Error: IRCC code not found for command: "' + command + '"';
      console.error(message);
      reject(new Error(message));
      return;
    }

    const req = new XMLHttpRequest();
    const tv_url = SONY_TV_URL_PREFIX + SONY_TV_IP + SONY_TV_URL_SUFFIX;
    // Making a async xmlhttprequest, this will not always work when sending
    // a list of commands, one after the other. So caller adds a delay between
    // codes. It would be fine to change this to a synchronous call and use
    // a WebWorker thread to send lists of codes.
    req.open('POST', tv_url, true);

    req.onreadystatechange = function() {
      if (req.readyState == 4) { // XMLHttpRequest.DONE
        if (req.status != 200) {
          // Safety: JSON.parse does not evaluate the attacker's scripts.
          // const cleanedResponse = JSON.parse(req.responseText);
          const message = 'Failed ' + command + ' ' + code + ' (Status '
            + req.status + '): ' + tv_url + ' Key: ' + SONY_TV_PRESHARED_KEY
            + ' (Response: "' + req.responseText + '")';
          console.error(message);
          reject(new Error(message));
        } else {
          // console.log('POST response received for: ' + command + ' ' + code);
          resolve();
        }
      }
    }

    req.setRequestHeader('Content-Type', 'text/xml; charset=UTF-8');
    // Note: The SOAPAction header value must be enclosed in " otherwise get
    // an Invalid Action error from TV!
    req.setRequestHeader('SOAPAction', '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"');
    req.setRequestHeader('X-Auth-PSK', SONY_TV_PRESHARED_KEY);
    const data =
      `<?xml version="1.0"?>
      <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
        <s:Body>
          <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">
            <IRCCCode>${code}</IRCCCode>
          </u:X_SendIRCC>
        </s:Body>
      </s:Envelope>`;

    /* Other errors to watch for:
       Incorrect IRCC code results in: 
     HTTP/1.1 500 Internal Server Error
     <errorCode>800</errorCode>
     <errorDescription>Cannot accept the IRCC Code</errorDescription>
     */

    req.timeout = 3000; // in milliseconds
    req.send(data);
    // Note: do not escape(data), that results in UPnPError:
    //      <errorCode>401</errorCode>
    //      <errorDescription>Invalid Action</errorDescription>
  });
}

// --------------------------------------------------------------------------------
// Get the list of commands supported by the TV. This only needs the URL,
// no need to send the TV Pre-Shared Key. Send this as a JSON command.
// Returns a Promise object that resolves on a succeful POST response.
// Equivalant to: curl --silent -XPOST http://$SonyBraviaIP/sony/system -d '{"method":"getRemoteControllerInfo","params":[],"id":10,"version":"1.0"}'  | python -m json.tool
function getRemoteControllerInfo(controllerOutputDiv) {
  return new Promise(function(resolve, reject) {
    if (SONY_TV_IP == '') {
      const message = 'Error: No Sony TV IP setup yet.';
      console.error(message);
      reject(new Error(message));
      return;
    }
    const req = new XMLHttpRequest();
    const tv_url = SONY_TV_URL_PREFIX + SONY_TV_IP + '/sony/system' ;
    req.open('POST', tv_url, true);
    req.setRequestHeader('Content-Type', 'text/xml; charset=UTF-8');
    req.timeout = 3000; // in milliseconds

    req.onreadystatechange = function() {
      if (req.readyState == 4) { // XMLHttpRequest.DONE
        if (req.status == 200) {
          // console.log('POST response received for: ' + command + ' ' + code);
          resolve(req.responseText);
        } else {
          const message = 'Failed to get TV info (Status '
            + req.status + '): ' + tv_url
            + ' (Response: "' + req.responseText + '")';
          console.error(message);
          reject(new Error(message));
        }
      }
    }

    const data = '{"method":"getRemoteControllerInfo","params":[],"id":10,"version":"1.0"}';
    req.send(data);
    console.log('Sent POST to get TV commands');
  });
}

// --------------------------------------------------------------------------------
// Maps each command to  IRCC code.  Use COMMAND_MAP[command] to access.
const COMMAND_MAP = {};
COMMAND_MAP['Num1'] = 'AAAAAQAAAAEAAAAAAw==';
COMMAND_MAP['Num2'] = 'AAAAAQAAAAEAAAABAw==';
COMMAND_MAP['Num3'] = 'AAAAAQAAAAEAAAACAw==';
COMMAND_MAP['Num4'] = 'AAAAAQAAAAEAAAADAw==';
COMMAND_MAP['Num5'] = 'AAAAAQAAAAEAAAAEAw==';
COMMAND_MAP['Num6'] = 'AAAAAQAAAAEAAAAFAw==';
COMMAND_MAP['Num7'] = 'AAAAAQAAAAEAAAAGAw==';
COMMAND_MAP['Num8'] = 'AAAAAQAAAAEAAAAHAw==';
COMMAND_MAP['Num9'] = 'AAAAAQAAAAEAAAAIAw==';
COMMAND_MAP['Num0'] = 'AAAAAQAAAAEAAAAJAw==';
COMMAND_MAP['Num11'] = 'AAAAAQAAAAEAAAAKAw==';
COMMAND_MAP['Num12'] = 'AAAAAQAAAAEAAAALAw==';
COMMAND_MAP['Enter'] = 'AAAAAQAAAAEAAAALAw==';
COMMAND_MAP['GGuide'] = 'AAAAAQAAAAEAAAAOAw==';
COMMAND_MAP['ChannelUp'] = 'AAAAAQAAAAEAAAAQAw==';
COMMAND_MAP['ChannelDown'] = 'AAAAAQAAAAEAAAARAw==';
COMMAND_MAP['VolumeUp'] = 'AAAAAQAAAAEAAAASAw==';
COMMAND_MAP['VolumeDown'] = 'AAAAAQAAAAEAAAATAw==';
COMMAND_MAP['Mute'] = 'AAAAAQAAAAEAAAAUAw==';
COMMAND_MAP['TvPower'] = 'AAAAAQAAAAEAAAAVAw==';
COMMAND_MAP['Audio'] = 'AAAAAQAAAAEAAAAXAw==';
COMMAND_MAP['MediaAudioTrack'] = 'AAAAAQAAAAEAAAAXAw==';
COMMAND_MAP['Tv'] = 'AAAAAQAAAAEAAAAkAw==';
COMMAND_MAP['Input'] = 'AAAAAQAAAAEAAAAlAw==';
COMMAND_MAP['TvInput'] = 'AAAAAQAAAAEAAAAlAw==';
COMMAND_MAP['TvAntennaCable'] = 'AAAAAQAAAAEAAAAqAw==';
COMMAND_MAP['WakeUp'] = 'AAAAAQAAAAEAAAAuAw==';
COMMAND_MAP['PowerOff'] = 'AAAAAQAAAAEAAAAvAw==';
COMMAND_MAP['Sleep'] = 'AAAAAQAAAAEAAAAvAw==';
COMMAND_MAP['Right'] = 'AAAAAQAAAAEAAAAzAw==';
COMMAND_MAP['Left'] = 'AAAAAQAAAAEAAAA0Aw==';
COMMAND_MAP['SleepTimer'] = 'AAAAAQAAAAEAAAA2Aw==';
COMMAND_MAP['Analog2'] = 'AAAAAQAAAAEAAAA4Aw==';
COMMAND_MAP['TvAnalog'] = 'AAAAAQAAAAEAAAA4Aw==';
COMMAND_MAP['Display'] = 'AAAAAQAAAAEAAAA6Aw==';
COMMAND_MAP['Jump'] = 'AAAAAQAAAAEAAAA7Aw==';
COMMAND_MAP['PicOff'] = 'AAAAAQAAAAEAAAA+Aw==';
COMMAND_MAP['PictureOff'] = 'AAAAAQAAAAEAAAA+Aw==';
COMMAND_MAP['Teletext'] = 'AAAAAQAAAAEAAAA/Aw==';
COMMAND_MAP['Video1'] = 'AAAAAQAAAAEAAABAAw==';
COMMAND_MAP['Video2'] = 'AAAAAQAAAAEAAABBAw==';
COMMAND_MAP['AnalogRgb1'] = 'AAAAAQAAAAEAAABDAw==';
COMMAND_MAP['Home'] = 'AAAAAQAAAAEAAABgAw==';
COMMAND_MAP['Exit'] = 'AAAAAQAAAAEAAABjAw==';
COMMAND_MAP['PictureMode'] = 'AAAAAQAAAAEAAABkAw==';
COMMAND_MAP['Confirm'] = 'AAAAAQAAAAEAAABlAw==';
COMMAND_MAP['Up'] = 'AAAAAQAAAAEAAAB0Aw==';
COMMAND_MAP['Down'] = 'AAAAAQAAAAEAAAB1Aw==';
COMMAND_MAP['ClosedCaption'] = 'AAAAAgAAAKQAAAAQAw==';
COMMAND_MAP['Component1'] = 'AAAAAgAAAKQAAAA2Aw==';
COMMAND_MAP['Component2'] = 'AAAAAgAAAKQAAAA3Aw==';
COMMAND_MAP['Wide'] = 'AAAAAgAAAKQAAAA9Aw==';
COMMAND_MAP['EPG'] = 'AAAAAgAAAKQAAABbAw==';
COMMAND_MAP['PAP'] = 'AAAAAgAAAKQAAAB3Aw==';
COMMAND_MAP['TenKey'] = 'AAAAAgAAAJcAAAAMAw==';
COMMAND_MAP['BSCS'] = 'AAAAAgAAAJcAAAAQAw==';
COMMAND_MAP['Ddata'] = 'AAAAAgAAAJcAAAAVAw==';
COMMAND_MAP['Stop'] = 'AAAAAgAAAJcAAAAYAw==';
COMMAND_MAP['Pause'] = 'AAAAAgAAAJcAAAAZAw==';
COMMAND_MAP['Play'] = 'AAAAAgAAAJcAAAAaAw==';
COMMAND_MAP['Rewind'] = 'AAAAAgAAAJcAAAAbAw==';
COMMAND_MAP['Forward'] = 'AAAAAgAAAJcAAAAcAw==';
COMMAND_MAP['DOT'] = 'AAAAAgAAAJcAAAAdAw==';
COMMAND_MAP['Rec'] = 'AAAAAgAAAJcAAAAgAw==';
COMMAND_MAP['Return'] = 'AAAAAgAAAJcAAAAjAw==';
COMMAND_MAP['Blue'] = 'AAAAAgAAAJcAAAAkAw==';
COMMAND_MAP['Red'] = 'AAAAAgAAAJcAAAAlAw==';
COMMAND_MAP['Green'] = 'AAAAAgAAAJcAAAAmAw==';
COMMAND_MAP['Yellow'] = 'AAAAAgAAAJcAAAAnAw==';
COMMAND_MAP['SubTitle'] = 'AAAAAgAAAJcAAAAoAw==';
COMMAND_MAP['CS'] = 'AAAAAgAAAJcAAAArAw==';
COMMAND_MAP['BS'] = 'AAAAAgAAAJcAAAAsAw==';
COMMAND_MAP['Digital'] = 'AAAAAgAAAJcAAAAyAw==';
COMMAND_MAP['Options'] = 'AAAAAgAAAJcAAAA2Aw==';
COMMAND_MAP['Media'] = 'AAAAAgAAAJcAAAA4Aw==';
COMMAND_MAP['Prev'] = 'AAAAAgAAAJcAAAA8Aw==';
COMMAND_MAP['Next'] = 'AAAAAgAAAJcAAAA9Aw==';
COMMAND_MAP['DpadCenter'] = 'AAAAAgAAAJcAAABKAw==';
COMMAND_MAP['CursorUp'] = 'AAAAAgAAAJcAAABPAw==';
COMMAND_MAP['CursorDown'] = 'AAAAAgAAAJcAAABQAw==';
COMMAND_MAP['CursorLeft'] = 'AAAAAgAAAJcAAABNAw==';
COMMAND_MAP['CursorRight'] = 'AAAAAgAAAJcAAABOAw==';
COMMAND_MAP['ShopRemoteControlForcedDynamic'] = 'AAAAAgAAAJcAAABqAw==';
COMMAND_MAP['FlashPlus'] = 'AAAAAgAAAJcAAAB4Aw==';
COMMAND_MAP['FlashMinus'] = 'AAAAAgAAAJcAAAB5Aw==';
COMMAND_MAP['AudioQualityMode'] = 'AAAAAgAAAJcAAAB7Aw==';
COMMAND_MAP['DemoMode'] = 'AAAAAgAAAJcAAAB8Aw==';
COMMAND_MAP['Analog'] = 'AAAAAgAAAHcAAAANAw==';
COMMAND_MAP['Mode3D'] = 'AAAAAgAAAHcAAABNAw==';
COMMAND_MAP['DigitalToggle'] = 'AAAAAgAAAHcAAABSAw==';
COMMAND_MAP['DemoSurround'] = 'AAAAAgAAAHcAAAB7Aw==';
COMMAND_MAP['*AD'] = 'AAAAAgAAABoAAAA7Aw==';
COMMAND_MAP['AudioMixUp'] = 'AAAAAgAAABoAAAA8Aw==';
COMMAND_MAP['AudioMixDown'] = 'AAAAAgAAABoAAAA9Aw==';
COMMAND_MAP['PhotoFrame'] = 'AAAAAgAAABoAAABVAw==';
COMMAND_MAP['Tv_Radio'] = 'AAAAAgAAABoAAABXAw==';
COMMAND_MAP['SyncMenu'] = 'AAAAAgAAABoAAABYAw==';
COMMAND_MAP['Hdmi1'] = 'AAAAAgAAABoAAABaAw==';
COMMAND_MAP['Hdmi2'] = 'AAAAAgAAABoAAABbAw==';
COMMAND_MAP['Hdmi3'] = 'AAAAAgAAABoAAABcAw==';
COMMAND_MAP['Hdmi4'] = 'AAAAAgAAABoAAABdAw==';
COMMAND_MAP['TopMenu'] = 'AAAAAgAAABoAAABgAw==';
COMMAND_MAP['PopUpMenu'] = 'AAAAAgAAABoAAABhAw==';
COMMAND_MAP['OneTouchTimeRec'] = 'AAAAAgAAABoAAABkAw==';
COMMAND_MAP['OneTouchView'] = 'AAAAAgAAABoAAABlAw==';
COMMAND_MAP['DUX'] = 'AAAAAgAAABoAAABzAw==';
COMMAND_MAP['FootballMode'] = 'AAAAAgAAABoAAAB2Aw==';
COMMAND_MAP['iManual'] = 'AAAAAgAAABoAAAB7Aw==';
COMMAND_MAP['Netflix'] = 'AAAAAgAAABoAAAB8Aw==';
COMMAND_MAP['Assists'] = 'AAAAAgAAAMQAAAA7Aw==';
COMMAND_MAP['ActionMenu'] = 'AAAAAgAAAMQAAABLAw==';
COMMAND_MAP['Help'] = 'AAAAAgAAAMQAAABNAw==';
COMMAND_MAP['TvSatellite'] = 'AAAAAgAAAMQAAABOAw==';
COMMAND_MAP['WirelessSubwoofer'] = 'AAAAAgAAAMQAAAB+Aw==';

function commandToCode(command) {
  // Return the IRCC code correspond to command. Returns undefined on failure.
  return COMMAND_MAP[command];
}

// --------------------------------------------------------------------------------

// sleep for time in milliseconds. Note that this will take much longer than
// wall clock time if the browser tab is put in background, since this counts
// time spent in this thread.
function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
// sleep Usage: sleep(500).then(() => { Do something after the sleep });

// --------------------------------------------------------------------------------
// Pops up the ID_POPUP_TEXT div. Assigns its text content to the message,
// if message is not null.
// Message is shown only if level <= MESSAGE_LEVEL.
// If msec provided and is >= 0, popup is removed after that many milliseconds.
// Only one popup is allowed at any time. And because we don't want the
// popup to wait for more than msec in wall clock time, we can't use
// the setTimeout function for that amount, but have to keep calling it
// until the elapsed time is as needed.
const POPUP_CHECK_PERIOD = 100; // msec, how often to check if timer has elapsed
var popupEndTime = 0;

function checkClearPopup() {
  const timeLeft = popupEndTime - Date.now();

  if (timeLeft <= 0) {
    POPUP_TEXT_ELEMENT.classList.add('hide');
  } else {
    const delay = Math.min(timeLeft, POPUP_CHECK_PERIOD);
    setTimeout(checkClearPopup, delay);
  }
}
function displayPopup(message, level, msec = -1) {
  // console.log('Display Message: ', message, msec);
  if (level > MESSAGE_LEVEL) {
    return;
  }
  if (message != null) {
    POPUP_TEXT_ELEMENT.textContent = message;
  }
  // Because we can't (easily) do both fade-in on start and fade-out on end,
  // stick to doing a fade-out after the times, looks nicer that way.
  // This means we need to remove the hide class on start, and add it again
  // when done. Also need to remove the initial class added to hide visibility
  // on page load. [hide-initial is never added again]
  POPUP_TEXT_ELEMENT.classList.remove('hide', 'hide-initial');
  if (msec >= 0) {
    popupEndTime = Date.now() + msec;
    const delay = Math.min(msec, POPUP_CHECK_PERIOD);
    setTimeout(checkClearPopup, delay);
  } else {
    // Nothing to do. Note that popup is never cleared, so caller
    // is expected to call displayPopup again with a valid msec value.
  }
}

// --------------------------------------------------------------------------------
// Given a channel number, return a array of TV commands to enter that channel
// Returns null if not a channel number.
// Valid channels are digits and dots: 2 or 2.1 or 56.5 etc
function channelToCommands(number) {
  if (!CHANNEL_RE.test(number)) {
    return null;
  }
  const commands = [];
  for (let c of number) {
    let command = '';
    if (c >= '0' && c <= '9') {
      command = 'Num' + c;
    } else if (c == '.') {
      command = 'DOT';
    } else {
      console.log('Unexpected error: invalid channel character ' + c + ' for ' + number);
      return null;
    }
    commands.push(command);
  }
  // console.log('Channel ' + number + ' is ' + commands);
  return commands;
}

// --------------------------------------------------------------------------------
// Given a array of commands, send the appropriate sequence to the TV
// A command may be code word or a channel number
function sendCommands(inputCommands) {
  // Create a flat list of all commands to be sent for this button
  const allCommands = [];
  for (let command of inputCommands) {
    // command may be a single TV command or a channel number
    const channelCommands = channelToCommands(command);
    const commands = channelCommands || [command];
    Array.prototype.push.apply(allCommands, commands);
  }

  // For feedback, display codes as they are sent
  let message = 'Sent:'; // Used by then() closure below

  displayPopup(message, LEVEL_INFO); // will clear this on command completion

  // Chain the sending of the commands through the async HTTP request calls,
  // and insert a short delay after each command.
  // Reduce all commands to a single Promise. 
  allCommands.reduce((sequence, command) => {
    return sequence
      .then(() => {
        message += ' ' + command;
        console.log(`Send Command '${command}' Code '${COMMAND_MAP[command]}'`);
        displayPopup(message, LEVEL_INFO);
        return sendCommand(command);
      }).then(() => {
        // After the TV HTTP request has responded, wait a bit more
        // to allow TV some time to complete command.
        return sleep(WAIT_AFTER_COMMAND);
      });
  }, Promise.resolve()) // Start the reduce with an resolved promise
    .then(() => { // All commands completed
      displayPopup(null, LEVEL_INFO, STATUS_MESSAGE_TIME); // now clear the message
    }).catch((err) => {
      // This will come here if any of the tasks above rejects or throws Error
      displayPopup(err.message, LEVEL_ERROR, ERROR_MESSAGE_TIME);
    });
}

// --------------------------------------------------------------------------------
// Return the array of commands based on the button
// While each button usually has a single command, it can be a sequence of
// commands separated by space. Commands may be TV commands or channel numbers.
function buttonToCommands(button) {
  // HTML attribute: data-stv.commands="command [command ...]"
  const buttonCommand = button.dataset[DATASET_COMMANDS];
  return buttonCommand ? buttonCommand.split(WHITESPACE_RE) : undefined;
}

// --------------------------------------------------------------------------------
// Button click listener that executes the remote command or commands
// this object here is a DOM object with dataset[DATASET_COMMANDS]
function handleClick(e) {
  e.preventDefault();
  // command may be one or more commands (keys of the COMMAND_MAP) separated by space
  const buttonCommands = buttonToCommands(this);
  sendCommands(buttonCommands);
}

// --------------------------------------------------------------------------------
// Connect all buttons (class tv-command) to the command click handler.
function setupButtonsOnclick() {
  const buttons = document.getElementsByClassName(CLASS_TV_COMMAND);
  for (let button of buttons) {
    // HTML attribute: data-stv.commands="command [command ...]"
    // Only handles buttons with that attribute
    const buttonCommands = buttonToCommands(button);
    if (buttonCommands) {
      button.onclick = handleClick;
    }
  }
}

// --------------------------------------------------------------------------------
// Send command from form text input box
function textCommand(e) {
  e.preventDefault();
  const text = document.getElementById(ID_TV_TEXT_COMMAND).value;
  const commands = text.split(WHITESPACE_RE);
  sendCommands(commands);
}

// --------------------------------------------------------------------------------
// Create DOM button elements for the quick access commands or channels.
// Format of each button is command-or-channel-number : button-name\n
function createChannelButtons(commandsString) {
  if (!commandsString) {
    console.log('Skipping custom buttons creation - string is empty');
    return;
  }
  const commands = commandsString.split(NEWLINE_RE);
  const oldChannelsDiv = document.getElementById(ID_CHANNEL_NUMBERS);

  // remove existing channel buttons - child nodes of oldChannelsDiv
  const newParentDiv = oldChannelsDiv.cloneNode(false);
  oldChannelsDiv.parentNode.replaceChild(newParentDiv, oldChannelsDiv);

  // add all the new channels
  for (let commandAndName of commands) {
    const commandAndNameV = commandAndName.split(COMMAND_AND_NAME_RE);
    const command = commandAndNameV[0].trim();
    if (!command) continue;
    const name = (commandAndNameV.length > 1 ? commandAndNameV[1].trim() : command);

    /* Example div to create for channel 2.1:
    <div class="columns" id="tv-channel-numbers">
      <div class="one-fourth-item">
        <button type="button" class="tv-command" data-stv.commands="2.1">2.1</button>
      </div>
      ...
    */
    const newItem = document.createElement('div');
    newItem.setAttribute('class', 'one-fourth-item'); // 4 buttons per row

    const newButton = document.createElement('button');
    newButton.appendChild(document.createTextNode(name));
    newButton.setAttribute('class', 'tv-command');
    newButton.setAttribute('type', 'button');
    newButton.setAttribute('data-' + DATASET_COMMANDS, command);
    newItem.appendChild(newButton);

    // add the newly created row element and its content into the DOM 
    newParentDiv.appendChild(newItem);
    // console.log('Adding child ', newRow);
  }

  // Connect all buttons to the click handler
  setupButtonsOnclick();
}

// --------------------------------------------------------------------------------
/* Web page onLoad init function. Attach listeners */

function onLoadFunction() {

  // TV Setup load and save. Loads IP address/key from local storage,
  // and creates all remote control buttons and sets up their onclick handler.
  restoreTVSetup();

  document.getElementById(ID_TV_SETUP).addEventListener('submit', saveTVSetup);
  document.getElementById(ID_TV_COMMAND_INPUT).addEventListener('submit',
    textCommand);

  POPUP_TEXT_ELEMENT = document.getElementById(ID_POPUP_TEXT);

  // Tabs setup
  const tabLinks = document.getElementsByClassName(CLASS_TAB_LINK);
  for (let i = 0; i < tabLinks.length; i++) {
    const tabLink = tabLinks[i];
    tabLink.onclick = () => {
      openTab(tabLink);
    }
  }

  // Open up appropriate tab, close other tabs.
  if (!SONY_TV_IP || !SONY_TV_PRESHARED_KEY) {
    openTab(document.getElementById('tab-setup-link'));
  } else {
    openTab(document.getElementById('tab-buttons-link'));
  }

  // Help page has a button to query TV for list of IRCC codes it knows about
  const controller = document.getElementById('controller-info-button');
  const controllerOutput = document.getElementById('controller-info-output');
  if (controller && controllerOutput) {
    controller.onclick = () => {
      getRemoteControllerInfo().then((responseText) => {
        controllerOutput.textContent = responseText;
      }).catch((err) => {
        displayPopup(err.message, LEVEL_ERROR, ERROR_MESSAGE_TIME);
      });
    }
  }

  // Help page has a version field, fill it in.
  if (typeof browser != 'undefined') {
    // Only do this if we are running as an extension, and not loading
    // this script on its own (for local web display testing, for example).
    const manifest = browser.runtime.getManifest();
    const element = document.getElementById('about-version');
    element.textContent = manifest.version;
  }
}

// --------------------------------------------------------------------------------
// Save and restore setup options.
// This used to use web extension storage functions browser.storage.local
// but now uses simpler localStorage since we don't need to communicate
// between background and content script pages (don't plan on using
// Add-On options for these settings).
function saveTVSetup(e) {
  e.preventDefault();
  const IP = document.getElementById(ID_TV_IP).value;
  const key = document.getElementById(ID_TV_KEY).value;
  let message = 'Data saved locally.';
  // Save whatever value user has entered - even if it is empty
  // to allow for clearing of stored values.
  localStorage.setItem(STORE_TV_IP, IP);
  localStorage.setItem(STORE_TV_KEY, key);
  const channelsString = document.getElementById(ID_MAKE_CUSTOM_BUTTONS).value;
  localStorage.setItem(STORE_CHANNEL_BUTTONS, channelsString);

  displayPopup(message, LEVEL_FEEDBACK, STATUS_MESSAGE_TIME);

  // Load the data into required fields on the web page
  restoreTVSetup();
}

// Load up the IP address and key from local storage
// Fills in values into the global variables for use by the web page buttons
function restoreTVSetup() {
  SONY_TV_IP = localStorage.getItem(STORE_TV_IP);
  SONY_TV_PRESHARED_KEY = localStorage.getItem(STORE_TV_KEY);
  const channelsString = localStorage.getItem(STORE_CHANNEL_BUTTONS) ||
    DEFAULT_COMMAND_BUTTONS;

  document.getElementById(ID_TV_IP).value = SONY_TV_IP;
  document.getElementById(ID_TV_KEY).value = SONY_TV_PRESHARED_KEY;
  document.getElementById(ID_MAKE_CUSTOM_BUTTONS).value = channelsString;

  // Create page elements - quick access channel buttons
  createChannelButtons(channelsString);
}

// --------------------------------------------------------------------------------
// Tabs support
function openTab(tabLink) {
  for (let e of document.getElementsByClassName(CLASS_TAB_CONTENT)) {
    e.style.display = 'none';
  }
  const activeTab = document.getElementById(tabLink.id.replace('-link', '-content'));
  activeTab.style.display = 'block';
  const replaceClass = ' ' + CSS_TAB_LINK_ACTIVE;
  for (let e of document.getElementsByClassName(CLASS_TAB_LINK)) {
    e.className = e.className.replace(replaceClass, '');
  }
  tabLink.className += replaceClass;
  window.scrollTo(0, 0); // Jump to top of page
}

// --------------------------------------------------------------------------------
// Web page init setup
window.onload = onLoadFunction;
