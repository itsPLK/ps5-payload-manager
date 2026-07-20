import React, { useEffect } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '../../utils/helpers'

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={cn(
      "cp-clip fixed top-8 right-8 z-[1000] flex items-center space-x-4 p-5 rounded-2xl border shadow-2xl animate-in slide-in-from-right duration-300 pointer-events-auto",
      type === 'success' ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-400" : "bg-red-950/90 border-red-500/50 text-red-400"
    )}>
      {type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
      <span className="font-bold uppercase tracking-tight">{message}</span>
    </div>
  )
}

export default Toast
