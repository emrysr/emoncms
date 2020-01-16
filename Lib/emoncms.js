/*
  All Emoncms code is released under the GNU Affero General Public License.
  See COPYRIGHT.txt and LICENSE.txt.

  ---------------------------------------------------------------------
  Emoncms - open source energy visualisation
  Part of the OpenEnergyMonitor project:
  http://openenergymonitor.org
*/
//
// THIS IS LOADED IN <head> - DO NOT ADD SCRIPTS THAT WOULD BLOCK THE "time to first print"
// ---------------------------------------------------------------------------------------
"use strict";

var _SETTINGS = {
    showErrors: true // false to allow errors to be handled by browser developer console
}

/**
 * POLYFILLS
 * document.currentScript
 *  - polyfill for IE browsers
 * works by getting the last <script> in the document
 * each <script> is loaded in order so this <script> would always be the last one in the parent <html>
 */
if(!document.currentScript) {
    document.currentScript = (function () { 
        var scripts = document.getElementsByTagName("script");
        return scripts[scripts.length - 1];
    }());
}
/**
 * Set the passed path as a constant that cannot be changed by other scripts
 * reads the [data-path] param of the <script> tag loading this file.
 * works by current filename if no [data-path] given
 * 
 * ## "Self-Executing Anonymous Functions" will not add to the window variable scope
 * @return emoncms path
 * @todo change "var path = ..." to "const path = ..." once all other modules have been updated to use this new js file
 * this will prevent any future changes to `path` within any other modules.
 * @todo look at adding this into a global `_SETTINGS` object for all js settings
 */
var path = (function() {
    // if [data-path] not in initial <script> tag, this file is in the /Lib directory
    const filePath = "Lib/emoncms.js"
    var _path = document.currentScript.dataset.path
    /**
     * remove the filePath from given url
     * @param {string} src url of current file
     * @returns url and path of emoncms system
     */
    function getPathFromScript(src) {
        var regex = new RegExp("(.*)" + filePath);
        var match = src.match(regex);
        return match[1];
    }
    // if path not set as [data-path] of <script> tag get the path from emoncms.js url
    // @todo: more testing ond different devices/browsers
    if (!_path) {
        _path = getPathFromScript(document.currentScript.src);
    }
    return _path;
})();

// on JQuery Ready...
$(function(){
    // trigger jquery "window.resized" custom event after debounce delay
    var resizeTimeout = false;
    window.addEventListener('resize', function(event) {
        clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(function() {
            $.event.trigger("window.resized");
        }, 200);
    })
});

// Display alert if js error encountered
window.onerror = function(msg, source, lineno, colno, error) {
    if (_SETTINGS && !_SETTINGS.showErrors) {
        return false;
    } else {
        if (msg.toLowerCase().indexOf("script error") > -1) {
            alert("Script Error: See Browser Console for Detail");
        } else {
            // REMOVE API KEY FROM ALERT
            // ----------------------------
            var maskedSource = source;
            var pattern = /(([\?&])?apikey=)([\w]*)/;
            // pattern match result examples:
            //  0 = ?apikey=abc123
            //  1 = ?apikey=
            //  2 = ?
            //  3 = abc123
            var match = source.match(pattern);
            if (match) {
                // if apikey first parameter replace with '?'
                // if apikey not first parameter replace with ''
                if(match[2]==="&") {
                    maskedSource = source.replace(match[0], "")
                } else {
                    maskedSource = source.replace(match[0], "?")
                }
            }
            var messages = [
                "EmonCMS Error",
                '-------------',
                "Message: " + msg,
                "Route: " + maskedSource.replace(path,""),
                "Line: " + lineno,
                "Column: " + colno
            ];
            if (Object.keys(error).length > 0) {
                messages.push("Error: " + JSON.stringify(error));
            }
            alert(messages.join("\n"));
        }
        return true; // true == prevents the firing of the default event handler.
    };
}

/**
 * Notify user of available updates
 * cache received responses from api to avoid excessive requests
 */
$(function() {
    var rightNav = $('#right-nav');
    // if interface has no #right-nav indicator cannot be shown
    if(rightNav.length > 0) {
        var userMenuDropdown = rightNav.find('.menu-user #user-dropdown');
        var dropDown = rightNav.find('.menu-user .dropdown-menu');
        var local_updates;
        // catch errors if localStorage doesn't exist in this browser
        try {
            local_updates = window.localStorage.getItem('emoncms_updates');
        } catch (error) {
            console.error(error);
        }
        // if cached responses exist, display the notification
        if(local_updates) {
            var response = null;
            // catch errors if local_updates not valid json
            try {
                response = JSON.parse(local_updates);
            } catch(error) {
                console.error(error)
            }
            // if cache, old request new data
            // @note: response.expires in unix time (seconds)
            if(response.expires && response.expires * 1000 < new Date()) {
                $.getJSON(path + 'admin/updates/refresh.json')
                .done(function(response) {
                    // cache response and show notification
                    saveUpdatesToBrowser(response);
                    showIndicator(response);
                })
                .fail(function(xhr, error, message) {
                    console.error(error, message);
                });
            // if cache not expired
            } else {
                showIndicator(response);
            }
        // no cache exists, download list from api
        } else {
            $.getJSON(path + 'admin/updates.json')
            .done(function(response) {
                // cache response and show notification
                saveUpdatesToBrowser(response);
                showIndicator(response);
            })
            .fail(function(xhr, error, message) {
                console.error(error, message);
            })
        }
    }

    /**
     * use local storage to cache api response to avoid delays
     * displays error in console if no local storage available
     * @param {Object} response returned value from /admin/updates.json
     */
    function saveUpdatesToBrowser(response) {
        try {
            window.localStorage.setItem('emoncms_updates', JSON.stringify(response));
        } catch(error) {
            console.error(error);
        }
    }

    /**
     * show small dot under user dropdown and add menu item to user dropdown
     * @param {Object} response returned value from /admin/updates.json
     */
    function showIndicator(response) {
        if(response.updates && response.updates.length > 0) {
            var title = _('Updates Available:') + "\n" + response.updates.join(' | ');
            var indicator = '<span class="update-indicator" title="' + title + '"></span>';
            // fade in the updates indicator in the top nav
            $(indicator).appendTo(userMenuDropdown).hide().fadeIn();

            var menuItem = '<li class="active update-available-menu-item">' +
            '<a href="http://localhost/emoncms/admin/view" title="' + title + '" class="justify-items-between align-items-center justify-content-center">' +
            '<svg class="icon update_available"><use xlink:href="#icon-box-add"></use></svg>' +
            '<span class="ml-1 flex-fill">' + _('Updates Available') + '</span>' +
            '</a></li>';
            // show the link in the user dropdown under the divider
            var separatorIndex = dropDown.find('.divider').index();
            $(menuItem).insertAfter(dropDown.find('li:eq(' + separatorIndex + ')'));
        }
    }
})
