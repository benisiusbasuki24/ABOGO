import { UserProfile, SchoolConfig, AttendanceRecord, PortalNotification } from '../types';

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  id: 'config_bopkri_gondolayu',
  schoolName: 'SD BOPKRI GONDOLAYU',
  npsn: '20403197',
  address: 'Jl. Jenderal Sudirman No. 55, Gondolayu, Terban, Kec. Gondokusuman, Kota Yogyakarta, D.I. Yogyakarta 55223',
  latitude: -7.782865,
  longitude: 110.367123,
  radiusToleranceMeters: 100,
  workStartTime: '07:00',
  lateThresholdTime: '07:15',
  workEndTime: '14:30',
  workEndTimeFriday: '14:30',
  headmasterName: 'Fransiscus Xaverius Suhari Irawan, S.E.',
  headmasterNip: '197204121998032004',
  updatedAt: new Date().toISOString(),
};

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'user_superadmin',
    email: 'ppdb.sdbogota@gmail.com',
    name: 'Administrator Utama PREBOGO',
    nip: '198501152010011001',
    role: 'superadmin',
    jobTitle: 'Superadmin Sistem & Pengelola TI',
    phone: '081227009876',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    password: 'admin',
    createdAt: '2026-01-01T07:00:00Z',
    updatedAt: '2026-01-01T07:00:00Z',
  },
  {
    id: 'user_kepsek',
    email: 'kepsek.sdbogota@gmail.com',
    name: 'Fransiscus Xaverius Suhari Irawan, S.E.',
    nip: '197204121998032004',
    role: 'kepala_sekolah',
    jobTitle: 'Kepala Sekolah SD BOPKRI Gondolayu',
    phone: '081392112233',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    password: '123',
    createdAt: '2026-01-01T07:00:00Z',
    updatedAt: '2026-01-01T07:00:00Z',
  },
];

export const generateSampleAttendances = (): AttendanceRecord[] => {
  // Production clean state: no dummy attendance records
  return [];
};

export const INITIAL_LEAVES: import('../types').LeaveRequest[] = [
  // Production clean state: no dummy leave requests
];

export const INITIAL_NOTIFICATIONS: PortalNotification[] = [
  // Production clean state: no dummy notifications
];


