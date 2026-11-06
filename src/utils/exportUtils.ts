import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { MonthlyUserSummary, SchoolConfig } from '../types';

export function exportMonthlyReportToPDF(
  monthName: string,
  year: number,
  summaries: MonthlyUserSummary[],
  schoolConfig: SchoolConfig
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header / Kop Surat
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(24, 43, 73); // Deep Navy
  doc.text('YAYASAN BOPKRI YOGYAKARTA', 148.5, 14, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(schoolConfig.schoolName || 'SD BOPKRI GONDOLAYU', 148.5, 21, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `NPSN: ${schoolConfig.npsn || '20403197'} | ${schoolConfig.address || 'Jl. Jenderal Sudirman No. 55, Gondolayu, Kota Yogyakarta'}`,
    148.5,
    27,
    { align: 'center' }
  );

  // Divider lines
  doc.setDrawColor(24, 43, 73);
  doc.setLineWidth(0.8);
  doc.line(15, 30, 282, 30);
  doc.setLineWidth(0.2);
  doc.line(15, 31.5, 282, 31.5);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`LAPORAN REKAPITULASI KEHADIRAN GURU & STAFF`, 148.5, 39, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Periode: ${monthName} ${year} | Toleransi Radius Lokasi: ${schoolConfig.radiusToleranceMeters}m`, 148.5, 45, { align: 'center' });

  // Table Data
  const tableData = summaries.map((s, idx) => [
    idx + 1,
    s.userNip,
    s.userName,
    s.jobTitle,
    s.totalWorkDays,
    s.onTimeCount,
    s.lateCount > 0 ? `${s.lateCount} (${s.totalLateMinutes}m)` : '0',
    s.leaveCount,
    s.sickCount,
    s.absentCount,
    `${s.attendancePercentage}%`,
  ]);

  autoTable(doc, {
    startY: 50,
    head: [
      [
        'No',
        'NIP',
        'Nama Lengkap',
        'Jabatan / Unit',
        'Hari Kerja',
        'Tepat Waktu',
        'Terlambat',
        'Izin',
        'Sakit',
        'Alpa',
        'Persentase',
      ],
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [24, 43, 73],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 32 },
      2: { halign: 'left', cellWidth: 55 },
      3: { halign: 'left', cellWidth: 45 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 24 },
      7: { halign: 'center', cellWidth: 14 },
      8: { halign: 'center', cellWidth: 14 },
      9: { halign: 'center', cellWidth: 14 },
      10: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Footer / Signatures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY || 140;
  const signatureY = Math.min(finalY + 15, 175);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const dateNowStr = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Left Sign: Admin / Pengelola Absensi
  doc.text('Mengetahui,', 30, signatureY);
  doc.text('Admin Kepegawaian & IT', 30, signatureY + 5);
  doc.text('( .................................................. )', 30, signatureY + 28);
  doc.text('NIP. ...........................................', 30, signatureY + 33);

  // Right Sign: Kepala Sekolah
  doc.text(`Yogyakarta, ${dateNowStr}`, 210, signatureY);
  doc.text('Kepala SD BOPKRI Gondolayu,', 210, signatureY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolConfig.headmasterName || 'Fransiscus Xaverius Suhari Irawan, S.E.', 210, signatureY + 28);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${schoolConfig.headmasterNip || '197204121998032004'}`, 210, signatureY + 33);

  // Save the PDF
  doc.save(`Rekap_Absensi_ABOGO_${monthName}_${year}.pdf`);
}

export function exportMonthlyReportToExcel(
  monthName: string,
  year: number,
  summaries: MonthlyUserSummary[],
  schoolConfig: SchoolConfig
) {
  const worksheetData: (string | number)[][] = [
    ['YAYASAN BOPKRI YOGYAKARTA'],
    [schoolConfig.schoolName || 'SD BOPKRI GONDOLAYU'],
    [`NPSN: ${schoolConfig.npsn || '20403197'} | ${schoolConfig.address}`],
    ['LAPORAN REKAPITULASI KEHADIRAN BULANAN PEGAWAI (PORTAL ABOGO)'],
    [`Bulan: ${monthName} ${year}`],
    [], // empty row
    [
      'No',
      'NIP',
      'Nama Lengkap',
      'Jabatan / Unit',
      'Total Hari Kerja',
      'Hadir Tepat Waktu',
      'Hadir Terlambat',
      'Total Menit Terlambat',
      'Izin',
      'Sakit',
      'Alpa',
      'Persentase Kehadiran (%)',
    ],
  ];

  summaries.forEach((s, idx) => {
    worksheetData.push([
      idx + 1,
      s.userNip,
      s.userName,
      s.jobTitle,
      s.totalWorkDays,
      s.onTimeCount,
      s.lateCount,
      s.totalLateMinutes,
      s.leaveCount,
      s.sickCount,
      s.absentCount,
      s.attendancePercentage,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-width columns
  ws['!cols'] = [
    { wch: 6 }, // No
    { wch: 22 }, // NIP
    { wch: 35 }, // Nama
    { wch: 30 }, // Jabatan
    { wch: 16 }, // Hari Kerja
    { wch: 18 }, // Tepat Waktu
    { wch: 16 }, // Terlambat
    { wch: 22 }, // Menit Terlambat
    { wch: 10 }, // Izin
    { wch: 10 }, // Sakit
    { wch: 10 }, // Alpa
    { wch: 24 }, // % Kehadiran
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Rekap_${monthName}`);

  XLSX.writeFile(wb, `Rekap_Absensi_ABOGO_${monthName}_${year}.xlsx`);
}
