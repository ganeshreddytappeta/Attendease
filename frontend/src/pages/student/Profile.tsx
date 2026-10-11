import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, IdCard, Building2, GraduationCap,
  Mail, Phone, ChevronRight, Lock, CheckCircle2,
  Circle, Lightbulb, ClipboardList, Check, AlertCircle, Loader2, LogOut,
  MessageSquare
} from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import srkrEmblem from '../../assets/srkr-emblem.png';
import { useAuth } from '../../context/AuthContext';
import { VerifiedActivityBadge } from '../../components/shared/VerifiedActivityBadge';

/* ── Shared style helpers ── */
const card = (extra: object = {}): React.CSSProperties => ({
  background: '#ffffff',
  borderRadius: 20,
  border: '1px solid #EEF2F7',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  ...extra,
});

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  height: 44, padding: '0 14px 0 38px',
  fontSize: 14, color: '#1E293B',
  background: '#F8FAFC', border: '1.5px solid #E8EDF2',
  borderRadius: 12, outline: 'none',
  fontFamily: 'inherit',
  transition: 'all 0.15s ease',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#374151',
  marginBottom: 6, display: 'block', letterSpacing: '0.01em',
};

const icoWrap: React.CSSProperties = {
  position: 'absolute', left: 12, top: '50%',
  transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none',
};

const TABS = ['Personal Information', 'Account Settings'] as const;
type Tab = typeof TABS[number];

/* ── Circular progress SVG ── */
function CircularProgress({ pct }: { pct: number }) {
  const r = 46, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={60} cy={60} r={r} fill="none" stroke="#EEF2F7" strokeWidth={10} />
      <circle
        cx={60} cy={60} r={r} fill="none"
        stroke="#F97316" strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateProfile } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const [tab, setTab] = useState<Tab>((location.state as any)?.tab || 'Personal Information');

  /* editable fields */
  const [fullName, setFullName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '+91 98765 43210');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [semester, setSemester] = useState<number | string>(user?.semester || 6);

  /* Password settings state */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /* UI feedback state */
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAvatarPrompt, setShowAvatarPrompt] = useState(false);

  // Sync state if user rehydrates
  useEffect(() => {
    if (user) {
      setFullName(user.name || '');
      setEmail(user.email || '');
      if (user.phone) setPhone(user.phone);
      if (user.avatarUrl) setAvatarUrl(user.avatarUrl);
      if (user.semester) setSemester(user.semester);
    }
  }, [user]);

  const focusIn = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#F97316';
    e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.09)';
    e.target.style.background = '#fff';
  };
  const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#E8EDF2';
    e.target.style.boxShadow = 'none';
    e.target.style.background = '#F8FAFC';
  };

  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      await updateProfile({
        name: fullName,
        email,
        phone,
        avatarUrl,
        semester: Number(semester),
      });
      setMessage({ type: 'success', text: 'Personal information updated and saved to database!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save personal information.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!currentPassword || !currentPassword.trim()) {
      setMessage({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (!newPassword || !newPassword.trim()) {
      setMessage({ type: 'error', text: 'Please enter a new password.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({
        currentPassword: currentPassword.trim(),
        password: newPassword.trim(),
      });
      setMessage({ type: 'success', text: 'Password successfully updated and saved to database!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarSave = async () => {
    if (!avatarUrl.trim()) return;
    setIsSaving(true);
    try {
      await updateProfile({ avatarUrl: avatarUrl.trim() });
      setMessage({ type: 'success', text: 'Profile photo updated successfully!' });
      setShowAvatarPrompt(false);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to update photo.' });
    } finally {
      setIsSaving(false);
    }
  };

  const completion = [
    { label: 'Personal Information', done: !!(fullName && email && phone) },
    { label: 'Profile Photo',        done: !!avatarUrl },
    { label: 'Account Security',     done: true },
  ];
  const completedCount = completion.filter(c => c.done).length;
  const completionPct = Math.round((completedCount / completion.length) * 100);

  return (
    <PageWrapper role="student">
      <style>{`
        .profile-tabs-card { padding: 0 !important; overflow: hidden !important; }
        .profile-tabs-header { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; width: 100% !important; min-width: 0 !important; }
        .profile-tab-btn { flex: 1 !important; width: 100% !important; min-width: 0 !important; justify-content: center !important; text-align: center !important; }
        @media (max-width: 768px) {
          .profile-hero-card { flex-direction: column !important; align-items: stretch !important; gap: 16px !important; padding: 20px 16px !important; width: 100% !important; box-sizing: border-box !important; }
          .profile-info-block { width: 100% !important; min-width: 0 !important; }
          .profile-info-chips { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 12px 14px !important; width: 100% !important; }
          .profile-tabs-card { padding: 0 !important; overflow: hidden !important; }
          .profile-tabs-header { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; width: 100% !important; min-width: 0 !important; }
          .profile-tab-btn { padding: 13px 4px !important; font-size: 12px !important; gap: 5px !important; }
          .profile-tab-wrapper { flex-direction: column !important; gap: 18px !important; width: 100% !important; align-items: stretch !important; }
          .profile-main-column { width: 100% !important; flex: none !important; box-sizing: border-box !important; min-width: 0 !important; }
          .profile-section-personal.tab-hidden { display: none !important; }
          .profile-section-account.tab-hidden { display: none !important; }
          .profile-form-card { padding: 20px 16px !important; width: 100% !important; box-sizing: border-box !important; max-width: 100% !important; overflow: hidden !important; }
          .profile-form-row { grid-template-columns: 1fr !important; gap: 14px !important; width: 100% !important; }
          .profile-sidebar { width: 100% !important; box-sizing: border-box !important; }
          .session-mgmt-block { display: none !important; }
        }
        @media (max-width: 380px) {
          .profile-tab-btn { font-size: 11px !important; padding: 11px 2px !important; gap: 4px !important; }
        }
        @media (min-width: 769px) {
          .profile-section-personal.tab-hidden { display: none !important; }
          .profile-section-account.tab-hidden { display: none !important; }
        }
      `}</style>

      {/* Breadcrumb & Small Feedback Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94A3B8' }}>
          <Link to="/student" style={{ color: '#F97316', textDecoration: 'none', fontWeight: 500 }}>Home</Link>
          <ChevronRight size={13} />
          <span style={{ color: '#64748B' }}>Profile</span>
        </div>
        <a
          href="https://forms.gle/girGw3vVdUfCR5zR6"
          target="_blank"
          rel="noopener noreferrer"
          title="Give Feedback & Report Issues"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 9999,
            fontSize: 12, fontWeight: 600,
            color: '#475569', background: '#FFFFFF',
            border: '1px solid #E2E8F0', textDecoration: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#EA580C';
            e.currentTarget.style.background = '#FFF7ED';
            e.currentTarget.style.borderColor = '#FDBA74';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#475569';
            e.currentTarget.style.background = '#FFFFFF';
            e.currentTarget.style.borderColor = '#E2E8F0';
          }}
        >
          <MessageSquare size={13.5} style={{ color: '#F97316' }} />
          <span>Feedback</span>
        </a>
      </div>

      {/* Alert Banner */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 14, marginBottom: 18, fontSize: 13, fontWeight: 600,
            background: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: message.type === 'success' ? '#047857' : '#B91C1C',
            border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          }}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </motion.div>
      )}

      {/* ── Hero Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}
        className="profile-hero-card"
        style={{
          ...card({ padding: '28px 32px', marginBottom: 24 }),
          background: 'linear-gradient(135deg, rgba(249,115,22,0.06) 0%, #F0F9FF 50%, #F8FAFC 100%)',
          display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
        }}
      >
        {/* Avatar attached directly to student card */}
        <div
          className="profile-avatar-card"
          style={{
            width: 140,
            height: avatarUrl ? 175 : 140,
            borderRadius: 14,
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
          ) : (
            <img src={srkrEmblem} alt="Avatar" style={{ width: 68, height: 68, objectFit: 'contain', opacity: 0.7 }} />
          )}
        </div>

        {/* Name + Info chips */}
        <div className="profile-info-block" style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>{user?.name || fullName}</h1>
            <VerifiedActivityBadge student={user} studentId={user?.userId || user?.id} rollNumber={(user as any)?.rollNumber} size="md" />
          </div>
          <span style={{
            display: 'inline-block', padding: '3px 12px', borderRadius: 20,
            background: 'rgba(249,115,22,0.1)', color: '#F97316', fontSize: 12, fontWeight: 700, marginBottom: 16,
          }}>Student · {user?.department || 'CSIT'}</span>

          <div className="profile-info-chips" style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {[
              { icon: IdCard, label: 'Roll Number', value: user?.rollNumber || '24B91A0720' },
              { icon: Building2, label: 'Branch', value: user?.department || 'CSIT' },
              { icon: GraduationCap, label: 'Semester', value: user?.semester ? `Sem ${user.semester}` : 'Semester 6' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={16} style={{ color: '#64748B' }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 1px' }}>{value}</p>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>


      </motion.div>

      {/* Avatar URL Edit Prompt */}
      {showAvatarPrompt && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{ ...card({ padding: '16px 20px', marginBottom: 20, background: '#FFF7ED', borderColor: '#FFEDD5' }) }}
        >
          <label style={{ fontSize: 12, fontWeight: 700, color: '#C2410C', display: 'block', marginBottom: 6 }}>
            Update Profile Photo Image URL
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              placeholder="e.g. https://srkrexams.in/SRKR/photo/24B91A0720.jpg"
              value={avatarUrl}
              onChange={e => setAvatarUrl(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 14, background: '#fff', flex: 1 }}
            />
            <button
              onClick={handleAvatarSave}
              disabled={isSaving}
              style={{
                padding: '0 18px', height: 44, borderRadius: 12, background: '#F97316', color: '#fff',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer'
              }}
            >
              Save Photo
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Tabs ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, delay: 0.05 }}
        className="profile-tabs-card"
        style={{ ...card({ padding: 0, marginBottom: 24, overflow: 'hidden' }) }}
      >
        <div className="profile-tabs-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', borderBottom: '1px solid #EEF2F7', width: '100%', minWidth: 0 }}>
          {TABS.map(t => {
            const isActive = tab === t;
            const icons: Record<Tab, React.ElementType> = {
              'Personal Information': User,
              'Account Settings': ClipboardList,
            };
            const Icon = icons[t];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="profile-tab-btn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '15px 16px', fontSize: 13.5, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#F97316' : '#64748B',
                  background: isActive ? '#FFF7ED' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  borderBottom: isActive ? '2.5px solid #F97316' : '2.5px solid transparent',
                  marginBottom: -1, whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <Icon size={14} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Tab Content ── */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="profile-tab-wrapper"
        style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}
      >

        {/* Left: Form */}
        <div className="profile-main-column" style={{ flex: 1, minWidth: 0, width: '100%' }}>

          {/* Personal Information Section */}
          <div className={`profile-section-personal ${tab === 'Personal Information' ? 'tab-active' : 'tab-hidden'}`}>
            <form onSubmit={handleSavePersonalInfo} className="profile-form-card" style={{ ...card({ padding: '24px 28px' }) }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: '0 0 20px' }}>Personal Information</h3>

              {/* Row 1 */}
              <div className="profile-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={14} style={icoWrap} />
                    <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} required />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Roll Number (Read-only)</label>
                  <div style={{ position: 'relative' }}>
                    <IdCard size={14} style={icoWrap} />
                    <input value={user?.rollNumber || '24B91A0720'} readOnly style={{ ...inputStyle, color: '#94A3B8', cursor: 'not-allowed' }} />
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="profile-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={icoWrap} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} required />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={14} style={icoWrap} />
                    <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                  </div>
                </div>
              </div>

              {/* Row 3: Semester */}
              <div className="profile-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Semester</label>
                  <div style={{ position: 'relative' }}>
                    <GraduationCap size={14} style={icoWrap} />
                    <select
                      value={semester}
                      onChange={e => setSemester(e.target.value)}
                      style={{ ...inputStyle, appearance: 'none', paddingRight: 32, cursor: 'pointer' }}
                      onFocus={focusIn}
                      onBlur={focusOut}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <option key={s} value={s}>Sem {s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px', borderRadius: 12,
                  background: isSaving ? '#FED7AA' : 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(249,115,22,0.28)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>{isSaving ? 'Saving to Database...' : 'Save Changes'}</span>
              </button>
            </form>
          </div>

          {/* Account Settings Section */}
          <div className={`profile-section-account ${tab === 'Account Settings' ? 'tab-active' : 'tab-hidden'}`}>
            <form onSubmit={handleChangePassword} className="profile-form-card" style={{ ...card({ padding: '24px 28px' }) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>Account Password Settings</h3>
                  <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Update your login password in the database.</p>
                </div>
              </div>

              <div style={{ padding: '20px', borderRadius: 13, background: '#F8FAFC', border: '1px solid #EEF2F7', marginBottom: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Current Password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={14} style={icoWrap} />
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        style={inputStyle}
                        onFocus={focusIn}
                        onBlur={focusOut}
                      />
                    </div>
                  </div>
                  <div className="profile-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>New Password</label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={14} style={icoWrap} />
                        <input
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          style={inputStyle}
                          onFocus={focusIn}
                          onBlur={focusOut}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Confirm New Password</label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={14} style={icoWrap} />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          style={inputStyle}
                          onFocus={focusIn}
                          onBlur={focusOut}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  color: '#fff', background: isSaving ? '#FED7AA' : '#F97316', border: 'none',
                  cursor: isSaving ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(249,115,22,0.2)',
                }}
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                <span>{isSaving ? 'Updating Password...' : 'Save New Password'}</span>
              </button>

              {/* Logout Option in Account Settings */}
              <div className="session-mgmt-block" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #EEF2F7' }}>
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#DC2626', margin: '0 0 4px' }}>Session Management</h4>
                <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px' }}>Log out of your AttendEase student account on this device.</p>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    color: '#DC2626', background: '#FEF2F2', border: '1px solid #FCA5A5',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  <LogOut size={16} />
                  <span>Log Out</span>
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* ── Right Sidebar ── */}
        <div className="profile-sidebar" style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Profile Completion */}
          <div style={{ ...card({ padding: '20px' }) }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: '0 0 16px' }}>Profile Completion</h3>

            {/* Circular progress */}
            <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: 16 }}>
              <CircularProgress pct={completionPct} />
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>{completionPct}%</p>
                <p style={{ fontSize: 10, color: '#94A3B8', margin: 0 }}>Complete</p>
              </div>
            </div>

            {/* Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {completion.map(({ label, done }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {done
                    ? <CheckCircle2 size={14} style={{ color: '#10B981', flexShrink: 0 }} />
                    : <Circle size={14} style={{ color: '#CBD5E1', flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 12, color: done ? '#374151' : '#94A3B8', fontWeight: done ? 500 : 400 }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tip card */}
          <div style={{
            borderRadius: 14, padding: '14px 16px',
            background: '#FFFBEB', border: '1px solid #FDE68A',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Lightbulb size={14} style={{ color: '#F59E0B' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>Tip</span>
            </div>
            <p style={{ fontSize: 12, color: '#78350F', margin: 0, lineHeight: 1.5 }}>
              All edits saved here persist directly to your database.
            </p>
          </div>


          {/* Account Settings / Logout Card (Mobile & Desktop) */}
          <div style={{ ...card({ padding: '18px 20px' }) }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, color: '#DC2626', margin: '0 0 4px' }}>Account Settings</h4>
            <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px' }}>Log out of your AttendEase account on this device.</p>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: '100%', boxSizing: 'border-box',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                color: '#DC2626', background: '#FEF2F2', border: '1px solid #FCA5A5',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          </div>

        </div>
      </motion.div>

    </PageWrapper>
  );
}
