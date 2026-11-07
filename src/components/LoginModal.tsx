import React, { useState } from 'react';
import {
  LogIn,
  Key,
  GraduationCap,
  AlertCircle,
  X,
  UserCheck,
  Shield,
  Clock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile, SchoolConfig } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  users?: UserProfile[];
  schoolConfig?: SchoolConfig;
  isFullPage?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  schoolConfig,
  isFullPage = false,
}) => {
  const { loginWithGoogle, loginWithNip } = useAuth();
  const [activeTab, setActiveTab] = useState<'nip' | 'google'>('nip');
  const [nipInput, setNipInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleNipLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await loginWithNip(nipInput, passwordInput);
      if (res.success) {
        if (onClose) onClose();
      } else {
        setErrorMsg(res.message || 'Login gagal. Periksa kembali NIP/Username dan kata sandi Anda.');
      }
    } catch {
      setErrorMsg('Terjadi kendala koneksi ke server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const success = await loginWithGoogle();
      if (success) {
        if (onClose) onClose();
      } else {
        setErrorMsg('Email Google Anda belum terdaftar dalam sistem SABOGOT SD BOPKRI Gondolayu.');
      }
    } catch {
      setErrorMsg('Gagal masuk dengan Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillCredentials = (username: string, pass: string) => {
    setNipInput(username);
    setPasswordInput(pass);
    setErrorMsg(null);
  };

  const containerClasses = isFullPage
    ? 'min-h-screen bg-radial from-slate-900 via-slate-950 to-black text-slate-800 flex items-center justify-center p-4 sm:p-6 lg:p-8'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto';

  return (
    <div className={containerClasses}>
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 animate-in zoom-in-95 duration-200">
        {/* Left Side: School Branding & System Identity */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 p-6 sm:p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none"></div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-300 shadow-inner">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-blue-300 uppercase block">
                  PORTAL RESMI ABSENSI
                </span>
                <h1 className="text-2xl font-black tracking-tight text-white">
                  SABOGOT
                </h1>
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-blue-100">
                SD BOPKRI GONDOLAYU
              </h2>
              <p className="text-xs text-blue-200 leading-relaxed">
                Sistem Absensi BOPKRI Gondolayu Online Terpadu dengan Geofencing GPS 100m dan Verifikasi Wajah Presisi.
              </p>
            </div>

            {/* School Highlights */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2.5 text-xs text-blue-200/90 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Geofence Maksimal: <strong>{schoolConfig?.radiusToleranceMeters || 100}m</strong> dari Gerbang Sekolah</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-blue-200/90 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Jam Masuk: <strong>07:00</strong> &bull; Pulang: <strong>14:30 WIB</strong></span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-blue-200/90 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Hari Kerja: <strong>Senin s/d Jumat</strong> (Sabtu-Minggu Libur)</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-white/10 text-[11px] text-blue-300/80 flex items-center justify-between">
            <span>Yayasan BOPKRI Yogyakarta</span>
            <span>v2.0 Online Cloud</span>
          </div>
        </div>

        {/* Right Side: Manual Login Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-white relative">
          {!isFullPage && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div>
            <div className="mb-5">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                AUTENTIKASI PENGGUNA
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Masuk ke Portal SABOGOT
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Superadmin, Kepala Sekolah, Guru, dan Staf wajib masuk secara manual untuk mencatat presensi dan mengakses sistem.
              </p>
            </div>

            {/* Tab Selector: Only NIP/Manual & Google Auth */}
            <div className="flex border-b border-slate-200 bg-slate-50 rounded-xl p-1 mb-5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('nip');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'nip'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Username / NIP & Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('google');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'google'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Google Authentication
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMsg}</div>
              </div>
            )}

            {/* Tab 1: Username / NIP & Password */}
            {activeTab === 'nip' && (
              <form onSubmit={handleNipLogin} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Username / NIP / Email Pegawai
                  </label>
                  <input
                    type="text"
                    required
                    value={nipInput}
                    onChange={e => setNipInput(e.target.value)}
                    placeholder="Contoh: guru.dummy atau admin atau 19850115..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kata Sandi / PIN
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                      placeholder="Masukkan kata sandi..."
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-xs font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isLoading ? 'Memverifikasi Kredensial...' : 'Masuk ke Portal SABOGOT'}</span>
                </button>
              </form>
            )}

            {/* Tab 2: Google Authentication */}
            {activeTab === 'google' && (
              <div className="space-y-4 py-2 text-center text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Masuk langsung menggunakan akun Google yang telah didaftarkan oleh Superadmin SD BOPKRI Gondolayu.
                </p>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-3 shadow-xs transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isLoading ? 'Menghubungkan...' : 'Lanjutkan dengan Google Sign-In'}</span>
                </button>

                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-left text-[11px] text-blue-800">
                  <strong>Akun Google Utama:</strong> Akun <code>ppdb.sdbogota@gmail.com</code> otomatis dikenali sebagai Superadmin Utama sistem.
                </div>
              </div>
            )}
          </div>

          {/* Credentials Helper Cards: Clear list including the new Dummy Account */}
          <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
            <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Panduan Kredensial Login Manual:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
              {/* Dummy User Account */}
              <button
                type="button"
                onClick={() => handleFillCredentials('guru.dummy', 'guru123')}
                className="p-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-left transition-all cursor-pointer group"
              >
                <div className="font-bold text-emerald-800 flex items-center justify-between">
                  <span>Akun Uji Coba (Dummy)</span>
                  <UserCheck className="w-3 h-3 text-emerald-600" />
                </div>
                <div className="text-emerald-700 font-mono mt-0.5">guru.dummy</div>
                <div className="text-emerald-600 text-[9px]">Pass: <code>guru123</code></div>
              </button>

              {/* Superadmin Account */}
              <button
                type="button"
                onClick={() => handleFillCredentials('admin', 'admin')}
                className="p-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-left transition-all cursor-pointer group"
              >
                <div className="font-bold text-blue-800 flex items-center justify-between">
                  <span>Superadmin</span>
                  <Shield className="w-3 h-3 text-blue-600" />
                </div>
                <div className="text-blue-700 font-mono mt-0.5">admin</div>
                <div className="text-blue-600 text-[9px]">Pass: <code>admin</code></div>
              </button>

              {/* Kepala Sekolah Account */}
              <button
                type="button"
                onClick={() => handleFillCredentials('kepsek', '123')}
                className="p-2 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-left transition-all cursor-pointer group"
              >
                <div className="font-bold text-amber-800 flex items-center justify-between">
                  <span>Kepala Sekolah</span>
                  <GraduationCap className="w-3 h-3 text-amber-600" />
                </div>
                <div className="text-amber-700 font-mono mt-0.5">kepsek</div>
                <div className="text-amber-600 text-[9px]">Pass: <code>123</code></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
