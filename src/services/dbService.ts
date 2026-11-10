import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import {
  UserProfile,
  AttendanceRecord,
  LeaveRequest,
  SchoolConfig,
  PortalNotification,
} from '../types';
import {
  INITIAL_USERS,
  DEFAULT_SCHOOL_CONFIG,
  generateSampleAttendances,
  INITIAL_NOTIFICATIONS,
  INITIAL_LEAVES,
} from './seedData';

// Haversine formula to compute exact distance in meters
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
}

// Local storage fallback keys (Production Clean State v2)
const LS_USERS = 'prebogo_users_v2';
const LS_ATTENDANCES = 'prebogo_attendances_v2';
const LS_LEAVES = 'prebogo_leaves_v2';
const LS_CONFIG = 'prebogo_config_v2';
const LS_NOTIFS = 'prebogo_notifications_v2';

// Clean up legacy caches and ensure clean state
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.startsWith('prebogo_') && !key.startsWith('firebase')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
} catch {
  // ignore
}

// ----------------- USERS -----------------
export async function fetchUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (!snap.empty) {
      const users: UserProfile[] = [];
      for (const d of snap.docs) {
        let u = d.data() as UserProfile;
        // Purge dummy test account if found in Firestore
        if (
          d.id === 'user_guru_dummy' ||
          u.id === 'user_guru_dummy' ||
          u.email?.includes('dummy') ||
          u.name?.toLowerCase().includes('uji coba')
        ) {
          deleteDoc(doc(db, 'users', d.id)).catch(() => {});
          continue;
        }

        // Auto-correct headmaster name if previously saved
        if (u.role === 'kepala_sekolah' && (u.name.includes('Maria') || !u.name.includes('Fransiscus'))) {
          u = {
            ...u,
            name: 'Fransiscus Xaverius Suhari Irawan, S.E.',
            jobTitle: 'Kepala Sekolah SD BOPKRI Gondolayu',
          };
          setDoc(doc(db, 'users', u.id), u).catch(() => {});
        }
        users.push(u);
      }

      localStorage.setItem(LS_USERS, JSON.stringify(users));
      return users;
    } else {
      // Seed initial users into Firestore (strictly official staff only, no dummy accounts)
      for (const u of INITIAL_USERS) {
        setDoc(doc(db, 'users', u.id), u).catch(() => {});
      }
      localStorage.setItem(LS_USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users', auth.currentUser);
  }

  // Fallback to local storage or seed
  const stored = localStorage.getItem(LS_USERS);
  if (stored) {
    const parsed = JSON.parse(stored) as UserProfile[];
    const sanitized = parsed
      .filter(
        u =>
          u.id !== 'user_guru_dummy' &&
          !u.email?.includes('dummy') &&
          !u.name?.toLowerCase().includes('uji coba')
      )
      .map(u =>
        u.role === 'kepala_sekolah' && u.name.includes('Maria')
          ? { ...u, name: 'Fransiscus Xaverius Suhari Irawan, S.E.' }
          : u
      );
    return sanitized;
  }
  localStorage.setItem(LS_USERS, JSON.stringify(INITIAL_USERS));
  return INITIAL_USERS;
}

// Helper to remove any undefined fields before sending to Firestore (prevents Firestore rejection)
export function cleanDocData<T extends Record<string, any>>(data: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export async function saveUser(user: UserProfile): Promise<void> {
  // Update local storage first
  const existing = await fetchUsers();
  const index = existing.findIndex(u => u.id === user.id);
  let updated: UserProfile[];
  if (index >= 0) {
    updated = [...existing];
    updated[index] = user;
  } else {
    updated = [user, ...existing];
  }
  localStorage.setItem(LS_USERS, JSON.stringify(updated));

  // Sync to Firestore with sanitized payload
  try {
    const cleaned = cleanDocData(user);
    await setDoc(doc(db, 'users', user.id), cleaned);
  } catch (err) {
    console.warn('Firestore setDoc warning for user:', user.id, err);
    try {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`, auth.currentUser);
    } catch {
      // Keep going if handled
    }
  }
}

export async function saveUsersBatch(usersToSave: UserProfile[]): Promise<void> {
  if (usersToSave.length === 0) return;
  const existing = await fetchUsers();
  const map = new Map<string, UserProfile>();
  existing.forEach(u => map.set(u.id, u));
  usersToSave.forEach(u => map.set(u.id, u));
  const updated = Array.from(map.values());
  localStorage.setItem(LS_USERS, JSON.stringify(updated));

  // Sync to Firestore in parallel with sanitized payloads
  const promises = usersToSave.map(async u => {
    try {
      const cleaned = cleanDocData(u);
      await setDoc(doc(db, 'users', u.id), cleaned);
    } catch (err) {
      console.error(`Failed to save user ${u.name} (${u.id}) to Firestore:`, err);
    }
  });

  await Promise.all(promises);
}

export async function removeUser(userId: string): Promise<void> {
  const existing = await fetchUsers();
  const updated = existing.filter(u => u.id !== userId);
  localStorage.setItem(LS_USERS, JSON.stringify(updated));

  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}`, auth.currentUser);
  }
}

// ----------------- ATTENDANCES -----------------
export async function fetchAttendances(): Promise<AttendanceRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'attendances'));
    if (!snap.empty) {
      const items: AttendanceRecord[] = [];
      snap.forEach(d => items.push(d.data() as AttendanceRecord));
      localStorage.setItem(LS_ATTENDANCES, JSON.stringify(items));
      return items;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'attendances', auth.currentUser);
  }

  const stored = localStorage.getItem(LS_ATTENDANCES);
  if (stored) {
    return JSON.parse(stored);
  }
  const sample = generateSampleAttendances();
  localStorage.setItem(LS_ATTENDANCES, JSON.stringify(sample));
  return sample;
}

export async function recordAttendance(record: AttendanceRecord): Promise<void> {
  const existing = await fetchAttendances();
  const idx = existing.findIndex(a => a.id === record.id);
  let updated: AttendanceRecord[];
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = record;
  } else {
    updated = [record, ...existing];
  }
  localStorage.setItem(LS_ATTENDANCES, JSON.stringify(updated));

  try {
    await setDoc(doc(db, 'attendances', record.id), record);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `attendances/${record.id}`, auth.currentUser);
  }
}

// ----------------- SCHOOL CONFIG -----------------
export async function fetchSchoolConfig(): Promise<SchoolConfig> {
  try {
    const snap = await getDocs(collection(db, 'school_settings'));
    if (!snap.empty) {
      let config = snap.docs[0].data() as SchoolConfig;
      let shouldSync = false;

      // Auto-update headmaster name if it was previously Dra. Maria Sri Rahayu
      if (!config.headmasterName || config.headmasterName.includes('Maria')) {
        config.headmasterName = 'Fransiscus Xaverius Suhari Irawan, S.E.';
        shouldSync = true;
      }

      // Auto-update workEndTime to 14:30 as official return time
      if (config.workEndTime !== '14:30' || config.workEndTimeFriday !== '14:30') {
        config.workEndTime = '14:30';
        config.workEndTimeFriday = '14:30';
        shouldSync = true;
      }

      if (shouldSync) {
        config.updatedAt = new Date().toISOString();
        setDoc(doc(db, 'school_settings', config.id), config).catch(() => {});
      }

      localStorage.setItem(LS_CONFIG, JSON.stringify(config));
      return config;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'school_settings', auth.currentUser);
  }

  const stored = localStorage.getItem(LS_CONFIG);
  if (stored) {
    const parsed = JSON.parse(stored) as SchoolConfig;
    if (!parsed.headmasterName || parsed.headmasterName.includes('Maria')) {
      parsed.headmasterName = 'Fransiscus Xaverius Suhari Irawan, S.E.';
    }
    parsed.workEndTime = '14:30';
    parsed.workEndTimeFriday = '14:30';
    localStorage.setItem(LS_CONFIG, JSON.stringify(parsed));
    return parsed;
  }
  localStorage.setItem(LS_CONFIG, JSON.stringify(DEFAULT_SCHOOL_CONFIG));
  return DEFAULT_SCHOOL_CONFIG;
}

export async function saveSchoolConfig(config: SchoolConfig): Promise<void> {
  localStorage.setItem(LS_CONFIG, JSON.stringify(config));
  try {
    await setDoc(doc(db, 'school_settings', config.id), config);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `school_settings/${config.id}`, auth.currentUser);
  }
}

// Purge all dummy data and test accounts from Firestore and local state
export async function purgeAllDummyData(): Promise<void> {
  localStorage.setItem(LS_ATTENDANCES, JSON.stringify([]));
  localStorage.setItem(LS_LEAVES, JSON.stringify([]));
  localStorage.setItem(LS_NOTIFS, JSON.stringify([]));

  // Purge dummy user from localStorage
  const localUsersRaw = localStorage.getItem(LS_USERS);
  if (localUsersRaw) {
    try {
      const parsed = JSON.parse(localUsersRaw) as UserProfile[];
      const cleaned = parsed.filter(
        u => u.id !== 'user_guru_dummy' && !u.email?.includes('dummy') && !u.name?.toLowerCase().includes('uji coba')
      );
      localStorage.setItem(LS_USERS, JSON.stringify(cleaned));
    } catch {
      // ignore
    }
  }

  try {
    // Purge dummy user accounts from Firestore
    const snapUsers = await getDocs(collection(db, 'users'));
    for (const d of snapUsers.docs) {
      const uData = d.data() as UserProfile;
      if (
        d.id === 'user_guru_dummy' ||
        d.id.includes('dummy') ||
        uData.email?.includes('dummy') ||
        uData.name?.toLowerCase().includes('uji coba')
      ) {
        await deleteDoc(doc(db, 'users', d.id));
      }
    }

    const snapAtt = await getDocs(collection(db, 'attendances'));
    for (const d of snapAtt.docs) {
      const data = d.data() as AttendanceRecord;
      if (
        d.id.startsWith('att_dummy_') ||
        d.id.includes('dummy') ||
        d.id.includes('sample') ||
        data.notes?.includes('Simulasi') ||
        data.notes?.includes('dummy')
      ) {
        await deleteDoc(doc(db, 'attendances', d.id));
      }
    }

    const snapLeaves = await getDocs(collection(db, 'leave_requests'));
    for (const d of snapLeaves.docs) {
      if (
        d.id.startsWith('leave_dummy_') ||
        d.id.includes('dummy') ||
        d.id.includes('sample')
      ) {
        await deleteDoc(doc(db, 'leave_requests', d.id));
      }
    }
  } catch (err) {
    console.warn('Purge dummy data check:', err);
  }
}

// ----------------- LEAVE REQUESTS -----------------
export async function fetchLeaveRequests(): Promise<LeaveRequest[]> {
  try {
    const snap = await getDocs(collection(db, 'leave_requests'));
    if (!snap.empty) {
      const items: LeaveRequest[] = [];
      snap.forEach(d => items.push(d.data() as LeaveRequest));
      localStorage.setItem(LS_LEAVES, JSON.stringify(items));
      return items;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'leave_requests', auth.currentUser);
  }

  const stored = localStorage.getItem(LS_LEAVES);
  if (stored) {
    return JSON.parse(stored);
  }
  localStorage.setItem(LS_LEAVES, JSON.stringify(INITIAL_LEAVES));
  return INITIAL_LEAVES;
}

export async function saveLeaveRequest(request: LeaveRequest): Promise<void> {
  const existing = await fetchLeaveRequests();
  const idx = existing.findIndex(r => r.id === request.id);
  let updated: LeaveRequest[];
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = request;
  } else {
    updated = [request, ...existing];
  }
  localStorage.setItem(LS_LEAVES, JSON.stringify(updated));

  try {
    await setDoc(doc(db, 'leave_requests', request.id), request);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `leave_requests/${request.id}`, auth.currentUser);
  }
}

// Automatically syncs approved leave dates into AttendanceRecords and sends notification
export async function approveLeaveAndSyncAttendance(
  leave: LeaveRequest,
  approverName: string,
  approvalNotes?: string
): Promise<void> {
  const nowStr = new Date().toISOString();

  // 1. Update Leave Request Status
  const updatedLeave: LeaveRequest = {
    ...leave,
    status: 'approved',
    approvedBy: approverName,
    approvalNotes: approvalNotes || 'Disetujui oleh Kepala Sekolah / Pimpinan',
    approvalDate: nowStr,
  };
  await saveLeaveRequest(updatedLeave);

  // 2. Generate date range array (Hari Kerja: Senin - Jumat, Sabtu & Minggu Libur)
  const dates: string[] = [];
  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    // 0 = Sunday, 6 = Saturday (Sabtu dan Minggu adalah hari libur)
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().split('T')[0]);
    }
  }

  // 3. Create or update attendance record for each approved day
  for (const dateKey of dates) {
    const recordId = `att_${leave.userId}_${dateKey}`;
    const statusType: 'sakit' | 'izin' = leave.type === 'sakit' ? 'sakit' : 'izin';
    const typeLabel = leave.type.replace('_', ' ').toUpperCase();

    const attendanceRecord: AttendanceRecord = {
      id: recordId,
      userId: leave.userId,
      userName: leave.userName,
      userNip: leave.userNip || '',
      userRole: leave.userRole,
      date: dateKey,
      status: statusType,
      lateMinutes: 0,
      notes: `[CUTI/IZIN RESMI] ${typeLabel} - ${leave.reason} (Disetujui oleh: ${approverName})`,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await recordAttendance(attendanceRecord);
  }

  // 4. Send real-time notification to the applicant
  const typeLabel = leave.type.replace('_', ' ').toUpperCase();
  const notif: PortalNotification = {
    id: `notif_leave_approved_${leave.id}_${Date.now()}`,
    recipientId: leave.userId,
    senderId: 'system',
    senderName: approverName,
    title: `Permohonan ${typeLabel} Telah Disetujui`,
    message: `Permohonan cuti/izin Anda untuk tanggal ${leave.startDate} s/d ${leave.endDate} (${dates.length} hari kerja) telah DISETUJUI oleh ${approverName}.${approvalNotes ? ` Catatan: "${approvalNotes}"` : ''}. Catatan kehadiran telah otomatis diperbarui.`,
    type: 'leave_request',
    read: false,
    createdAt: nowStr,
  };
  await addNotification(notif);

  // 5. Update user annual leave quota if applicable
  if (leave.type === 'cuti' || leave.type === 'cuti_tahunan') {
    try {
      const allUsers = await fetchUsers();
      const user = allUsers.find(u => u.id === leave.userId);
      if (user) {
        const used = (user.annualLeaveUsed || 0) + dates.length;
        await saveUser({
          ...user,
          annualLeaveUsed: used,
        });
      }
    } catch (e) {
      console.warn('Could not update user leave quota', e);
    }
  }
}

// Reject leave request and send notification with reason
export async function rejectLeaveRequest(
  leave: LeaveRequest,
  approverName: string,
  rejectionNotes: string
): Promise<void> {
  const nowStr = new Date().toISOString();

  const updatedLeave: LeaveRequest = {
    ...leave,
    status: 'rejected',
    approvedBy: approverName,
    approvalNotes: rejectionNotes.trim() || 'Ditolak',
    approvalDate: nowStr,
  };
  await saveLeaveRequest(updatedLeave);

  const typeLabel = leave.type.replace('_', ' ').toUpperCase();
  const notif: PortalNotification = {
    id: `notif_leave_rejected_${leave.id}_${Date.now()}`,
    recipientId: leave.userId,
    senderId: 'system',
    senderName: approverName,
    title: `Permohonan ${typeLabel} Tidak Disetujui`,
    message: `Permohonan cuti/izin Anda (${leave.startDate} s/d ${leave.endDate}) TIDAK DISETUJUI oleh ${approverName}. Alasan: "${rejectionNotes}".`,
    type: 'leave_request',
    read: false,
    createdAt: nowStr,
  };
  await addNotification(notif);
}

// ----------------- NOTIFICATIONS -----------------
export async function fetchNotifications(): Promise<PortalNotification[]> {
  try {
    const snap = await getDocs(collection(db, 'notifications'));
    if (!snap.empty) {
      const items: PortalNotification[] = [];
      snap.forEach(d => items.push(d.data() as PortalNotification));
      localStorage.setItem(LS_NOTIFS, JSON.stringify(items));
      return items;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'notifications', auth.currentUser);
  }

  const stored = localStorage.getItem(LS_NOTIFS);
  if (stored) {
    return JSON.parse(stored);
  }
  localStorage.setItem(LS_NOTIFS, JSON.stringify(INITIAL_NOTIFICATIONS));
  return INITIAL_NOTIFICATIONS;
}

export async function addNotification(notif: PortalNotification): Promise<void> {
  const existing = await fetchNotifications();
  const updated = [notif, ...existing];
  localStorage.setItem(LS_NOTIFS, JSON.stringify(updated));

  try {
    await setDoc(doc(db, 'notifications', notif.id), notif);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `notifications/${notif.id}`, auth.currentUser);
  }
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const existing = await fetchNotifications();
  const updated = existing.map(n => (n.id === id ? { ...n, read: true } : n));
  localStorage.setItem(LS_NOTIFS, JSON.stringify(updated));

  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`, auth.currentUser);
  }
}

// Subscribe to real-time attendances if online
export function subscribeToAttendances(
  onUpdate: (attendances: AttendanceRecord[]) => void
): () => void {
  try {
    const unsub = onSnapshot(
      collection(db, 'attendances'),
      snap => {
        const items: AttendanceRecord[] = [];
        snap.forEach(d => items.push(d.data() as AttendanceRecord));
        localStorage.setItem(LS_ATTENDANCES, JSON.stringify(items));
        onUpdate(items);
      },
      err => {
        handleFirestoreError(err, OperationType.GET, 'attendances', auth.currentUser);
      }
    );
    return unsub;
  } catch {
    return () => {};
  }
}

// Subscribe to real-time leave requests for instant moderation
export function subscribeToLeaveRequests(
  onUpdate: (leaves: LeaveRequest[]) => void
): () => void {
  try {
    const unsub = onSnapshot(
      collection(db, 'leave_requests'),
      snap => {
        const items: LeaveRequest[] = [];
        snap.forEach(d => items.push(d.data() as LeaveRequest));
        localStorage.setItem(LS_LEAVES, JSON.stringify(items));
        onUpdate(items);
      },
      err => {
        handleFirestoreError(err, OperationType.GET, 'leave_requests', auth.currentUser);
      }
    );
    return unsub;
  } catch {
    return () => {};
  }
}

// Subscribe to real-time notifications
export function subscribeToNotifications(
  onUpdate: (notifications: PortalNotification[]) => void
): () => void {
  try {
    const unsub = onSnapshot(
      collection(db, 'notifications'),
      snap => {
        const items: PortalNotification[] = [];
        snap.forEach(d => items.push(d.data() as PortalNotification));
        localStorage.setItem(LS_NOTIFS, JSON.stringify(items));
        onUpdate(items);
      },
      err => {
        handleFirestoreError(err, OperationType.GET, 'notifications', auth.currentUser);
      }
    );
    return unsub;
  } catch {
    return () => {};
  }
}

