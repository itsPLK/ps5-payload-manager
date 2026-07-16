import React from 'react'
import { Zap, Usb } from 'lucide-react'
import { cn, resolvePayloadDisplay } from '../../utils/helpers'

const PayloadName = ({
  path,
  className,
  versionClassName,
  stacked = false,
  hideIcon = false,
  lastUpdate = null,
  metaVersion = null,
}) => {
  const { displayName, version, isDelay } = resolvePayloadDisplay(path, metaVersion);
  const isUsb = path?.startsWith('/mnt/usb');

  return (
    <div className={cn("flex min-w-0 flex-1 w-full", stacked ? "flex-col items-stretch" : "items-center space-x-3", className)}>
      <div className="flex items-center space-x-2 min-w-0">
        {isDelay && !hideIcon && <Zap className="w-4 h-4 text-ps-blue shrink-0" />}
        {isUsb && !hideIcon && <Usb className="w-5 h-5 text-ps-blue shrink-0 mr-1" />}
        <span className="font-bold truncate shrink leading-tight">{displayName}</span>
      </div>
      {(version || lastUpdate) && (
        <div className={cn("flex items-center", stacked ? "mt-1" : "")}>
          {version && (
            <span className={cn(
              stacked
                ? "text-[11px] font-bold tracking-wider text-ps-blue opacity-90"
                : "text-[10px] px-2 py-0.5 bg-ps-blue/10 text-ps-blue font-bold rounded-md border border-ps-blue/20 shrink-0",
              versionClassName)}>
              {version}
            </span>
          )}
          {version && lastUpdate && (
            <span className="text-[11px] text-zinc-600 mx-2">•</span>
          )}
          {lastUpdate && (
            <span className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
              {lastUpdate}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PayloadName
