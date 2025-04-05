// UTM Tracker: Final Version with Debug & Persistence Fixes
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';
  const reportLog = [];

  function getCookie(name) {
    const cookies = `; ${document.cookie}`;
    const parts = cookies.split(`; ${name}=`);
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

  function storeUTMParams(data) {
    const fullData = { ...data, firstVisit: new Date().toISOString() };
    try {
      const json = JSON.stringify(fullData);
      localStorage.setItem(STORAGE_KEY, json);
      setCookie(STORAGE_KEY, json, CONFIG.cookieExpirationDays);
      console.log('📦 UTM data stored to localStorage & cookie:', fullData);
    } catch (err) {
      console.error('❌ Failed to store UTM data:', err);
    }
  }

  function getStoredUTMData() {
    try {
      const fromLocal = localStorage.getItem(STORAGE_KEY);
      return fromLocal ? JSON.parse(fromLocal) : null;
    } catch (e) {
      console.warn('⚠️ Failed to parse stored UTM:', e);
      return null;
    }
  }

  function restoreUTMFromCookie() {
    const cookieVal = getCookie(STORAGE_KEY);
    if (cookieVal && !getStoredUTMData()) {
      try {
        localStorage.setItem(STORAGE_KEY, cookieVal);
        console.log('♻️ Restored UTM from cookie:', JSON.parse(cookieVal));
      } catch (e) {
        console.warn('⚠️ Cookie restore failed:', e);
      }
    }
  }

  function logEvent(type, details = {}) {
    const utm = getStoredUTMData();
    const event = {
      eventType: type,
      timestamp: new Date().toISOString(),
      utm,
      pageURL: window.location.href,
      ...details
    };
    reportLog.push(event);
    console.log(`📌 Event logged: ${type}`, event);
  }

  function generateReport() {
    return {
      totalEvents: reportLog.length,
      utmStored: getStoredUTMData()
    };
  }

  // MAIN
  window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded inside UTM Tracker');

    // Simulate consent
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredUTMData();

    console.log('🔍 URL UTM Params:', utm);
    console.log('📦 Existing stored UTM:', existing);

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM from URL being stored now');
      storeUTMParams(utm);
    } else if (!existing) {
      restoreUTMFromCookie();
    }

    // Confirm storage
    const confirmedUTM = getStoredUTMData();
    console.log('📦 Confirmed stored UTM:', confirmedUTM);

    logEvent('page_view');

    if (CONFIG.reportGeneration === 'auto') {
      console.log('📊 UTM Report:', generateReport());
    }
  });

  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
