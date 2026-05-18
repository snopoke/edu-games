/* Polyfill for the window.storage API that the multiplication game was
   originally written against. The third argument to get/set was used by the
   original host; we accept and ignore it so the game's call sites don't
   need to change. */

/** @type {any} */ (window).storage = {
  async get(key, _opts)        { return { value: localStorage.getItem(key) }; },
  async set(key, value, _opts) { localStorage.setItem(key, value); }
};
