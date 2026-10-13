import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Award,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  Check,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { verifyCertificateByToken } from '../lib/api';
import type { CertificateVerificationData } from '../lib/api';

const CATEGORY_NAMES: Record<string, string> = {
  internship: 'Internship',
  startup: 'Startup / Entrepreneurship',
  project_work: 'Project Work',
  sports: 'Sports & Athletics',
  house_events: 'House Events',
};

export default function CertificateVerifyPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<CertificateVerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    verifyCertificateByToken(token)
      .then((res) => setData(res))
      .catch(() => setData({ valid: false, message: 'Network error verifying certificate.' }))
      .finally(() => setLoading(false));
  }, [token]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600">Verifying institutional credentials...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.valid || !data.certificate) {
    const isRevoked = data?.status === 'revoked';
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isRevoked ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
          }`}>
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {isRevoked ? 'Certificate Revoked' : 'Verification Failed'}
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            {isRevoked
              ? `This certificate (${data?.certificateNumber || 'Record'}) was revoked by an institutional coordinator on ${data?.revokedAt ? new Date(data.revokedAt).toLocaleDateString() : 'record'}.`
              : 'This verification link is invalid or the credential record does not exist in AttendEase.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to AttendEase Home
          </Link>
        </motion.div>
      </div>
    );
  }

  const { certificate } = data;

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation & Action Bar */}
        <div className="flex items-center justify-between no-print">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" /> AttendEase Verification Registry
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Link Copied' : 'Share Link'}
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* Certificate Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative print:shadow-none print:border-none"
        >
          {/* Top Decorative Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-8 py-8 sm:px-12 sm:py-10 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium mb-4 border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" /> Authenticated Institutional Credential
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif tracking-wide mb-2 text-white font-bold">
              CERTIFICATE OF PARTICIPATION
            </h1>
            <p className="text-xs uppercase tracking-widest text-slate-300 font-sans">
              AttendEase Verified Student Achievement Record
            </p>
            <div className="mt-4 text-xs font-mono text-indigo-300 bg-white/5 inline-block px-3 py-1 rounded-md border border-white/10">
              Ref: {certificate.certificateNumber}
            </div>
          </div>

          {/* Certificate Content Body */}
          <div className="p-8 sm:p-12 space-y-8">
            {/* Recipient Statement */}
            <div className="text-center space-y-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
                This is to certify that
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-serif">
                {certificate.studentName}
              </h2>
              <p className="text-sm text-slate-600 max-w-lg mx-auto">
                {certificate.studentRollNumber && (
                  <span className="font-semibold text-slate-800">Roll No: {certificate.studentRollNumber} &bull; </span>
                )}
                <span>Department of {certificate.studentDepartment}</span>
                {certificate.studentYear && <span>, {certificate.studentYear} Year</span>}
                {certificate.studentSection && <span> (Sec {certificate.studentSection})</span>}
              </p>
            </div>

            {/* Participation Details */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                    {CATEGORY_NAMES[certificate.category] || certificate.category}
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {certificate.titleOrCompany}
                  </div>
                  {certificate.roleOrPosition && (
                    <div className="text-sm font-medium text-slate-600">
                      Role / Position: <span className="text-slate-800 font-semibold">{certificate.roleOrPosition}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tenure & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <div className="text-xs text-slate-600">
                    <span className="block text-slate-400 uppercase font-medium">Effective Tenure</span>
                    <span className="font-semibold text-slate-800">
                      {certificate.effectiveStartDate ? new Date(certificate.effectiveStartDate).toLocaleDateString() : 'N/A'}
                      {' — '}
                      {certificate.effectiveEndDate ? new Date(certificate.effectiveEndDate).toLocaleDateString() : 'Present'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <div className="text-xs text-slate-600">
                    <span className="block text-slate-400 uppercase font-medium">Status</span>
                    <span className={`inline-flex items-center gap-1 font-semibold ${
                      certificate.tenure === 'active' ? 'text-blue-700' : 'text-emerald-700'
                    }`}>
                      {certificate.tenure === 'active' ? 'Active Participation' : 'Completed Participation'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Participation Note */}
              {certificate.participationNote && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{certificate.participationNote}</span>
                </div>
              )}
            </div>

            {/* Institutional Verification Block (Not digital signature) */}
            <div className="pt-6 border-t-2 border-dashed border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
                  Institutional Verification Details
                </div>
                <div className="text-slate-700">
                  <span className="font-medium text-slate-900">{certificate.issuedBy.name}</span>
                  {certificate.issuedBy.designation && <span> &bull; {certificate.issuedBy.designation}</span>}
                </div>
                <div>Faculty Coordinator, {certificate.issuedBy.department}</div>
                <div className="text-slate-400">
                  Approved on: {new Date(certificate.issuedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium">Digitally Verified via AttendEase</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Registry Token: {token?.slice(0, 12)}...
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400 no-print">
          This document is generated and authenticated via AttendEase Student Activity & Verification Registry.
        </div>
      </div>
    </div>
  );
}
