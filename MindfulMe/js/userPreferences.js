class UserPreferences {
    static getPreference(key, defaultValue = null) {
        if (typeof Storage === 'undefined') {
            return defaultValue;
        }
        return Storage.get(key, defaultValue);
    }

    static setPreference(key, value) {
        if (typeof Storage === 'undefined') {
            return;
        }
        Storage.set(key, value);
    }

    static clearPreference(key) {
        if (typeof Storage === 'undefined') {
            return;
        }
        Storage.remove(key);
    }

    static clearAllPreferences() {
        if (typeof Storage === 'undefined') {
            return;
        }
        Storage.clear();
    }
}
