/**
 * 更新通知对话框
 *
 * 弹出提示框展示新版本信息，用户可选择立即跳转下载或稍后提醒。
 */

import { X, ExternalLink, Download } from 'lucide-react';
import type { UpdateInfo } from '@/lib/updateChecker';

interface UpdateDialogProps {
  info: UpdateInfo;
  onDismiss: () => void;
  onDownload: () => void;
}

export function UpdateDialog({ info, onDismiss, onDownload }: UpdateDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-[#c9a96e]/20 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c9a96e]/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#c9a96e]/10 flex items-center justify-center">
              <Download size={18} className="text-[#c9a96e]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f5f0e8]">发现新版本</h3>
              <p className="text-xs text-[#f5f0e8]/40">
                当前版本可升级至 {info.version}
                {info.isPrerelease && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400/80 border border-amber-400/20">
                    预发布
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-[#f5f0e8]/30 hover:text-[#f5f0e8]/60 hover:bg-[#f5f0e8]/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Release notes */}
        {info.body && (
          <div className="px-6 py-4 max-h-48 overflow-y-auto">
            <p className="text-xs text-[#f5f0e8]/50 uppercase tracking-wider mb-2">更新内容</p>
            <div className="text-sm text-[#f5f0e8]/70 leading-relaxed whitespace-pre-wrap break-words">
              {info.body.length > 800 ? info.body.slice(0, 800) + '\n\n...' : info.body}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#c9a96e]/10">
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-[#f5f0e8]/50 hover:text-[#f5f0e8]/70 hover:bg-[#f5f0e8]/5 transition-colors"
          >
            稍后提醒
          </button>
          <button
            onClick={onDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#c9a96e]/20 border border-[#c9a96e]/30 text-sm font-medium text-[#c9a96e] hover:bg-[#c9a96e]/30 transition-colors"
          >
            <ExternalLink size={15} />
            查看更新
          </button>
        </div>
      </div>
    </div>
  );
}
