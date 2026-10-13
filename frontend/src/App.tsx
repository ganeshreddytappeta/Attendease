import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import type { UserRole } from './context/AuthContext';

// Pages — public & auth
import LoginPortal from './pages/auth/LoginPortal';
import AdminLogin from './pages/admin/Login';
import ShareRedirectPage from './pages/ShareRedirectPage';
import ShareResolvePage from './pages/ShareResolvePage';

// Pages — student
import StudentHome from './pages/student/Home';
import NewRequest from './pages/student/NewRequest';
import RequestSuccess from './pages/student/RequestSuccess';
import History from './pages/student/History';
import StudentRequestDetails from './pages/student/RequestDetails';
import EditRequest from './pages/student/EditRequest';
import Profile from './pages/student/Profile';
import StudentNotifications from './pages/student/Notifications';
import StudentCertificates from './pages/student/Certificates';

// Pages — faculty
import FacultyDashboard from './pages/faculty_portal/Dashboard';
import FacultyRequests from './pages/faculty_portal/Requests';
import FacultyRequestDetails from './pages/faculty_portal/RequestDetails';
import FacultyInvigilation from './pages/faculty_portal/Invigilation';
import FacultyReports from './pages/faculty_portal/Reports';
import FacultySettings from './pages/faculty_portal/Settings';
import FacultyAttendance from './pages/faculty_portal/Attendance';

// Pages — HOD
import HODDashboard from './pages/hod/Dashboard';
import HODRequestDetails from './pages/hod/RequestDetails';
import HODAllRequests from './pages/hod/AllRequests';
import HODFaculty from './pages/hod/Faculty';
import HODReports from './pages/hod/Reports';
import HODSettings from './pages/hod/Settings';

// Shared Student Activities Page
import StudentActivitiesPage from './pages/shared/StudentActivitiesPage';
import AnimationShowcasePage from './pages/shared/AnimationShowcasePage';

// Pages — admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminInvigilation from './pages/admin/Invigilation';
import AdminCounseling from './pages/admin/Counseling';
import AdminAnnouncements from './pages/admin/Announcements';
import AdminRequests from './pages/admin/Requests';
import AdminDatabase from './pages/admin/Database';
import AdminSettings from './pages/admin/Settings';

// Shared / Admin — permissions
import PermissionsPage from './pages/Permissions';
import LandingPage from './pages/LandingPage';
import Developers from './pages/Developers';
import Recruitment from './pages/Recruitment';
import CertificateVerifyPage from './pages/CertificateVerifyPage';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, retry: 1 },
  },
});

// Protected route wrapper
function ProtectedRoute({
  children,
  role,
  allowPasswordChange = false,
}: {
  children: React.ReactNode;
  role: UserRole;
  allowPasswordChange?: boolean;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Wait for token rehydration — show minimal spinner instead of blank screen (important on mobile)
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
        <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if ((user as any)?.mustChangePassword && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (user?.role !== role) {
    const roleHomeMap: Record<UserRole, string> = {
      student: '/student',
      faculty: '/faculty',
      hod: '/hod',
      admin: '/admin',
    };
    return <Navigate to={roleHomeMap[user?.role as UserRole] ?? '/'} replace />;
  }

  return <>{children}</>;
}

const roleHomeMap: Record<UserRole, string> = {
  student: '/student',
  faculty: '/faculty',
  hod: '/hod',
  admin: '/admin',
};

export const getDashboardPathForRole = (role?: UserRole | string | null): string => {
  if (!role) return '/student';
  return roleHomeMap[role as UserRole] ?? '/student';
};

// Smart Gateway: If a token is presented or user is already logged in, redirect directly to dashboard
function LandingOrDashboard({ forceLanding = false }: { forceLanding?: boolean }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const isPreview = searchParams.get('preview') === 'true' || searchParams.get('mode') === 'landing';
  const redirectParam = searchParams.get('redirect') || searchParams.get('returnUrl');

  if (forceLanding || isPreview) {
    return <LandingPage />;
  }

  // Waiting for token rehydration / background check
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500 tracking-wide">Loading AttendEase...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    // If a specific return/redirect path was requested in query string (e.g. ?redirect=/student/history)
    if (redirectParam) {
      const cleanRedirect = redirectParam.trim();
      if (cleanRedirect.startsWith('/') && !cleanRedirect.startsWith('//') && !cleanRedirect.includes('\\') && !cleanRedirect.includes('://')) {
        return <Navigate to={cleanRedirect} replace />;
      }
    }
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return <LandingPage />;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public & Smart Dashboard Redirects */}
        <Route path="/" element={<LandingOrDashboard />} />
        <Route path="/home" element={<LandingOrDashboard />} />
        <Route path="/landing" element={<LandingOrDashboard />} />
        <Route path="/welcome" element={<LandingOrDashboard forceLanding />} />
        <Route path="/developers" element={<Developers />} />
        <Route path="/developer" element={<Navigate to="/developers" replace />} />
        <Route path="/gowtham" element={<Navigate to="/developers" replace />} />
        <Route path="/vivek" element={<Navigate to="/developers" replace />} />
        <Route path="/team" element={<Navigate to="/developers" replace />} />
        <Route path="/pavan" element={<Navigate to="/developers" replace />} />
        <Route path="/manasa" element={<Navigate to="/developers" replace />} />
        <Route path="/recruitment" element={<Recruitment />} />
        <Route path="/recruit" element={<Navigate to="/recruitment" replace />} />
        <Route path="/join" element={<Navigate to="/recruitment" replace />} />
        <Route path="/apply" element={<Navigate to="/recruitment" replace />} />
        <Route path="/login" element={<LoginPortal />} />
        <Route path="/animation" element={<AnimationShowcasePage />} />
        <Route path="/send-demo" element={<AnimationShowcasePage />} />
        <Route path="/r/:shareToken" element={<ShareResolvePage />} />
        <Route path="/share/:publicId" element={<ShareRedirectPage />} />

        {/* Public Certificate Verification routes */}
        <Route path="/verify/:token" element={<CertificateVerifyPage />} />
        <Route path="/verify/certificate/:token" element={<CertificateVerifyPage />} />

        {/* Approved Permissions page (all roles & URL aliases) */}
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/permissions/*" element={<PermissionsPage />} />
        <Route path="/permission" element={<PermissionsPage />} />
        <Route path="/student/permissions" element={<PermissionsPage />} />
        <Route path="/faculty/permissions" element={<PermissionsPage />} />
        <Route path="/hod/permissions" element={<PermissionsPage />} />
        <Route path="/admin/permissions" element={<PermissionsPage />} />

        {/* Legacy redirects */}
        <Route path="/login/student" element={<Navigate to="/login" replace />} />
        <Route path="/login/faculty" element={<Navigate to="/login" replace />} />
        <Route path="/login/hod" element={<Navigate to="/login" replace />} />

        {/* Student (protected) */}
        <Route path="/student" element={<ProtectedRoute role="student"><StudentHome /></ProtectedRoute>} />
        <Route path="/student/event" element={<Navigate to="/student" replace />} />
        <Route path="/student/events" element={<Navigate to="/student" replace />} />
        <Route path="/event" element={<Navigate to="/student" replace />} />
        <Route path="/cricket" element={<Navigate to="/student" replace />} />
        <Route path="/student/new-request" element={<ProtectedRoute role="student"><NewRequest /></ProtectedRoute>} />
        <Route path="/student/success" element={<ProtectedRoute role="student"><RequestSuccess /></ProtectedRoute>} />
        <Route path="/student/history" element={<ProtectedRoute role="student"><History /></ProtectedRoute>} />
        <Route path="/student/request/:id/edit" element={<ProtectedRoute role="student"><EditRequest /></ProtectedRoute>} />
        <Route path="/student/request/:id" element={<ProtectedRoute role="student"><StudentRequestDetails /></ProtectedRoute>} />
        <Route path="/student/profile" element={<ProtectedRoute role="student"><Profile /></ProtectedRoute>} />
        <Route path="/student/notifications" element={<ProtectedRoute role="student"><StudentNotifications /></ProtectedRoute>} />
        <Route path="/student/certificates" element={<ProtectedRoute role="student"><StudentCertificates /></ProtectedRoute>} />

        {/* Faculty (protected) */}
        <Route path="/faculty" element={<ProtectedRoute role="faculty"><FacultyDashboard /></ProtectedRoute>} />
        <Route path="/faculty/attendance" element={<ProtectedRoute role="faculty"><FacultyAttendance /></ProtectedRoute>} />
        <Route path="/faculty/requests" element={<ProtectedRoute role="faculty"><FacultyRequests /></ProtectedRoute>} />
        <Route path="/faculty/request/:id" element={<ProtectedRoute role="faculty"><FacultyRequestDetails /></ProtectedRoute>} />
        <Route path="/faculty/review/:id" element={<ProtectedRoute role="faculty"><FacultyRequestDetails /></ProtectedRoute>} />
        <Route path="/faculty/invigilation" element={<ProtectedRoute role="faculty"><FacultyInvigilation /></ProtectedRoute>} />
        <Route path="/faculty/invigilations" element={<Navigate to="/faculty/invigilation" replace />} />
        <Route path="/faculty/students" element={<Navigate to="/faculty/invigilation" replace />} />
        <Route path="/faculty/student-activities" element={<ProtectedRoute role="faculty"><StudentActivitiesPage role="faculty" /></ProtectedRoute>} />
        <Route path="/faculty/reports" element={<ProtectedRoute role="faculty"><FacultyReports /></ProtectedRoute>} />
        <Route path="/faculty/settings" element={<ProtectedRoute role="faculty"><FacultySettings /></ProtectedRoute>} />

        {/* HOD (protected) */}
        <Route path="/hod" element={<ProtectedRoute role="hod"><HODDashboard /></ProtectedRoute>} />
        <Route path="/hod/request/:id" element={<ProtectedRoute role="hod"><HODRequestDetails /></ProtectedRoute>} />
        <Route path="/hod/review/:id" element={<ProtectedRoute role="hod"><HODRequestDetails /></ProtectedRoute>} />
        <Route path="/hod/requests" element={<ProtectedRoute role="hod"><HODAllRequests /></ProtectedRoute>} />
        <Route path="/hod/faculty" element={<ProtectedRoute role="hod"><HODFaculty /></ProtectedRoute>} />
        <Route path="/hod/student-activities" element={<ProtectedRoute role="hod"><StudentActivitiesPage role="hod" /></ProtectedRoute>} />
        <Route path="/hod/reports" element={<ProtectedRoute role="hod"><HODReports /></ProtectedRoute>} />
        <Route path="/hod/settings" element={<ProtectedRoute role="hod"><HODSettings /></ProtectedRoute>} />

        {/* Admin (protected & standalone login) */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute role="admin"><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/invigilation" element={<ProtectedRoute role="admin"><AdminInvigilation /></ProtectedRoute>} />
        <Route path="/admin/counseling" element={<ProtectedRoute role="admin"><AdminCounseling /></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute role="admin"><AdminAnnouncements /></ProtectedRoute>} />
        <Route path="/admin/requests" element={<ProtectedRoute role="admin"><AdminRequests /></ProtectedRoute>} />
        <Route path="/admin/database" element={<ProtectedRoute role="admin"><AdminDatabase /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminSettings /></ProtectedRoute>} />

        {/* 404 Error Page */}
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
