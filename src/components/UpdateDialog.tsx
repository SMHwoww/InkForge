/**
 * 更新通知对话框
 *
 * 弹出提示框展示新版本信息，用户可选择下载安装或稍后提醒。
 * 支持显示下载进度条。
 */

import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { UpdateInfo, DownloadStatus } from '@/lib/updateChecker';
import { startDownload, pollDownloadStatus } from '@/lib/updateChecker';

interface UpdateDialogProps {
  info: UpdateInfo;
  onDismiss: () => void;
  onDownload: () => void;
}

export function UpdateDialog({ info, onDismiss, onDownload }: UpdateDialogProps) {
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleDownload = async () => {
    if (!info.downloadUrl) {
      // 没有可下载的资产，打开浏览器页面
      onDownload();
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const { downloadId } = await startDownload(info.downloadUrl, info.version);

      // 每秒轮询下载进度
      pollRef.current = setInterval(async () => {
        try {
          const status = await pollDownloadStatus(downloadId);
          setDownloadStatus(status);

          if (status.status === 'completed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setIsDownloading(false);
          } else if (status.status === 'error') {
            if (pollRef.current) clearInterval(pollRef.current);
            setDownloadError(status.error || '下载失败');
            setIsDownloading(false);
          }
        } catch {
          // 轮询错误，静默重试
        }
      }, 1000);
    } catch (e: any) {
      setDownloadError(e.message || '启动下载失败');
      setIsDownloading(false);
    }
  };

  const handleOpenFile = () => {
    if (downloadStatus?.destPath) {
      // 打开文件所在目录
      window.open(`file:///${downloadStatus.destPath.replace(/\\/g, '/')}`, '_blank');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const progressPercent = downloadStatus && downloadStatus.total > 0
    ? Math.round((downloadStatus.progress / downloadStatus.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-[#c9a96e]/20 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c9a96e]/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#c9a96e]/10 flex items-center justify-center">
              {downloadStatus?.status === 'completed' ? (
                <CheckCircle size={18} className="text-green-400" />
              ) : isDownloading ? (
                <Loader2 size={18} className="text-[#c9a96e] animate-spin" />
              ) : (
                <Download size={18} className="text-[#c9a96e]" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f5f0e8]">
                {downloadStatus?.status === 'completed' ? '下载完成' : '发现新版本'}
              </h3>
              <p className="text-xs text-[#f5f0e8]/40">
                {downloadStatus?.status === 'completed'
                  ? `已保存至本地，请手动安装`
                  : `当前版本可升级至 ${info.version}`}
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

        {/* Download Progress */}
        {isDownloading && downloadStatus && (
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[#f5f0e8]/50">正在下载 {info.downloadName || info.version}</p>
              <p className="text-xs text-[#f5f0e8]/40">
                {formatSize(downloadStatus.progress)}
                {downloadStatus.total > 0 && ` / ${formatSize(downloadStatus.total)}`}
              </p>
            </div>
            <div className="w-full h-2 bg-[#f5f0e8]/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#c9a96e] rounded-full transition-all duration-300"
                style={{ width: `${downloadStatus.total > 0 ? progressPercent : 10}%` }}
              />
            </div>
            {downloadStatus.total === 0 && (
              <p className="text-xs text-[#f5f0e8]/30 mt-1.5">正在连接...</p>
            )}
          </div>
        )}

        {/* Download Error */}
        {downloadError && (
          <div className="px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              <span>{downloadError}</span>
            </div>
          </div>
        )}

        {/* Release notes */}
        {info.body && !isDownloading && downloadStatus?.status !== 'completed' && (
          <div className="px-6 py-4 max-h-48 overflow-y-auto">
            <p className="text-xs text-[#f5f0e8]/50 uppercase tracking-wider mb-2">更新内容</p>
            <div className="text-sm text-[#f5f0e8]/70 leading-relaxed whitespace-pre-wrap break-words">
              {info.body.length > 800 ? info.body.slice(0, 800) + '\n\n...' : info.body}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#c9a96e]/10">
          {downloadStatus?.status === 'completed' ? (
            <>
              <button
                onClick={onDismiss}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-[#f5f0e8]/50 hover:text-[#f5f0e8]/70 hover:bg-[#f5f0e8]/5 transition-colors"
              >
                关闭
              </button>
              <button
                onClick={handleOpenFile}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/20 border border-green-400/30 text-sm font-medium text-green-400 hover:bg-green-500/30 transition-colors"
              >
                <ExternalLink size={15} />
                打开文件
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onDismiss}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-[#f5f0e8]/50 hover:text-[#f5f0e8]/70 hover:bg-[#f5f0e8]/5 transition-colors"
                disabled={isDownloading}
              >
                稍后提醒
              </button>
              {isDownloading ? (
                <button
                  disabled
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#c9a96e]/10 border border-[#c9a96e]/20 text-sm font-medium text-[#c9a96e]/50"
                >
                  <Loader2 size={15} className="animate-spin" />
                  下载中...
                </button>
              ) : (
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#c9a96e]/20 border border-[#c9a96e]/30 text-sm font-medium text-[#c9a96e] hover:bg-[#c9a96e]/30 transition-colors"
                >
                  {info.downloadUrl ? (
                    <>
                      <Download size={15} />
                      下载更新
                    </>
                  ) : (
                    <>
                      <ExternalLink size={15} />
                      查看更新
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
