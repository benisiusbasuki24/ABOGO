import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { InteractiveMap } from './components/InteractiveMap';
import { MonthlyReport } from './components/MonthlyReport';
import { LeaveManagement } from './components/LeaveRequestModal';
import { UserManagement } from './components/UserManagement';
import { AttendanceModal } from './components/AttendanceModal';
import { SchoolSettingsModal } from './components/SchoolSettingsModal';
import { LoginModal } from './components/LoginModal';
import {
  UserProfile,
  AttendanceRecord,
  LeaveRequest,
  SchoolConfig,
  PortalNotification,
} from './types';
import {
  fetchUsers,
  fetchAttendances,
  fetchLeaveRequests,
  fetchSchoolConfig,
  fetchNotifications,
  calculateDistanceMeters,
  subscribeToAttendances,
  subscribeToLeaveRequests,
  subscribeToNotifications,
  purgeAllDummyData,
} from './services/dbService';
import { DEFAULT_SCHOOL_CONFIG } from './services/seedData';
import {
  Camera,
  MapPin,
  ShieldCheck,
  Compass,
  AlertTriangle,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

function AppContent() {
  const { currentUser, isSuperAdmin, isKepalaSekolah, isLoading: authLoading } = useAuth();

  // App State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'report' | 'leaves' | 'users'>('dashboard');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);

  // Geolocation state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(false);
  const [isSimulatedLocation, setIsSimulatedLocation] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Modals
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Refresh data functions
  const loadInitialData = useCallback(async () => {
    try {
      // Purge any lingering dummy records to guarantee clean state
      await purgeAllDummyData();

      const [u, a, l, c, n] = await Promise.all([
        fetchUsers(),
        fetchAttendances(),
        fetchLeaveRequests(),
        fetchSchoolConfig(),
        fetchNotifications(),
      ]);
      setUsers(u);
      setAttendances(a);
      setLeaves(l);
      setSchoolConfig(c);
      setNotifications(n);
    } catch (err) {
      console.error('Error loading initial data', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    // Subscribe to live attendances from Firestore
    const unsubAttendances = subscribeToAttendances(updatedList => {
      setAttendances(updatedList);
    });

    // Subscribe to live leave requests from Firestore
    const unsubLeaves = subscribeToLeaveRequests(updatedLeaves => {
      setLeaves(updatedLeaves);
    });

    // Subscribe to live notifications from Firestore
    const unsubNotifs = subscribeToNotifications(updatedNotifs => {
      setNotifications(updatedNotifs);
    });

    return () => {
      unsubAttendances();
      unsubLeaves();
      unsubNotifs();
    };
  }, [loadInitialData]);

  // GPS Tracking Logic
  const updatePosition = useCallback((lat: number, lng: number) => {
    setUserCoords({ lat, lng });
    const dist = calculateDistanceMeters(
      lat,
      lng,
      schoolConfig.latitude,
      schoolConfig.longitude
    );
    setDistanceMeters(dist);
    setIsWithinRadius(dist <= schoolConfig.radiusToleranceMeters);
  }, [schoolConfig]);

  const requestRealGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Peramban Anda tidak mendukung sensor GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setIsSimulatedLocation(false);
        setGpsError(null);
        updatePosition(pos.coords.latitude, pos.coords.longitude);
      },
      err => {
        console.warn('GPS permission denied or unavailable', err);
        setGpsError('Izin GPS tidak diberikan. Klik tombol Simulasi di bawah untuk menguji dalam radius.');
        // Default to a nearby point at SD BOPKRI Gondolayu for seamless experience
        updatePosition(-7.782875, 110.367135);
        setIsSimulatedLocation(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [updatePosition]);

  useEffect(() => {
    requestRealGps();
  }, [requestRealGps]);

  // Toggle simulate within school radius (< 100m)
  const handleSimulateSchoolLocation = () => {
    if (isSimulatedLocation && isWithinRadius) {
      // Toggle to outside radius for testing warning (e.g. 250 meters away)
      const testOutsideLat = schoolConfig.latitude + 0.0022; // ~240m away
      const testOutsideLng = schoolConfig.longitude + 0.0020;
      updatePosition(testOutsideLat, testOutsideLng);
      setIsSimulatedLocation(true);
    } else {
      // Set to 25 meters from school center gate (within 100m)
      const testInsideLat = schoolConfig.latitude + 0.00015;
      const testInsideLng = schoolConfig.longitude + 0.00012;
      updatePosition(testInsideLat, testInsideLng);
      setIsSimulatedLocation(true);
    }
  };

  const handleAttendanceSuccess = () => {
    loadInitialData();
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const existingTodayRecord = currentUser
    ? attendances.find(a => a.userId === currentUser.id && a.date === todayStr)
    : undefined;

  const pendingLeavesCount = leaves.filter(l => l.status === 'pending').length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center animate-pulse mb-3 shadow-lg">
          <GraduationCap className="w-7 h-7 text-blue-400" />
        </div>
        <div className="font-extrabold text-base tracking-wide text-white">Memuat Sistem SABOGOT...</div>
        <div className="text-xs text-blue-200 mt-1">SD BOPKRI Gondolayu Yogyakarta</div>
      </div>
    );
  }

  // Strict Manual Login Gate: All users & superadmin MUST login manually
  if (!currentUser) {
    return (
      <LoginModal
        isOpen={true}
        isFullPage={true}
        users={users}
        schoolConfig={schoolConfig}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner for School Institution Identity */}
      <div className="bg-slate-900 text-slate-300 px-4 py-1.5 text-[11px] flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2 max-w-4xl truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>
            <strong>SD BOPKRI GONDOLAYU YOGYAKARTA</strong> &bull; NPSN: {schoolConfig.npsn} &bull; {schoolConfig.address}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-slate-400">
          <span className="text-emerald-400 font-semibold">Hari Kerja: Senin – Jumat (Sabtu & Minggu Libur)</span>
          <span>&bull;</span>
          <span>Radius Toleransi: <strong>{schoolConfig.radiusToleranceMeters}m</strong></span>
          <span>&bull;</span>
          <span>Jam Masuk: <strong>{schoolConfig.workStartTime} WIB</strong></span>
        </div>
      </div>

      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notifications={notifications}
        onRefreshNotifications={loadInitialData}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        schoolConfig={schoolConfig}
        allUsers={users}
        pendingLeavesCount={pendingLeavesCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Geofence Status Ribbon Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                isWithinRadius ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                Status GPS & Geofence:
                {isWithinRadius ? (
                  <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Dalam Radius ({distanceMeters !== null ? `${Math.round(distanceMeters)}m` : '0m'})
                  </span>
                ) : (
                  <span className="text-rose-600 font-extrabold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Di Luar Radius ({distanceMeters !== null ? `${Math.round(distanceMeters)}m` : '0m'})
                  </span>
                )}
              </span>
              <p className="text-[11px] text-slate-500">
                Pusat Presensi: SD BOPKRI Gondolayu ({schoolConfig.latitude.toFixed(5)}, {schoolConfig.longitude.toFixed(5)})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateSchoolLocation}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                isWithinRadius
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>
                {isWithinRadius
                  ? 'Simulasi: Posisi di Sekolah (25m)'
                  : 'Klik untuk Simulasi Masuk Radius'}
              </span>
            </button>

            {currentUser && (
              <button
                onClick={() => setIsAttendanceModalOpen(true)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-blue-600/20 transition-all cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>
                  {existingTodayRecord && existingTodayRecord.checkInTime && !existingTodayRecord.checkOutTime
                    ? 'Absen Pulang'
                    : 'Absen Masuk'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Dashboard Analitik & Live Feed */}
        {activeTab === 'dashboard' && currentUser && (
          <div className="space-y-6">
            <DashboardAnalytics
              users={users}
              attendances={attendances}
              leaves={leaves}
              schoolConfig={schoolConfig}
              onOpenAttendanceModal={() => setIsAttendanceModalOpen(true)}
              currentUser={currentUser}
            />

            {/* Embedded interactive map in dashboard for convenience */}
            <div className="mt-6">
              <InteractiveMap
                schoolConfig={schoolConfig}
                userCoords={userCoords}
                distanceMeters={distanceMeters}
                isWithinRadius={isWithinRadius}
                onRefreshLocation={requestRealGps}
                onSimulateSchoolLocation={handleSimulateSchoolLocation}
                isSimulated={isSimulatedLocation}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Full Screen Peta Geofence 100m */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <h2 className="text-lg font-bold text-slate-800">
                Peta Titik Absensi & Radius Geofence SD BOPKRI Gondolayu
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Presensi absensi guru dan staf hanya dapat dikirim jika perangkat Anda berada dalam batas toleransi 100 meter dari koordinat sekolah.
              </p>
            </div>

            <InteractiveMap
              schoolConfig={schoolConfig}
              userCoords={userCoords}
              distanceMeters={distanceMeters}
              isWithinRadius={isWithinRadius}
              onRefreshLocation={requestRealGps}
              onSimulateSchoolLocation={handleSimulateSchoolLocation}
              isSimulated={isSimulatedLocation}
            />
          </div>
        )}

        {/* Tab 3: Monthly Report & PDF/Excel Export */}
        {activeTab === 'report' && (
          <MonthlyReport
            users={users}
            attendances={attendances}
            leaves={leaves}
            schoolConfig={schoolConfig}
          />
        )}

        {/* Tab 4: Leaves Management */}
        {activeTab === 'leaves' && currentUser && (
          <LeaveManagement
            leaves={leaves}
            onRefresh={loadInitialData}
            currentUser={currentUser}
            canApprove={isSuperAdmin || isKepalaSekolah}
            allUsers={users}
          />
        )}

        {/* Tab 5: User Management (Superadmin Only) */}
        {activeTab === 'users' && currentUser && (
          <UserManagement
            users={users}
            onRefresh={loadInitialData}
            currentUser={currentUser}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-bold text-slate-800">
              SABOGOT &bull; Absensi Online SD BOPKRI Gondolayu
            </div>
            <p className="text-[11px] text-slate-400">
              YAYASAN BOPKRI YOGYAKARTA &bull; Dikembangkan dengan Geofencing 100m, Verifikasi Wajah & Sinkronisasi Firebase.
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Kepala Sekolah: <strong>{schoolConfig.headmasterName}</strong></span>
            <span>&bull;</span>
            <span>Tahun Ajaran 2026/2027</span>
          </div>
        </div>
      </footer>

      {/* Attendance Modal (Camera + Geofence verification) */}
      {currentUser && (
        <AttendanceModal
          isOpen={isAttendanceModalOpen}
          onClose={() => setIsAttendanceModalOpen(false)}
          currentUser={currentUser}
          schoolConfig={schoolConfig}
          userCoords={userCoords}
          distanceMeters={distanceMeters}
          isWithinRadius={isWithinRadius}
          existingTodayRecord={existingTodayRecord}
          onSuccess={handleAttendanceSuccess}
        />
      )}

      {/* School Settings Modal (Superadmin) */}
      <SchoolSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={schoolConfig}
        onSaveSuccess={newConfig => {
          setSchoolConfig(newConfig);
          loadInitialData();
        }}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={users}
        schoolConfig={schoolConfig}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
