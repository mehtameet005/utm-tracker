// ✅ UTM Tracker: Final Version with Auto Consent & Persistence Fixes
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    apiEndpoint: '',
    googleSheetsWebhook: '',
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto',
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? decodeURIComponent(parts.pop().split(';')[0]) : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}`;
  }

  function getUTMParamsFromURL() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    UTM_PARAMS.forEach((key) => {
      if (params.has(key)) result[key] = params.get(key);
    });
    return result;
  }

  function storeUTMParams(utmData) {
    const data = { ...utmData, firstVisit: new Date().toISOString() };
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
    setCookie(STORAGE_KEY, json, CONFIG.cookieExpirationDays);
    console.log('📦 UTM data stored:', data);
  }

  function getStoredUTMData() {
    const fromLocal = localStorage.getItem(STORAGE_KEY);
    try {
      return fromLocal ? JSON.parse(fromLocal) : null;
    } catch (e) {
      return null;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 UTM Tracker initialized');

    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredUTMData();

    console.log('🔍 URL Params:', utm);
    console.log('📦 Existing localStorage UTM:', existing);

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM from URL being stored now');
      storeUTMParams(utm);
    }
  });

  window.UTMTracker = {
    logEvent: () => {},
    generateReport: () => {}
  };
})(window, document);
