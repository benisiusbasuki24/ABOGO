import React, { useState } from 'react';
import {
  LogIn,
  Key,
  Shield,
  GraduationCap,
  Briefcase,
  ArrowRight,
  AlertCircle,
  X,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
}) => {
  const { loginWithGoogle, loginWithNip, switchDemoUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'nip' | 'google' | 'demo'>('nip');
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
        onClose();
      } else {
        setErrorMsg(res.message || 'Login gagal. Periksa kembali NIP dan kata sandi Anda.');
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
        onClose();
      } else {
        setErrorMsg('Email Google Anda belum didaftarkan oleh Superadmin SD BOPKRI Gondolayu.');
      }
    } catch {
      setErrorMsg('Gagal masuk dengan Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemo = async (userId: string) => {
    setIsLoading(true);
    await switchDemoUser(userId);
    setIsLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-blue-900 via-blue-800 to-slate-950 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-300 mb-3 shadow-inner">
            <GraduationCap className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
            PORTAL RESMI ABOGO
          </span>
          <h2 className="text-xl font-black mt-0.5">SD BOPKRI GONDOLAYU</h2>
          <p className="text-xs text-blue-200 mt-1">
            Silakan masuk untuk mencatat absensi atau mengakses dashboard kepegawaian.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab('nip');
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'nip'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            NIP & Password
          </button>
          <button
            onClick={() => {
              setActiveTab('google');
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'google'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Google Auth
          </button>
          <button
            onClick={() => {
              setActiveTab('demo');
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'demo'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Akses Cepat (Demo)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {activeTab === 'nip' && (
            <form onSubmit={handleNipLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nomor Induk Pegawai (NIP) atau Email
                </label>
                <input
                  type="text"
                  required
                  value={nipInput}
                  onChange={e => setNipInput(e.target.value)}
                  placeholder="Contoh: 198203142006041005"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono text-xs"
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
                    placeholder="Masukkan sandi atau default: 123"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-xs"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Default password demo: <code>123</code> (atau <code>admin</code> untuk Superadmin)
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'Memproses Masuk...' : 'Masuk ke Portal ABOGO'}</span>
              </button>
            </form>
          )}

          {activeTab === 'google' && (
            <div className="space-y-4 py-2 text-center">
              <p className="text-xs text-slate-600 leading-relaxed">
                Masuk menggunakan akun Google Anda yang terdaftar pada sistem SD BOPKRI Gondolayu.
              </p>

              <button
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
                <strong>Catatan Admin:</strong> Akun Google superadmin bawaan: <code>ppdb.sdbogota@gmail.com</code> otomatis dikenali sebagai Superadmin Utama.
              </div>
            </div>
          )}

          {activeTab === 'demo' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Pilih akun simulasi di bawah untuk menguji hak akses dan alur kerja masing-masing peran:
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {users.slice(0, 5).map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectDemo(u.id)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={u.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=2563eb&color=fff`}
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                      <div>
                        <div className="font-bold text-slate-800 text-xs group-hover:text-blue-600 transition-colors">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                          <span className="capitalize font-semibold text-blue-700">{u.role.replace('_', ' ')}</span>
                          <span>&bull;</span>
                          <span>{u.jobTitle}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
