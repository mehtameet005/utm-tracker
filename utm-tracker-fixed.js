/**
 * UTM Tracker: Final Version
 * - Auto Consent (for Testing)
 * - Tracks UTM + Referrer
 * - Persists via localStorage + Cookie
 * - Tracks Page Views, Clicks, Forms
 * - Generates Session Funnel Reports
 */

(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    apiEndpoint: '',
    googleSheetsWebhook: '',
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';
  const reportLog = [];

  // ------------------- UTILITY -------------------

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? decodeURIComponent(parts.pop().split(';').shift()) : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  }

  function getUTMParamsFromURL() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    UTM_PARAMS.forEach(key => {
      if (params.has(key)) result[key] = params.get(key);
    });
    return result;
  }

  function getReferrerSource() {
    try {
      const ref = document.referrer;
      if (!ref || ref.includes(location.hostname)) return null;
      const hostname = new URL(ref).hostname;
      if (hostname.includes('google.')) return 'google';
      if (hostname.includes('bing.')) return 'bing';
      if (hostname.includes('facebook.')) return 'facebook';
      if (hostname.includes('instagram.')) return 'instagram';
      if (hostname.includes('linkedin.')) return 'linkedin';
      if (hostname.includes('t.co') || hostname.includes('twitter.')) return 'twitter';
      return hostname;
    } catch (e) {
      return null;
    }
  }

  function storeUTMParams(data) {
    const fullData = { ...data, firstVisit: new Date().toISOString() };
    const json = JSON.stringify(fullData);
    localStorage.setItem(STORAGE_KEY, json);
    setCookie(STORAGE_KEY, json, CONFIG.cookieExpirationDays);
    console.log('📦 UTM Stored:', fullData);
  }

  function getStoredUTMData() {
    const fromLocal = localStorage.getItem(STORAGE_KEY);
    try {
      return fromLocal ? JSON.parse(fromLocal) : null;
    } catch (e) {
      console.warn('⚠️ Failed to parse UTM from localStorage:', e);
      return null;
    }
  }

  function restoreUTMFromCookie() {
    const cookieVal = getCookie(STORAGE_KEY);
    if (cookieVal && !getStoredUTMData()) {
      try {
        const parsed = JSON.parse(cookieVal);
        if (parsed && typeof parsed === 'object') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          console.log('♻️ Restored UTM from cookie:', parsed);
        }
      } catch (e) {
        console.warn('⚠️ Failed to parse UTM from cookie:', e);
      }
    }
  }

  function hasConsent() {
    const value = getCookie(CONFIG.consentCookieName);
    return value === null || value === 'true';
  }

  // ------------------- TRACKING -------------------

  function logEvent(type, details = {}) {
    if (!hasConsent()) return;

    const utm = getStoredUTMData();
    const event = {
      eventType: type,
      timestamp: new Date().toISOString(),
      utm,
      pageURL: window.location.href,
      ...details
    };

    reportLog.push(event);
    pushToDestinations(event);
    console.log(`📌 Event Logged: ${type}`, event);
  }

  function pushToDestinations(data) {
    if (CONFIG.apiEndpoint) {
      fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(console.error);
    }

    if (CONFIG.googleSheetsWebhook) {
      fetch(CONFIG.googleSheetsWebhook, {
        method: 'POST',
        body: JSON.stringify(data)
      }).catch(console.error);
    }
  }

  function generateReport() {
    const report = {
      totalEvents: reportLog.length,
      utmSources: {},
      funnel: {},
      timeMetrics: {},
      userJourneys: {}
    };

    const userStart = {};

    reportLog.forEach(entry => {
      const src = entry.utm?.utm_source || 'unknown';
      report.utmSources[src] = (report.utmSources[src] || 0) + 1;
      report.funnel[entry.eventType] = (report.funnel[entry.eventType] || 0) + 1;

      const uid = JSON.stringify(entry.utm || {});
      userStart[uid] = userStart[uid] || entry.timestamp;

      const duration = new Date(entry.timestamp) - new Date(userStart[uid]);
      report.timeMetrics[uid] = report.timeMetrics[uid] || [];
      report.timeMetrics[uid].push(duration);

      report.userJourneys[uid] = report.userJourneys[uid] || [];
      report.userJourneys[uid].push({ event: entry.eventType, time: entry.timestamp });
    });

    return report;
  }

  // ------------------- DOM EVENTS -------------------

  function attachClickListeners() {
    document.querySelectorAll('button, a, input[type="submit"]').forEach(el => {
      const text = el.innerText || el.value || '';
      if (/sign\s?up|submit|buy|book|download|get/i.test(text)) {
        el.addEventListener('click', () => {
          logEvent('button_click', {
            elementText: text,
            elementId: el.id || null
          });
        });
      }
    });
  }

  function attachFormListeners() {
    document.querySelectorAll('form').forEach(form => {
      if (form.querySelector('input[type="email"]') && !form.dataset.tracked) {
        form.dataset.tracked = 'true';
        form.addEventListener('submit', () => {
          const fields = {};
          new FormData(form).forEach((v, k) => (fields[k] = v));
          logEvent('form_submission', { formId: form.id || null, fields });
        });
      }
    });
  }

  function watchForForms() {
    new MutationObserver(attachFormListeners).observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ------------------- INIT -------------------

  window.addEventListener('DOMContentLoaded', () => {
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utmParams = getUTMParamsFromURL();
    const alreadyStored = getStoredUTMData();

    if (Object.keys(utmParams).length > 0 && !alreadyStored) {
      storeUTMParams({ ...utmParams, firstVisit: new Date().toISOString() });
      console.log('✅ UTM captured from URL:', utmParams);
    } else if (!alreadyStored) {
      const refSource = getReferrerSource();
      if (refSource) {
        const fallbackUTM = {
          utm_source: refSource,
          utm_medium: 'referral',
          fallback: true,
          firstVisit: new Date().toISOString()
        };
        storeUTMParams(fallbackUTM);
        console.log('🔁 Stored fallback UTM from referrer:', refSource);
      } else {
        restoreUTMFromCookie();
      }
    }

    // ✅ DEFER logEvent AFTER UTM data is surely present
    setTimeout(() => {
      logEvent('page_view');
      if (CONFIG.reportGeneration === 'auto') {
        console.log('📊 Auto-generating report...');
        console.log('📈 Report:', generateReport());
      }
    }, 100);

    attachClickListeners();
    attachFormListeners();
    watchForForms();
  });

  window.UTMTracker = {
    generateReport,
    logEvent
  };
})(window, document);
