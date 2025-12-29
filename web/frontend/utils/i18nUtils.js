import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import ShopifyFormat from "@shopify/i18next-shopify";
import resourcesToBackend from "i18next-resources-to-backend";
import { match } from "@formatjs/intl-localematcher";
import { shouldPolyfill as shouldPolyfillLocale } from "@formatjs/intl-locale/should-polyfill";
import { shouldPolyfill as shouldPolyfillPluralRules } from "@formatjs/intl-pluralrules/should-polyfill";
import {
  DEFAULT_LOCALE as DEFAULT_POLARIS_LOCALE,
  SUPPORTED_LOCALES as SUPPORTED_POLARIS_LOCALES,
} from "@shopify/polaris";

const DEFAULT_APP_LOCALE = "en";
const SUPPORTED_APP_LOCALES = ["en"];

let _userLocale, _polarisTranslations;

export function getUserLocale() {
  if (_userLocale) {
    return _userLocale;
  }
  const url = new URL(window.location.href);
  const locale = url.searchParams.get("locale") || DEFAULT_APP_LOCALE;
  _userLocale = match([locale], SUPPORTED_APP_LOCALES, DEFAULT_APP_LOCALE);
  return _userLocale;
}

export function getPolarisTranslations() {
  return _polarisTranslations;
}

export async function initI18n() {
  await loadIntlPolyfills();
  await Promise.all([initI18next(), fetchPolarisTranslations()]);
}

async function loadIntlPolyfills() {
  if (shouldPolyfillLocale()) {
    await import("@formatjs/intl-locale/polyfill");
  }
  const promises = [];
  if (shouldPolyfillPluralRules(DEFAULT_APP_LOCALE)) {
    await import("@formatjs/intl-pluralrules/polyfill-force");
    promises.push(loadIntlPluralRulesLocaleData(DEFAULT_APP_LOCALE));
  }
  if (
    DEFAULT_APP_LOCALE !== getUserLocale() &&
    shouldPolyfillPluralRules(getUserLocale())
  ) {
    promises.push(loadIntlPluralRulesLocaleData(getUserLocale()));
  }
  await Promise.all(promises);
}

const PLURAL_RULES_LOCALE_DATA = {
  en: () => import("@formatjs/intl-pluralrules/locale-data/en"),
};

async function loadIntlPluralRulesLocaleData(locale) {
  return (await PLURAL_RULES_LOCALE_DATA[locale]()).default;
}

async function initI18next() {
  return await i18next
    .use(initReactI18next)
    .use(ShopifyFormat)
    .use(localResourcesToBackend())
    .init({
      debug: process.env.NODE_ENV === "development",
      lng: getUserLocale(),
      fallbackLng: DEFAULT_APP_LOCALE,
      supportedLngs: SUPPORTED_APP_LOCALES,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
}

function localResourcesToBackend() {
  return resourcesToBackend(async (locale, _namespace) => {
    return (await import(`../locales/${locale}.json`)).default;
  });
}

async function fetchPolarisTranslations() {
  if (_polarisTranslations) {
    return _polarisTranslations;
  }
  const defaultPolarisLocale = match(
    [DEFAULT_APP_LOCALE],
    SUPPORTED_POLARIS_LOCALES,
    DEFAULT_POLARIS_LOCALE,
  );
  const polarisLocale = match(
    [getUserLocale()],
    SUPPORTED_POLARIS_LOCALES,
    defaultPolarisLocale,
  );
  _polarisTranslations = await loadPolarisTranslations(polarisLocale);
  return _polarisTranslations;
}

const POLARIS_LOCALE_DATA = {
  en: () => import("@shopify/polaris/locales/en.json"),
};

async function loadPolarisTranslations(locale) {
  return (await POLARIS_LOCALE_DATA[locale]()).default;
}
