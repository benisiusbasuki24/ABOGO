import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle, AlertCircle, X, ShieldAlert, Sparkles, MapPin, Clock, Navigation } from 'lucide-react';
import { UserProfile, SchoolConfig, AttendanceRecord, PortalNotification } from '../types';
import { recordAttendance, addNotification } from '../services/dbService';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  schoolConfig: SchoolConfig;
  userCoords: { lat: number; lng: number } | null;
  distanceMeters: number | null;
  isWithinRadius: boolean;
  gpsError?: string | null;
  onRefreshGps?: () => void;
  existingTodayRecord?: AttendanceRecord;
  onSuccess: () => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  schoolConfig,
  userCoords,
  distanceMeters,
  isWithinRadius,
  gpsError,
  onRefreshGps,
  existingTodayRecord,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'checkin' | 'checkout'>('checkin');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [notes, setNotes] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isFaceAligned, setIsFaceAligned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live ticking clock (synchronized with device / Indonesian WIB)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine if checkin or checkout
  useEffect(() => {
    if (existingTodayRecord && existingTodayRecord.checkInTime && !existingTodayRecord.checkOutTime) {
      setMode('checkout');
    } else {
      setMode('checkin');
    }
  }, [existingTodayRecord]);

  // Stop camera safely
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
    setIsCameraReady(false);
    setIsCameraStarting(false);
  }, []);

  // Start Camera with stable reference (prevents re-render blinking loops)
  const startCamera = useCallback(async () => {
    setCameraError(null);

    // If stream is already active and attached, avoid unnecessary restarts
    if (streamRef.current && streamRef.current.active) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraReady(true);
      return;
    }

    setIsCameraStarting(true);
    try {
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
          videoRef.current?.play().catch(e => console.warn('Autoplay error', e));
          setIsCameraReady(true);
          setIsCameraStarting(false);
        };
      } else {
        setIsCameraReady(true);
        setIsCameraStarting(false);
      }
    } catch (err) {
      console.error('Camera access denied or unavailable', err);
      setCameraError('Izin kamera diperlukan untuk verifikasi wajah presensi. Mohon izinkan akses kamera di peramban Anda.');
      setIsCameraStarting(false);
    }
  }, []);

  // Start camera when modal opens, stop cleanly when modal closes
  useEffect(() => {
    let alignmentTimer: NodeJS.Timeout;

    if (isOpen) {
      startCamera();
      alignmentTimer = setTimeout(() => {
        setIsFaceAligned(true);
      }, 1200);
    } else {
      stopCamera();
      setCapturedPhoto(null);
      setNotes('');
      setIsFaceAligned(false);
    }

    return () => {
      clearTimeout(alignmentTimer);
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  // Realtime Time Calculation & Synchronization
  const now = currentTime;
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const [currentHour, currentMinute] = timeStr.split(':').map(Number);
  const currentTotalMins = currentHour * 60 + currentMinute;

  // Jam Kehadiran (Masuk) synchronization
  const [lateHour, lateMinute] = (schoolConfig.lateThresholdTime || '07:15').split(':').map(Number);
  const lateTotalMins = lateHour * 60 + lateMinute;
  const isLate = mode === 'checkin' && currentTotalMins > lateTotalMins;
  const lateMinutes = isLate ? currentTotalMins - lateTotalMins : 0;

  // Jam Kepulangan (Pulang) synchronization
  const isFriday = now.getDay() === 5;
  const officialEndTime = isFriday ? (schoolConfig.workEndTimeFriday || '14:30') : (schoolConfig.workEndTime || '14:30');
  const [endHour, endMinute] = officialEndTime.split(':').map(Number);
  const officialEndMins = endHour * 60 + endMinute;
  const isEarlyCheckout = mode === 'checkout' && currentTotalMins < officialEndMins;
  const earlyCheckoutMinutes = isEarlyCheckout ? officialEndMins - currentTotalMins : 0;

  // GPS Enforcement
  const isGpsActive = !!userCoords && !gpsError;
  const canSubmit = isGpsActive && isWithinRadius && !!capturedPhoto && !isSubmitting;

  // Capture face photo with geotag & watermark
  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply watermark overlay
    const w = canvas.width;
    const h = canvas.height;

    // Bottom dark gradient banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, h - 90, w, 90);

    // Top subtle banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(0, 0, w, 36);

    // Header text
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#60a5fa'; // Blue 400
    ctx.fillText('SD BOPKRI GONDOLAYU - VERIFIKASI WAJAH PREBOGO', 14, 23);

    // Bottom Stamp details
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${currentUser.name} (NIP. ${currentUser.nip})`, 14, h - 65);

    ctx.font = '11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
    ctx.fillText(`${dateFormatted} | Pukul ${timeStr} WIB`, 14, h - 45);

    const distText = distanceMeters !== null ? `${Math.round(distanceMeters)}m dari sekolah` : 'Di area sekolah';
    ctx.fillText(`GPS: ${userCoords ? `${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)}` : 'Terdeteksi'} (${distText})`, 14, h - 25);

    // Status Badge on photo
    let badgeText = 'TEPAT WAKTU';
    let badgeColor = '#10b981';
    if (mode === 'checkout') {
      if (isEarlyCheckout) {
        badgeText = `PULANG AWAL (-${earlyCheckoutMinutes}m)`;
        badgeColor = '#f59e0b';
      } else {
        badgeText = 'PULANG SESUAI JADWAL (14:30 WIB)';
        badgeColor = '#3b82f6';
      }
    } else {
      if (isLate) {
        badgeText = `TERLAMBAT (+${lateMinutes}m)`;
        badgeColor = '#f43f5e';
      } else {
        badgeText = 'TEPAT WAKTU (07:00-07:15 WIB)';
        badgeColor = '#10b981';
      }
    }

    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    const textWidth = ctx.measureText(badgeText).width;
    const badgeX = w - textWidth - 28;
    const badgeY = h - 55;

    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY - 16, textWidth + 18, 26, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(badgeText, badgeX + 9, badgeY + 2);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
    setIsCapturing(false);
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    if (!streamRef.current || !streamRef.current.active) {
      startCamera();
    } else if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleSubmitAttendance = async () => {
    if (!isGpsActive) {
      alert('Anda wajib mengaktifkan GPS pada handphone Anda untuk melakukan presensi resmi SD BOPKRI Gondolayu.');
      return;
    }

    if (!isWithinRadius) {
      alert(`Jarak Anda (${Math.round(distanceMeters || 0)}m) melebihi batas toleransi ${schoolConfig.radiusToleranceMeters}m dari SD BOPKRI Gondolayu.`);
      return;
    }

    if (!capturedPhoto) {
      alert('Silakan ambil foto verifikasi wajah terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    const dateKey = now.toISOString().split('T')[0];
    const recordId = existingTodayRecord?.id || `att_${currentUser.id}_${dateKey}`;

    try {
      if (mode === 'checkin') {
        const newRecord: AttendanceRecord = {
          id: recordId,
          userId: currentUser.id,
          userName: currentUser.name,
          userNip: currentUser.nip,
          userRole: currentUser.role,
          date: dateKey,
          checkInTime: timeStr,
          checkInStatus: isLate ? 'terlambat' : 'tepat_waktu',
          lateMinutes: lateMinutes,
          checkInDistance: distanceMeters !== null ? Math.round(distanceMeters * 10) / 10 : 0,
          checkInLat: userCoords?.lat || schoolConfig.latitude,
          checkInLng: userCoords?.lng || schoolConfig.longitude,
          checkInPhoto: capturedPhoto,
          status: isLate ? 'terlambat' : 'hadir',
          notes: notes.trim(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        await recordAttendance(newRecord);

        // Real-time Late Alert notification for Headmaster & Admins
        if (isLate) {
          const lateNotif: PortalNotification = {
            id: `notif_late_${currentUser.id}_${Date.now()}`,
            recipientId: 'all_admins',
            senderId: currentUser.id,
            senderName: currentUser.name,
            title: `Keterlambatan: ${currentUser.name}`,
            message: `${currentUser.name} (${currentUser.jobTitle}) presensi masuk pukul ${timeStr} WIB (Terlambat ${lateMinutes} menit). Catatan: ${notes || 'Tanpa catatan'}`,
            type: 'late_alert',
            read: false,
            createdAt: now.toISOString(),
          };
          await addNotification(lateNotif);
        }
      } else {
        // Mode checkout
        const updatedRecord: AttendanceRecord = {
          ...(existingTodayRecord as AttendanceRecord),
          checkOutTime: timeStr,
          checkOutStatus: isEarlyCheckout ? 'pulang_awal' : 'sesuai_jadwal',
          checkOutEarlyMinutes: earlyCheckoutMinutes,
          checkOutDistance: distanceMeters !== null ? Math.round(distanceMeters * 10) / 10 : 0,
          checkOutLat: userCoords?.lat || schoolConfig.latitude,
          checkOutLng: userCoords?.lng || schoolConfig.longitude,
          checkOutPhoto: capturedPhoto,
          updatedAt: now.toISOString(),
        };
        await recordAttendance(updatedRecord);

        // Early checkout alert for admins if leaving early
        if (isEarlyCheckout) {
          const earlyNotif: PortalNotification = {
            id: `notif_early_${currentUser.id}_${Date.now()}`,
            recipientId: 'all_admins',
            senderId: currentUser.id,
            senderName: currentUser.name,
            title: `Pulang Lebih Awal: ${currentUser.name}`,
            message: `${currentUser.name} (${currentUser.jobTitle}) melakukan presensi pulang pukul ${timeStr} WIB (${earlyCheckoutMinutes} menit sebelum jam resmi 14:30 WIB). Catatan: ${notes || 'Tanpa catatan'}`,
            type: 'late_alert',
            read: false,
            createdAt: now.toISOString(),
          };
          await addNotification(earlyNotif);
        }
      }

      stopCamera();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to submit attendance', err);
      alert('Terjadi kendala saat menyimpan presensi. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-300">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {mode === 'checkin' ? 'Presensi Masuk Harian' : 'Presensi Pulang Kerja'}
              </h2>
              <p className="text-xs text-blue-200">
                SD BOPKRI GONDOLAYU &bull; {currentUser.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Status Bar: Synchronized Digital Clock & Real GPS distance */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-slate-500 block text-[11px]">Waktu Presensi (WIB):</span>
                <span className="font-mono font-extrabold text-slate-800 text-sm">{timeStr}</span>
              </div>
            </div>

            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              !isGpsActive
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : isWithinRadius
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}>
              <MapPin className="w-4 h-4 shrink-0" />
              <div>
                <span className="block text-[11px] opacity-80">GPS Handphone:</span>
                <span className="font-bold text-xs">
                  {!isGpsActive
                    ? 'GPS Nonaktif'
                    : `${Math.round(distanceMeters || 0)}m (${isWithinRadius ? 'Dalam Radius' : 'Di Luar Radius'})`}
                </span>
              </div>
            </div>
          </div>

          {/* GPS MANDATORY WARNING BANNER */}
          {!isGpsActive && (
            <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-rose-800 block text-xs">GPS Handphone Wajib Aktif!</strong>
                  <p className="text-[11px] text-rose-700 leading-relaxed mt-0.5">
                    Untuk melakukan presensi, Anda wajib mengaktifkan layanan lokasi (GPS) pada smartphone dan mengizinkan peramban mengakses titik koordinat Anda di SD BOPKRI Gondolayu.
                  </p>
                </div>
              </div>

              {onRefreshGps && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={onRefreshGps}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Aktifkan / Cek Ulang GPS</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Time Synchronization Details */}
          {mode === 'checkin' ? (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
              isLate ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${isLate ? 'text-amber-600' : 'text-emerald-600'}`} />
              <div>
                <strong className="font-bold">Sinkronisasi Jam Masuk: </strong>
                Jam masuk resmi pukul <strong>{schoolConfig.workStartTime} WIB</strong> (Toleransi keterlambatan s/d <strong>{schoolConfig.lateThresholdTime} WIB</strong>).
                {isLate ? (
                  <span className="block text-amber-800 font-bold mt-0.5">
                    Status: Terlambat {lateMinutes} menit dari jadwal toleransi.
                  </span>
                ) : (
                  <span className="block text-emerald-800 font-semibold mt-0.5">
                    Status: Tepat Waktu (Memenuhi jam kehadiran sekolah).
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
              isEarlyCheckout ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${isEarlyCheckout ? 'text-amber-600' : 'text-blue-600'}`} />
              <div>
                <strong className="font-bold">Sinkronisasi Jam Kepulangan: </strong>
                Waktu kepulangan resmi SD BOPKRI Gondolayu adalah pukul <strong>{officialEndTime} WIB</strong>.
                {isEarlyCheckout ? (
                  <span className="block text-amber-800 font-bold mt-0.5">
                    Perhatian: Anda melakukan presensi pulang {earlyCheckoutMinutes} menit lebih awal sebelum pukul 14:30 WIB.
                  </span>
                ) : (
                  <span className="block text-blue-800 font-semibold mt-0.5">
                    Status: Kepulangan Sesuai Jadwal Resmi (Pukul {timeStr} WIB).
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Geofence Alert if GPS active but outside school boundary */}
          {isGpsActive && !isWithinRadius && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Di Luar Lingkungan Sekolah: </strong>
                Jarak Anda terdeteksi {Math.round(distanceMeters || 0)}m dari gerbang SD BOPKRI Gondolayu. Batas toleransi adalah {schoolConfig.radiusToleranceMeters} meter.
              </div>
            </div>
          )}

          {/* Camera View / Captured Preview */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center border-2 border-slate-700 shadow-inner">
            {capturedPhoto ? (
              <img
                src={capturedPhoto}
                alt="Foto Presensi"
                className="w-full h-full object-cover"
              />
            ) : cameraError ? (
              <div className="p-6 text-center text-rose-300 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
                <p className="text-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Coba Akses Kamera Lagi
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => {
                    videoRef.current?.play().catch(() => {});
                    setIsCameraReady(true);
                  }}
                  className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-200 ${
                    isCameraReady ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* Loading state indicator while camera initializes */}
                {isCameraStarting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white gap-2">
                    <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                    <span className="text-xs text-slate-300 font-medium">Menghubungkan kamera...</span>
                  </div>
                )}

                {/* Face Oval Frame Guide */}
                {isCameraReady && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div
                      className={`w-44 h-56 rounded-[50%] border-2 transition-all duration-300 ${
                        isFaceAligned
                          ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]'
                          : 'border-white/60 border-dashed'
                      }`}
                    ></div>
                    <span className="mt-3 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-[11px] font-semibold text-white border border-white/20 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      {isFaceAligned ? 'Posisi Wajah Terdeteksi Bagus' : 'Arahkan wajah ke dalam oval'}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Offscreen Canvas for watermarking */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Controls */}
          <div className="flex items-center justify-center gap-3">
            {!capturedPhoto ? (
              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={isCapturing || !!cameraError || !isGpsActive}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>
                  {!isGpsActive ? 'Aktifkan GPS Handphone Terlebih Dahulu' : 'Ambil Foto Verifikasi Wajah'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRetake}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ambil Ulang Foto Wajah</span>
              </button>
            )}
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan / Keterangan Presensi (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={
                mode === 'checkout' && isEarlyCheckout
                  ? 'Keterangan alasan pulang lebih awal (contoh: izin tugas kedinasan luar)...'
                  : isLate
                  ? 'Keterangan alasan keterlambatan (contoh: jalanan macet)...'
                  : 'Catatan tambahan...'
              }
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2.5">
          <div className="text-[11px] text-slate-500">
            {isGpsActive ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> GPS Aktif ({Math.round(distanceMeters || 0)}m)
              </span>
            ) : (
              <span className="text-rose-600 font-semibold">GPS Belum Aktif</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSubmitAttendance}
              disabled={!canSubmit}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                !canSubmit
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Menyimpan Presensi...'
                  : mode === 'checkin'
                  ? 'Kirim Presensi Masuk'
                  : 'Kirim Presensi Pulang'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
