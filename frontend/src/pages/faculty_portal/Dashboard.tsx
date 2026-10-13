import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckSquare, ArrowRight, Camera, Loader2, Check } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { FaceAlignedImage } from '../../components/shared/FaceAlignedImage';
import { UpcomingInvigilationWidget } from './components/UpcomingInvigilationWidget';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../lib/api';
import { AnnouncementRenderer } from '../../components/announcements/AnnouncementRenderer';

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.28, delay: i * 0.07 } }),
};

export default function FacultyDashboard() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);

  const { data: summaryData } = useQuery({
    queryKey: ['requests-summary'],
    queryFn: () => api.getRequestsSummary(),
    refetchInterval: 30000,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: api.getAnnouncements,
    refetchInterval: 60000,
  });

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setIsUploadingPhoto(true);
    setPhotoSuccess(false);
    try {
      const { url } = await api.uploadProofDocument(file);
      if (url) {
        await updateProfile({ avatarUrl: url });
        void queryClient.invalidateQueries({ queryKey: ['faculty'] });
        void queryClient.invalidateQueries({ queryKey: ['requests'] });
        void queryClient.invalidateQueries({ queryKey: ['requests-summary'] });
        setPhotoSuccess(true);
        setTimeout(() => setPhotoSuccess(false), 3500);
      }
    } catch (err) {
      console.error('Faculty dashboard photo upload failed:', err);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const total = summaryData?.stats.total ?? 0;
  const pending = summaryData?.stats.pending ?? 0;
  const approved = summaryData?.stats.approved ?? 0;
  const rejected = summaryData?.stats.rejected ?? 0;

  return (
    <PageWrapper role="faculty">
      <div className="max-w-4xl mx-auto">

        {/* ── Dynamic Opening Animation / Popup Dialog ── */}
        <AnnouncementRenderer announcements={announcements} placement="POPUP" />

        {/* ── Dynamic Top Announcements / Banners ── */}
        <AnnouncementRenderer announcements={announcements} placement="HOME_TOP" />

        {/* ── Faculty Profile Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card overflow-hidden mb-6 sm:mb-8"
        >

          <div className="flex flex-col sm:flex-row items-stretch">
            {/* Photo – face-detected & auto-aligned with Cloudinary change button */}
            <div className="sm:w-48 w-full flex-shrink-0 relative group" style={{ minHeight: '220px' }}>
              <FaceAlignedImage
                src={user?.avatarUrl}
                fallbackName={user?.name || 'Faculty'}
                alt={user?.name || 'Faculty Profile'}
                containerClassName="w-full h-full"
                containerStyle={{ minHeight: '220px', height: '100%' }}
                className="w-full h-full sm:absolute sm:inset-0"
              />
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              <button
                type="button"
                disabled={isUploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 left-3 right-3 sm:right-auto sm:left-3 px-3 py-1.5 bg-black/65 hover:bg-black/85 text-white text-[11px] font-bold rounded-xl backdrop-blur-md flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer border border-white/20 opacity-90 hover:opacity-100"
              >
                {isUploadingPhoto ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-orange-400" />
                    <span>Uploading...</span>
                  </>
                ) : photoSuccess ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span>Updated!</span>
                  </>
                ) : (
                  <>
                    <Camera size={12} />
                    <span>Update Photo</span>
                  </>
                )}
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 p-5 sm:px-6 sm:py-5 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[11px] font-bold text-orange-500 uppercase tracking-widest">
                  FACULTY OVERVIEW
                </p>
                {photoSuccess && (
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                    <Check size={11} /> Photo updated across portal
                  </span>
                )}
              </div>
              <p className="text-[20px] sm:text-[22px] font-heading font-bold text-slate-900 mb-0.5">{user?.name}</p>
              <p className="text-[13px] sm:text-[14px] text-slate-500 mb-3">Professor</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 text-[11px] sm:text-[12px] font-semibold rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                  {user?.department ?? 'CSD'}
                </span>
                <span className="px-3 py-1 text-[11px] sm:text-[12px] font-semibold rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                  SRKR Engineering College
                </span>
              </div>
              <p className="text-[12px] sm:text-[13px] text-slate-400 mt-2.5">{user?.email}</p>
            </div>
          </div>
        </motion.div>

        {/* ── Upcoming Invigilation Duties Widget ── */}
        <div className="mb-6 sm:mb-8">
          <UpcomingInvigilationWidget />
        </div>

        {/* ── Take Attendance Primary Action Card (Between Overview & Stats) ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mb-6 sm:mb-8"
        >
          <div
            className="p-4 sm:p-5 rounded-2xl sm:rounded-[22px] flex items-center justify-between gap-3 shadow-lg shadow-orange-500/20"
            style={{
              background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/25">
                <CheckSquare size={22} className="text-white" />
              </div>
              <div className="min-w-0">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-extrabold text-[10px] uppercase tracking-wider inline-block mb-1 border border-white/20">
                  PRIMARY ACTION
                </span>
                <h3 className="text-[17px] sm:text-[19px] font-extrabold text-white leading-tight truncate">
                  Take Attendance
                </h3>
                <p className="text-[12px] text-orange-100 font-medium truncate">
                  Select section, period block, and...
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/faculty/attendance')}
              className="px-4 sm:px-5 py-2 bg-white hover:bg-orange-50 text-orange-600 font-extrabold text-[13px] rounded-full shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Open Roster</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </motion.div>

        {/* ── Dynamic Middle Announcements / Widgets ── */}
        <div className="mb-6 sm:mb-8">
          <AnnouncementRenderer announcements={announcements} placement="HOME_MIDDLE" />
        </div>

        {/* ── Summary Stats ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8"
        >
          {[
            { label: 'Total', value: total, color: 'text-slate-700', bg: 'bg-white' },
            { label: 'Pending', value: pending, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Approved', value: approved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Rejected', value: rejected, color: 'text-rose-500', bg: 'bg-rose-50' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className={`card px-5 py-4 ${s.bg}`}
            >
              <p className={`text-[30px] font-heading font-bold leading-none mb-1 ${s.color}`}>{s.value}</p>
              <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Dynamic Bottom Announcements ── */}
        <AnnouncementRenderer announcements={announcements} placement="HOME_BOTTOM" />

      </div>
    </PageWrapper>
  );
}
