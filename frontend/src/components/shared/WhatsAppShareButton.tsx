import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { AttendanceRequest } from '../../lib/api';
import * as api from '../../lib/api';

import whatsappLogo from '../../assets/whatsapp-logo.png';

export const WhatsAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <img
    src={whatsappLogo}
    alt="WhatsApp"
    width={size}
    height={size}
    className={`inline-block object-contain pointer-events-none select-none shrink-0 ${className}`}
    style={{ width: size, height: size }}
  />
);

interface WhatsAppShareButtonProps {
  request?: AttendanceRequest | null;
  className?: string;
  variant?: 'primary' | 'secondary' | 'icon' | 'round';
  showCopyOption?: boolean;
}

/** Helper to get or build the dedicated share link URL */
async function resolveShareUrl(request?: AttendanceRequest | null): Promise<string> {
  const origin = window.location.origin;

  if (request?.shareUrl && request.shareUrl.startsWith('/r/')) {
    return `${origin}${request.shareUrl}`;
  }

  if (request?.shareToken) {
    return `${origin}/r/${request.shareToken}`;
  }

  // Fetch/create share token from backend (uses the canonical share-link endpoint)
  const reqId = request?.publicId || request?.id || (request as any)?.requestId || (request as any)?._id;
  if (reqId) {
    try {
      const linkRes = await api.getRequestShareLink(reqId);
      if (linkRes?.shareToken) {
        return `${origin}/r/${linkRes.shareToken}`;
      }
      if (linkRes?.shareUrl) {
        return `${origin}${linkRes.shareUrl.startsWith('/') ? '' : '/'}${linkRes.shareUrl}`;
      }
    } catch (err) {
      console.warn('Could not fetch share link:', err);
    }
  }

  // Fallback: If no request object passed, fetch student's latest request from API
  try {
    const list = await api.getRequests();
    if (list && list.length > 0) {
      const first = list[0];
      if (first.shareUrl) return `${origin}${first.shareUrl}`;
      if (first.shareToken) return `${origin}/r/${first.shareToken}`;
      const firstId = first.publicId || first.id;
      if (firstId) {
        const linkRes = await api.getRequestShareLink(firstId);
        if (linkRes?.shareToken) return `${origin}/r/${linkRes.shareToken}`;
        if (linkRes?.shareUrl) return `${origin}${linkRes.shareUrl.startsWith('/') ? '' : '/'}${linkRes.shareUrl}`;
      }
    }
  } catch (err) {
    console.warn('Fallback getStudentRequests failed:', err);
  }

  return `${origin}/permissions`;
}

export const WhatsAppShareButton: React.FC<WhatsAppShareButtonProps> = ({
  request,
  className = '',
  variant = 'primary',
}) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);

    try {
      const shareUrl = await resolveShareUrl(request);

      // Strict Section 5 Safe Message Format: NO sensitive personal or request details exposed
      const message = `Attendance Permission Request\n\nPlease review my attendance permission request:\n${shareUrl}`;

      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.warn('Share error:', err);
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Attendance Permission Request\n\nPlease review my attendance permission request:\n${window.location.origin}/permissions`)}`, '_blank', 'noopener,noreferrer');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const shareUrl = await resolveShareUrl(request);
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  if (variant === 'round') {
    return (
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={handleShare}
          disabled={loading}
          title="Share Request on WhatsApp"
          className={`w-13 h-13 rounded-full bg-white hover:bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-center shadow-md shadow-[#25D366]/25 active:scale-95 transition-all cursor-pointer ${className}`}
        >
          {loading ? (
            <span className="w-5 h-5 rounded-full border-2 border-emerald-500/30 border-t-emerald-600 inline-block animate-spin" />
          ) : (
            <WhatsAppIcon size={28} />
          )}
        </button>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleShare}
        disabled={loading}
        title="Share on WhatsApp"
        className={`p-2.5 rounded-full bg-white hover:bg-emerald-50 border border-emerald-200/80 transition-all cursor-pointer flex items-center justify-center ${className}`}
      >
        <WhatsAppIcon size={20} />
      </button>
    );
  }

  if (variant === 'secondary') {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={loading}
          className={`px-3.5 py-2 text-xs font-bold rounded-full bg-white hover:bg-emerald-50 text-[#128C7E] border border-emerald-200 transition-all cursor-pointer flex items-center gap-2 ${className}`}
        >
          <WhatsAppIcon size={18} />
          <span>Share on WhatsApp</span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          title="Copy Link"
          className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer text-xs"
        >
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
      <button
        type="button"
        onClick={handleShare}
        disabled={loading}
        className={`w-full h-12 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-[14.5px] font-bold transition-all shadow-md shadow-[#25D366]/25 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2.5 ${className}`}
      >
        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
          <WhatsAppIcon size={18} />
        </div>
        <span>Share on WhatsApp</span>
      </button>

      <button
        type="button"
        onClick={handleCopy}
        title="Copy Share Link"
        className="w-full sm:w-auto px-4 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13.5px] font-bold border border-slate-200/80 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
      >
        {copied ? (
          <>
            <Check size={16} className="text-emerald-600" />
            <span className="text-emerald-700">Copied</span>
          </>
        ) : (
          <>
            <Copy size={16} />
            <span>Copy Link</span>
          </>
        )}
      </button>
    </div>
  );
};

export const CopyShareLinkButton: React.FC<{ request?: AttendanceRequest | null; className?: string }> = ({
  request,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const shareUrl = await resolveShareUrl(request);
      if (!shareUrl) return;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy Share Link"
      className={`px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold border border-slate-200 transition-all flex items-center gap-2 cursor-pointer ${className}`}
    >
      {copied ? (
        <>
          <Check size={14} className="text-emerald-600" />
          <span className="text-emerald-700 font-semibold">Link Copied!</span>
        </>
      ) : (
        <>
          <Copy size={14} />
          <span>Copy Link</span>
        </>
      )}
    </button>
  );
};
