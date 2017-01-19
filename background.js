/*
     Sony TV Remote using a web page.
     This is the script that runs in the background of the web extension.

     Since the controls have to send a Javascript request to a different IP
     address, it runs afoul of cross-domain restrictions (XHR).
     Therefore this page is loaded using a Web Extension which needs to be
     installed manually by the end-user.

     Requires Javascript 2016.
*/

/* Open a new tab, and load "my-page.html" into it.  */
function openMyPage() {
  console.log("injecting");
  browser.tabs.create({
    "url": "/sony-tv.html"
  });
}

/* Add openMyPage() as a listener to clicks on the browser action. */
browser.browserAction.onClicked.addListener(openMyPage);

/* TODO: context menu item creation ----------------------------

function onCreated() {
  if (browser.runtime.lastError) {
    console.log("error creating item:" + browser.runtime.lastError);
  } else {
    console.log("item created successfully");
  }
}

browser.contextMenus.create({
  id: "mute-tv",
  title: "Mute Sony TV",
  contexts: ["all"],
}, onCreated);

browser.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId == "mute-tv") {
    // TODO: Need to share code if this is to work.
    // sendCode(commandToCode("Mute"));
  }
});
------------------------------------------------------------ */
