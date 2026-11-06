import React, { useState } from 'react';
import { Settings, MapPin, Clock, Save, X, RotateCcw } from 'lucide-react';
import { SchoolConfig } from '../types';
import { saveSchoolConfig } from '../services/dbService';
import { DEFAULT_SCHOOL_CONFIG } from '../services/seedData';

interface SchoolSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SchoolConfig;
  onSaveSuccess: (newConfig: SchoolConfig) => void;
}

export const SchoolSettingsModal: React.FC<SchoolSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveSuccess,
}) => {
  const [formData, setFormData] = useState<SchoolConfig>({ ...config });
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const updated: SchoolConfig = {
      ...formData,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveSchoolConfig(updated);
      onSaveSuccess(updated);
      onClose();
    } catch (err) {
      console.error('Failed to save school config', err);
      alert('Gagal menyimpan pengaturan sekolah.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (confirm('Kembalikan koordinat dan jam operasional ke default SD BOPKRI Gondolayu?')) {
      setFormData({ ...DEFAULT_SCHOOL_CONFIG });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm">Pengaturan Titik Geofence & Jam Kerja Sekolah</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Nama Resmi Sekolah</label>
            <input
              type="text"
              required
              value={formData.schoolName}
              onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">NPSN</label>
              <input
                type="text"
                value={formData.npsn}
                onChange={e => setFormData({ ...formData, npsn: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Toleransi Radius GPS (Meter)
              </label>
              <input
                type="number"
                min={10}
                max={500}
                required
                value={formData.radiusToleranceMeters}
                onChange={e => setFormData({ ...formData, radiusToleranceMeters: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-600"
              />
              <span className="text-[10px] text-slate-400">Default permintaan sistem: 100 meter</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Alamat Lengkap</label>
            <input
              type="text"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Coordinates */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5">
            <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>Titik Koordinat Gerbang SD BOPKRI Gondolayu</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.latitude}
                  onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.longitude}
                  onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Operational Hours */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Jadwal Operasional Masuk & Batas Keterlambatan</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Jam Masuk Standar</label>
                <input
                  type="time"
                  required
                  value={formData.workStartTime}
                  onChange={e => setFormData({ ...formData, workStartTime: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Batas Toleransi Terlambat
                </label>
                <input
                  type="time"
                  required
                  value={formData.lateThresholdTime}
                  onChange={e => setFormData({ ...formData, lateThresholdTime: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-rose-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Jam Pulang Resmi (14:30 WIB)
                </label>
                <input
                  type="time"
                  required
                  value={formData.workEndTime}
                  onChange={e => setFormData({ ...formData, workEndTime: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Jam Pulang Jumat</label>
                <input
                  type="time"
                  required
                  value={formData.workEndTimeFriday}
                  onChange={e => setFormData({ ...formData, workEndTimeFriday: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="pt-1.5 text-[11px] text-amber-800 bg-amber-100/60 p-2 rounded-lg border border-amber-200">
              <strong>Ketentuan Hari Kerja:</strong> Senin s/d Jumat. Hari Sabtu dan Minggu adalah hari libur (tidak dihitung sebagai hari kerja atau alpa).
            </div>
          </div>

          {/* Headmaster signature info for PDF */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Kepala Sekolah</label>
              <input
                type="text"
                value={formData.headmasterName}
                onChange={e => setFormData({ ...formData, headmasterName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">NIP Kepala Sekolah</label>
              <input
                type="text"
                value={formData.headmasterNip}
                onChange={e => setFormData({ ...formData, headmasterNip: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefault}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
