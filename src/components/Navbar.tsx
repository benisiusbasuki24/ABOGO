import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Bell,
  Clock,
  LogOut,
  Settings,
  Users,
  Calendar,
  FileText,
  MapPin,
  Shield,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Menu,
  X,
  Fingerprint,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PortalNotification, SchoolConfig, UserProfile } from '../types';
import { markNotificationAsRead } from '../services/dbService';

interface NavbarProps {
  activeTab: 'dashboard' | 'map' | 'report' | 'leaves' | 'users';
  setActiveTab: (tab: 'dashboard' | 'map' | 'report' | 'leaves' | 'users') => void;
  notifications: PortalNotification[];
  onRefreshNotifications: () => void;
  onOpenSettings: () => void;
  onOpenLoginModal: () => void;
  schoolConfig: SchoolConfig;
  allUsers: UserProfile[];
  pendingLeavesCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  notifications,
  onRefreshNotifications,
  onOpenSettings,
  onOpenLoginModal,
  schoolConfig,
  allUsers,
  pendingLeavesCount = 0,
}) => {
  const {
    currentUser,
    logout,
    isSuperAdmin,
    isKepalaSekolah,
    canApproveLeaves,
    registerBiometric,
    removeBiometric,
    registeredBiometricUser,
  } = useAuth();
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [bioFeedback, setBioFeedback] = useState<string | null>(null);

  // Digital WIB Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
      setDateStr(
        new Intl.DateTimeFormat('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const unreadNotifs = notifications.filter(n => !n.read);

  const handleNotificationClick = async (notifId: string) => {
    await markNotificationAsRead(notifId);
    onRefreshNotifications();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & School Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-base">
                  PREBOGO
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                  SD BOPKRI GONDOLAYU
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Absensi Online Geofence & Verifikasi Wajah
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Dashboard Analitik
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Peta Geofence (100m)
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Rekap & Ekspor
            </button>
            <button
              onClick={() => setActiveTab('leaves')}
              className={`px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'leaves'
                  ? 'bg-purple-50 text-purple-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>{isKepalaSekolah ? 'Moderasi Cuti & Izin' : 'Cuti & Izin'}</span>
              {canApproveLeaves && pendingLeavesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-extrabold animate-pulse">
                  {pendingLeavesCount}
                </span>
              )}
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-purple-50 text-purple-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Kelola User (Superadmin)
              </button>
            )}
          </nav>

          {/* Right Action Icons: Clock, Cloud Status, Notification, Profile */}
          <div className="flex items-center gap-2.5">
            {/* Real-time Firebase Cloud Connection Badge */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Firebase Cloud: Terhubung</span>
            </div>

            {/* Live Clock */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-mono font-bold">
              <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>{timeStr}</span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                title="Pusat Notifikasi"
                className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center animate-bounce">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">Notifikasi Keterlambatan & Sistem</span>
                      {unreadNotifs.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 font-extrabold">
                          {unreadNotifs.length} baru
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setIsNotifOpen(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-2 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        Tidak ada notifikasi baru.
                      </div>
                    ) : (
                      notifications.slice(0, 8).map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif.id)}
                          className={`py-2.5 px-2 rounded-xl text-xs transition-colors cursor-pointer ${
                            !notif.read ? 'bg-amber-50/70 hover:bg-amber-100/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {notif.type === 'late_alert' ? (
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-800 text-[11px] flex items-center justify-between">
                                <span>{notif.title}</span>
                                {!notif.read && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 leading-tight">
                                {notif.message}
                              </p>
                              <span className="text-[10px] text-slate-400 block pt-0.5">
                                {new Date(notif.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile / Account Dropdown */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <img
                    src={currentUser.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=2563eb&color=fff`}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                  />
                  <div className="text-left hidden md:block">
                    <div className="font-bold text-xs text-slate-800 leading-none">
                      {currentUser.name.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-slate-500 capitalize leading-none mt-1">
                      {currentUser.role.replace('_', ' ')}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
                    <div className="p-2 border-b border-slate-100">
                      <div className="font-bold text-slate-900">{currentUser.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">NIP: {currentUser.nip}</div>
                      <div className="text-[11px] text-blue-600 font-semibold mt-0.5">{currentUser.jobTitle}</div>
                    </div>

                    <div className="py-2 space-y-1">
                      {isSuperAdmin && (
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenSettings();
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <Settings className="w-4 h-4 text-blue-600" />
                          <span>Pengaturan Geofence & Jam Kerja</span>
                        </button>
                      )}

                      {/* Device Biometric Registration / Toggle */}
                      {registeredBiometricUser?.userId === currentUser.id ? (
                        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                              <Fingerprint className="w-4 h-4 text-emerald-600" />
                              <span>Biometrik Aktif</span>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await removeBiometric();
                                setBioFeedback('Biometrik dinonaktifkan di perangkat ini.');
                                setTimeout(() => setBioFeedback(null), 3000);
                              }}
                              className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                          <span className="text-[10px] text-emerald-700 block mt-0.5">
                            Perangkat ini dapat login 1 sentuhan.
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await registerBiometric();
                            setBioFeedback(res.message);
                            setTimeout(() => setBioFeedback(null), 3500);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <Fingerprint className="w-4 h-4 text-emerald-600" />
                          <span>Daftarkan Biometrik Perangkat</span>
                        </button>
                      )}

                      {bioFeedback && (
                        <div className="px-2.5 py-1 text-[10px] rounded-lg bg-blue-50 text-blue-700 font-medium">
                          {bioFeedback}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenLoginModal();
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <UserCheck className="w-4 h-4 text-purple-600" />
                        <span>Ganti Akun / Login</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer font-bold"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Keluar Akun (Logout)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenLoginModal}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                Masuk / Login
              </button>
            )}

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-100 text-slate-700"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-200 space-y-1 text-xs font-semibold">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl ${
                activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'
              }`}
            >
              Dashboard Analitik
            </button>
            <button
              onClick={() => {
                setActiveTab('map');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl ${
                activeTab === 'map' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'
              }`}
            >
              Peta Geofence (100m)
            </button>
            <button
              onClick={() => {
                setActiveTab('report');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl ${
                activeTab === 'report' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'
              }`}
            >
              Rekap & Ekspor Laporan
            </button>
            <button
              onClick={() => {
                setActiveTab('leaves');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between ${
                activeTab === 'leaves' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-700'
              }`}
            >
              <span>{isKepalaSekolah ? 'Moderasi Cuti & Izin Guru' : 'Pengajuan Cuti / Izin'}</span>
              {canApproveLeaves && pendingLeavesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-extrabold">
                  {pendingLeavesCount} pending
                </span>
              )}
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => {
                  setActiveTab('users');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl ${
                  activeTab === 'users' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-700'
                }`}
              >
                Kelola User (Superadmin)
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
