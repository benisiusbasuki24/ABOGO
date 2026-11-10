export type UserRole = 'superadmin' | 'kepala_sekolah' | 'guru' | 'staff';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  nip: string;
  role: UserRole;
  jobTitle: string;
  phone: string;
  photoUrl?: string;
  status: 'active' | 'inactive';
  password?: string; // For NIP & Password login credential
  annualLeaveQuota?: number; // default: 12 days
  annualLeaveUsed?: number; // default: 0
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
  biometricRegisteredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpa';
export type CheckInStatus = 'tepat_waktu' | 'terlambat';

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userNip: string;
  userRole: UserRole;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkInStatus?: CheckInStatus;
  lateMinutes: number;
  checkInDistance?: number; // distance in meters from school
  checkInLat?: number;
  checkInLng?: number;
  checkInPhoto?: string; // Base64 data URL
  checkOutTime?: string; // HH:mm:ss
  checkOutDistance?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  checkOutPhoto?: string;
  status: AttendanceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeaveType =
  | 'izin'
  | 'sakit'
  | 'dinas_luar'
  | 'cuti'
  | 'cuti_tahunan'
  | 'cuti_melahirkan'
  | 'alasan_penting';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userNip?: string;
  userRole: UserRole;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: string;
  documentUrl?: string;
  documentName?: string;
  emergencyPhone?: string;
  substituteTeacher?: string; // Guru pengganti selama cuti/izin
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalNotes?: string;
  approvalDate?: string;
  createdAt: string;
}

export interface SchoolConfig {
  id: string;
  schoolName: string;
  npsn: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusToleranceMeters: number; // 100 meters
  workStartTime: string; // "07:00"
  lateThresholdTime: string; // "07:15"
  workEndTime: string; // "14:30"
  workEndTimeFriday: string; // "14:30"
  headmasterName: string;
  headmasterNip: string;
  updatedAt: string;
}

export interface PortalNotification {
  id: string;
  recipientId: string; // 'all_admins' or user ID
  senderId: string;
  senderName: string;
  title: string;
  message: string;
  type: 'late_alert' | 'checkin_success' | 'leave_request' | 'system';
  read: boolean;
  createdAt: string;
}

export interface MonthlyUserSummary {
  userId: string;
  userName: string;
  userNip: string;
  userRole: UserRole;
  jobTitle: string;
  totalWorkDays: number;
  presentCount: number;
  onTimeCount: number;
  lateCount: number;
  totalLateMinutes: number;
  leaveCount: number;
  sickCount: number;
  absentCount: number;
  attendancePercentage: number;
}
