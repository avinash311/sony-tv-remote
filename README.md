# sony-tv-remote
Sony TV Web Page Remote Control

## Web Page based Sony Remote Control

This is a web page based Sony TV Remote Control.

It can be used online, installed locally, or installed as a web extension.

It provides quick access to some often used commands such as Muting, entering all the digits to change a channel number using a single click, and any user-defined custom command sequence.

The web page has a setup that allows for creating custom buttons to send your own commands to the TV, and it comes bundled with some fixed commands (such as Mute, Volume Up and Down, Power On/Off, etc).

It can be used on any device that can access both the web remote control page and the TV to be controlled.
On smartphones (or desktop too), it is also possible to create a Home Screen shortcut to the web page which allows for quick access to the remote control.

Sony does provide a smartphone app with similar controls and far more capability, but it is very slow to startup and has too many additional features that make it more complex to use.
And it has no quick way to enter a channel number - entering 38.1 requires clicking on four buttons (or more) instead of just one button using this tool.

For more information and screenshots of the extension web page, visit the home page
which also has a link to an online working version of this web page Sony remote control.

### Home Page: <a href="http://www.aczoom.com/tech/sony-tv-remote/">ACZoom.com/tech/sony-tv-remote/</a>

The home page link contains some more information as well as a link to the actual working Sony TV Remote control page.

## How it works

Sony Bravia TVs (2016 or later, some earlier ones too) support IRCC control (infrared-like-control-commands).

These can be sent to the TV over HTTP using a POST web request.

Sony TVs also offer a way to provide security by defining a Pre-Shared Key
on the TV which has to be provided in the POST request header.

That is the basic mechanism used by this web page Javascript code.

The Sony TVs also send correct cross-origin resource sharing (CORS) headers, which allows this web page Javascript to send a POST message to the TV.

### Use as a web page

This is the easiest way to use this tool.
The link to the online web page is provided on the home page:
<a href="http://www.aczoom.com/tech/sony-tv-remote/">ACZoom.com/tech/sony-tv-remote/</a>

If necessary, this package can be installed locally or any other web server. And the HTML and Javascript can be customized - for example, enter the Setup information in the Javascript code so there is no need for your users to enter the Setup tab.
Since your TV is only accessible from your home network (most likely!) and you control access to your home network, it may be perfectly fine to harcode your TV information onto your custom web pages.
This will make it easier for people in your household to access these remote control buttons on any device with a web browser.

### Use as Web Extension

This is only provided for TVs that do not send the correct CORS headers.
(At least the Sony TV I tested and from other reports on the web, it seems that all Sony TVs do send CORS headers, so using this as a web extension may not be necessary).

The web extension explicitly asks for Javascript permission to send web requests to other domains, which allows this web page to send a HTTP message to a TV on a local network.

Firefox Add-on (Web Extension) is available at the Firefox pages: <a href="https://addons.mozilla.org/en-US/firefox/addon/sony-tv-web-page-remote/">Firefox Add-on Sony TV Web Page Remote</a>.

## Technical Details

### Javascript security

This Javascript code needs the TV to support cross-origin HTTP requests, which
the Sony Bravia TVs (at least some of them, if not all) do support.
This is necessary since the Web Page Remote control is on a different IP address
from the TV, therefore without CORS (cross-origin resource sharing) support,
the same-origin policy of Javascript will reject the request to send a command
to the TV.

Just for reference, here are the HTTP headers actually seen on a computer
loading this Sony TV Web Remote page:

    Sent to TV when loading this page from the online page at
        http://www.aczoom.com/..../sony-tv.html page:
      Access-Control-Request-Method: POST
      Origin: null
      Origin: http://www.aczoom.com\r\n
    Get this in response:
      HTTP/1.1 200 OK
      Access-Control-Allow-Origin: http://www.aczoom.com\r\n
      Access-Control-Allow-Credentials: true

    Sent to TV when loading this page locally as a file://..../sony-tv.html page:
      Origin: null
    Get this in response:
      Access-Control-Allow-Origin: null

    Sent to TV when loading from a local web server as http://10.0.0.29/.../sony-tv.html page:
      Origin: http://10.0.0.29
    Get this in response:
      Access-Control-Allow-Origin: http://10.0.0.29

This means the Sony TV is correctly configured to send the CORS header, which for a Apache
web server means enabling <code>Access-Control-Allow-Origin "<nowiki>*</nowiki>"</code>.
If you are using a Sony TV without CORS setup, then the Web Extension is necessary and that will work.
It uses Web Extension permissions to handle the Javascript same-origin policy.

# No email support

Please note that there is no technical help available for this code. This may be useful only for developers already familiar with Javascript, HTML, CSS and related tools.

If you do find a bug or have a feature request, feel free to file it at the
<a href="https://github.com/avinash311/sony-tv-remote/issues">(GitHub aczoom) Sony TV Remote issues</a> page.
