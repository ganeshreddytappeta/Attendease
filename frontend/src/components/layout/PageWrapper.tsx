import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home, Clock, User, LogOut, LogIn,
  Bell, Plus,
  ClipboardList, Users, Settings, Shield,
  CheckSquare, UserCheck, Database, CalendarCheck, Award,
  Phone
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import attendEaseLogo from '../../assets/logo.png';
import { HelplineModal } from '../shared/HelplineModal';
const srkrLogo = '/srkr-emblem.png';

interface PageWrapperProps {
  children: ReactNode;
  role?: 'student' | 'faculty' | 'hod' | 'admin' | 'viewer';
  showGreeting?: boolean;
}

const viewerNav: { to: string; label: string; icon: any }[] = [];

const studentNav = [
  { to: '/student', label: 'Home', icon: Home },
  { to: '/student/notifications', label: 'Notifications', icon: Bell, hasBadge: true },
  { to: '/student/new-request', label: 'New Request', icon: Plus },
  { to: '/student/history', label: 'History', icon: Clock },
  { to: '/student/profile', label: 'Profile', icon: User },
];
const facultyNav = [
  { to: '/faculty', label: 'Dashboard', icon: Home },
  { to: '/faculty/attendance', label: 'Mark Attendance', icon: CheckSquare },
  { to: '/faculty/requests', label: 'Requests', icon: ClipboardList },
  { to: '/faculty/invigilation', label: 'Invigilation', icon: CalendarCheck },
  { to: '/faculty/student-activities', label: 'Student Activities', icon: Award },
];

const hodNav = [
  { to: '/hod', label: 'Overview', icon: Home },
  { to: '/hod/requests', label: 'All Requests', icon: ClipboardList },
  { to: '/hod/faculty', label: 'Faculty', icon: Users },
  { to: '/hod/student-activities', label: 'Student Activities', icon: Award },
];

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: Home },
  { to: '/admin/users', label: 'Accounts & Students', icon: Users },
  { to: '/admin/invigilation', label: 'Invigilation Duties & Hours', icon: CalendarCheck },
  { to: '/admin/counseling', label: 'Counseling', icon: UserCheck },
  { to: '/admin/requests', label: 'Request Logs', icon: ClipboardList },
  { to: '/admin/database', label: 'Database Tables', icon: Database },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

type BottomNavItem = {
  id: string;
  type: 'link' | 'fab';
  to?: string;
  label?: string;
  icon?: React.ElementType;
  hasBadge?: boolean;
};

/* Bottom tab bar items (mobile) */
const studentMobileBottomNav: BottomNavItem[] = [
  { id: 'home', to: '/student', label: 'Home', icon: Home, type: 'link' },
  { id: 'notifications', to: '/student/notifications', label: 'Notifications', icon: Bell, type: 'link', hasBadge: true },
  { id: 'fab', type: 'fab', to: '/student/new-request' },
  { id: 'history', to: '/student/history', label: 'History', icon: Clock, type: 'link' },
  { id: 'profile', to: '/student/profile', label: 'Profile', icon: User, type: 'link' },
];

const facultyMobileBottomNav: BottomNavItem[] = [
  { id: 'home', to: '/faculty', label: 'Dashboard', icon: Home, type: 'link' },
  { id: 'attendance', to: '/faculty/attendance', label: 'Attendance', icon: CheckSquare, type: 'link' },
  { id: 'requests', to: '/faculty/requests', label: 'Requests', icon: ClipboardList, type: 'link' },
  { id: 'invigilation', to: '/faculty/invigilation', label: 'Invigilation', icon: CalendarCheck, type: 'link' },
  { id: 'student-activities', to: '/faculty/student-activities', label: 'Activities', icon: Award, type: 'link' },
];

const hodMobileBottomNav: BottomNavItem[] = [
  { id: 'home', to: '/hod', label: 'Overview', icon: Home, type: 'link' },
  { id: 'faculty', to: '/hod/faculty', label: 'Faculty', icon: Users, type: 'link' },
  { id: 'requests', to: '/hod/requests', label: 'Requests', icon: ClipboardList, type: 'link' },
  { id: 'student-activities', to: '/hod/student-activities', label: 'Activities', icon: Award, type: 'link' },
];

const adminMobileBottomNav: BottomNavItem[] = [
  { id: 'home', to: '/admin', label: 'Dashboard', icon: Home, type: 'link' },
  { id: 'users', to: '/admin/users', label: 'Accounts', icon: Users, type: 'link' },
  { id: 'invigilation', to: '/admin/invigilation', label: 'Invigilation', icon: CalendarCheck, type: 'link' },
  { id: 'counseling', to: '/admin/counseling', label: 'Counseling', icon: UserCheck, type: 'link' },
  { id: 'database', to: '/admin/database', label: 'Database', icon: Database, type: 'link' },
  { id: 'settings', to: '/admin/settings', label: 'Settings', icon: Settings, type: 'link' },
];

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export function PageWrapper({ children, role = 'student' }: PageWrapperProps) {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { user, logout } = useAuth();
  const [isHelplineOpen, setIsHelplineOpen] = useState(false);

  useEffect(() => {
    localStorage.removeItem('attendease_theme');
    document.documentElement.classList.remove('dark');
  }, []);

  const unreadCount = 0;

  const userPortalLink = user
    ? (user.role === 'admin' ? '/admin' : user.role === 'hod' ? '/hod' : user.role === 'faculty' ? '/faculty' : '/student')
    : '/login';

  const userSettingsLink = user
    ? (user.role === 'admin' ? '/admin/settings' : user.role === 'hod' ? '/hod/settings' : user.role === 'faculty' ? '/faculty/settings' : '/student/profile')
    : '/login';

  const navLinks = role === 'viewer' ? viewerNav : role === 'student' ? studentNav : role === 'faculty' ? facultyNav : role === 'hod' ? hodNav : adminNav;
  const homeLink = user ? userPortalLink : (role === 'viewer' ? '/permissions' : role === 'student' ? '/student' : role === 'faculty' ? '/faculty' : role === 'hod' ? '/hod' : '/admin');

  const handleLogout = () => { logout(); navigate('/'); };

  const hour = new Date().getHours();
  const firstName = user?.name?.split(' ')[0] ?? 'User';
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F3F6FB', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>

      {/* ═══════════════════════════════════════
          DESKTOP TOP BAR
      ═══════════════════════════════════════ */}
      <header className="desktop-topbar print:hidden" style={{
        position: 'sticky', top: 0, zIndex: 40,
        height: 56, background: '#ffffff',
        borderBottom: '1px solid #edf0f2',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex', alignItems: 'center',
        padding: '0 24px',
      }}>
        <Link to={homeLink} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <img
            src={attendEaseLogo}
            alt="AttendEase"
            style={{
              width: 40, height: 40,
              objectFit: 'contain',
              background: 'transparent',
            }}
          />
          <div style={{ lineHeight: 1.15 }}>
            <p style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              <span style={{ color: '#18181b' }}>Attend</span>
              <span style={{ color: '#EA580C' }}>Ease</span>
            </p>
            <p style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', margin: 0 }}>Permission Portal</p>
          </div>
        </Link>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Helpline / Developer Contacts Button */}
          <button
            type="button"
            onClick={() => setIsHelplineOpen(true)}
            title="Helpline & Developer Contact Details"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '6px 12px', fontSize: 12.5, fontWeight: 600,
              color: '#0F172A', background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 8, textDecoration: 'none', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#F1F5F9';
              e.currentTarget.style.borderColor = '#CBD5E1';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#F8FAFC';
              e.currentTarget.style.borderColor = '#E2E8F0';
            }}
          >
            <Phone size={13} className="text-orange-500" />
            <span>Helpline</span>
          </button>

          {/* View Permissions Button in top navbar */}
          {routerLocation.pathname === '/permissions' ? (
            user && (
              <Link
                to={userPortalLink}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '6px 12px', fontSize: 12.5, fontWeight: 600,
                  color: '#18181b', background: '#edf0f2',
                  border: '1px solid #e2e6e9',
                  borderRadius: 8, textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Home size={14} />
                <span>Dashboard</span>
              </Link>
            )
          ) : (
            <Link
              to="/permissions"
              title="View Public Approved Permissions & Exemption Ledger"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '6px 12px', fontSize: 12.5, fontWeight: 600,
                color: '#EA580C', background: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: 8, textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#EA580C';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#EA580C';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#FFF7ED';
                e.currentTarget.style.color = '#EA580C';
                e.currentTarget.style.borderColor = '#FED7AA';
              }}
            >
              <Shield size={14} />
              <span>View Permissions</span>
            </Link>
          )}

          {/* Show Login or User Profile/Dashboard button */}
          {!user ? (
            <Link
              to="/login"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '6px 14px', fontSize: 12.5, fontWeight: 600,
                color: '#EA580C', background: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: 8, textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#EA580C';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#EA580C';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#FFF7ED';
                e.currentTarget.style.color = '#EA580C';
                e.currentTarget.style.borderColor = '#FED7AA';
              }}
            >
              <LogIn size={14} />
              <span>Login</span>
            </Link>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link
                to={userPortalLink}
                title="Dashboard"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '6px 12px', fontSize: 12.5, fontWeight: 600,
                  color: '#18181b', background: '#edf0f2',
                  border: '1px solid #e2e6e9',
                  borderRadius: 8, textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2e6e9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#edf0f2'; }}
              >
                <User size={14} />
                <span style={{ textTransform: 'capitalize' }}>{user.name?.split(' ')[0] || user.role}</span>
              </Link>

              {/* Settings button in top navbar (hidden for student) */}
              {user.role !== 'student' && role !== 'student' && (
                <Link
                  to={userSettingsLink}
                  title="Settings & Preferences"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 34, height: 34, borderRadius: 8, background: '#edf0f2',
                    border: '1px solid #e2e6e9', color: '#64748B', textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#e2e6e9'; e.currentTarget.style.color = '#18181b'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#edf0f2'; e.currentTarget.style.color = '#64748B'; }}
                >
                  <Settings size={15} />
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════
          MOBILE TOP BAR
      ═══════════════════════════════════════ */}
      <header className="mobile-topbar print:hidden" style={{
        position: 'sticky', top: 0, zIndex: 40,
        height: 56, background: '#ffffff',
        borderBottom: '1px solid #edf0f2',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'none', alignItems: 'center',
        padding: '0 16px',
      }}>
        {/* Left: logo + brand */}
        <Link to={homeLink} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <img
            src={attendEaseLogo}
            alt="AttendEase"
            style={{
              width: 28, height: 28,
              objectFit: 'contain',
              background: 'transparent',
            }}
          />
          <div style={{ lineHeight: 1.15 }}>
            <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>
              <span style={{ color: '#18181b' }}>Attend</span>
              <span style={{ color: '#EA580C' }}>Ease</span>
            </p>
            <p style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', margin: 0 }}>Permission Portal</p>
          </div>
        </Link>

        {/* Center/Right: View Permissions + Settings / Login + Helpline (mobile) */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Mobile Helpline Button */}
          <button
            type="button"
            onClick={() => setIsHelplineOpen(true)}
            title="Helpline & Developer Contact Details"
            style={{
              width: 32, height: 32, borderRadius: 7,
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              color: '#EA580C', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Phone size={14} />
          </button>

          {routerLocation.pathname !== '/permissions' ? (
            <Link
              to="/permissions"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '5px 10px', fontSize: 11.5, fontWeight: 600,
                color: '#EA580C', background: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: 7, textDecoration: 'none',
              }}
            >
              <Shield size={13} />
              <span>Permissions</span>
            </Link>
          ) : user ? (
            <Link
              to={userPortalLink}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '5px 10px', fontSize: 11.5, fontWeight: 600,
                color: '#18181b', background: '#edf0f2',
                border: '1px solid #e2e6e9',
                borderRadius: 7, textDecoration: 'none',
              }}
            >
              <Home size={13} />
              <span>Dashboard</span>
            </Link>
          ) : null}

          {!user ? (
            <Link
              to="/login"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '5px 12px', fontSize: 11.5, fontWeight: 600,
                color: '#EA580C', background: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: 7, textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <LogIn size={13} />
              <span>Login</span>
            </Link>
          ) : user.role !== 'student' && role !== 'student' ? (
            <Link
              to={userSettingsLink}
              title="Settings"
              style={{
                width: 32, height: 32, borderRadius: 7,
                background: '#edf0f2', border: '1px solid #e2e6e9',
                color: '#64748B', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none',
              }}
            >
              <Settings size={14} />
            </Link>
          ) : null}
        </div>
      </header>

      {/* ═══════════════════════════════════════
          BODY: SIDEBAR + MAIN
      ═══════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* ── DESKTOP SIDEBAR ── */}
        {navLinks.length > 0 && (
          <aside className="desktop-sidebar print:hidden" style={{
            width: 220, flexShrink: 0,
            background: '#ffffff',
            borderRight: '1px solid #edf0f2',
            display: 'flex', flexDirection: 'column',
            padding: '16px 0',
            position: 'sticky', top: 56, height: 'calc(100vh - 56px)',
            overflowY: 'auto',
          }}>
            <nav style={{ flex: 1, padding: '0 10px' }}>
              {navLinks.map(link => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === homeLink}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8.5px 12px', borderRadius: 8, marginBottom: 3,
                      fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                      color: isActive
                        ? role === 'admin' ? '#ffffff' : '#EA580C'
                        : '#64748B',
                      background: isActive
                        ? role === 'admin' ? '#18181b' : '#FFF7ED'
                        : 'transparent',
                      border: isActive && role !== 'admin' ? '1px solid #FED7AA' : '1px solid transparent',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    })}
                  >
                    <Icon size={16} />
                    {link.label}
                  </NavLink>
                );
              })}

              {/* Logout */}
              {role !== 'viewer' && (
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8.5px 12px', borderRadius: 8,
                    marginTop: 20,
                    fontSize: 13.5, fontWeight: 500,
                    color: '#64748B', background: 'transparent',
                    border: 'none',
                    cursor: 'pointer', width: '100%',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.background = '#fef2f2';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#64748B';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              )}
            </nav>

            <div style={{
              margin: '12px 10px 0',
              background: role === 'admin' ? '#f8f9fa' : '#FFF7ED',
              border: role === 'admin' ? '1px solid #edf0f2' : '1px solid #FED7AA',
              borderRadius: 12, padding: '12px 10px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <img
                src={srkrLogo}
                alt="SRKR Engineering College"
                style={{ width: 36, height: 36, objectFit: 'contain', background: 'transparent' }}
              />
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: role === 'admin' ? '#18181b' : '#C2410C', margin: '0 0 2px' }}>CSD &amp; CSIT</p>
                <p style={{ fontSize: 10.5, color: role === 'admin' ? '#88929e' : '#EA580C', margin: 0 }}>SRKR Engineering College</p>
              </div>
            </div>
          </aside>
        )}

        {/* ── MAIN CONTENT ── */}
        <motion.main
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', minWidth: 0 }}
          className="main-content"
        >
          {/* Greeting header — only on non-admin dashboard home pages */}
          {role !== 'admin' && (routerLocation.pathname === '/student' || routerLocation.pathname === '/student/' || routerLocation.pathname === '/faculty' || routerLocation.pathname === '/faculty/' || routerLocation.pathname === '/hod' || routerLocation.pathname === '/hod/') && (
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                {greeting}, {user?.name || firstName}
              </h1>
              <p style={{ fontSize: 13.5, color: '#64748B', margin: 0, fontWeight: 500 }}>
                Welcome to AttendEase • SRKR Engineering College
              </p>
            </div>
          )}

          {children}

          <div className="footer-line print:hidden" style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #EEF2F7', textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
            <span>© 2026 AttendEase • SRKR Engineering College, Bhimavaram. All rights reserved. </span>
            <button
              type="button"
              onClick={() => setIsHelplineOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#EA580C',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '0 4px',
                textDecoration: 'underline',
                fontSize: 12,
              }}
            >
              Helpline &amp; Contacts
            </button>
            <span style={{ margin: '0 2px' }}>•</span>
            <a
              href="https://forms.gle/girGw3vVdUfCR5zR6"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#EA580C',
                fontWeight: 700,
                padding: '0 4px',
                textDecoration: 'underline',
                fontSize: 12,
              }}
            >
              Feedback &amp; Reports
            </a>
          </div>
        </motion.main>
      </div>

      {/* ── Helpline Modal Popup ── */}
      <HelplineModal
        isOpen={isHelplineOpen}
        onClose={() => setIsHelplineOpen(false)}
      />

      {/* ═══════════════════════════════════════
          MOBILE BOTTOM TAB BAR (Hidden in Viewer Mode)
      ═══════════════════════════════════════ */}
      {role !== 'viewer' && (
        <nav className="mobile-bottom-nav print:hidden" style={{
          display: 'none',
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          height: 64, background: '#ffffff',
          borderTop: '1px solid #EEF2F7',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
          alignItems: 'center', justifyContent: 'space-between',
          padding: '0 4px calc(env(safe-area-inset-bottom, 0px) + 2px)',
        }}>
          {(role === 'admin' ? adminMobileBottomNav : role === 'hod' ? hodMobileBottomNav : role === 'faculty' ? facultyMobileBottomNav : studentMobileBottomNav).map(item => {
            if (item.type === 'fab') {
              // Centre + FAB button -> Navigates to /student/new-request
              return (
                <div key="fab" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <button
                    onClick={() => navigate(item.to || '/student/new-request')}
                    style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                      border: '3px solid #ffffff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 14px rgba(249,115,22,0.45)',
                      transform: 'translateY(-12px)',
                    }}
                  >
                    <Plus size={24} style={{ color: '#fff' }} />
                  </button>
                </div>
              );
            }

            const Icon = item.icon!;
            const isRootPage = item.to === '/student' || item.to === '/faculty' || item.to === '/hod' || item.to === '/admin';
            const active = isRootPage
              ? (routerLocation.pathname === item.to || routerLocation.pathname === `${item.to}/`)
              : routerLocation.pathname.startsWith(item.to!);
            return (
              <div key={item.id} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0 }}>
                <Link
                  to={item.to!}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    textDecoration: 'none', position: 'relative',
                    padding: '6px 0', width: '100%',
                    color: active ? '#F97316' : '#94A3B8',
                    transition: 'color 0.15s ease',
                  }}
                >
                  <Icon size={20} />
                  <span style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    lineHeight: 1.1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}>
                    {item.label}
                  </span>
                  {item.hasBadge && unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: 'calc(50% - 14px)', width: 7, height: 7, borderRadius: '50%', background: '#F97316', border: '1px solid #fff' }} />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>
      )}

      {/* ── Responsive CSS ── */}
      <style>{`
        /* ── Screen Mobile ── */
        @media screen and (max-width: 768px) {
          .desktop-topbar   { display: none !important; }
          .desktop-sidebar  { display: none !important; }
          .mobile-topbar    { display: flex !important; }
          .mobile-bottom-nav{ display: ${role === 'viewer' ? 'none' : 'flex'} !important; }
          .main-content     { padding: ${role === 'viewer' ? '16px 16px 24px' : '16px 16px 92px'} !important; }
          .student-portal-badge { display: none !important; }
        }
        /* ── Screen Desktop ── */
        @media screen and (min-width: 769px) {
          .desktop-topbar   { display: flex !important; }
          .desktop-sidebar  { display: flex !important; }
          .mobile-topbar    { display: none !important; }
<<<<<<< HEAD
          .mobile-bottom-nav { display: none !important; }
          .meniscus-wrapper   { display: none !important; }
          .main-content     { padding: 24px 32px 48px !important; }
=======
          .mobile-bottom-nav{ display: none !important; }
>>>>>>> origin/main
        }
        /* ── Print ── */
        @media print {
          .desktop-topbar, .mobile-topbar, .desktop-sidebar, .mobile-bottom-nav, .footer-line {
            display: none !important;
          }
          .main-content {
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default PageWrapper;
