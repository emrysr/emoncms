/**
 * @author: emrys@openenergymonitor.org
 */
function _(str) {
    return translate(str);
}
/**
 * emulate the php gettext function for replacing php strings in js
 */
function translate(property) {
    _strings = {};
    if (typeof getTranslations === 'function') {
        _strings = getTranslations();
    }
    if (_strings.hasOwnProperty(property)) {
        return _strings[property];
    } else {
        return property;
    }
}

/**
 * ADD THIS `getTranslations()` METHOD TO THE VIEW FOR THE `translate()` FUNCTION TO HAVE STRINGS TO TRANSLATE
 * 
 * `gettext` can search through the templates for any `gettext` functions.
 * It then creates a `.po` file with all the required translation strings
 * @see: https://www.php.net/manual/en/function.gettext.php
 */

/*
eg:
<script>
/**
 * return an object of gettext translated strings used by JS
 * @return object
 * /
function getTranslations(){
    return {
        'ID': "<?php echo _('ID') ?>",
        'Value': "<?php echo _('Value') ?>",
        'Time': "<?php echo _('Time') ?>",
        'Updated': "<?php echo _('Updated') ?>"
    }
}
</script>
*/