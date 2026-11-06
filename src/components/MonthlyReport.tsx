import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { UserProfile, AttendanceRecord, LeaveRequest, SchoolConfig, MonthlyUserSummary } from '../types';
import { exportMonthlyReportToPDF, exportMonthlyReportToExcel } from '../utils/exportUtils';

interface MonthlyReportProps {
  users: UserProfile[];
  attendances: AttendanceRecord[];
  leaves: LeaveRequest[];
  schoolConfig: SchoolConfig;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MonthlyReport: React.FC<MonthlyReportProps> = ({
  users,
  attendances,
  leaves,
  schoolConfig,
}) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Total working days strictly Monday - Friday (Sabtu & Minggu adalah hari libur)
  const totalWorkDaysInMonth = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth, day);
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
    }
    return Math.max(1, count);
  }, [selectedYear, selectedMonth]);

  // Compute monthly summary per user
  const monthlySummaries: MonthlyUserSummary[] = useMemo(() => {
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const targetPrefix = `${selectedYear}-${monthStr}`;

    return users.map(user => {
      // Find all attendances of this user in this month
      const userAtts = attendances.filter(
        a => a.userId === user.id && a.date.startsWith(targetPrefix)
      );

      const onTimeCount = userAtts.filter(a => (a.status === 'hadir' && a.lateMinutes === 0) || a.checkInStatus === 'tepat_waktu').length;
      const lateAtts = userAtts.filter(a => a.status === 'terlambat' || a.checkInStatus === 'terlambat' || a.lateMinutes > 0);
      const lateCount = lateAtts.length;
      const totalLateMinutes = lateAtts.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);
      const presentCount = onTimeCount + lateCount;

      // Attendance records created through approved leaves
      const attSickCount = userAtts.filter(a => a.status === 'sakit').length;
      const attLeaveCount = userAtts.filter(a => a.status === 'izin').length;

      // Leaves in this month
      const userApprovedLeaves = leaves.filter(
        l => l.userId === user.id && l.status === 'approved' && l.startDate.startsWith(targetPrefix)
      );
      const reqSickDays = userApprovedLeaves.filter(l => l.type === 'sakit').reduce((sum, l) => sum + (l.totalDays || 1), 0);
      const reqLeaveDays = userApprovedLeaves.filter(l => l.type !== 'sakit').reduce((sum, l) => sum + (l.totalDays || 1), 0);

      const sickCount = Math.max(attSickCount, reqSickDays);
      const leaveCount = Math.max(attLeaveCount, reqLeaveDays);

      // Absent estimate
      const accountedDays = presentCount + sickCount + leaveCount;
      const absentCount = Math.max(0, Math.min(totalWorkDaysInMonth - accountedDays, 5));

      const percentage = Math.min(100, Math.round(((presentCount + (sickCount * 0.8) + (leaveCount * 0.8)) / Math.max(1, totalWorkDaysInMonth)) * 100));

      return {
        userId: user.id,
        userName: user.name,
        userNip: user.nip,
        userRole: user.role,
        jobTitle: user.jobTitle,
        totalWorkDays: totalWorkDaysInMonth,
        presentCount,
        onTimeCount,
        lateCount,
        totalLateMinutes,
        leaveCount,
        sickCount,
        absentCount,
        attendancePercentage: percentage,
      };
    });
  }, [users, attendances, leaves, selectedMonth, selectedYear]);

  const filteredSummaries = useMemo(() => {
    return monthlySummaries.filter(s => {
      const matchRole = roleFilter === 'all' || s.userRole === roleFilter;
      const matchSearch =
        s.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.userNip.includes(searchTerm) ||
        s.jobTitle.toLowerCase().includes(searchTerm.toLowerCase());
      return matchRole && matchSearch;
    });
  }, [monthlySummaries, roleFilter, searchTerm]);

  // Overall Statistics
  const avgAttendance = useMemo(() => {
    if (filteredSummaries.length === 0) return 0;
    const sum = filteredSummaries.reduce((acc, curr) => acc + curr.attendancePercentage, 0);
    return Math.round(sum / filteredSummaries.length);
  }, [filteredSummaries]);

  const totalLateCases = useMemo(() => {
    return filteredSummaries.reduce((acc, curr) => acc + curr.lateCount, 0);
  }, [filteredSummaries]);

  const totalLateMins = useMemo(() => {
    return filteredSummaries.reduce((acc, curr) => acc + curr.totalLateMinutes, 0);
  }, [filteredSummaries]);

  const handleExportPDF = () => {
    exportMonthlyReportToPDF(
      MONTH_NAMES[selectedMonth],
      selectedYear,
      filteredSummaries,
      schoolConfig
    );
  };

  const handleExportExcel = () => {
    exportMonthlyReportToExcel(
      MONTH_NAMES[selectedMonth],
      selectedYear,
      filteredSummaries,
      schoolConfig
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Export Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Laporan Kepegawaian Otomatis
            </span>
            <span className="text-xs text-slate-500">
              Periode: {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mt-1">
            Rekapitulasi Kehadiran Bulanan Guru & Staff
          </h2>
          <p className="text-xs text-slate-500">
            Hasil kalkulasi otomatis persentase kehadiran, rekapitulasi keterlambatan, dan izin/sakit siap ekspor.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Ekspor PDF Resmi</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Rata-Rata Kehadiran</span>
            <div className="text-2xl font-extrabold text-slate-800">{avgAttendance}%</div>
            <span className="text-[11px] text-emerald-600 font-semibold">Tercatat di sistem</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Kasus Keterlambatan</span>
            <div className="text-2xl font-extrabold text-amber-600">{totalLateCases} Kali</div>
            <span className="text-[11px] text-slate-500 font-medium">
              Total {totalLateMins} menit terlambat
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Jumlah Pegawai Terekap</span>
            <div className="text-2xl font-extrabold text-emerald-600">{filteredSummaries.length} Orang</div>
            <span className="text-[11px] text-slate-500">Kepala Sekolah, Guru & Staff</span>
          </div>
        </div>
      </div>

      {/* Filter and Period Selection */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-bold"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-bold"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2027}>2027</option>
          </select>

          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
            >
              <option value="all">Semua Peran</option>
              <option value="guru">Guru Saja</option>
              <option value="staff">Staff Saja</option>
              <option value="kepala_sekolah">Kepala Sekolah</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari nama atau NIP..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3.5 text-center w-10">No</th>
                <th className="py-3 px-3.5">NIP</th>
                <th className="py-3 px-3.5">Nama Pegawai</th>
                <th className="py-3 px-3.5">Jabatan / Unit</th>
                <th className="py-3 px-3 text-center">Hari Kerja</th>
                <th className="py-3 px-3 text-center text-emerald-700">Tepat Waktu</th>
                <th className="py-3 px-3 text-center text-amber-700">Terlambat</th>
                <th className="py-3 px-3 text-center text-blue-700">Izin</th>
                <th className="py-3 px-3 text-center text-purple-700">Sakit</th>
                <th className="py-3 px-3 text-center text-rose-700">Alpa</th>
                <th className="py-3 px-4 text-center">Persentase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    Tidak ada data kehadiran untuk filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((s, idx) => (
                  <tr key={s.userId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">{s.userNip}</td>
                    <td className="py-3 px-3 font-bold text-slate-800">{s.userName}</td>
                    <td className="py-3 px-3 text-slate-600">{s.jobTitle}</td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-600">{s.totalWorkDays}</td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-600">{s.onTimeCount}</td>
                    <td className="py-3 px-3 text-center">
                      {s.lateCount > 0 ? (
                        <span className="font-bold text-amber-600">
                          {s.lateCount} <span className="text-[10px] text-slate-400">({s.totalLateMinutes}m)</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-blue-600">{s.leaveCount}</td>
                    <td className="py-3 px-3 text-center font-semibold text-purple-600">{s.sickCount}</td>
                    <td className="py-3 px-3 text-center font-semibold text-rose-600">{s.absentCount}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.attendancePercentage >= 90
                                ? 'bg-emerald-500'
                                : s.attendancePercentage >= 75
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${s.attendancePercentage}%` }}
                          ></div>
                        </div>
                        <span className="font-extrabold text-slate-800 text-xs w-8 text-right">
                          {s.attendancePercentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
