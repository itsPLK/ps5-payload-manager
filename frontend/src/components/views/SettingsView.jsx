import React, { useState } from 'react'
import { Terminal, ChevronRight, Globe, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'

const FOLLOW_BROWSER_LANGUAGE = '__auto__'

const isFollowingBrowserLanguage = () => {
  try {
    return !localStorage.getItem('i18nextLng')
  } catch {
    return true
  }
}

const SettingRow = ({ title, description, children, icon: Icon, vertical }) => (
  <div className={cn(
    "p-5 md:p-8 bg-white/[0.03] rounded-3xl border border-white/10 hover:border-ps-blue/30 transition-all group h-full",
    vertical ? "flex flex-col space-y-4" : "grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 md:flex md:items-center md:justify-between md:gap-6"
  )}>
    <div className="flex items-start md:items-center space-x-4 md:space-x-6 min-w-0 col-span-1">
      {Icon && (
        <div className="p-3 md:p-4 bg-white/5 rounded-2xl group-hover:bg-ps-blue/10 transition-colors shrink-0">
          <Icon className="w-5 h-5 md:w-6 md:h-6 text-zinc-500 group-hover:text-ps-blue transition-colors" />
        </div>
      )}
      <div className="space-y-1 min-w-0">
        <p className="font-bold text-white uppercase text-base md:text-lg tracking-tight leading-tight">{title}</p>
        <p className={cn("text-sm text-zinc-500 max-w-md leading-relaxed", vertical ? "block mt-2" : "hidden md:!block")}>{description}</p>
      </div>
    </div>
    <div className={cn("shrink-0", vertical ? "w-full pt-2" : "col-start-2 row-start-1 md:ml-8 self-center md:self-auto")}>
      {children}
    </div>
    {!vertical && (
      <p className="md:hidden col-span-2 text-xs text-zinc-500 leading-relaxed">
        {description}
      </p>
    )}
  </div>
)

const SettingsView = ({ config, onSaveConfig, setShowLogs, onNavigate }) => {
  const { t, i18n } = useTranslation()
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
            <button
              onClick={() => onSaveConfig({ AUTO_BROWSER_OPEN: !autoOpen })}
              className={cn(
                "w-14 h-7 md:w-20 md:h-10 rounded-full transition-all relative p-1 md:p-1.5",
                autoOpen ? "bg-ps-blue" : "bg-white/10"
              )}
            >
              <div className={cn(
                "w-5 h-5 md:w-7 md:h-7 bg-white rounded-full transition-all",
                autoOpen ? "translate-x-7 md:translate-x-10" : "translate-x-0"
              )} />
            </button>
          </SettingRow>

          <SettingRow
            title={t("settings.auto_install_title", "Auto-install App Launcher")}
            description={t("settings.auto_install_desc", "Automatically install the Payload Manager app to the PS5 home screen.")}
          >
            <button
              onClick={() => onSaveConfig({ AUTO_INSTALL_APP: !autoInstall })}
              className={cn(
                "w-14 h-7 md:w-20 md:h-10 rounded-full transition-all relative p-1 md:p-1.5",
                autoInstall ? "bg-ps-blue" : "bg-white/10"
              )}
            >
              <div className={cn(
                "w-5 h-5 md:w-7 md:h-7 bg-white rounded-full transition-all",
                autoInstall ? "translate-x-7 md:translate-x-10" : "translate-x-0"
              )} />
            </button>
          </SettingRow>

          <SettingRow
            title={t("settings.kill_disc_title", "Kill Disc Player")}
            description={t("settings.kill_disc_desc", "Automatically terminate the Disc Player application on startup (for BD-JB users).")}
          >
            <button
              onClick={() => onSaveConfig({ KILL_DISC_PLAYER_ON_STARTUP: !config.KILL_DISC_PLAYER_ON_STARTUP })}
              className={cn(
                "w-14 h-7 md:w-20 md:h-10 rounded-full transition-all relative p-1 md:p-1.5",
                config.KILL_DISC_PLAYER_ON_STARTUP !== false ? "bg-ps-blue" : "bg-white/10"
              )}
            >
              <div className={cn(
                "w-5 h-5 md:w-7 md:h-7 bg-white rounded-full transition-all",
                config.KILL_DISC_PLAYER_ON_STARTUP !== false ? "translate-x-7 md:translate-x-10" : "translate-x-0"
              )} />
            </button>
          </SettingRow>

          <SettingRow
            title={t("settings.scan_usb_title", "Scan USB Payloads")}
            description={t("settings.scan_usb_desc", "Enable scanning for .elf and .bin files in the root directory of USB drives (/mnt/usb0-7).")}
          >
            <button
              onClick={() => onSaveConfig({ SCAN_USB_PAYLOADS: !config.SCAN_USB_PAYLOADS })}
              className={cn(
                "w-14 h-7 md:w-20 md:h-10 rounded-full transition-all relative p-1 md:p-1.5",
                config.SCAN_USB_PAYLOADS ? "bg-ps-blue" : "bg-white/10"
              )}
            >
              <div className={cn(
                "w-5 h-5 md:w-7 md:h-7 bg-white rounded-full transition-all",
                config.SCAN_USB_PAYLOADS ? "translate-x-7 md:translate-x-10" : "translate-x-0"
              )} />
            </button>
          </SettingRow>

          <div className="flex flex-col justify-between p-8 bg-white/[0.03] rounded-3xl border border-white/10 space-y-8 h-full">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <p className="font-bold text-white uppercase text-lg tracking-tight">{t("settings.autoload_delay_title", "Autoload Delay")}</p>
                <p className="text-sm text-zinc-500">{t("settings.autoload_delay_desc", "Wait time before the autoload sequence begins.")}</p>
              </div>
              <span className="text-ps-blue font-black text-4xl italic tracking-tighter">{autoloadDelay}s</span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[3, 5, 10].map(s => (
                <button
                  key={s}
                  onClick={() => onSaveConfig({ AUTOLOAD_DELAY: s })}
                  className={cn(
                    "py-5 rounded-2xl font-black text-xl transition-all border uppercase italic",
                    autoloadDelay === s
                      ? "bg-ps-blue border-ps-blue text-white scale-[1.02]"
                      : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {s}s
                </button>
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
            <button
              onClick={() => onSaveConfig({ MULTI_SOURCES_ENABLED: !multiSources })}
              className={cn(
                "w-14 h-7 md:w-20 md:h-10 rounded-full transition-all relative p-1 md:p-1.5",
                multiSources ? "bg-ps-blue" : "bg-white/10"
              )}
            >
              <div className={cn(
                "w-5 h-5 md:w-7 md:h-7 bg-white rounded-full transition-all",
                multiSources ? "translate-x-7 md:translate-x-10" : "translate-x-0"
              )} />
            </button>
          </SettingRow>

          {multiSources && (
            <button
              onClick={() => onNavigate('sources')}
              className="group w-full text-left grid grid-cols-[1fr_auto] md:flex md:items-center md:justify-between p-5 md:p-8 bg-white/[0.03] rounded-3xl border border-white/10 hover:border-ps-blue/50 hover:bg-ps-blue/5 transition-all gap-x-4 gap-y-3 md:gap-6"
            >
              <div className="flex items-start md:items-center space-x-4 md:space-x-6 min-w-0 col-span-1">
                <div className="p-3 md:p-4 bg-white/5 rounded-2xl group-hover:bg-ps-blue/10 transition-colors shrink-0">
                  <Globe className="w-5 h-5 md:w-6 md:h-6 text-zinc-500 group-hover:text-ps-blue transition-colors" />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="font-bold text-white uppercase text-base md:text-lg tracking-tight leading-tight">{t("settings.manage_sources_title", "Manage Sources")}</p>
                  <p className="hidden md:!block text-sm text-zinc-500 max-w-md leading-relaxed">{t("settings.manage_sources_desc", "Add, remove, or reorder your payload repositories.")}</p>
                </div>
              </div>
              <div className="shrink-0 col-start-2 row-start-1 md:ml-8 self-center md:self-auto">
                <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-zinc-700 group-hover:text-ps-blue group-hover:translate-x-2 transition-all" />
              </div>
              <p className="md:hidden col-span-2 text-xs text-zinc-500 leading-relaxed">
                {t("settings.manage_sources_desc", "Add, remove, or reorder your payload repositories.")}
              </p>
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
          onClick={() => setShowLogs(true)}
          className="group w-full text-left grid grid-cols-[1fr_auto] md:flex md:items-center md:justify-between p-5 md:p-8 bg-white/[0.03] rounded-3xl border border-white/10 hover:border-ps-blue/50 hover:bg-ps-blue/5 transition-all gap-x-4 gap-y-3 md:gap-6"
        >
          <div className="flex items-start md:items-center space-x-4 md:space-x-6 min-w-0 col-span-1">
            <div className="p-3 md:p-4 bg-white/5 rounded-2xl group-hover:bg-ps-blue/10 transition-colors shrink-0">
              <Terminal className="w-5 h-5 md:w-6 md:h-6 text-zinc-500 group-hover:text-ps-blue transition-colors" />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="font-bold text-white uppercase text-base md:text-lg tracking-tight leading-tight">{t("settings.log_viewer_title", "Open Log Viewer")}</p>
              <p className="hidden md:!block text-sm text-zinc-500 max-w-md leading-relaxed">{t("settings.log_viewer_desc", "Access real-time debug output from the Payload Manager daemon.")}</p>
            </div>
          </div>
          <div className="shrink-0 col-start-2 row-start-1 md:ml-8 self-center md:self-auto">
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-zinc-700 group-hover:text-ps-blue group-hover:translate-x-2 transition-all" />
          </div>
          <p className="md:hidden col-span-2 text-xs text-zinc-500 leading-relaxed">
            {t("settings.log_viewer_desc", "Access real-time debug output from the Payload Manager daemon.")}
          </p>
        </button>
      </section>


    </div>
  )
}

export default SettingsView
