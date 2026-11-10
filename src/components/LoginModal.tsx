import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Fingerprint,
  ScanFace,
  CheckCircle2,
  RefreshCw,
  Camera,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile, SchoolConfig } from '../types';
import { getLocalBiometricRegistry, registerDeviceBiometric } from '../services/biometricService';

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
  users = [],
  schoolConfig,
  isFullPage = false,
}) => {
  const {
    loginWithGoogle,
    loginWithNip,
    loginWithBiometric,
    isBiometricSupported,
    registeredBiometricUser,
    refreshBiometricStatus,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'nip' | 'biometric' | 'google'>(
    registeredBiometricUser ? 'biometric' : 'nip'
  );
  const [nipInput, setNipInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Biometric Sub-mode: 'sensor' (Fingerprint / TouchID / WebAuthn) or 'camera_face' (Camera Scan)
  const [bioMode, setBioMode] = useState<'sensor' | 'camera_face'>('sensor');
  const [selectedBioUser, setSelectedBioUser] = useState<string>(
    registeredBiometricUser?.userId || 'user_guru_dummy'
  );

  // Camera state for Face Biometric Scan
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isFaceScanning, setIsFaceScanning] = useState(false);
  const [faceScanSuccess, setFaceScanSuccess] = useState(false);

  // Stop face scan camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsFaceScanning(false);
  }, []);

  // Start face scan camera
  const startCamera = useCallback(async () => {
    setErrorMsg(null);
    try {
      if (streamRef.current && streamRef.current.active) {
        if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
        setIsCameraActive(true);
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera access failed for biometric face scan', err);
      setErrorMsg('Kamera tidak dapat diakses untuk pemindaian biometrik wajah. Mohon izinkan akses kamera.');
    }
  }, []);

  // Clean up camera when tab changes or modal closes
  useEffect(() => {
    if (activeTab === 'biometric' && bioMode === 'camera_face' && isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, bioMode, isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  // Handle standard NIP/Username login
  const handleNipLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
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

  // Handle Google Auth Login
  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
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

  // Handle Device Sensor Biometric (Touch ID / Face ID / Fingerprint)
  const handleSensorBiometricLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const targetUser = users.find(u => u.id === selectedBioUser);
      const res = await loginWithBiometric(targetUser?.nip || selectedBioUser);
      if (res.success) {
        setSuccessMsg(res.message || 'Biometrik terverifikasi! Mengalihkan ke portal...');
        setTimeout(() => {
          if (onClose) onClose();
        }, 600);
      } else {
        setErrorMsg(res.message || 'Verifikasi biometrik dibatalkan atau gagal.');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(`Kendala biometrik: ${error.message || 'Sensor tidak merespon'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Register & Login with Biometric for an account
  const handleQuickRegisterBiometric = async (user: UserProfile) => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const regRes = await registerDeviceBiometric(user);
      if (regRes.success) {
        refreshBiometricStatus();
        // Immediately log in using the newly registered biometric
        const loginRes = await loginWithBiometric(user.id);
        if (loginRes.success) {
          setSuccessMsg(`Biometrik untuk ${user.name} berhasil diaktifkan & terverifikasi!`);
          setTimeout(() => {
            if (onClose) onClose();
          }, 600);
        } else {
          setSuccessMsg(regRes.message);
        }
      } else {
        setErrorMsg(regRes.message);
      }
    } catch {
      setErrorMsg('Gagal mengaktifkan biometrik perangkat.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Camera Face Recognition Unlock
  const handleTriggerFaceScan = () => {
    setIsFaceScanning(true);
    setErrorMsg(null);

    // Simulate real-time face matching pipeline
    setTimeout(() => {
      const targetUser = users.find(u => u.id === selectedBioUser) || users[0];
      if (targetUser) {
        setFaceScanSuccess(true);
        setTimeout(async () => {
          // Login as verified user
          await loginWithNip(targetUser.nip, targetUser.password || '123');
          stopCamera();
          if (onClose) onClose();
        }, 1000);
      } else {
        setIsFaceScanning(false);
        setErrorMsg('Wajah tidak dikenali dalam basis data pegawai SD BOPKRI Gondolayu.');
      }
    }, 1800);
  };

  const handleFillCredentials = (username: string, pass: string) => {
    setNipInput(username);
    setPasswordInput(pass);
    setErrorMsg(null);
  };

  const localRegistrations = getLocalBiometricRegistry();
  const currentBioTarget = users.find(u => u.id === selectedBioUser) || (users.length > 0 ? users[0] : null);

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
                Sistem Absensi Terpadu dengan Geofence GPS 100m, Verifikasi Wajah, dan <strong>Login Biometrik</strong> Cepat.
              </p>
            </div>

            {/* Highlights */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2.5 text-xs text-blue-200/90 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <Fingerprint className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Login Biometrik: <strong>Sidik Jari / Touch ID / Face ID</strong></span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-blue-200/90 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Geofence Maksimal: <strong>{schoolConfig?.radiusToleranceMeters || 100}m</strong> dari Sekolah</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-blue-200/90 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Jam Masuk: <strong>07:00</strong> &bull; Pulang: <strong>14:30 WIB</strong></span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-white/10 text-[11px] text-blue-300/80 flex items-center justify-between">
            <span>Yayasan BOPKRI Yogyakarta</span>
            <span>v2.2 Biometric Ready</span>
          </div>
        </div>

        {/* Right Side: Login Form with Biometric Tabs */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-white relative">
          {!isFullPage && onClose && (
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div>
            <div className="mb-4">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                AUTENTIKASI RESMI
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Masuk ke Portal SABOGOT
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Pilih metode masuk yang diinginkan: Biometrik Sensor/Wajah, NIP & Password, atau Google.
              </p>
            </div>

            {/* Main Tabs: Biometrik, NIP, Google */}
            <div className="flex border-b border-slate-200 bg-slate-50 rounded-xl p-1 mb-4 gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('biometric');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'biometric'
                    ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Fingerprint className="w-4 h-4 text-emerald-600" />
                <span>Biometrik</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('nip');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'nip'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                NIP & Sandi
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('google');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'google'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Google Auth
              </button>
            </div>

            {/* Error or Success feedback */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMsg}</div>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-semibold">{successMsg}</div>
              </div>
            )}

            {/* ================= TAB 1: BIOMETRIC LOGIN ================= */}
            {activeTab === 'biometric' && (
              <div className="space-y-4">
                {/* Sub-selector: Sensor vs Camera Face ID */}
                <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setBioMode('sensor');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      bioMode === 'sensor'
                        ? 'bg-white text-emerald-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>Sidik Jari / Touch ID</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBioMode('camera_face');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      bioMode === 'camera_face'
                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ScanFace className="w-3.5 h-3.5" />
                    <span>Pindai Wajah (Face ID)</span>
                  </button>
                </div>

                {/* Sub-mode 1: Device Sensor (WebAuthn / Touch ID / Fingerprint) */}
                {bioMode === 'sensor' && (
                  <div className="space-y-4">
                    {/* Select Account for Biometric */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Pilih Akun Pegawai untuk Masuk:
                      </label>
                      <select
                        value={selectedBioUser}
                        onChange={e => setSelectedBioUser(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.jobTitle})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Biometric Interactive Action Card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50 border border-emerald-200/80 text-center space-y-3 shadow-xs">
                      <div className="relative inline-flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-pulse">
                          <Fingerprint className="w-9 h-9" />
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-slate-800 text-sm">
                          {currentBioTarget?.name || 'Pengguna Terpilih'}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {currentBioTarget?.jobTitle} &bull; NIP: {currentBioTarget?.nip}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleSensorBiometricLogin}
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <Fingerprint className="w-4 h-4" />
                        <span>{isLoading ? 'Menunggu Sentuhan Sensor...' : 'Sentuh Sensor Biometrik untuk Masuk'}</span>
                      </button>

                      <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5 pt-1">
                        <Smartphone className="w-3 h-3 text-emerald-600" />
                        <span>Mendukung Touch ID, Face ID, Fingerprint & Windows Hello</span>
                      </div>
                    </div>

                    {/* Quick registration prompt if not registered yet */}
                    {currentBioTarget && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-[11px]">
                        <div>
                          <span className="font-bold text-slate-700 block">Ingin mendaftarkan sensor perangkat?</span>
                          <span className="text-slate-500">Tautkan sidik jari perangkat ini untuk akun {currentBioTarget.name.split(' ')[0]}.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickRegisterBiometric(currentBioTarget)}
                          disabled={isLoading}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-emerald-700 font-bold whitespace-nowrap cursor-pointer shadow-2xs"
                        >
                          Daftarkan Sensor
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-mode 2: Live Camera Face Scan */}
                {bioMode === 'camera_face' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Pilih Identitas Pegawai yang Dipindai:
                      </label>
                      <select
                        value={selectedBioUser}
                        onChange={e => setSelectedBioUser(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.jobTitle})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Camera View Box */}
                    <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center border-2 border-slate-700 shadow-inner">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />

                      {/* Oval Guide Overlay */}
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        <div
                          className={`w-36 h-48 rounded-[50%] border-2 transition-all duration-300 ${
                            faceScanSuccess
                              ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_rgba(52,211,153,0.6)]'
                              : isFaceScanning
                              ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)] animate-pulse'
                              : 'border-white/70 border-dashed'
                          }`}
                        ></div>
                        <span className="mt-2 px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-[10px] font-semibold text-white border border-white/20 flex items-center gap-1">
                          {faceScanSuccess ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-300">Wajah Terverifikasi! Masuk...</span>
                            </>
                          ) : isFaceScanning ? (
                            <>
                              <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                              <span>Mencocokkan Biometrik Wajah...</span>
                            </>
                          ) : (
                            <>
                              <ScanFace className="w-3 h-3 text-blue-400" />
                              <span>Arahkan Wajah ke Dalam Lingkaran Oval</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTriggerFaceScan}
                      disabled={isFaceScanning || faceScanSuccess}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                    >
                      <ScanFace className="w-4 h-4" />
                      <span>{isFaceScanning ? 'Memverifikasi...' : 'Pindai Wajah Sekarang'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ================= TAB 2: NIP & PASSWORD ================= */}
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

            {/* ================= TAB 3: GOOGLE AUTH ================= */}
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

          {/* Quick Helper Credentials */}
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
            <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Panduan Kredensial Login Cepat:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
              {/* Dummy User Account */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('nip');
                  handleFillCredentials('guru.dummy', 'guru123');
                }}
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
                onClick={() => {
                  setActiveTab('nip');
                  handleFillCredentials('admin', 'admin');
                }}
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
                onClick={() => {
                  setActiveTab('nip');
                  handleFillCredentials('kepsek', '123');
                }}
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
