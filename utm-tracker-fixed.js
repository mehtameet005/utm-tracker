(function (window, document) {
  console.log('🔥 UTM Tracker initialized');

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

  function storeUTMParams(utmData) {
    const fullData = {
      ...utmData,
      firstVisit: new Date().toISOString()
    };
    const json = JSON.stringify(fullData);
    localStorage.setItem(STORAGE_KEY, json);
    setCookie(STORAGE_KEY, json, CONFIG.cookieExpirationDays);
    console.log('📦 UTM data stored:', fullData);
  }

  function getStoredUTMData() {
    const fromLocal = localStorage.getItem(STORAGE_KEY);
    try {
      return fromLocal ? JSON.parse(fromLocal) : null;
    } catch (e) {
      console.warn('⚠️ Failed to parse UTM data from localStorage:', e);
      return null;
    }
  }

  function restoreFromCookieIfNeeded() {
    const cookieVal = getCookie(STORAGE_KEY);
    if (cookieVal && !getStoredUTMData()) {
      try {
        const parsed = JSON.parse(cookieVal);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        console.log('♻️ Restored UTM from cookie:', parsed);
      } catch (e) {
        console.warn('⚠️ Error restoring UTM from cookie:', e);
      }
    }
  }

  function getReferrerSource() {
    const ref = document.referrer;
    if (!ref || ref.includes(location.hostname)) return null;
    try {
      const host = new URL(ref).hostname;
      if (host.includes('google')) return 'google';
      if (host.includes('bing')) return 'bing';
      if (host.includes('facebook')) return 'facebook';
      if (host.includes('instagram')) return 'instagram';
      if (host.includes('linkedin')) return 'linkedin';
      if (host.includes('twitter') || host.includes('t.co')) return 'twitter';
      return host;
    } catch {
      return null;
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
    console.log(`📌 Event logged: ${type}`, event);
  }

  function generateReport() {
    const stored = getStoredUTMData();
    return {
      totalEvents: 1,
      utmStored: stored
    };
  }

  window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded triggered inside tracker');

    // ✅ Simulate Consent
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    // ✅ Capture and store UTM only once
    const utm = getUTMParamsFromURL();
    const existing = getStoredUTMData();

    console.log('🔍 URL Params:', utm);
    console.log('📦 Existing localStorage UTM:', existing);

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM from URL being stored now');
      storeUTMParams(utm);
    } else if (!existing) {
      const ref = getReferrerSource();
      if (ref) {
        storeUTMParams({
          utm_source: ref,
          utm_medium: 'referral',
          fallback: true
        });
        console.log('🔁 Fallback referrer UTM:', ref);
      } else {
        restoreFromCookieIfNeeded();
      }
    }

    // ✅ Defer log after storage is complete
    logEvent('page_view');
    if (CONFIG.reportGeneration === 'auto') {
      console.log('📊 Report:', generateReport());
    }
  });

  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
