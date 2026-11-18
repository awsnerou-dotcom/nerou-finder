/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { initGA } from "../lib/analytics.js";

interface CookieConsentProps {
  isRtl: boolean;
}

export default function CookieConsent({ isRtl }: CookieConsentProps) {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [showPreferences, setShowPreferences] = useState<boolean>(false);
  
  // Consent toggles
  const [consentFunctional, setConsentFunctional] = useState<boolean>(true);
  const [consentAnalytics, setConsentAnalytics] = useState<boolean>(true);

  useEffect(() => {
    const consentStatus = localStorage.getItem("cookie_consent_status");
    if (!consentStatus) {
      // First-time visitor, show banner after a small delay
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      // Already has choice, initialize analytics if allowed
      if (localStorage.getItem("cookie_consent_analytics") === "true") {
        initGA();
      }
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem("cookie_consent_status", "ACCEPTED");
    localStorage.setItem("cookie_consent_essential", "true");
    localStorage.setItem("cookie_consent_functional", "true");
    localStorage.setItem("cookie_consent_analytics", "true");
    initGA();
    setIsVisible(false);
  };

  // Dismissing via the corner X is not an affirmative choice - it should behave like "not now"
  // (the banner just closes, no consent status is recorded, so it reappears next visit) rather
  // than silently recording the same outcome as clicking the explicit "Decline All" button.
  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleDeclineAll = () => {
    localStorage.setItem("cookie_consent_status", "DECLINED");
    localStorage.setItem("cookie_consent_essential", "true");
    localStorage.setItem("cookie_consent_functional", "false");
    localStorage.setItem("cookie_consent_analytics", "false");
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem("cookie_consent_status", "CUSTOM");
    localStorage.setItem("cookie_consent_essential", "true");
    localStorage.setItem("cookie_consent_functional", consentFunctional ? "true" : "false");
    localStorage.setItem("cookie_consent_analytics", consentAnalytics ? "true" : "false");
    if (consentAnalytics) {
      initGA();
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div id="cookie-consent-banner" className="fixed bottom-4 left-4 right-4 md:right-auto md:bottom-6 md:left-6 md:max-w-sm bg-chrome text-[#f7f5f0] border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-4 z-50 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white mb-1">
            {isRtl ? "ملفات تعريف الارتباط" : "Cookies"}
          </h4>
          <p className="text-[13px] text-white/75 leading-relaxed">
            {isRtl
              ? "نستخدمها لإبقائك مسجّلاً الدخول وحفظ تفضيلاتك وقياس استخدام الموقع. اختر ما تسمح به."
              : "We use them to keep you signed in, remember your preferences and measure how the site is used. Choose what you allow."}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-ink-muted hover:text-white transition-colors"
          title={isRtl ? "إغلاق مؤقت (لن يتم حفظ أي خيار)" : "Dismiss for now (no choice will be saved)"}
        >
          <X size={16} />
        </button>
      </div>

      {showPreferences ? (
        <div className="mt-4 pt-4 border-t border-chrome-hover space-y-3">
          <div className="flex items-center justify-between bg-[#2c2924] p-2 rounded-lg">
            <div>
              <p className="text-[10px] font-bold text-gold">
                {isRtl ? "ملفات التعريف الأساسية (إجباري)" : "Essential Cookies (Required)"}
              </p>
              <p className="text-[11px] text-white/60">
                {isRtl ? "ضرورية لعمليات المصادقة وجلسات الأمان." : "Necessary for account sign-in and session security."}
              </p>
            </div>
            <div className="bg-gold/20 text-gold p-1 rounded">
              <Check size={12} />
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#2c2924] p-2 rounded-lg">
            <div>
              <p className="text-[10px] font-bold text-white">
                {isRtl ? "ملفات التفضيلات الوظيفية" : "Functional Preferences"}
              </p>
              <p className="text-[11px] text-white/60">
                {isRtl ? "تذكر تفضيلات اللغة والوضع وعمليات البحث." : "Remember language, view options, and recent searches."}
              </p>
            </div>
            <input 
              type="checkbox"
              checked={consentFunctional}
              onChange={(e) => setConsentFunctional(e.target.checked)}
              className="accent-gold h-4 w-4 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between bg-[#2c2924] p-2 rounded-lg">
            <div>
              <p className="text-[10px] font-bold text-white">
                {isRtl ? "التحليلات والمراقبة (GA4)" : "Performance & Analytics (GA4)"}
              </p>
              <p className="text-[11px] text-white/60">
                {isRtl ? "تساعدنا على فهم كيفية استخدام الزوار لمنصتنا." : "Anonymized usage analytics via Google Analytics."}
              </p>
            </div>
            <input 
              type="checkbox"
              checked={consentAnalytics}
              onChange={(e) => setConsentAnalytics(e.target.checked)}
              className="accent-gold h-4 w-4 cursor-pointer"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button 
              onClick={handleSavePreferences}
              className="flex-1 py-1.5 bg-gold hover:bg-gold-hover text-black font-bold rounded-md text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
            >
              {isRtl ? "حفظ التفضيلات" : "Save Choice"}
            </button>
            <button 
              onClick={() => setShowPreferences(false)}
              className="px-3 py-1.5 bg-chrome-hover hover:bg-[#4d483e] text-white rounded-md text-[10px] transition-colors cursor-pointer"
            >
              {isRtl ? "رجوع" : "Back"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={handleAcceptAll}
            className="px-4 py-2 bg-gold hover:bg-gold-hover text-black font-semibold rounded-lg text-sm transition-colors cursor-pointer"
          >
            {isRtl ? "قبول الكل" : "Accept all"}
          </button>
          <button
            onClick={handleDeclineAll}
            className="px-4 py-2 bg-transparent border border-white/25 hover:bg-white/10 text-sm font-semibold text-white rounded-lg transition-colors cursor-pointer"
          >
            {isRtl ? "رفض الكل" : "Decline all"}
          </button>
          <button
            onClick={() => setShowPreferences(true)}
            className="px-2 py-2 text-sm text-white/75 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
          >
            {isRtl ? "تخصيص" : "Customize"}
          </button>
        </div>
      )}
    </div>
  );
}
