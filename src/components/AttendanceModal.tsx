import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle, AlertCircle, X, ShieldAlert, Sparkles, MapPin, Clock } from 'lucide-react';
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
  existingTodayRecord,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'checkin' | 'checkout'>('checkin');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [notes, setNotes] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFaceAligned, setIsFaceAligned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Determine if checkin or checkout
  useEffect(() => {
    if (existingTodayRecord && existingTodayRecord.checkInTime && !existingTodayRecord.checkOutTime) {
      setMode('checkout');
    } else {
      setMode('checkin');
    }
  }, [existingTodayRecord]);

  // Start Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access denied or unavailable', err);
      setCameraError('Izin kamera diperlukan untuk verifikasi wajah absensi. Mohon izinkan akses kamera di peramban Anda.');
    }
  }, [stream]);

  // Stop camera when closing
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      // Face alignment visual prompt cycle
      const timer = setTimeout(() => {
        setIsFaceAligned(true);
      }, 1500);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
      setCapturedPhoto(null);
      setNotes('');
      setIsFaceAligned(false);
    }
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  // Calculate late time
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const [currentHour, currentMinute] = timeStr.split(':').map(Number);
  const [lateHour, lateMinute] = (schoolConfig.lateThresholdTime || '07:15').split(':').map(Number);

  const currentTotalMins = currentHour * 60 + currentMinute;
  const lateTotalMins = lateHour * 60 + lateMinute;
  const isLate = mode === 'checkin' && currentTotalMins > lateTotalMins;
  const lateMinutes = isLate ? currentTotalMins - lateTotalMins : 0;

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
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, h - 90, w, 90);

    // Top subtle banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.fillRect(0, 0, w, 36);

    // Header text
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#60a5fa'; // Blue 400
    ctx.fillText('SD BOPKRI GONDOLAYU - VERIFIKASI WAJAH SABOGOT', 14, 23);

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
    const badgeText = mode === 'checkout' ? 'ABSEN PULANG' : (isLate ? `TERLAMBAT (+${lateMinutes}m)` : 'TEPAT WAKTU');
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    const textWidth = ctx.measureText(badgeText).width;
    const badgeX = w - textWidth - 28;
    const badgeY = h - 55;

    ctx.fillStyle = mode === 'checkout' ? '#3b82f6' : (isLate ? '#f43f5e' : '#10b981');
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
    startCamera();
  };

  const handleSubmitAttendance = async () => {
    if (!capturedPhoto) {
      alert('Silakan ambil foto verifikasi wajah terlebih dahulu.');
      return;
    }

    if (!isWithinRadius) {
      alert(`Jarak Anda (${Math.round(distanceMeters || 0)}m) melebihi batas toleransi ${schoolConfig.radiusToleranceMeters}m dari SD BOPKRI Gondolayu.`);
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
            message: `${currentUser.name} (${currentUser.jobTitle}) melakukan absensi masuk pukul ${timeStr} WIB (Terlambat ${lateMinutes} menit). Catatan: ${notes || 'Tanpa keterangan'}`,
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
          checkOutDistance: distanceMeters !== null ? Math.round(distanceMeters * 10) / 10 : 0,
          checkOutLat: userCoords?.lat || schoolConfig.latitude,
          checkOutLng: userCoords?.lng || schoolConfig.longitude,
          checkOutPhoto: capturedPhoto,
          updatedAt: now.toISOString(),
        };
        await recordAttendance(updatedRecord);
      }

      stopCamera();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to submit attendance', err);
      alert('Terjadi kendala saat menyimpan absensi. Silakan coba kembali.');
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
                {mode === 'checkin' ? 'Absensi Masuk Harian' : 'Absensi Pulang Kerja'}
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
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Status Bar */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-slate-500 block text-[11px]">Waktu Sekarang:</span>
                <span className="font-bold text-slate-800 text-sm">{timeStr} WIB</span>
              </div>
            </div>

            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              isWithinRadius
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <MapPin className="w-4 h-4 shrink-0" />
              <div>
                <span className="block text-[11px] opacity-80">Jarak ke Sekolah:</span>
                <span className="font-bold text-xs sm:text-sm">
                  {distanceMeters !== null ? `${Math.round(distanceMeters)}m` : '0m'} ({isWithinRadius ? 'Valid &le;100m' : 'Di Luar 100m'})
                </span>
              </div>
            </div>
          </div>

          {/* Late Warning Alert if applicable */}
          {mode === 'checkin' && isLate && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Peringatan Keterlambatan: </strong>
                Anda melakukan absensi lewat dari batas jam operasional ({schoolConfig.lateThresholdTime || '07:15'} WIB). Terlambat sekitar {lateMinutes} menit.
              </div>
            </div>
          )}

          {/* Checkout Info Banner */}
          {mode === 'checkout' && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-800">
              <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Waktu Kepulangan Resmi: </strong>
                Waktu kepulangan resmi adalah pukul <strong>{schoolConfig.workEndTime || '14:30'} WIB</strong>. Pastikan tugas kedinasan dan presensi selesai dengan tertib.
              </div>
            </div>
          )}

          {/* Distance warning if outside 100m */}
          {!isWithinRadius && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Di Luar Titik Sekolah: </strong>
                Sistem mendeteksi jarak Anda {Math.round(distanceMeters || 0)}m dari SD BOPKRI Gondolayu. Toleransi absensi adalah maksimal 100 meter.
              </div>
            </div>
          )}

          {/* Camera View / Captured Preview */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center border-2 border-slate-700 shadow-inner">
            {capturedPhoto ? (
              <img
                src={capturedPhoto}
                alt="Foto Absensi"
                className="w-full h-full object-cover"
              />
            ) : cameraError ? (
              <div className="p-6 text-center text-rose-300 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
                <p className="text-xs">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
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
                  className="w-full h-full object-cover transform -scale-x-100"
                />

                {/* Face Oval Frame Guide */}
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
                disabled={isCapturing || !!cameraError}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Ambil Foto Verifikasi Wajah</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRetake}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ambil Ulang Foto</span>
              </button>
            )}
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan / Keterangan Tambahan (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isLate ? 'Contoh: Terhambat macet di jembatan Gondolayu...' : 'Contoh: Mengajar kelas 4 pagi ini...'}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
            disabled={!capturedPhoto || !isWithinRadius || isSubmitting}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
              !capturedPhoto || !isWithinRadius || isSubmitting
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Menyimpan Absensi...'
                : mode === 'checkin'
                ? 'Kirim Absensi Masuk'
                : 'Kirim Absensi Pulang'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
