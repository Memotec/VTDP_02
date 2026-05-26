/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InventoryItem } from './types.ts';

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: "item-1",
    name: "Máy thu phát VHF AM vô tuyến Rohde & Schwarz Series 4200",
    pn: "R&S-S4200-TX",
    sn: "RS100429402",
    warehouse: "KHO-VHF-01",
    loc: "Tủ máy VHF số 1 - Ngăn 1",
    qty: 2,
    auditStatus: "OK",
    auditDate: "2026-05-25 15:30",
    auditNote: "Thiết bị hoạt động ổn định, công suất phát đạt 50W",
    category: "VHF AM",
    history: [
      {
        id: "h-1",
        status: "OK",
        date: "2026-05-25 15:30",
        note: "Đủ thiết bị, hoạt động tốt",
        user: "admin"
      }
    ]
  },
  {
    id: "item-2",
    name: "Bộ điều khiển thoại cầm tay Jotron TR-810 Transceiver",
    pn: "JTR-810-PORTABLE",
    sn: "JT81009281",
    warehouse: "KHO-VHF-02",
    loc: "Hộp cứu hộ khẩn cấp - Kệ B2",
    qty: 1,
    auditStatus: "OK",
    auditDate: "2026-05-24 10:15",
    auditNote: "Đã sạc đầy pin, kiểm tra nghe gọi rõ ràng",
    category: "VHF AM",
    history: []
  },
  {
    id: "item-3",
    name: "Khối xử lý trung tâm hệ thống VCCS Frequentis VCS3020X",
    pn: "FREQ-VCS3020X-CPU",
    sn: "FRQ920194821",
    warehouse: "KHO-VCCS-01",
    loc: "Tủ trung tâm VCCS - Cabinet A",
    qty: 1,
    auditStatus: null,
    auditDate: null,
    auditNote: "",
    category: "VCCS",
    history: []
  },
  {
    id: "item-4",
    name: "Màn hình giao diện không lưu không quân Frequentis TM-12",
    pn: "FREQ-TM12-TOUCH",
    sn: "FRQ441209384",
    warehouse: "KHO-VCCS-02",
    loc: "Tủ linh kiện dự phòng - Ngăn 3",
    qty: 3,
    auditStatus: "OK",
    auditDate: "2026-05-26 09:00",
    auditNote: "Màn hình cảm ứng nhạy, không trầy xước",
    category: "VCCS",
    history: []
  },
  {
    id: "item-5",
    name: "Anten thu phát vệ tinh GPS Trimble Bullet III Active",
    pn: "TRM-B3-GPS",
    sn: "TRB39384029",
    warehouse: "KHO-GPS-01",
    loc: "Kệ vật tư ăng-ten - Tầng 2",
    qty: 5,
    auditStatus: null,
    auditDate: null,
    auditNote: "",
    category: "GPS & Ăng-ten",
    history: []
  },
  {
    id: "item-6",
    name: "Hệ thống ghi âm chuyên dụng thoại không lưu VCS DVR-64",
    pn: "DVR-64-SERVER",
    sn: "DVR642025091",
    warehouse: "KHO-LOG-01",
    loc: "Tủ thiết bị ghi âm - Server Room",
    qty: 1,
    auditStatus: "MISSING",
    auditDate: "2026-05-26 11:20",
    auditNote: "Đã mượn lắp đặt thử nghiệm ở Đài kiểm soát tại sân bay",
    category: "Ghi âm & Lưu trữ",
    history: [
      {
        id: "h-2",
        status: "MISSING",
        date: "2026-05-26 11:20",
        note: "Mang đi lắp đặt thử nghiệm ở Đài kiểm soát tại sân bay",
        user: "admin"
      }
    ]
  },
  {
    id: "item-7",
    name: "Bộ lưu điện thông minh APC Smart-UPS SRT 3000VA RM",
    pn: "APC-SRT3000-2U",
    sn: "APC3000847291",
    warehouse: "KHO-PWR-01",
    loc: "Khu vực UPS dự phòng - Gian trái",
    qty: 2,
    auditStatus: "OK",
    auditDate: "2026-05-23 16:45",
    auditNote: "Ăc-quy mới thay thế 2026, kiểm tra nạp xả tốt",
    category: "Nguồn & UPS",
    history: []
  },
  {
    id: "item-8",
    name: "Thiết bị lọc nhiễu dải thông Anten VHF (Bandpass Filter)",
    pn: "BPF-118-137-50",
    sn: "BPF11804291",
    warehouse: "KHO-VHF-03",
    loc: "Tủ linh kiện ăng-ten - Ngăn 4",
    qty: 4,
    auditStatus: null,
    auditDate: null,
    auditNote: "",
    category: "GPS & Ăng-ten",
    history: []
  }
];

export const CATEGORIES = [
  "Tất cả loại",
  "VHF AM",
  "VCCS",
  "GPS & Ăng-ten",
  "Ghi âm & Lưu trữ",
  "Nguồn & UPS",
  "Khác"
];
