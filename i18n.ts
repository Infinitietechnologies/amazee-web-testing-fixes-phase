import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getCookieFromContext } from "@/helpers/getters";
import { GetServerSidePropsContext } from "next";
import { getCookie, setCookie } from "@/lib/cookies";

// Languages
import enTranslation from "./public/locales/en.json";
import hiTranslation from "./public/locales/hi.json";
import arTranslation from "./public/locales/ar.json";
// [CHANGE 2026-09-22] The four South Indian languages.
//
// These files hold only the keys that have actually been translated. i18next
// falls back to `en` per key, so a partial locale renders English for the rest
// rather than a blank or a raw key name — and a file padded out with English
// strings would make it impossible to tell what is genuinely translated.
import taTranslation from "./public/locales/ta.json";
import teTranslation from "./public/locales/te.json";
import knTranslation from "./public/locales/kn.json";
import mlTranslation from "./public/locales/ml.json";

const LANGUAGE_KEY = "i18nextLng";

const DEFAULT_LANG = "en";

const languages = {
  en: {
    translation: enTranslation,
  },
  hi: {
    translation: hiTranslation,
  },
  ar: {
    translation: arTranslation,
  },
  ta: {
    translation: taTranslation,
  },
  te: {
    translation: teTranslation,
  },
  kn: {
    translation: knTranslation,
  },
  ml: {
    translation: mlTranslation,
  },
};

/** Every language the storefront offers. The switcher reads this, so the list
 *  and the loaded resources cannot drift apart. */
export const SUPPORTED_LANGUAGES = ["en", "hi", "ar", "ta", "te", "kn", "ml"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Initialize i18n with static defaults. Client-specific detection will run later.
i18n.use(initReactI18next).init({
  resources: languages,
  // Default language on server - client will override if a cookie is present
  lng: getCookie<string>(LANGUAGE_KEY) || DEFAULT_LANG,
  fallbackLng: DEFAULT_LANG,
  interpolation: {
    escapeValue: false,
  },
});

// Function to change language and persist in cookie
export const changeLanguage = (lng: string) => {
  // Persist cookie only in browser
  if (typeof window !== "undefined") {
    setCookie(LANGUAGE_KEY, lng, { expires: 365 });
  }
  i18n.changeLanguage(lng);

  // Ensure this code runs only in the browser
  if (typeof document !== "undefined") {
    // Arabic is the only RTL locale offered. Tamil, Telugu, Kannada and
    // Malayalam are left-to-right; listing the RTL set explicitly means adding
    // another LTR language cannot accidentally flip the document.
    const RTL_LANGUAGES = ["ar"];
    document.documentElement.setAttribute(
      "dir",
      RTL_LANGUAGES.includes(lng) ? "rtl" : "ltr",
    );
    document.documentElement.setAttribute("lang", lng);
  }
};

export const loadTranslations = async (context: GetServerSidePropsContext) => {
  const lang =
    (getCookieFromContext(context, LANGUAGE_KEY) as string) || DEFAULT_LANG;

  // Initialize i18next with the loaded resources
  i18n.init({
    resources: languages,
    lng: lang,
    fallbackLng: DEFAULT_LANG,
    interpolation: {
      escapeValue: false,
    },
  });
};

export default i18n;
