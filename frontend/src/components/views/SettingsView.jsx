import React, { useState } from 'react'
import { Terminal, ChevronRight, Globe, Languages, Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'
import { useTheme } from '../../theme/ThemeContext'
import ToggleSwitch from '../ui/ToggleSwitch'
import HudButton from '../ui/HudButton'

const FOLLOW_BROWSER_LANGUAGE = '__auto__'

const isFollowingBrowserLanguage = () => {
  try {
    return !localStorage.getItem('i18nextLng')
  } catch {
    return true
  }
}

/**
 * Settings card: icon | copy | control.
 * Uses a real 3-col grid so the cyberpunk OFF|ON toggle never collapses
 * the title into a single-word column.
 */
const SettingRow = ({ title, description, children, icon: Icon, vertical }) => (
  <div
    className={cn(
      'setting-row group',
      vertical && 'setting-row--vertical'
    )}
  >
    {Icon && (
      <div className="setting-row__icon">
        <Icon className="w-5 h-5 md:w-6 md:h-6" />
      </div>
    )}
    <div className="setting-row__copy">
      <p className="setting-row__title">{title}</p>
      {description && (
        <p className="setting-row__desc">{description}</p>
      )}
    </div>
    <div className="setting-row__control">
      {children}
    </div>
  </div>
)

const SettingsView = ({ config, onSaveConfig, setShowLogs, onNavigate }) => {
  const { t, i18n } = useTranslation()
  const { themeId, setThemeId, themes } = useTheme()
  const autoOpen = config.AUTO_BROWSER_OPEN !== false
  const autoInstall = config.AUTO_INSTALL_APP !== false
  const autoloadDelay = config.AUTOLOAD_DELAY || 5
  const multiSources = config.MULTI_SOURCES_ENABLED === true
  const [followBrowserLanguage, setFollowBrowserLanguage] = useState(isFollowingBrowserLanguage)

  const getLanguageDisplayName = (lang) => {
    let displayName = lang;
    try {
      const baseLang = lang.split('-')[0];
      const lookupLang = lang.startsWith('zh') ? lang : baseLang;
      displayName = new Intl.DisplayNames([lang], { type: 'language' }).of(lookupLang);
      displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    } catch {
      return lang;
    }
    return displayName;
  };

  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';
  const selectedLanguage = followBrowserLanguage ? FOLLOW_BROWSER_LANGUAGE : currentLang;

  const handleLanguageChange = async (event) => {
    const language = event.target.value;
    const followBrowser = language === FOLLOW_BROWSER_LANGUAGE;
    setFollowBrowserLanguage(followBrowser);
    try {
      if (followBrowser) {
        localStorage.removeItem('i18nextLng');
      } else {
        localStorage.setItem('i18nextLng', language);
      }
    } catch {
      // Continue with an in-memory language change if storage is unavailable.
    }
    await i18n.changeLanguage(followBrowser ? undefined : language);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-16 pb-20">
      <div className="space-y-4">
        <h2 className="text-4xl font-extrabold text-white tracking-tight">
          {t("settings.title", "Settings")}
        </h2>
      </div>

      {/* Appearance / theme */}
      <section className="space-y-8">
        <h3 className="label-caps !text-ps-blue !opacity-100 flex items-center space-x-4 text-xl tracking-[0.2em]">
          <Palette className="w-6 h-6" />
          <span>{t("settings.appearance_title", "Appearance")}</span>
        </h3>
        <div className="cp-theme-grid">
          {Object.values(themes).map((th) => (
            <button
              key={th.id}
              type="button"
              onClick={() => setThemeId(th.id)}
              className={cn('cp-theme-card', themeId === th.id && 'is-active')}
            >
              <div className="cp-theme-card__swatches">
                {th.id === 'cyberpunk' ? (
                  <>
                    <span className="cp-theme-card__swatch" style={{ background: '#ff3c3c' }} />
                    <span className="cp-theme-card__swatch" style={{ background: '#00f0ff' }} />
                    <span className="cp-theme-card__swatch" style={{ background: '#fcee0a' }} />
                    <span className="cp-theme-card__swatch" style={{ background: '#0a0508' }} />
                  </>
                ) : (
                  <>
                    <span className="cp-theme-card__swatch" style={{ background: '#0095ff' }} />
                    <span className="cp-theme-card__swatch" style={{ background: '#101014' }} />
                    <span className="cp-theme-card__swatch" style={{ background: '#ffffff' }} />
                    <span className="cp-theme-card__swatch" style={{ background: '#08080a' }} />
                  </>
                )}
              </div>
              <div className="cp-theme-card__name">{th.label}</div>
              <div className="cp-theme-card__desc">{th.description}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Startup Settings */}
      <section className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SettingRow
            title={t("settings.language_title", "Language")}
            description={t("settings.language_desc", "Change the display language of the application.")}
            icon={Languages}
            vertical
          >
            <div className="flex flex-col items-start space-y-2 w-full">
              <div className="relative w-full bg-black/50 border border-white/10 text-white rounded-xl px-4 py-3 font-bold tracking-tight hover:bg-white/5 transition-all overflow-hidden flex items-center justify-between">
                <span>
                  {followBrowserLanguage
                    ? t("settings.language_system_default", "System Default")
                    : getLanguageDisplayName(currentLang)}
                </span>
                <ChevronRight className="w-5 h-5 text-zinc-500 rotate-90" />
                <select
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                  <option value={FOLLOW_BROWSER_LANGUAGE} className="bg-[#121214]">
                    {t("settings.language_system_default", "System Default")}
                  </option>
                  {Object.keys(i18n.store.data).map(lang => (
                    <option key={lang} value={lang} className="bg-[#121214]">{getLanguageDisplayName(lang)}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed text-left w-full mt-1">
                {t("settings.language_disclaimer", "Translations are community-driven and may contain errors.")}
              </p>
            </div>
          </SettingRow>

          <SettingRow
            title={t("settings.auto_open_title", "Auto-open Browser")}
            description={t("settings.auto_open_desc", "Automatically launch the browser when Payload Manager payload is executed.")}
          >
            <ToggleSwitch
              on={autoOpen}
              onChange={(v) => onSaveConfig({ AUTO_BROWSER_OPEN: v })}
            />
          </SettingRow>

          <SettingRow
            title={t("settings.auto_install_title", "Auto-install App Launcher")}
            description={t("settings.auto_install_desc", "Automatically install the Payload Manager app to the PS5 home screen.")}
          >
            <ToggleSwitch
              on={autoInstall}
              onChange={(v) => onSaveConfig({ AUTO_INSTALL_APP: v })}
            />
          </SettingRow>

          <SettingRow
            title={t("settings.kill_disc_title", "Kill Disc Player")}
            description={t("settings.kill_disc_desc", "Automatically terminate the Disc Player application on startup (for BD-JB users).")}
          >
            <ToggleSwitch
              on={config.KILL_DISC_PLAYER_ON_STARTUP !== false}
              onChange={(v) => onSaveConfig({ KILL_DISC_PLAYER_ON_STARTUP: v })}
            />
          </SettingRow>

          <SettingRow
            title={t("settings.scan_usb_title", "Scan USB Payloads")}
            description={t("settings.scan_usb_desc", "Enable scanning for .elf and .bin files in the root directory of USB drives (/mnt/usb0-7).")}
          >
            <ToggleSwitch
              on={!!config.SCAN_USB_PAYLOADS}
              onChange={(v) => onSaveConfig({ SCAN_USB_PAYLOADS: v })}
            />
          </SettingRow>

          <div className="cp-delay-card">
            <div className="cp-delay-card__head">
              <div className="min-w-0 space-y-1">
                <p className="setting-row__title">{t("settings.autoload_delay_title", "Autoload Delay")}</p>
                <p className="setting-row__desc">{t("settings.autoload_delay_desc", "Wait time before the autoload sequence begins.")}</p>
              </div>
              <span className="cp-delay-card__value">{autoloadDelay}s</span>
            </div>
            <div className="cp-delay-card__chips">
              {[3, 5, 10].map((s) => (
                <HudButton
                  key={s}
                  onClick={() => onSaveConfig({ AUTOLOAD_DELAY: s })}
                  variant={autoloadDelay === s ? 'primary' : 'secondary'}
                  size="lg"
                  block
                  className={cn(autoloadDelay === s && 'cp-btn--selected is-selected')}
                >
                  {s}s
                </HudButton>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Source */}
      <section className="space-y-8">
        <h3 className="label-caps !text-ps-blue !opacity-100 flex items-center space-x-4 text-xl tracking-[0.2em]">
          <Globe className="w-6 h-6" />
          <span>{t("settings.sources_title", "Payload Sources")}</span>
        </h3>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SettingRow
            title={t("settings.multi_sources_title", "Multiple Payload Sources")}
            description={t("settings.multi_sources_desc", "Enable third-party payload repositories. Payloads from multiple sources are grouped by catalog in the Manage tab.")}
            icon={Globe}
          >
            <ToggleSwitch
              on={multiSources}
              onChange={(v) => onSaveConfig({ MULTI_SOURCES_ENABLED: v })}
            />
          </SettingRow>

          {multiSources && (
            <button
              type="button"
              onClick={() => onNavigate('sources')}
              className="setting-row group w-full text-left cursor-pointer hover:border-ps-blue/50"
            >
              <div className="setting-row__icon">
                <Globe className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="setting-row__copy">
                <p className="setting-row__title">{t("settings.manage_sources_title", "Manage Sources")}</p>
                <p className="setting-row__desc">{t("settings.manage_sources_desc", "Add, remove, or reorder your payload repositories.")}</p>
              </div>
              <div className="setting-row__control">
                <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-zinc-600 group-hover:text-ps-blue group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          )}
        </div>
      </section>

      {/* Diagnostics */}
      <section className="space-y-8">
        <h3 className="label-caps !text-ps-blue !opacity-100 flex items-center space-x-4 text-xl tracking-[0.2em]">
          <Terminal className="w-6 h-6" />
          <span>{t("settings.diagnostics_title", "Diagnostics")}</span>
        </h3>

        <button
          type="button"
          onClick={() => setShowLogs(true)}
          className="setting-row group w-full text-left cursor-pointer hover:border-ps-blue/50"
        >
          <div className="setting-row__icon">
            <Terminal className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="setting-row__copy">
            <p className="setting-row__title">{t("settings.log_viewer_title", "Open Log Viewer")}</p>
            <p className="setting-row__desc">{t("settings.log_viewer_desc", "Access real-time debug output from the Payload Manager daemon.")}</p>
          </div>
          <div className="setting-row__control">
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-zinc-600 group-hover:text-ps-blue group-hover:translate-x-1 transition-all" />
          </div>
        </button>
      </section>


    </div>
  )
}

export default SettingsView
