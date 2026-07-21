import React from 'react'
import { Heart } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { isPS5 } from '../../utils/helpers'

const DonateView = () => {
  const { t } = useTranslation()
  const donateUrl = 'https://github.com/itsPLK/ps5-payload-manager/blob/main/DONATE.md';
  return (
    <div className="flex flex-col xl:flex-row items-center justify-center min-h-[60vh] animate-fade-in max-w-6xl mx-auto py-10 xl:py-20 gap-12 xl:gap-24">
      {/* Left Column */}
      <div className="flex flex-col items-center text-center space-y-8 md:space-y-10 flex-1 px-4">
        <div className="p-8 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] bg-red-600/10 border border-red-600/20 text-red-500 shadow-2xl inline-flex">
          <Heart className="w-16 h-16 md:w-20 md:h-20 fill-current animate-pulse" />
        </div>
        <div className="space-y-4 md:space-y-6">
          <h3 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter">
            {t("donate.title_1", "Support")} <span className="text-red-500">{t("donate.title_2", "Project")}</span>
          </h3>
          <p className="text-lg md:text-2xl text-zinc-400 font-medium leading-relaxed italic">
            {t("donate.description", "If you'd like to support my work or just say thanks, you can buy me a coffee. It's much appreciated!")}
          </p>
        </div>
      </div>

      {/* Right Column */}
      <div className="flex items-center justify-center flex-1 px-4">
        {isPS5 ? (
          <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-[0_0_60px_rgba(220,38,38,0.3)]">
            <QRCodeSVG value={donateUrl} size={isPS5 ? 280 : 180} level="H" />
          </div>
        ) : (
          <a
            href={donateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-10 md:px-16 py-6 md:py-8 bg-red-600 text-white text-xl md:text-3xl font-black uppercase rounded-2xl md:rounded-[2rem] hover:bg-red-500 transition-all transform active:scale-95 shadow-[0_0_50px_rgba(220,38,38,0.4)] text-center block"
          >
            {t("donate.view_options_btn", "View Donation Options")}
          </a>
        )}
      </div>
    </div>
  )
}

export default DonateView
