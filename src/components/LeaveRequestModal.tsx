import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  X,
  FileCheck,
  AlertCircle,
  UserCheck,
  Phone,
  GraduationCap,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { UserProfile, LeaveRequest, LeaveType } from '../types';
import {
  saveLeaveRequest,
  addNotification,
  approveLeaveAndSyncAttendance,
  rejectLeaveRequest,
} from '../services/dbService';

interface LeaveManagementProps {
  leaves: LeaveRequest[];
  onRefresh: () => void;
  currentUser: UserProfile;
  canApprove: boolean;
  allUsers: UserProfile[];
}

export const LeaveManagement: React.FC<LeaveManagementProps> = ({
  leaves,
  onRefresh,
  currentUser,
  canApprove,
  allUsers,
}) => {
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [reviewingLeave, setReviewingLeave] = useState<LeaveRequest | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Form State
  const [type, setType] = useState<LeaveType>('cuti_tahunan');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState(currentUser.phone || '');
  const [substituteTeacher, setSubstituteTeacher] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate working days strictly Monday - Friday (Sabtu & Minggu adalah hari libur)
  const calculatedDays = useMemo(() => {
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e < s) return 0;
      let count = 0;
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) count++; // Senin - Jumat kerja, Sabtu & Minggu libur
      }
      return count;
    } catch {
      return 1;
    }
  }, [startDate, endDate]);

  // Quota calculation for current user
  const quotaTotal = currentUser.annualLeaveQuota || 12;
  const quotaUsed = currentUser.annualLeaveUsed || 0;
  const quotaRemaining = Math.max(0, quotaTotal - quotaUsed);

  // List of other teachers for substitute teacher dropdown
  const otherTeachers = useMemo(() => {
    return allUsers.filter(u => u.id !== currentUser.id && u.status === 'active');
  }, [allUsers, currentUser.id]);

  // Submit leave request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Mohon isi alasan lengkap pengajuan cuti atau izin.');
      return;
    }

    if (calculatedDays <= 0) {
      alert('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    if (type === 'cuti_tahunan' && calculatedDays > quotaRemaining) {
      if (!confirm(`Jumlah hari yang diajukan (${calculatedDays} hari) melebihi sisa kuota cuti tahunan Anda (${quotaRemaining} hari). Tetap lanjutkan pengajuan ke Kepala Sekolah?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    const newLeave: LeaveRequest = {
      id: `leave_${currentUser.id}_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userNip: currentUser.nip,
      userRole: currentUser.role,
      type,
      startDate,
      endDate,
      totalDays: calculatedDays,
      reason: reason.trim(),
      emergencyPhone: emergencyPhone.trim(),
      substituteTeacher: substituteTeacher.trim() || undefined,
      documentUrl: documentUrl.trim() || undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    try {
      await saveLeaveRequest(newLeave);

      // Trigger high-priority notification to Superadmin & Kepala Sekolah
      const typeLabel = type.replace('_', ' ').toUpperCase();
      await addNotification({
        id: `notif_leave_req_${Date.now()}`,
        recipientId: 'all_admins',
        senderId: currentUser.id,
        senderName: currentUser.name,
        title: `Pengajuan ${typeLabel} Baru`,
        message: `${currentUser.name} (${currentUser.jobTitle}) mengajukan ${typeLabel} selama ${calculatedDays} hari (${startDate} s/d ${endDate}). Alasan: ${reason.trim()}`,
        type: 'leave_request',
        read: false,
        createdAt: new Date().toISOString(),
      });

      setIsSubmitModalOpen(false);
      setReason('');
      setDocumentUrl('');
      setSubstituteTeacher('');
      onRefresh();
      alert('Permohonan cuti/izin berhasil dikirim dan menunggu persetujuan Kepala Sekolah.');
    } catch (err) {
      console.error('Failed to submit leave', err);
      alert('Gagal mengirim permohonan cuti. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve leave handler: updates status, syncs attendance records, sends notification
  const handleApprove = async () => {
    if (!reviewingLeave) return;
    setIsActionLoading(true);
    try {
      await approveLeaveAndSyncAttendance(
        reviewingLeave,
        currentUser.name,
        approvalNotes.trim() || 'Disetujui oleh Kepala SD BOPKRI Gondolayu'
      );
      setReviewingLeave(null);
      setApprovalNotes('');
      onRefresh();
      alert('Permohonan cuti BERHASIL DISETUJUI. Catatan kehadiran telah otomatis diperbarui dan notifikasi terkirim ke pemohon.');
    } catch (err) {
      console.error('Failed to approve leave', err);
      alert('Gagal menyetujui permohonan.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Reject leave handler: updates status and sends notification
  const handleReject = async () => {
    if (!reviewingLeave) return;
    if (!rejectionNotes.trim()) {
      alert('Mohon cantumkan alasan atau catatan mengapa permohonan ditolak.');
      return;
    }
    setIsActionLoading(true);
    try {
      await rejectLeaveRequest(
        reviewingLeave,
        currentUser.name,
        rejectionNotes.trim()
      );
      setReviewingLeave(null);
      setRejectionNotes('');
      onRefresh();
      alert('Permohonan cuti telah DITOLAK dan notifikasi alasan penolakan terkirim ke pemohon.');
    } catch (err) {
      console.error('Failed to reject leave', err);
      alert('Gagal memproses penolakan.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Filtering based on permissions and tab
  const baseLeaves = canApprove ? leaves : leaves.filter(l => l.userId === currentUser.id);

  const filteredLeaves = useMemo(() => {
    if (activeTabFilter === 'all') return baseLeaves;
    return baseLeaves.filter(l => l.status === activeTabFilter);
  }, [baseLeaves, activeTabFilter]);

  const pendingCount = useMemo(() => {
    return baseLeaves.filter(l => l.status === 'pending').length;
  }, [baseLeaves]);

  const getTypeBadge = (leaveType: LeaveType) => {
    switch (leaveType) {
      case 'cuti_tahunan':
      case 'cuti':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Cuti Tahunan</span>;
      case 'sakit':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Sakit</span>;
      case 'dinas_luar':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">Dinas Luar</span>;
      case 'cuti_melahirkan':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-pink-100 text-pink-800 border border-pink-200">Cuti Melahirkan</span>;
      case 'alasan_penting':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Alasan Penting</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Izin Pribadi</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Layanan Kepegawaian SABOGOT
            </span>
            <span className="text-xs text-slate-500 font-medium">
              SD BOPKRI GONDOLAYU
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
            Pengajuan Cuti & Izin Online
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Guru dan staf dapat mengajukan cuti/izin secara mandiri. Permohonan yang disetujui Kepala Sekolah akan <strong>otomatis tersinkronisasi ke catatan kehadiran harian</strong> dan mengirimkan notifikasi resmi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajukan Cuti / Izin Baru</span>
          </button>
        </div>
      </div>

      {/* Quota Information Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Kuota Cuti Tahunan</span>
          <div className="text-2xl font-black text-slate-800 mt-1">{quotaTotal} Hari</div>
          <span className="text-[11px] text-slate-400">Tahun Ajaran 2026/2027</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Cuti Terpakai</span>
          <div className="text-2xl font-black text-purple-600 mt-1">{quotaUsed} Hari</div>
          <span className="text-[11px] text-slate-400">Telah disetujui</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Sisa Kuota Cuti Anda</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{quotaRemaining} Hari</div>
          <span className="text-[11px] text-emerald-600 font-semibold">Tersedia untuk diajukan</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">
            {canApprove ? 'Menunggu Review Kepsek' : 'Permohonan Aktif Saya'}
          </span>
          <div className="text-2xl font-black text-amber-600 mt-1">{pendingCount} Pengajuan</div>
          <span className="text-[11px] text-amber-700 font-medium">
            {canApprove ? 'Perlu tindakan Kepala Sekolah' : 'Status dalam proses'}
          </span>
        </div>
      </div>

      {/* Filter Tabs & Content */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="px-5 pt-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTabFilter('all')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTabFilter === 'all'
                  ? 'border-purple-600 text-purple-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua Permohonan ({baseLeaves.length})
            </button>
            <button
              onClick={() => setActiveTabFilter('pending')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTabFilter === 'pending'
                  ? 'border-amber-500 text-amber-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Menunggu Persetujuan</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-extrabold">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTabFilter('approved')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTabFilter === 'approved'
                  ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Telah Disetujui ({baseLeaves.filter(l => l.status === 'approved').length})
            </button>
            <button
              onClick={() => setActiveTabFilter('rejected')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTabFilter === 'rejected'
                  ? 'border-rose-600 text-rose-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Ditolak ({baseLeaves.filter(l => l.status === 'rejected').length})
            </button>
          </div>

          <div className="pb-2 text-xs text-slate-500 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Menampilkan: {filteredLeaves.length} Data</span>
          </div>
        </div>

        {/* Leaves Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4">Pegawai Pemohon</th>
                <th className="py-3.5 px-4">Jenis Permohonan</th>
                <th className="py-3.5 px-4">Rentang & Durasi</th>
                <th className="py-3.5 px-4">Alasan & Rekan Pengganti</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center w-32">Aksi / Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    Tidak ada pengajuan cuti atau izin dalam kategori ini.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave, idx) => (
                  <tr key={leave.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 text-xs sm:text-sm">{leave.userName}</div>
                      <div className="text-[11px] text-slate-500">NIP: {leave.userNip || '-'} &bull; <span className="capitalize">{leave.userRole}</span></div>
                    </td>
                    <td className="py-3.5 px-4">
                      {getTypeBadge(leave.type)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>{leave.startDate} s/d {leave.endDate}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Total: <strong>{leave.totalDays || 1} Hari Kerja</strong>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-slate-800 font-medium truncate" title={leave.reason}>
                        {leave.reason}
                      </p>
                      {leave.substituteTeacher && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <UserCheck className="w-3 h-3 text-purple-600" />
                          <span>Pengganti: {leave.substituteTeacher}</span>
                        </div>
                      )}
                      {leave.documentUrl && (
                        <a
                          href={leave.documentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 mt-0.5 font-semibold"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Lihat Surat / Lampiran</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {leave.status === 'approved' && (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Disetujui
                          </span>
                          {leave.approvedBy && (
                            <div className="text-[10px] text-slate-500 mt-1">
                              Oleh: <span className="font-semibold">{leave.approvedBy}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {leave.status === 'rejected' && (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" /> Ditolak
                          </span>
                          {leave.approvedBy && (
                            <div className="text-[10px] text-slate-500 mt-1">
                              Oleh: {leave.approvedBy}
                            </div>
                          )}
                        </div>
                      )}
                      {leave.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 animate-pulse">
                          <Clock className="w-3 h-3 text-amber-600" /> Menunggu Review
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setReviewingLeave(leave);
                          setApprovalNotes(leave.approvalNotes || '');
                          setRejectionNotes('');
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs"
                      >
                        <span>{canApprove && leave.status === 'pending' ? 'Review & Proses' : 'Lihat Detail'}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & Approval Modal (For Kepala Sekolah & Superadmin) */}
      {reviewingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-purple-300">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {canApprove && reviewingLeave.status === 'pending'
                      ? 'Review Persetujuan Kepala Sekolah'
                      : 'Detail Permohonan Cuti / Izin'}
                  </h3>
                  <p className="text-[11px] text-purple-200">
                    SD BOPKRI GONDOLAYU &bull; {reviewingLeave.userName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewingLeave(null)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Applicant Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{reviewingLeave.userName}</div>
                    <div className="text-slate-500 text-[11px]">NIP: {reviewingLeave.userNip || '-'} &bull; <span className="capitalize">{reviewingLeave.userRole}</span></div>
                  </div>
                  <div>{getTypeBadge(reviewingLeave.type)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Periode Tanggal:</span>
                    <strong className="text-slate-800 font-semibold">{reviewingLeave.startDate} s/d {reviewingLeave.endDate}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Hari Kerja:</span>
                    <strong className="text-purple-700 font-bold">{reviewingLeave.totalDays || 1} Hari</strong>
                  </div>
                </div>
              </div>

              {/* Reasons & Details */}
              <div className="space-y-2">
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Alasan Pengajuan:</span>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed">
                    {reviewingLeave.reason}
                  </div>
                </div>

                {reviewingLeave.substituteTeacher && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                    <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="text-[11px] block opacity-80">Guru / Rekan Pengganti:</span>
                      <strong>{reviewingLeave.substituteTeacher}</strong>
                    </div>
                  </div>
                )}

                {reviewingLeave.emergencyPhone && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[11px] block text-slate-500">Kontak Darurat Selama Cuti:</span>
                      <strong className="font-mono">{reviewingLeave.emergencyPhone}</strong>
                    </div>
                  </div>
                )}

                {reviewingLeave.documentUrl && (
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-900">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span className="font-bold">Surat Dokter / Dokumen Pendukung</span>
                    </div>
                    <a
                      href={reviewingLeave.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] flex items-center gap-1"
                    >
                      <span>Buka Berkas</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Existing approval status if already completed */}
              {reviewingLeave.status !== 'pending' && (
                <div className={`p-3.5 rounded-2xl border ${
                  reviewingLeave.status === 'approved'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {reviewingLeave.status === 'approved' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>Status: {reviewingLeave.status === 'approved' ? 'Telah Disetujui' : 'Permohonan Ditolak'}</span>
                  </div>
                  {reviewingLeave.approvedBy && (
                    <div className="text-[11px] mt-1">
                      Diproses oleh: <strong>{reviewingLeave.approvedBy}</strong>
                      {reviewingLeave.approvalDate && ` pada ${new Date(reviewingLeave.approvalDate).toLocaleDateString('id-ID')}`}
                    </div>
                  )}
                  {reviewingLeave.approvalNotes && (
                    <div className="mt-1.5 pt-1.5 border-t border-current/20 text-[11px] italic">
                      Catatan: &ldquo;{reviewingLeave.approvalNotes}&rdquo;
                    </div>
                  )}
                </div>
              )}

              {/* Approval Action Form (Only when Pending and User is Headmaster or Superadmin) */}
              {canApprove && reviewingLeave.status === 'pending' && (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                    <strong>Sinkronisasi Otomatis:</strong> Menyetujui permohonan ini akan secara otomatis membuat catatan presensi guru pada rentang tanggal di atas sebagai <em>Izin/Sakit Resmi</em> dan mengirimkan notifikasi konfirmasi ke pemohon.
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Catatan / Disposisi Kepala Sekolah (Opsional untuk Persetujuan)
                    </label>
                    <input
                      type="text"
                      value={approvalNotes}
                      onChange={e => setApprovalNotes(e.target.value)}
                      placeholder="Contoh: Disetujui. Harap memastikan tugas materi diserahkan ke guru pengganti."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-rose-600">
                      Alasan Penolakan (Wajib diisi jika menolak)
                    </label>
                    <input
                      type="text"
                      value={rejectionNotes}
                      onChange={e => setRejectionNotes(e.target.value)}
                      placeholder="Contoh: Jadwal bertabrakan dengan agenda Asesmen Nasional sekolah."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={handleReject}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                    >
                      Tolak Permohonan
                    </button>
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={handleApprove}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isActionLoading ? 'Memproses...' : 'Setujui & Sinkronkan Presensi'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Leave Request Modal (For Teachers & Staff) */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-900 to-indigo-900 text-white">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-purple-300" />
                <div>
                  <h3 className="font-bold text-sm">Formulir Pengajuan Cuti / Izin Guru & Staff</h3>
                  <p className="text-[11px] text-purple-200">SD BOPKRI GONDOLAYU</p>
                </div>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Jenis Cuti / Izin <span className="text-rose-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as LeaveType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold text-slate-800"
                >
                  <option value="cuti_tahunan">Cuti Tahunan (Sisa kuota: {quotaRemaining} hari)</option>
                  <option value="sakit">Cuti Sakit (Disertai Surat Dokter)</option>
                  <option value="izin">Izin Keperluan Pribadi / Keluarga</option>
                  <option value="dinas_luar">Dinas Luar / Tugas Pelatihan Sekolah</option>
                  <option value="cuti_melahirkan">Cuti Melahirkan</option>
                  <option value="alasan_penting">Cuti Alasan Penting</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Mulai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Selesai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                </div>
              </div>

              {/* Calculated days badge */}
              <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 flex items-center justify-between">
                <span className="text-purple-900 font-semibold text-[11px]">
                  Durasi yang diajukan (Hari Kerja):
                </span>
                <span className="font-extrabold text-purple-700 text-xs px-2 py-0.5 rounded-md bg-white border border-purple-200">
                  {calculatedDays} Hari Kerja (Senin - Jumat, Sabtu & Minggu Libur)
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alasan Lengkap Pengajuan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Jelaskan alasan secara lengkap dan jelas untuk pertimbangan Kepala Sekolah..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Guru / Rekan Pengganti
                  </label>
                  <select
                    value={substituteTeacher}
                    onChange={e => setSubstituteTeacher(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Pilih Rekan Pengganti --</option>
                    {otherTeachers.map(t => (
                      <option key={t.id} value={`${t.name} (${t.jobTitle})`}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nomor WhatsApp / HP Darurat
                  </label>
                  <input
                    type="text"
                    value={emergencyPhone}
                    onChange={e => setEmergencyPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Link Berkas / Surat Dokter / Surat Tugas (Opsional)
                </label>
                <input
                  type="url"
                  value={documentUrl}
                  onChange={e => setDocumentUrl(e.target.value)}
                  placeholder="https://drive.google.com/... atau tautan berkas foto"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Sertakan tautan foto surat keterangan dokter (jika sakit) atau surat tugas (jika dinas luar).
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  {isSubmitting ? 'Mengirim Permohonan...' : 'Kirim Permohonan ke Kepala Sekolah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
