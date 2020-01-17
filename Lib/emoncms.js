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
 * return promise object to allow the calling function to act on responses
 * if ajax calls are made the ajax promise is returned
 * if using local storage a custom promise is returned matching the ajax promise format
 */
function get_updates(ignore_local, clear_cache) {
    var local_updates = false;
    var deferred = $.Deferred();
    var cached_path = "admin/updates.json"; // cached (unless old) version
    var fresh_path  = "admin/updates/refresh.json"; // un-cached version

    if (ignore_local===true) {
        // clear local cache of update version
        try {
            window.localStorage.removeItem("emoncms_updates");
        } catch(error) {
            console.error(error);
        }
    } else {
        // reject if localStorage doesn't exist in this browser
        try {
            local_updates = window.localStorage.getItem('emoncms_updates');
        } catch (error) {
            deferred.reject(null, 'No localStorage', error);
        }
    }

    // if cached responses exist, display the notification
    if(local_updates) {
        var response = null;
        // catch errors if local_updates not valid json
        try {
            response = JSON.parse(local_updates);
        } catch(error) {
            deferred.reject(null, 'Cache invalid', error);
        }
        // if cache expired, request new data
        // @note: response.expires in unix time (seconds)
        if((response.hasOwnProperty('success') && response.success === false) || 
            response.hasOwnProperty('expires') && response.expires * 1000 < new Date())
        {
            // return promise and wait for cache busting version
            return $.getJSON(path + fresh_path)
            
        // if cache not expired, respond with cached version
        } else {
            deferred.resolve(response);
        }
    // no cache exists, download list from api
    } else {
        // force cache to be updated or just download cached version
        var url = path + (!clear_cache ? cached_path: fresh_path);
        return $.getJSON(url);
    }
    return deferred.promise();
}
/**
 * Notify user of available updates
 * cache received responses from api to avoid excessive requests
 */
$(function() {
    if(!document.body.classList.contains("update_checker")) return false;
    // if interface has no #right-nav indicator cannot be shown
    if($('#right-nav').length === 0) return false;

    showGetUpdates();
    get_updates()
    .done(function(response) {
        // cache response and show notification
        saveUpdatesToBrowser(response);
        showUpdatesIndicator(response);
    })
    .fail(function(xhr, error, message) {
        console.error(error, message);
    });
})

/**
 * use local storage to cache api response to avoid delays
 * displays error in console if no local storage available
 * @param {Object} response returned value from /admin/updates.json
 */
function saveUpdatesToBrowser(response) {
    // don't save un successful responses
    if(response.hasOwnProperty('success') && response.success === false) {
        return false;
    }
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
function showUpdatesIndicator(response) {
    var indicator = $('#update-indicator');
    if(response.updates && response.updates.length > 0) {
        // fade in the updates indicator in the top nav
        if(indicator.length === 0) {
            var userMenuDropdown = $('#right-nav .menu-user #user-dropdown');
            var title = _('Updates Available:') + "\n" + response.updates.join(' | ');
            var html = '<span id="update-indicator" class="update-indicator" title="' + title + '"></span>';
            indicator = $(html).appendTo(userMenuDropdown);
        }
        indicator.fadeIn();
    } else {
        indicator.fadeOut();
    }
}

/**
 * @param {Object} response from /admin/updates.json
 * @param {Object<jQuerySelector>} element the <li> element in the menu
 */
function showUpdatesAvailable(response, elem) {
    var link = elem.find('a');
    var linkText = link.find('span');
    var activeClass = 'active';
    var updates = response.updates || [];
    if(!elem.data('original-text')) elem.data('original-text', linkText.text());
    if(updates.length > 0) {
        link.attr('title', updates.join(' | '));
        linkText.text(_('Updates Available'));
        elem.addClass(activeClass);
    } else {
        link.attr('title', elem.data('original-text'));
        linkText.text(elem.data('original-text'));
        elem.removeClass(activeClass);
        link.blur();
    }
    var lastupdated = response.lastupdated || false;
    if(lastupdated) {
        var title = [link.attr('title')];
        if(typeof moment !== 'undefined') {
            title = [ 
                link.attr('title'), 
                _('Checked ') + moment.unix(lastupdated).fromNow()
            ].filter(Boolean);
        }
        link.attr('title', title.join("\n"));
    }
}
/**
 * captures click of dropdown item
 * performs ajax call to re-load available system updates
 * displays 'available' or 'not available' type messages
 * 
 * @return {Boolean} true = continue, false = ignore the click
 * @param {MouseEvent} event 
 */
function onClick_checkForUpdates(event) {
    var $this = $(event.currentTarget);
    if($this.hasClass('disabled')) return false;
    var icon = $this.find('svg')[0];
    var loadingClass = 'loading';
    var activeClass = 'active';
    var disabledClass = 'disabled';

    // follow link to admin/view if class='active'
    if($this.hasClass(activeClass)) return true;
    $this.addClass(disabledClass);
    icon.classList.add(loadingClass);
    get_updates(true,false,event)
    .done(function(response) {
        if(response.hasOwnProperty('success') && response.success === false) {
            console.error(response.message);
            $('#get-updates').addClass('disabled')
            .find('span').attr('title', response.message);
            document.body.classList.remove('admin');
        } else {
            // cache response and show notification
            saveUpdatesToBrowser(response);
            showUpdatesIndicator(response);
            $(document).trigger('emoncms:versions:loaded', response);
            $this.removeClass(disabledClass);
        }
    })
    .fail(function(xhr, error, message) {
        console.error(error, message);
    })
    .always(function(response){
        icon.classList.remove(loadingClass);
        // change the link if updates available
        showUpdatesAvailable(response, $this);
    })
    event.preventDefault();
    return false
}
/**
 * Display a menu item in the "user menu"
 * Menu item to trigger update check
 * @param {Object} response same as the data returned from /admin/updates.json
 */
function showGetUpdates(response) {
    var title = _('Check for updates');
    var dropDown = $('#right-nav .menu-user .dropdown-menu');

    var menuItem = '<li id="get-updates" class="update-available-menu-item">' +
        '<a href="' + path + 'admin/view" title="' + title + '..." class="justify-items-between align-items-center justify-content-center">' +
        '<svg class="icon update_available"><use xlink:href="#icon-box-add"></use></svg>' +
        '<span class="ml-1 flex-fill">' + title + '</span>' +
        '</a></li>';
    // show the link in the user dropdown under the divider
    var separatorIndex = dropDown.find('.divider').index();
    var item = $(menuItem).insertAfter(dropDown.find('li:eq(' + separatorIndex + ')'));
    var link = item.find('a');
    get_updates()
    .done(function(response) {
        // cache response and show notification
        saveUpdatesToBrowser(response);
        showUpdatesIndicator(response);
        showUpdatesAvailable(response, item);
    })
    .fail(function(xhr, error, message) {
        console.error(error, message);
        link.attr('title','');
    });

    item.on('click', onClick_checkForUpdates);
}
