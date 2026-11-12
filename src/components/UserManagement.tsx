import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Shield,
  GraduationCap,
  Briefcase,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Key,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { saveUser, saveUsersBatch, removeUser } from '../services/dbService';

export interface ParsedUserRow {
  rowNumber: number;
  nip: string;
  name: string;
  email: string;
  role: UserRole;
  jobTitle: string;
  phone: string;
  password?: string;
  status: 'active' | 'inactive';
  isValid: boolean;
  error?: string;
  isExisting: boolean;
  existingId?: string;
}

interface UserManagementProps {
  users: UserProfile[];
  onRefresh: () => void;
  currentUser: UserProfile;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  onRefresh,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Upload Data States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [importMethod, setImportMethod] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    nip: '',
    email: '',
    role: 'guru' as UserRole,
    jobTitle: '',
    phone: '',
    password: '123',
    photoUrl: '',
    status: 'active' as 'active' | 'inactive',
  });

  const isSuperAdmin = currentUser.role === 'superadmin' || currentUser.email.toLowerCase() === 'ppdb.sdbogota@gmail.com';

  if (!isSuperAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-lg mx-auto shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Akses Dibatasi</h3>
        <p className="text-xs text-slate-600 mt-1">
          Hanya <strong>Superadmin</strong> yang memiliki wewenang untuk mendaftarkan, mengedit, dan menghapus data guru serta staf SD BOPKRI Gondolayu.
        </p>
      </div>
    );
  }

  // Download Excel Template for SD BOPKRI Gondolayu
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'No': 1,
        'NIP / NIK': '198203142006041005',
        'Nama Lengkap': 'Yohanes Eko Prasetyo, S.Pd.',
        'Email Pegawai': 'yohanes.eko@sdbogota.sch.id',
        'Peran (guru/staff/kepala_sekolah/superadmin)': 'guru',
        'Jabatan / Unit Kerja': 'Guru Kelas 1 & Koord. Kurikulum',
        'Nomor WhatsApp / HP': '085729114455',
        'Kata Sandi': '123',
        'Status (active/inactive)': 'active',
      },
      {
        'No': 2,
        'NIP / NIK': '198607192008121001',
        'Nama Lengkap': 'Stefanus Agus Setiawan, A.Md.',
        'Email Pegawai': 'agus.setiawan@sdbogota.sch.id',
        'Peran (guru/staff/kepala_sekolah/superadmin)': 'staff',
        'Jabatan / Unit Kerja': 'Kepala Tata Usaha & Dapodik',
        'Nomor WhatsApp / HP': '081392887766',
        'Kata Sandi': '123',
        'Status (active/inactive)': 'active',
      },
      {
        'No': 3,
        'NIP / NIK': '198904032011012007',
        'Nama Lengkap': 'Theresia Tri Wahyuni, S.Pd.',
        'Email Pegawai': 'tri.wahyuni@sdbogota.sch.id',
        'Peran (guru/staff/kepala_sekolah/superadmin)': 'guru',
        'Jabatan / Unit Kerja': 'Guru Kelas 4 & Pembina Pramuka',
        'Nomor WhatsApp / HP': '085643112233',
        'Kata Sandi': '123',
        'Status (active/inactive)': 'active',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Pegawai');
    XLSX.writeFile(wb, 'Template_Data_Pegawai_SD_BOPKRI_Gondolayu.xlsx');
  };

  // Core matrix parser for both file uploads and pasted spreadsheet tables
  const parseUserMatrix = (rawJson: any[][], sourceName?: string) => {
    setUploadError(null);
    if (sourceName) setUploadedFileName(sourceName);

    if (!rawJson || rawJson.length < 2) {
      setUploadError('Data kosong atau tidak memiliki baris data pegawai.');
      setParsedRows([]);
      return;
    }

    // Smart Header Row Detection across first 15 rows with scoring algorithm
    let headerRowIndex = -1;
    let bestScore = -1;
    let nipIdx = -1;
    let nameIdx = -1;
    let emailIdx = -1;
    let roleIdx = -1;
    let jobIdx = -1;
    let phoneIdx = -1;
    let passIdx = -1;
    let statusIdx = -1;

    for (let r = 0; r < Math.min(15, rawJson.length); r++) {
      const rowCells = (rawJson[r] || []).map(h => String(h || '').trim());
      const nonEmptyCount = rowCells.filter(c => c.length > 0).length;
      if (nonEmptyCount < 2) continue; // Skip title banner or empty rows

      const rowHeaders = rowCells.map(h => h.toLowerCase());
      
      // Skip if this is obviously a document title banner
      const isBanner = rowHeaders.some(h => 
        h.includes('daftar guru') || 
        h.includes('data guru') || 
        h.includes('daftar pegawai') || 
        h.includes('rekapitulasi') || 
        h.includes('tahun ajaran') || 
        h.includes('sd bopkri')
      ) && nonEmptyCount <= 3;
      if (isBanner) continue;

      let score = 0;
      let tempNip = -1;
      let tempName = -1;
      let tempEmail = -1;
      let tempRole = -1;
      let tempJob = -1;
      let tempPhone = -1;
      let tempPass = -1;
      let tempStatus = -1;

      rowHeaders.forEach((h, colIdx) => {
        if (!h) return;
        if (
          h === 'nama' ||
          h === 'nama lengkap' ||
          h.startsWith('nama ') ||
          h.includes('nama lengkap') ||
          h.includes('nama pegawai') ||
          h.includes('nama guru') ||
          h.includes('nama staf') ||
          h.includes('nama karyawan') ||
          h === 'guru' ||
          h === 'pegawai' ||
          h === 'staf'
        ) {
          tempName = colIdx;
          score += 6;
        } else if (
          h.includes('nip') ||
          h.includes('nik') ||
          h.includes('nomor induk') ||
          h.includes('no. induk') ||
          h.includes('no induk') ||
          h.includes('id pegawai')
        ) {
          tempNip = colIdx;
          score += 6;
        } else if (
          h.includes('jabatan') ||
          h.includes('unit') ||
          h.includes('tugas') ||
          h.includes('bagian') ||
          h.includes('mapel') ||
          h.includes('mata pelajaran') ||
          h.includes('pekerjaan')
        ) {
          tempJob = colIdx;
          score += 4;
        } else if (
          h.includes('email') ||
          h.includes('surel') ||
          h.includes('e-mail') ||
          h.includes('mail')
        ) {
          tempEmail = colIdx;
          score += 4;
        } else if (
          h.includes('peran') ||
          h.includes('role') ||
          h.includes('status kepegawaian') ||
          h.includes('kategori') ||
          h.includes('posisi')
        ) {
          tempRole = colIdx;
          score += 3;
        } else if (
          h.includes('telepon') ||
          h.includes('telp') ||
          h.includes('hp') ||
          h.includes('wa') ||
          h.includes('whatsapp') ||
          h.includes('kontak') ||
          h.includes('phone') ||
          h.includes('no hp') ||
          h.includes('no. hp')
        ) {
          tempPhone = colIdx;
          score += 3;
        } else if (
          h.includes('sandi') ||
          h.includes('password') ||
          h.includes('pin') ||
          h.includes('pass')
        ) {
          tempPass = colIdx;
          score += 3;
        } else if (
          h.includes('status') ||
          h.includes('keaktifan') ||
          h.includes('kondisi') ||
          h.includes('aktif')
        ) {
          tempStatus = colIdx;
          score += 2;
        } else if (h === 'no' || h === 'no.' || h === 'nomor') {
          score += 2;
        }
      });

      if (score > bestScore && (tempName !== -1 || tempNip !== -1)) {
        bestScore = score;
        headerRowIndex = r;
        nipIdx = tempNip;
        nameIdx = tempName;
        emailIdx = tempEmail;
        roleIdx = tempRole;
        jobIdx = tempJob;
        phoneIdx = tempPhone;
        passIdx = tempPass;
        statusIdx = tempStatus;
      }
    }

    // If no explicit header was matched, fallback to heuristic column layout
    if (headerRowIndex === -1) {
      headerRowIndex = 0;
      if (rawJson[0].length >= 2) {
        nipIdx = 1;
        nameIdx = 2;
        emailIdx = 3;
        roleIdx = 4;
        jobIdx = 5;
      } else {
        setUploadError('Format kolom tidak dapat dideteksi. Pastikan data memiliki kolom NIP/NIK dan Nama Lengkap.');
        setParsedRows([]);
        return;
      }
    }

    const rows: ParsedUserRow[] = [];
    const seenNips = new Set<string>();

    for (let i = headerRowIndex + 1; i < rawJson.length; i++) {
      const row = rawJson[i];
      if (!row || row.length === 0 || row.every(c => c === undefined || c === null || String(c).trim() === '')) {
        continue;
      }

      // Skip signature footers (e.g. "Mengetahui Kepala Sekolah")
      const rowCombined = row.map(c => String(c || '').trim().toLowerCase()).join(' ');
      if (
        rowCombined.startsWith('mengetahui') ||
        rowCombined.includes('kepala sekolah sd bopkri') ||
        rowCombined.includes('fransiscus xaverius suhari') ||
        rowCombined.startsWith('yogyakarta,') ||
        rowCombined.startsWith('catatan:')
      ) {
        continue;
      }

      let nip = String(nipIdx !== -1 && row[nipIdx] !== undefined && row[nipIdx] !== null ? row[nipIdx] : '').trim();
      if (nip.endsWith('.0')) nip = nip.slice(0, -2);

      const name = String(nameIdx !== -1 && row[nameIdx] !== undefined && row[nameIdx] !== null ? row[nameIdx] : '').trim();
      if (!name || name.toLowerCase() === 'nama' || name.toLowerCase() === 'nama lengkap') {
        continue;
      }

      let email = String(emailIdx !== -1 && row[emailIdx] !== undefined && row[emailIdx] !== null ? row[emailIdx] : '').trim().toLowerCase();
      const rawRole = String(roleIdx !== -1 && row[roleIdx] !== undefined && row[roleIdx] !== null ? row[roleIdx] : '').trim().toLowerCase();
      const jobTitle = String(jobIdx !== -1 && row[jobIdx] !== undefined && row[jobIdx] !== null ? row[jobIdx] : '').trim();
      const phone = String(phoneIdx !== -1 && row[phoneIdx] !== undefined && row[phoneIdx] !== null ? row[phoneIdx] : '').trim();
      const password = String(passIdx !== -1 && row[passIdx] !== undefined && row[passIdx] !== null ? row[passIdx] : '123').trim();
      const rawStatus = String(statusIdx !== -1 && row[statusIdx] !== undefined && row[statusIdx] !== null ? row[statusIdx] : 'active').trim().toLowerCase();

      // Auto-generate clean official email if missing or invalid
      if (!email || !email.includes('@')) {
        const cleanSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '.')
          .replace(/\.+/g, '.')
          .replace(/^\.|\.$/g, '');
        email = `${cleanSlug || 'pegawai'}.${(nip || String(i)).slice(-4)}@sdbogota.sch.id`;
      }

      // Auto-generate NIP if missing
      if (!nip) {
        nip = `PEG${Date.now().toString().slice(-6)}${i}`;
      }

      let role: UserRole = 'guru';
      if (rawRole.includes('kepala') || rawRole.includes('kepsek') || jobTitle.toLowerCase().includes('kepala sekolah')) {
        role = 'kepala_sekolah';
      } else if (rawRole.includes('superadmin') || rawRole.includes('admin') || jobTitle.toLowerCase().includes('superadmin')) {
        role = 'superadmin';
      } else if (
        rawRole.includes('staff') ||
        rawRole.includes('staf') ||
        rawRole.includes('tu') ||
        rawRole.includes('tata usaha') ||
        rawRole.includes('pustakawan') ||
        rawRole.includes('penjaga') ||
        rawRole.includes('satpam') ||
        rawRole.includes('karyawan') ||
        rawRole.includes('tendik') ||
        rawRole.includes('kebersihan') ||
        rawRole.includes('operator') ||
        jobTitle.toLowerCase().includes('staff') ||
        jobTitle.toLowerCase().includes('tata usaha')
      ) {
        role = 'staff';
      }

      const status: 'active' | 'inactive' =
        rawStatus.includes('non') || rawStatus.includes('pasif') || rawStatus === 'inactive' ? 'inactive' : 'active';

      let errorMsg = '';
      if (!name) {
        errorMsg = 'Nama lengkap wajib diisi';
      } else if (seenNips.has(nip)) {
        errorMsg = 'NIP terduplikasi di dalam berkas ini';
      }

      if (!errorMsg) {
        seenNips.add(nip);
      }

      // Safe lookup with String conversion
      const existingUser = users.find(
        u => (u.nip && String(u.nip).trim() === nip) || (u.email && String(u.email).trim().toLowerCase() === email)
      );

      rows.push({
        rowNumber: i + 1,
        nip,
        name,
        email,
        role,
        jobTitle: jobTitle || (role === 'guru' ? 'Guru Kelas' : 'Staff Sekolah'),
        phone,
        password: password || '123',
        status,
        isValid: !errorMsg,
        error: errorMsg,
        isExisting: !!existingUser,
        existingId: existingUser?.id,
      });
    }

    if (rows.length === 0) {
      setUploadError('Tidak ditemukan baris data pegawai yang valid setelah membaca data.');
    }

    setParsedRows(rows);
  };

  // Process uploaded Excel / CSV file
  const processUploadedFile = (file: File) => {
    setUploadError(null);
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse with raw: false to retain cell string representations (preserves full 18-digit NIPs)
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false }) as any[][];
        parseUserMatrix(rawJson, file.name);
      } catch (err) {
        console.error('Failed to parse file', err);
        setUploadError('Gagal memproses berkas Excel/CSV. Pastikan format file sesuai (.xlsx, .xls, .csv).');
        setParsedRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Process pasted text from Excel / Google Sheets
  const processPastedText = () => {
    if (!pastedText.trim()) {
      setUploadError('Silakan tempel teks baris tabel terlebih dahulu.');
      return;
    }
    const lines = pastedText.split(/\r?\n/).filter(line => line.trim().length > 0);
    const rawMatrix: any[][] = lines.map(line => {
      if (line.includes('\t')) {
        return line.split('\t').map(c => c.trim());
      }
      if (line.includes(';')) {
        return line.split(';').map(c => c.trim());
      }
      return line.split(',').map(c => c.trim());
    });
    parseUserMatrix(rawMatrix, `Tabel Salin & Tempel (${lines.length} Baris)`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleExecuteImport = async () => {
    const importableRows = parsedRows.filter(r => r.isValid && (overwriteExisting || !r.isExisting));
    if (importableRows.length === 0) {
      alert('Tidak ada baris data yang siap diimpor. Periksa status baris di tabel pratinjau.');
      return;
    }

    setIsImporting(true);
    try {
      const now = new Date().toISOString();
      const usersToSave: UserProfile[] = importableRows.map(r => {
        const existing = r.existingId ? users.find(u => u.id === r.existingId) : null;
        const profile: UserProfile = {
          id: r.existingId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: String(r.name).trim(),
          nip: String(r.nip).trim(),
          email: String(r.email).trim().toLowerCase(),
          role: r.role,
          jobTitle: String(r.jobTitle).trim(),
          phone: String(r.phone || '').trim(),
          password: String(r.password || (existing?.password || '123')).trim(),
          status: r.status,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        if (existing?.photoUrl) {
          profile.photoUrl = existing.photoUrl;
        }
        return profile;
      });

      await saveUsersBatch(usersToSave);
      setIsImporting(false);
      setIsUploadModalOpen(false);
      setParsedRows([]);
      setUploadedFileName(null);
      onRefresh();
      setSuccessToast(`Berhasil menyimpan ${usersToSave.length} data guru dan staf ke sistem PREBOGO dan Cloud Firestore.`);
      setTimeout(() => setSuccessToast(null), 6000);
    } catch (err) {
      console.error('Failed to import users', err);
      setIsImporting(false);
      alert('Terjadi kendala saat menyimpan data ke sistem. Pastikan koneksi internet stabil.');
    }
  };

  const handleOpenUploadModal = () => {
    setParsedRows([]);
    setUploadError(null);
    setUploadedFileName(null);
    setPastedText('');
    setImportMethod('file');
    setPreviewFilter('all');
    setIsUploadModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      nip: '',
      email: '',
      role: 'guru',
      jobTitle: '',
      phone: '',
      password: '123',
      photoUrl: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      nip: user.nip,
      email: user.email,
      role: user.role,
      jobTitle: user.jobTitle,
      phone: user.phone,
      password: user.password || '123',
      photoUrl: user.photoUrl || '',
      status: user.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nip || !formData.email) {
      alert('Nama lengkap, NIP, dan email wajib diisi.');
      return;
    }

    const now = new Date().toISOString();
    const targetId = editingUser ? editingUser.id : `user_${Date.now()}`;

    const profileToSave: UserProfile = {
      id: targetId,
      name: formData.name.trim(),
      nip: formData.nip.trim(),
      email: formData.email.trim(),
      role: formData.role,
      jobTitle: formData.jobTitle.trim() || (formData.role === 'guru' ? 'Guru' : 'Staff'),
      phone: formData.phone.trim(),
      password: formData.password.trim(),
      photoUrl: formData.photoUrl.trim() || undefined,
      status: formData.status,
      createdAt: editingUser ? editingUser.createdAt : now,
      updatedAt: now,
    };

    try {
      await saveUser(profileToSave);
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to save user', err);
      alert('Gagal menyimpan data pengguna.');
    }
  };

  const handleDelete = async (userId: string) => {
    if (userId === currentUser.id) {
      alert('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }
    if (confirm('Apakah Anda yakin ingin menghapus data pengguna ini dari portal PREBOGO?')) {
      try {
        await removeUser(userId);
        setIsDeletingId(null);
        onRefresh();
      } catch (err) {
        console.error('Failed to delete user', err);
        alert('Gagal menghapus pengguna.');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const nameStr = String(u.name || '').toLowerCase();
    const nipStr = String(u.nip || '');
    const emailStr = String(u.email || '').toLowerCase();
    const jobStr = String(u.jobTitle || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchSearch =
      nameStr.includes(search) ||
      nipStr.includes(search) ||
      emailStr.includes(search) ||
      jobStr.includes(search);

    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-5">
      {/* Top Banner / Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              Otoritas Superadmin
            </span>
            <span className="text-xs text-slate-500">
              Total: {users.length} Pegawai Terdaftar
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mt-1">
            Manajemen Pengguna SD BOPKRI Gondolayu
          </h2>
          <p className="text-xs text-slate-500">
            Pusat registrasi, edit jabatan/NIP, dan kelola hak akses Kepala Sekolah, Guru, dan Staff.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenUploadModal}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Data (Excel / CSV)</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-blue-600/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Guru / Staff Baru</span>
          </button>
        </div>
      </div>

      {/* Success Notification Toast */}
      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari nama pegawai, NIP, email, atau jabatan..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filter Peran:</span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
          >
            <option value="all">Semua Peran ({users.length})</option>
            <option value="kepala_sekolah">Kepala Sekolah</option>
            <option value="guru">Guru</option>
            <option value="staff">Staff / Pegawai</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4">Pegawai</th>
                <th className="py-3.5 px-4">NIP / NIK</th>
                <th className="py-3.5 px-4">Peran (Role)</th>
                <th className="py-3.5 px-4">Jabatan / Unit</th>
                <th className="py-3.5 px-4">Kontak</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Tidak ditemukan data pegawai yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=2563eb&color=fff`}
                          alt={u.name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="font-bold text-slate-800 text-xs sm:text-sm">{u.name}</div>
                          <div className="text-[11px] text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 font-semibold">{u.nip}</td>
                    <td className="py-3 px-4">
                      {u.role === 'superadmin' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                          <Shield className="w-3 h-3" /> Superadmin
                        </span>
                      )}
                      {u.role === 'kepala_sekolah' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          <GraduationCap className="w-3 h-3" /> Kepala Sekolah
                        </span>
                      )}
                      {u.role === 'guru' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                          <GraduationCap className="w-3 h-3" /> Guru
                        </span>
                      )}
                      {u.role === 'staff' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <Briefcase className="w-3 h-3" /> Staff / TU
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{u.jobTitle}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{u.phone || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      {u.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          <XCircle className="w-3 h-3" /> Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          title="Edit Pengguna"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          title="Hapus Pengguna"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <h3 className="font-bold text-sm">
                {editingUser ? 'Edit Data Pegawai' : 'Registrasi Guru / Staff Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap & Gelar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Elisabeth Retno Wulandari, S.Pd."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    NIP / NIK <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nip}
                    onChange={e => setFormData({ ...formData, nip: e.target.value })}
                    placeholder="Contoh: 198711092009022003"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Peran (Role) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  >
                    <option value="guru">Guru</option>
                    <option value="staff">Staff / TU / Pustakawan</option>
                    <option value="kepala_sekolah">Kepala Sekolah</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Email Pengguna <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="guru@sdbogota.sch.id"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jabatan / Unit Kerja
                  </label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={e => setFormData({ ...formData, jobTitle: e.target.value })}
                    placeholder="Contoh: Guru Kelas 2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="081234567890"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kata Sandi / PIN Login
                  </label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Default: 123"
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  URL Foto Wajah Terdaftar (Opsional)
                </label>
                <input
                  type="url"
                  value={formData.photoUrl}
                  onChange={e => setFormData({ ...formData, photoUrl: e.target.value })}
                  placeholder="https://... atau biarkan kosong untuk avatar otomatis"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Keaktifan</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                >
                  <option value="active">Aktif (Bisa Presensi)</option>
                  <option value="inactive">Nonaktif (Akses Ditangguhkan)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  {editingUser ? 'Simpan Perubahan' : 'Daftarkan Pegawai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= UPLOAD DATA (EXCEL / CSV) MODAL ================= */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300 border border-white/10">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    Upload & Impor Massal Data Pegawai
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    SD BOPKRI GONDOLAYU &bull; Mendukung berkas Microsoft Excel (.xlsx, .xls) dan CSV
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content Scrollable Area */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Step 1: Download Template Guide */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200/80 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      Langkah 1: Format Standar
                    </span>
                    <span className="font-bold text-slate-800">
                      Format Template Excel Resmi SD BOPKRI Gondolayu
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Unduh template resmi kami untuk memastikan nama kolom sesuai (NIP, Nama, Email, Peran, Jabatan, Nomor WA, Kata Sandi).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2.5 rounded-xl bg-white border border-blue-300 hover:bg-blue-600 hover:text-white text-blue-700 font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Template Excel (.xlsx)</span>
                </button>
              </div>

              {/* Step 2: Upload Dropzone Area or Copy-Paste */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Langkah 2: Masukkan Data
                    </span>
                    <span>Pilih Metode Pengunggahan:</span>
                  </label>

                  {/* Mode switcher tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setImportMethod('file')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        importMethod === 'file'
                          ? 'bg-white text-emerald-800 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Unggah Berkas Excel / CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMethod('paste')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        importMethod === 'paste'
                          ? 'bg-white text-emerald-800 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Salin &amp; Tempel (Copy-Paste)
                    </button>
                  </div>
                </div>

                {importMethod === 'file' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        Pilih berkas dari komputer/smartphone Anda:
                      </span>
                      {uploadedFileName && (
                        <button
                          type="button"
                          onClick={() => {
                            setParsedRows([]);
                            setUploadedFileName(null);
                            setUploadError(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                        >
                          Hapus &amp; Ganti Berkas
                        </button>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                        isDragging
                          ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]'
                          : uploadedFileName
                          ? 'border-emerald-300 bg-emerald-50/30'
                          : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'
                      }`}
                    >
                      {uploadedFileName ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                            <FileSpreadsheet className="w-6 h-6" />
                          </div>
                          <div className="font-bold text-slate-800 text-sm">{uploadedFileName}</div>
                          <p className="text-[11px] text-emerald-700 font-medium">
                            Berkas berhasil terbaca. Periksa tabel pratinjau di bawah sebelum melakukan impor.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
                            <Upload className="w-6 h-6 text-slate-600" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">
                              Klik untuk memilih berkas Excel / CSV
                            </span>{' '}
                            <span className="text-slate-500">atau tarik dan lepas berkas ke area ini</span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Mendukung format .xlsx, .xls, atau .csv (maksimal 500 baris per berkas)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">
                      Salin (Ctrl+C) baris data dari Excel, Google Sheets, atau Word, lalu tempel (Ctrl+V) di kotak bawah ini:
                    </p>
                    <textarea
                      rows={5}
                      value={pastedText}
                      onChange={e => setPastedText(e.target.value)}
                      placeholder={`NIP\tNama Lengkap\tEmail\tJabatan\tNo HP\n198203142006041005\tYohanes Eko Prasetyo, S.Pd.\tyohanes@sdbogota.sch.id\tGuru Kelas 1\t081234567890`}
                      className="w-full p-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs bg-slate-50"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={processPastedText}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Analisis Baris Tabel Teks</span>
                      </button>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-800 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>

              {/* Step 3: Parsed Data Summary & Interactive Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                        Langkah 3: Pratinjau & Validasi
                      </span>
                      <span className="font-bold text-slate-800">Hasil Analisis Baris Data</span>
                    </div>

                    <label className="flex items-center gap-2 text-[11px] text-slate-700 font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={overwriteExisting}
                        onChange={e => setOverwriteExisting(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Perbarui data jika NIP/NIK sudah terdaftar di sistem</span>
                    </label>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-slate-100 text-slate-800 border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Total Baris</div>
                      <div className="text-lg font-black">{parsedRows.length}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <div className="text-[10px] text-emerald-600 font-bold uppercase">Siap Diimpor</div>
                      <div className="text-lg font-black">
                        {parsedRows.filter(r => r.isValid && (overwriteExisting || !r.isExisting)).length}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
                      <div className="text-[10px] text-blue-600 font-bold uppercase">Pembaruan Pegawai</div>
                      <div className="text-lg font-black">
                        {parsedRows.filter(r => r.isValid && r.isExisting).length}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
                      <div className="text-[10px] text-rose-600 font-bold uppercase">Tidak Valid / Error</div>
                      <div className="text-lg font-black">
                        {parsedRows.filter(r => !r.isValid).length}
                      </div>
                    </div>
                  </div>

                  {/* Filter Tabs for Preview */}
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('all')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        previewFilter === 'all'
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Semua ({parsedRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('valid')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        previewFilter === 'valid'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Hanya Valid ({parsedRows.filter(r => r.isValid).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('invalid')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        previewFilter === 'invalid'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Bermasalah ({parsedRows.filter(r => !r.isValid).length})
                    </button>
                  </div>

                  {/* Scrollable Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="py-2 px-3 w-10 text-center">Baris</th>
                          <th className="py-2 px-3">NIP / NIK</th>
                          <th className="py-2 px-3">Nama Lengkap</th>
                          <th className="py-2 px-3">Email</th>
                          <th className="py-2 px-3">Peran</th>
                          <th className="py-2 px-3">Jabatan</th>
                          <th className="py-2 px-3 text-center">Status Import</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows
                          .filter(r => {
                            if (previewFilter === 'valid') return r.isValid;
                            if (previewFilter === 'invalid') return !r.isValid;
                            return true;
                          })
                          .map(row => (
                            <tr
                              key={row.rowNumber}
                              className={`hover:bg-slate-50 transition-colors ${
                                !row.isValid ? 'bg-rose-50/50' : row.isExisting ? 'bg-blue-50/30' : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-center text-slate-400 font-mono">
                                {row.rowNumber}
                              </td>
                              <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                                {row.nip || <span className="text-rose-500 italic">Kosong</span>}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-800">
                                {row.name || <span className="text-rose-500 italic">Kosong</span>}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {row.email || <span className="text-rose-500 italic">Kosong</span>}
                              </td>
                              <td className="py-2 px-3 capitalize text-slate-700">
                                {row.role.replace('_', ' ')}
                              </td>
                              <td className="py-2 px-3 text-slate-600">{row.jobTitle}</td>
                              <td className="py-2 px-3 text-center">
                                {!row.isValid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{row.error}</span>
                                  </span>
                                ) : row.isExisting ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Perbarui Data</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Pegawai Baru</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-slate-500">
                Data yang diimpor akan langsung tersimpan di <strong>Cloud Firestore</strong> & tersinkronisasi ke seluruh perangkat.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-200 font-semibold cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={
                    isImporting ||
                    parsedRows.filter(r => r.isValid && (overwriteExisting || !r.isExisting)).length === 0
                  }
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Cloud Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>
                        Impor{' '}
                        {parsedRows.filter(r => r.isValid && (overwriteExisting || !r.isExisting)).length} Pegawai ke PREBOGO
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
