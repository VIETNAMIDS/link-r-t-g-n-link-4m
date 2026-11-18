// modules/storage.js - Giả lập chrome.storage.local bằng localStorage
const storage = {
  get: (keys, callback) => {
    const res = {};
    const keyList = Array.isArray(keys) ? keys : [keys];
    keyList.forEach(k => {
      try {
        const val = localStorage.getItem(k);
        res[k] = val !== null ? JSON.parse(val) : null;
      } catch (e) {
        res[k] = localStorage.getItem(k);
      }
    });
    if (callback) callback(res);
    return Promise.resolve(res);
  },
  set: (obj, callback) => {
    Object.keys(obj).forEach(k => {
      try {
        localStorage.setItem(k, JSON.stringify(obj[k]));
      } catch (e) {
        localStorage.setItem(k, obj[k]);
      }
    });
    if (callback) callback();
    return Promise.resolve();
  }
};

window.chrome = window.chrome || {};
window.chrome.storage = { local: storage };

module.exports = { storage };
