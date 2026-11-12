import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Sparkles,
  MapPin,
  MapPinOff,
  ChevronRight,
  ShieldCheck,
  Eye,
  X,
  AlertTriangle,
} from 'lucide-react';
import { UserProfile, AttendanceRecord, LeaveRequest, SchoolConfig } from '../types';

interface DashboardAnalyticsProps {
  users: UserProfile[];
  attendances: AttendanceRecord[];
  leaves: LeaveRequest[];
  schoolConfig: SchoolConfig;
  onOpenAttendanceModal: () => void;
  currentUser: UserProfile;
  isGpsActive?: boolean;
  onRequestGps?: () => void;
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  users,
  attendances,
  leaves,
  schoolConfig,
  onOpenAttendanceModal,
  currentUser,
  isGpsActive = false,
  onRequestGps,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'tepat_waktu' | 'terlambat' | 'belum_absen'>('all');
  const [inspectPhoto, setInspectPhoto] = useState<AttendanceRecord | null>(null);

  // Active users only
  const activeUsers = useMemo(() => users.filter(u => u.status === 'active'), [users]);

  // Today attendances
  const todayAttendances = useMemo(() => {
    return attendances.filter(a => a.date === selectedDate);
  }, [attendances, selectedDate]);

  // Today leaves
  const todayLeaves = useMemo(() => {
    return leaves.filter(
      l => l.status === 'approved' && l.startDate <= selectedDate && l.endDate >= selectedDate
    );
  }, [leaves, selectedDate]);

  // Stats computation
  const totalEmployees = activeUsers.length;
  const onTimeAttendances = todayAttendances.filter(
    a => (a.status === 'hadir' && a.lateMinutes === 0) || a.checkInStatus === 'tepat_waktu'
  );
  const lateAttendances = todayAttendances.filter(
    a => a.status === 'terlambat' || a.checkInStatus === 'terlambat' || a.lateMinutes > 0
  );
  const leaveAttendances = todayAttendances.filter(
    a => a.status === 'izin' || a.status === 'sakit'
  );
  const presentCount = onTimeAttendances.length + lateAttendances.length;
  const totalLeaveCount = Math.max(todayLeaves.length, leaveAttendances.length);
  const absentCount = Math.max(0, totalEmployees - presentCount - totalLeaveCount);
  const attendanceRate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

  // Find who has not checked in yet
  const unrecordedUsers = useMemo(() => {
    const presentUserIds = new Set(todayAttendances.map(a => a.userId));
    const leaveUserIds = new Set(todayLeaves.map(l => l.userId));
    return activeUsers.filter(u => !presentUserIds.has(u.id) && !leaveUserIds.has(u.id));
  }, [activeUsers, todayAttendances, todayLeaves]);

  // Filtered attendance records to display
  const displayedAttendances = useMemo(() => {
    if (statusFilter === 'tepat_waktu') return onTimeAttendances;
    if (statusFilter === 'terlambat') return lateAttendances;
    return todayAttendances;
  }, [todayAttendances, onTimeAttendances, lateAttendances, statusFilter]);

  // Check if current user has already checked in today
  const myTodayRecord = todayAttendances.find(a => a.userId === currentUser.id);

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Action Card */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-950 text-white p-6 md:p-8 shadow-xl relative overflow-hidden">
        {/* Background Decorative patterns */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none"></div>
        <div className="absolute -right-8 -bottom-8 w-64 h-64 rounded-full bg-blue-500/10 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-xs font-semibold text-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>Portal Presensi Cerdas &bull; SD BOPKRI Gondolayu</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Selamat Datang, {currentUser.name}
            </h1>
            <p className="text-xs md:text-sm text-blue-100/90 leading-relaxed">
              Titik presensi terverifikasi dengan radius toleransi 100 meter dari gerbang sekolah dan verifikasi selfie wajah otomatis.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-blue-200">
              <span className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Maksimal 100m dari SD BOPKRI
              </span>
              <span className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Masuk: {schoolConfig.workStartTime} WIB (Batas Toleransi: {schoolConfig.lateThresholdTime} WIB)
              </span>
            </div>
          </div>

          {/* Quick Check-in / Out Button */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center space-y-3 min-w-[220px]">
            <div className="text-xs text-blue-200">Status Kehadiran Anda Hari Ini:</div>
            {myTodayRecord ? (
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sudah Presensi Masuk ({myTodayRecord.checkInTime} WIB)
                </div>
                {myTodayRecord.checkOutTime ? (
                  <div className="text-[11px] text-blue-200">
                    Pulang: {myTodayRecord.checkOutTime} WIB
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => {
                        if (!isGpsActive) {
                          alert('GPS Belum Aktif di Perangkat: Anda wajib mengaktifkan GPS/Layanan Lokasi pada handphone Anda untuk melakukan presensi pulang.');
                          onRequestGps?.();
                          return;
                        }
                        onOpenAttendanceModal();
                      }}
                      disabled={!isGpsActive}
                      className={`w-full mt-2 py-2 px-4 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                        isGpsActive
                          ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                          : 'bg-slate-400/30 text-slate-300 border border-white/20 cursor-not-allowed opacity-75'
                      }`}
                      title={!isGpsActive ? 'GPS wajib aktif di smartphone Anda' : 'Presensi Pulang (14:30)'}
                    >
                      {!isGpsActive ? (
                        <>
                          <MapPinOff className="w-3.5 h-3.5 text-rose-300" />
                          <span>GPS Wajib Aktif di HP</span>
                        </>
                      ) : (
                        <span>Presensi Pulang (14:30)</span>
                      )}
                    </button>
                    {!isGpsActive && (
                      <button
                        type="button"
                        onClick={onRequestGps}
                        className="w-full text-[10px] text-amber-200 hover:text-amber-100 font-medium mt-1.5 cursor-pointer underline flex items-center justify-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-300" />
                        <span>Nyalakan GPS HP untuk presensi</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => {
                    if (!isGpsActive) {
                      alert('GPS Belum Aktif di Perangkat: Anda wajib mengaktifkan GPS/Layanan Lokasi pada handphone Anda untuk melakukan presensi masuk.');
                      onRequestGps?.();
                      return;
                    }
                    onOpenAttendanceModal();
                  }}
                  disabled={!isGpsActive}
                  className={`w-full py-2.5 px-5 rounded-xl font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
                    isGpsActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/30 cursor-pointer'
                      : 'bg-slate-400/30 text-slate-200 border border-white/20 cursor-not-allowed opacity-75'
                  }`}
                  title={!isGpsActive ? 'GPS wajib aktif di smartphone Anda' : 'Lakukan Presensi Masuk'}
                >
                  {!isGpsActive ? (
                    <>
                      <MapPinOff className="w-4 h-4 text-rose-300" />
                      <span>GPS Wajib Aktif di HP</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Lakukan Presensi Masuk</span>
                    </>
                  )}
                </button>
                {!isGpsActive && (
                  <button
                    type="button"
                    onClick={onRequestGps}
                    className="w-full text-[10px] text-amber-200 hover:text-amber-100 font-medium mt-1.5 cursor-pointer underline flex items-center justify-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-300" />
                    <span>Nyalakan GPS HP untuk presensi</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Statistic Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Pegawai */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Pegawai</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800">{totalEmployees}</div>
          <span className="text-[11px] text-slate-500">Guru & Staf Aktif</span>
        </div>

        {/* Hadir Hari Ini */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Hadir Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600">{presentCount}</div>
          <span className="text-[11px] text-blue-600 font-semibold">{attendanceRate}% Kehadiran</span>
        </div>

        {/* Tepat Waktu */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Tepat Waktu</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">{onTimeAttendances.length}</div>
          <span className="text-[11px] text-emerald-700 font-medium">
            Sebelum {schoolConfig.lateThresholdTime || '07:15'} WIB
          </span>
        </div>

        {/* Terlambat */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Terlambat Masuk</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">{lateAttendances.length}</div>
          <span className="text-[11px] text-amber-700 font-medium">Notifikasi real-time aktif</span>
        </div>

        {/* Belum Absen */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Belum Presensi</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">{absentCount}</div>
          <span className="text-[11px] text-slate-500">{totalLeaveCount > 0 ? `${totalLeaveCount} Izin/Sakit` : 'Belum hadir'}</span>
        </div>
      </div>

      {/* Main Content Grid: Live Feed & Analytics Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Attendance Stream & Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            {/* Header Feed */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                  <span>Feed Kehadiran Real-Time SD BOPKRI</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Riwayat presensi pegawai dilengkapi foto verifikasi wajah dan jarak radius GPS.
                </p>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    statusFilter === 'all'
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({todayAttendances.length})
                </button>
                <button
                  onClick={() => setStatusFilter('tepat_waktu')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    statusFilter === 'tepat_waktu'
                      ? 'bg-white text-emerald-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tepat Waktu ({onTimeAttendances.length})
                </button>
                <button
                  onClick={() => setStatusFilter('terlambat')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    statusFilter === 'terlambat'
                      ? 'bg-white text-amber-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Terlambat ({lateAttendances.length})
                </button>
                <button
                  onClick={() => setStatusFilter('belum_absen')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    statusFilter === 'belum_absen'
                      ? 'bg-white text-rose-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Belum ({unrecordedUsers.length})
                </button>
              </div>
            </div>

            {/* List / Feed */}
            <div className="pt-4 divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
              {statusFilter === 'belum_absen' && (
                unrecordedUsers.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Semua guru dan staf telah melakukan presensi hari ini.
                  </div>
                ) : (
                  unrecordedUsers.map(user => (
                    <div key={user.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=f43f5e&color=fff`}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="font-bold text-slate-800 text-xs">{user.name}</div>
                          <div className="text-[11px] text-slate-500">NIP: {user.nip} &bull; {user.jobTitle}</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                        Belum Presensi
                      </span>
                    </div>
                  ))
                )
              )}

              {statusFilter !== 'belum_absen' && (
                displayedAttendances.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Belum ada data kehadiran untuk kategori ini.
                  </div>
                ) : (
                  displayedAttendances.map(record => (
                    <div key={record.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70 p-2 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        {/* Selfie thumbnail */}
                        <div
                          onClick={() => setInspectPhoto(record)}
                          className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-900 shrink-0 cursor-pointer border border-slate-200 group"
                        >
                          {record.checkInPhoto ? (
                            <img
                              src={record.checkInPhoto}
                              alt={record.userName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold bg-blue-600">
                              {record.userName.charAt(0)}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <Eye className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        <div>
                          <div className="font-bold text-slate-800 text-xs sm:text-sm">
                            {record.userName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>NIP: {record.userNip}</span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-0.5 text-blue-600 font-medium">
                              <MapPin className="w-3 h-3" />
                              {record.checkInDistance ? `${Math.round(record.checkInDistance)}m` : 'Sekolah'}
                            </span>
                          </div>
                          {record.notes && (
                            <p className="text-[11px] text-slate-600 italic mt-0.5">
                              &ldquo;{record.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Tag / Status */}
                      <div className="text-right space-y-1">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            {record.checkInTime ? `${record.checkInTime} WIB` : 'Presensi Resmi'}
                          </span>
                          {record.status === 'izin' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300">
                              Cuti / Izin Resmi
                            </span>
                          ) : record.status === 'sakit' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                              Sakit (Disetujui)
                            </span>
                          ) : record.checkInStatus === 'terlambat' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                              Terlambat (+{record.lateMinutes}m)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Tepat Waktu
                            </span>
                          )}
                        </div>
                        {record.checkOutTime && (
                          <div className="text-[10px] text-slate-500">
                            Pulang: <span className="font-semibold text-slate-700">{record.checkOutTime} WIB</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Analytics & Attendance Composition */}
        <div className="space-y-4">
          {/* Donut Chart / Progress Composition */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between">
              <span>Distribusi Kehadiran Hari Ini</span>
              <span className="text-xs text-slate-500 font-normal">
                {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(selectedDate))}
              </span>
            </h3>

            {/* Visual Multi-Segment Bar */}
            <div className="space-y-2">
              <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${totalEmployees > 0 ? (onTimeAttendances.length / totalEmployees) * 100 : 0}%` }}
                  title="Tepat Waktu"
                ></div>
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{ width: `${totalEmployees > 0 ? (lateAttendances.length / totalEmployees) * 100 : 0}%` }}
                  title="Terlambat"
                ></div>
                <div
                  className="bg-blue-500 h-full transition-all duration-500"
                  style={{ width: `${totalEmployees > 0 ? (totalLeaveCount / totalEmployees) * 100 : 0}%` }}
                  title="Izin / Sakit"
                ></div>
                <div
                  className="bg-slate-300 h-full transition-all duration-500"
                  style={{ width: `${totalEmployees > 0 ? (absentCount / totalEmployees) * 100 : 0}%` }}
                  title="Belum Presensi"
                ></div>
              </div>

              {/* Legends */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <span className="text-slate-600">Tepat Waktu: <strong>{onTimeAttendances.length}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <span className="text-slate-600">Terlambat: <strong>{lateAttendances.length}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <span className="text-slate-600">Izin/Sakit: <strong>{totalLeaveCount}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  <span className="text-slate-600">Belum: <strong>{absentCount}</strong></span>
                </div>
              </div>
            </div>

            {/* School Profile Summary Card */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
              <div className="font-bold text-slate-800 text-xs">Informasi Jam Operasional PREBOGO:</div>
              <div className="flex justify-between text-slate-600">
                <span>Jam Masuk:</span>
                <span className="font-semibold text-slate-800">{schoolConfig.workStartTime} WIB</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Toleransi Terlambat:</span>
                <span className="font-semibold text-amber-700">{schoolConfig.lateThresholdTime} WIB</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Jam Pulang Resmi:</span>
                <span className="font-semibold text-slate-800">{schoolConfig.workEndTime} WIB</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Hari Kerja:</span>
                <span className="font-semibold text-emerald-700">Senin – Jumat (Sabtu & Minggu Libur)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Toleransi Geofence:</span>
                <span className="font-semibold text-blue-700">{schoolConfig.radiusToleranceMeters} Meter</span>
              </div>
            </div>
          </div>

          {/* Late alert summary banner if late teachers exist */}
          {lateAttendances.length > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Peringatan Keterlambatan Guru Hari Ini ({lateAttendances.length})</span>
              </div>
              <div className="space-y-1.5">
                {lateAttendances.map(a => (
                  <div key={a.id} className="text-xs text-amber-900 bg-white/80 p-2 rounded-lg border border-amber-200/60 flex items-center justify-between">
                    <div>
                      <div className="font-bold">{a.userName}</div>
                      <div className="text-[10px] text-amber-700">Masuk: {a.checkInTime} WIB</div>
                    </div>
                    <span className="font-extrabold text-amber-800 text-[11px] bg-amber-100 px-2 py-0.5 rounded-full">
                      +{a.lateMinutes} Menit
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photo Inspector Modal */}
      {inspectPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="text-xs font-bold">Bukti Verifikasi Wajah & Geotag</h4>
              <button
                onClick={() => setInspectPhoto(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {inspectPhoto.checkInPhoto ? (
                <img
                  src={inspectPhoto.checkInPhoto}
                  alt={inspectPhoto.userName}
                  className="w-full rounded-xl object-cover shadow-sm border border-slate-200"
                />
              ) : (
                <div className="h-48 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                  Foto tidak tersedia
                </div>
              )}
              <div className="text-xs space-y-1">
                <div className="font-bold text-slate-800 text-sm">{inspectPhoto.userName}</div>
                <div className="text-slate-500">NIP: {inspectPhoto.userNip}</div>
                <div className="text-slate-600">
                  Waktu: <strong>{inspectPhoto.checkInTime} WIB</strong> ({inspectPhoto.checkInStatus === 'terlambat' ? `Terlambat ${inspectPhoto.lateMinutes}m` : 'Tepat Waktu'})
                </div>
                <div className="text-slate-600">
                  Jarak ke Titik Sekolah: <strong>{inspectPhoto.checkInDistance || 0} meter</strong>
                </div>
                {inspectPhoto.notes && (
                  <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 italic border border-slate-200">
                    Catatan: &ldquo;{inspectPhoto.notes}&rdquo;
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
