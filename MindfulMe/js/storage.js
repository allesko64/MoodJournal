// Lightweight wrapper around localStorage with JSON (de)serialization.
// Exposes a global `Storage` object (to avoid clashing with the built-in Storage type, we use `AppStorage` internally).

const AppStorage = {
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Swallow quota or serialization errors gracefully
      console.error('Failed to persist to localStorage', e);
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to remove from localStorage', e);
    }
  },

  clear() {
    try {
      localStorage.clear();
    } catch (e) {
      console.error('Failed to clear localStorage', e);
    }
  },
};

// Provide a short, convenient global alias that won't collide with the browser's native Storage prototype.
const Storage = AppStorage;

