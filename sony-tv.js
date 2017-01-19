/*
     Sony TV Web Page Remote
     Uses Sony Bravia TV IRCC (IR like control commands) sent using HTTP POST.

     This script runs along with a web page that displays all the commands
     to send.
     Since this has to send a Javascript request to a different IP address,
     it runs afoul of cross-domain restrictions. Therefore this page
     is loaded using a Web Extension which needs to be installed manually
     by the end-user.

     Requires Javascript ES2015 (ES6). Works with most browsers in 2017.

     There are a number of similar tools available - from command line
     scripts to server side Javascript. Use a web search such as "Sony
     TV IRCC" to find references. Example:
     http://www.openremote.org/display/forums/Sony+TV+HTTP+control?focusedCommentId=23601972#comment-23601972
*/

'use strict';

// --------------------------------------------------------------------------------

let SONY_TV_IP = ''; // updated from local storage
let SONY_TV_PRESHARED_KEY = '';

const SONY_TV_URL_PREFIX = 'http://';
const SONY_TV_URL_SUFFIX = '/sony/IRCC';
// Construct the URL as: SONY_TV_URL_PREFIX + SONY_TV_IP + SONY_TV_URL_SUFFIX

// All the web page DOM class names and ids.
const CLASS_TV_COMMAND = 'tv-command';
const ID_TV_SETUP = 'tv-setup'; // form ID to save TV IP and Key
const ID_TV_IP = 'tv-ip-address'; // ID of field that shows/updates TV IP
const ID_TV_KEY = 'tv-key'; // ID of field that shows/updates TV Pre-Shared Key
const CLASS_TAB_CONTENT = 'tab-content'; // each tab content div (buttons, etc)
const CLASS_TAB_LINK = 'tab-link'; // navigation bar for the tabs
const CSS_TAB_LINK_ACTIVE = 'tab-color-active';  // css of active tab link

// When sending a sequence of codes, such as for a channel number:
// Num3 Num8 DOT Num1 (38.1), or arrow sequences Wide Up Up
// it is necessary to wait a short while before sending the async requests.
// This defines the delay - wait at least this much (may wait a bit less)
// between the codes. Set this to 0 avoid any extra delays between sending codes.
// Note: some of the command sequences - such as Wide display command - need a
// long delay, 500ms seems to work, 300ms causes Up Up ... keys to be skipped.
const DELAY_SEQUENCE = 700; // milliseconds to wait between sending codes.

// --------------------------------------------------------------------------------
// Send the IRCCCode code to the TV using a POST web request.
function sendCode(code) {
  if (SONY_TV_IP == '' || SONY_TV_PRESHARED_KEY == '') {
    console.error('Error: No Sony TV IP or PreShared Key setup yet.');
    return;
  }
  const req = new XMLHttpRequest();
  const tv_url = SONY_TV_URL_PREFIX + SONY_TV_IP + SONY_TV_URL_SUFFIX;
  // Making a async xmlhttprequest, this seems to work fine even when sending
  // a list of commands, one after the other. If this turns out to cause
  // problems at the TV receiving too many codes, would be fine to change
  // this to a synchronous call and use a WebWorker thread to send
  // lists of codes.
  req.open('POST', tv_url, true);

  req.onreadystatechange = function() {
    if (req.readyState == 4) { // XMLHttpRequest.DONE
      if (req.status !== 200) {
        // Safety: JSON.parse does not evaluate the attacker's scripts.
        // const cleanedResponse = JSON.parse(req.responseText);
        console.warn('Failed: ', tv_url, ' Key: ', SONY_TV_PRESHARED_KEY);
        console.warn('Failed: Got status from req: ', req.status);
        console.warn('Failed: Got responseText from req: ', req.responseText);
      }
    }
  }

  req.setRequestHeader('Content-Type', 'text/xml; charset=UTF-8');
  // Note: The SOAPAction header value must be enclosed in " otherwise get
  // an Invalid Action error from TV!
  req.setRequestHeader('SOAPAction', '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"');
  req.setRequestHeader('X-Auth-PSK', SONY_TV_PRESHARED_KEY);
  const data = `<?xml version="1.0"?>
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
}

// --------------------------------------------------------------------------------
// Maps each command to  IRCC code.  Use COMMAND_MAP[command] to access.
const COMMAND_MAP = {};
COMMAND_MAP['Num1']='AAAAAQAAAAEAAAAAAw=='
COMMAND_MAP['Num2']='AAAAAQAAAAEAAAABAw=='
COMMAND_MAP['Num3']='AAAAAQAAAAEAAAACAw=='
COMMAND_MAP['Num4']='AAAAAQAAAAEAAAADAw=='
COMMAND_MAP['Num5']='AAAAAQAAAAEAAAAEAw=='
COMMAND_MAP['Num6']='AAAAAQAAAAEAAAAFAw=='
COMMAND_MAP['Num7']='AAAAAQAAAAEAAAAGAw=='
COMMAND_MAP['Num8']='AAAAAQAAAAEAAAAHAw=='
COMMAND_MAP['Num9']='AAAAAQAAAAEAAAAIAw=='
COMMAND_MAP['Num0']='AAAAAQAAAAEAAAAJAw=='
COMMAND_MAP['Num11']='AAAAAQAAAAEAAAAKAw=='
COMMAND_MAP['Num12']='AAAAAQAAAAEAAAALAw=='
COMMAND_MAP['Enter']='AAAAAQAAAAEAAAALAw=='
COMMAND_MAP['GGuide']='AAAAAQAAAAEAAAAOAw=='
COMMAND_MAP['ChannelUp']='AAAAAQAAAAEAAAAQAw=='
COMMAND_MAP['ChannelDown']='AAAAAQAAAAEAAAARAw=='
COMMAND_MAP['VolumeUp']='AAAAAQAAAAEAAAASAw=='
COMMAND_MAP['VolumeDown']='AAAAAQAAAAEAAAATAw=='
COMMAND_MAP['Mute']='AAAAAQAAAAEAAAAUAw=='
COMMAND_MAP['TvPower']='AAAAAQAAAAEAAAAVAw=='
COMMAND_MAP['Audio']='AAAAAQAAAAEAAAAXAw=='
COMMAND_MAP['MediaAudioTrack']='AAAAAQAAAAEAAAAXAw=='
COMMAND_MAP['Tv']='AAAAAQAAAAEAAAAkAw=='
COMMAND_MAP['Input']='AAAAAQAAAAEAAAAlAw=='
COMMAND_MAP['TvInput']='AAAAAQAAAAEAAAAlAw=='
COMMAND_MAP['TvAntennaCable']='AAAAAQAAAAEAAAAqAw=='
COMMAND_MAP['WakeUp']='AAAAAQAAAAEAAAAuAw=='
COMMAND_MAP['PowerOff']='AAAAAQAAAAEAAAAvAw=='
COMMAND_MAP['Sleep']='AAAAAQAAAAEAAAAvAw=='
COMMAND_MAP['Right']='AAAAAQAAAAEAAAAzAw=='
COMMAND_MAP['Left']='AAAAAQAAAAEAAAA0Aw=='
COMMAND_MAP['SleepTimer']='AAAAAQAAAAEAAAA2Aw=='
COMMAND_MAP['Analog2']='AAAAAQAAAAEAAAA4Aw=='
COMMAND_MAP['TvAnalog']='AAAAAQAAAAEAAAA4Aw=='
COMMAND_MAP['Display']='AAAAAQAAAAEAAAA6Aw=='
COMMAND_MAP['Jump']='AAAAAQAAAAEAAAA7Aw=='
COMMAND_MAP['PicOff']='AAAAAQAAAAEAAAA+Aw=='
COMMAND_MAP['PictureOff']='AAAAAQAAAAEAAAA+Aw=='
COMMAND_MAP['Teletext']='AAAAAQAAAAEAAAA/Aw=='
COMMAND_MAP['Video1']='AAAAAQAAAAEAAABAAw=='
COMMAND_MAP['Video2']='AAAAAQAAAAEAAABBAw=='
COMMAND_MAP['AnalogRgb1']='AAAAAQAAAAEAAABDAw=='
COMMAND_MAP['Home']='AAAAAQAAAAEAAABgAw=='
COMMAND_MAP['Exit']='AAAAAQAAAAEAAABjAw=='
COMMAND_MAP['PictureMode']='AAAAAQAAAAEAAABkAw=='
COMMAND_MAP['Confirm']='AAAAAQAAAAEAAABlAw=='
COMMAND_MAP['Up']='AAAAAQAAAAEAAAB0Aw=='
COMMAND_MAP['Down']='AAAAAQAAAAEAAAB1Aw=='
COMMAND_MAP['ClosedCaption']='AAAAAgAAAKQAAAAQAw=='
COMMAND_MAP['Component1']='AAAAAgAAAKQAAAA2Aw=='
COMMAND_MAP['Component2']='AAAAAgAAAKQAAAA3Aw=='
COMMAND_MAP['Wide']='AAAAAgAAAKQAAAA9Aw=='
COMMAND_MAP['EPG']='AAAAAgAAAKQAAABbAw=='
COMMAND_MAP['PAP']='AAAAAgAAAKQAAAB3Aw=='
COMMAND_MAP['TenKey']='AAAAAgAAAJcAAAAMAw=='
COMMAND_MAP['BSCS']='AAAAAgAAAJcAAAAQAw=='
COMMAND_MAP['Ddata']='AAAAAgAAAJcAAAAVAw=='
COMMAND_MAP['Stop']='AAAAAgAAAJcAAAAYAw=='
COMMAND_MAP['Pause']='AAAAAgAAAJcAAAAZAw=='
COMMAND_MAP['Play']='AAAAAgAAAJcAAAAaAw=='
COMMAND_MAP['Rewind']='AAAAAgAAAJcAAAAbAw=='
COMMAND_MAP['Forward']='AAAAAgAAAJcAAAAcAw=='
COMMAND_MAP['DOT']='AAAAAgAAAJcAAAAdAw=='
COMMAND_MAP['Rec']='AAAAAgAAAJcAAAAgAw=='
COMMAND_MAP['Return']='AAAAAgAAAJcAAAAjAw=='
COMMAND_MAP['Blue']='AAAAAgAAAJcAAAAkAw=='
COMMAND_MAP['Red']='AAAAAgAAAJcAAAAlAw=='
COMMAND_MAP['Green']='AAAAAgAAAJcAAAAmAw=='
COMMAND_MAP['Yellow']='AAAAAgAAAJcAAAAnAw=='
COMMAND_MAP['SubTitle']='AAAAAgAAAJcAAAAoAw=='
COMMAND_MAP['CS']='AAAAAgAAAJcAAAArAw=='
COMMAND_MAP['BS']='AAAAAgAAAJcAAAAsAw=='
COMMAND_MAP['Digital']='AAAAAgAAAJcAAAAyAw=='
COMMAND_MAP['Options']='AAAAAgAAAJcAAAA2Aw=='
COMMAND_MAP['Media']='AAAAAgAAAJcAAAA4Aw=='
COMMAND_MAP['Prev']='AAAAAgAAAJcAAAA8Aw=='
COMMAND_MAP['Next']='AAAAAgAAAJcAAAA9Aw=='
COMMAND_MAP['DpadCenter']='AAAAAgAAAJcAAABKAw=='
COMMAND_MAP['CursorUp']='AAAAAgAAAJcAAABPAw=='
COMMAND_MAP['CursorDown']='AAAAAgAAAJcAAABQAw=='
COMMAND_MAP['CursorLeft']='AAAAAgAAAJcAAABNAw=='
COMMAND_MAP['CursorRight']='AAAAAgAAAJcAAABOAw=='
COMMAND_MAP['ShopRemoteControlForcedDynamic']='AAAAAgAAAJcAAABqAw=='
COMMAND_MAP['FlashPlus']='AAAAAgAAAJcAAAB4Aw=='
COMMAND_MAP['FlashMinus']='AAAAAgAAAJcAAAB5Aw=='
COMMAND_MAP['AudioQualityMode']='AAAAAgAAAJcAAAB7Aw=='
COMMAND_MAP['DemoMode']='AAAAAgAAAJcAAAB8Aw=='
COMMAND_MAP['Analog']='AAAAAgAAAHcAAAANAw=='
COMMAND_MAP['Mode3D']='AAAAAgAAAHcAAABNAw=='
COMMAND_MAP['DigitalToggle']='AAAAAgAAAHcAAABSAw=='
COMMAND_MAP['DemoSurround']='AAAAAgAAAHcAAAB7Aw=='
COMMAND_MAP['*AD']='AAAAAgAAABoAAAA7Aw=='
COMMAND_MAP['AudioMixUp']='AAAAAgAAABoAAAA8Aw=='
COMMAND_MAP['AudioMixDown']='AAAAAgAAABoAAAA9Aw=='
COMMAND_MAP['PhotoFrame']='AAAAAgAAABoAAABVAw=='
COMMAND_MAP['Tv_Radio']='AAAAAgAAABoAAABXAw=='
COMMAND_MAP['SyncMenu']='AAAAAgAAABoAAABYAw=='
COMMAND_MAP['Hdmi1']='AAAAAgAAABoAAABaAw=='
COMMAND_MAP['Hdmi2']='AAAAAgAAABoAAABbAw=='
COMMAND_MAP['Hdmi3']='AAAAAgAAABoAAABcAw=='
COMMAND_MAP['Hdmi4']='AAAAAgAAABoAAABdAw=='
COMMAND_MAP['TopMenu']='AAAAAgAAABoAAABgAw=='
COMMAND_MAP['PopUpMenu']='AAAAAgAAABoAAABhAw=='
COMMAND_MAP['OneTouchTimeRec']='AAAAAgAAABoAAABkAw=='
COMMAND_MAP['OneTouchView']='AAAAAgAAABoAAABlAw=='
COMMAND_MAP['DUX']='AAAAAgAAABoAAABzAw=='
COMMAND_MAP['FootballMode']='AAAAAgAAABoAAAB2Aw=='
COMMAND_MAP['iManual']='AAAAAgAAABoAAAB7Aw=='
COMMAND_MAP['Netflix']='AAAAAgAAABoAAAB8Aw=='
COMMAND_MAP['Assists']='AAAAAgAAAMQAAAA7Aw=='
COMMAND_MAP['ActionMenu']='AAAAAgAAAMQAAABLAw=='
COMMAND_MAP['Help']='AAAAAgAAAMQAAABNAw=='
COMMAND_MAP['TvSatellite']='AAAAAgAAAMQAAABOAw=='
COMMAND_MAP['WirelessSubwoofer']='AAAAAgAAAMQAAAB+Aw=='

function commandToCode(command) {
  // Return the IRCC code correspond to command. Returns undefined on failure.
  return COMMAND_MAP[command];
}

// --------------------------------------------------------------------------------

// sleep for time in milliseconds
function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
// sleep Usage: sleep(500).then(() => { Do something after the sleep });

// Given a channel number, return a array of TV commands to enter that channel
// Returns null if not a channel number.
// Valid channels are digits and dots: 2 or 2.1 or 56.5 etc
const CHANNEL_RE = /^([0-9]+\.[0-9]+|[0-9]+)$/;
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
  console.log('Channel ' + number + ' is ' + commands);
  return commands;
}

// Return the array of commands based on the button
// While each button usually has a single command, it can be a sequence of
// commands separated by space. Commands may be TV commands or channel numbers.
function buttonToCommands(button) {
  const re = /\s+/;
  // HTML attribute: data-stv:commands="command [command ...]"
  const buttonCommand = button.dataset['stv:commands'];
  return buttonCommand.split(re);
}

// Button click listener that executes the remote command or commands
// this object here is a DOM object with dataset['stv:commands']
function handleClick(e) {
  e.preventDefault();
  // command may be one or more commands (keys of the COMMAND_MAP) separated by space
  const codes = [];
  const buttonCommands = buttonToCommands(this);

  let i = 0; // TV code number send index
  for (let bCommand of buttonCommands) {
    // bCommand may be a single TV command or a channel number
    const channelCommands = channelToCommands(bCommand);
    const commands = channelCommands || [ bCommand ];

    for (let command of commands) {
      const code = commandToCode(command);
      const delay = i * DELAY_SEQUENCE;

      console.log(`Send at ${delay}ms: Command '${command}' Code '${code}'`);

      // To avoid sending too many commands too fast,
      // wait here for a while in between sending codes.
      // 0th code gets a 0 delay.
      sleep(delay).then(() => {
        // Send the code to the TV using XMLHttpRequest
        sendCode(code);
      });

      i++; // increment this for next code to be sent
    }
  }
}

/* Web page init function. Attach listeners */

function init() {
  // Connect all buttons to the command click handler.
  const buttons = document.getElementsByClassName(CLASS_TV_COMMAND);
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    button.onclick = handleClick;
  }

  // TV Setup load and save
  restoreTVSetup(); // load IP address/key from local storage
  document.getElementById(ID_TV_SETUP).addEventListener('submit', saveTVSetup);

  // Tabs setup
  const tabLinks = document.getElementsByClassName(CLASS_TAB_LINK);
  for (let i = 0; i < tabLinks.length; i++) {
    const tabLink = tabLinks[i];
    tabLink.onclick = () => {
      openTab(tabLink);
    }
  }
  openTab(document.getElementById('tab-buttons-link'));
}

function saveTVSetup(e) {
  e.preventDefault();
  const IP = document.getElementById(ID_TV_IP).value;
  const key = document.getElementById(ID_TV_KEY).value;
  if (IP == '' || key == '') {
    console.error('Empty IP or Key, skipped and not stored');
  } else {
    browser.storage.local.set({
      SonyTVIP: IP,
      SonyTVPreSharedKey: key
    });
  }

  // Load the data into required fields
  restoreTVSetup();
}

/* Load up the IP address and key that is saved by options page onto local storage */
/* Fills in values into the global variables for use by the web page buttons */
function restoreTVSetup() {
  if (typeof browser === 'undefined') {
    // During debugging, seems to come here sometimes.
    return;
  }

  const getIP = browser.storage.local.get('SonyTVIP');
  const getKey = browser.storage.local.get('SonyTVPreSharedKey');
  getIP.then((result) => {
    SONY_TV_IP = result.SonyTVIP;
    document.getElementById(ID_TV_IP).value = result.SonyTVIP;
  });
  getKey.then((result) => {
    SONY_TV_PRESHARED_KEY = result.SonyTVPreSharedKey;
    document.getElementById(ID_TV_KEY).value = result.SonyTVPreSharedKey;
  });
}

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
}

/* Web page init setup */
window.onload = init;
