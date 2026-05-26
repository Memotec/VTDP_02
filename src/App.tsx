/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  QrCode, Search, Database, RefreshCw, SlidersHorizontal, Plus, Edit, 
  Trash2, User, Lock, LogOut, Sun, Moon, FileSpreadsheet, Printer, 
  Clock, ArrowRightLeft, CheckCircle2, XCircle, AlertCircle, X, 
  ChevronRight, History, Settings, Camera, Laptop, Check, Filter,
  FileText, Activity, Layers, MapPin, PlusCircle, CheckSquare, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';

import { InventoryItem, SyncConfig, Role, AuditStats, AuditHistoryEntry } from './types.ts';
import { INITIAL_INVENTORY, CATEGORIES } from './initialData.ts';

export default function App() {
  // --- STATE ---
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  
  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả loại');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OK' | 'MISSING' | 'UNCHECKED'>('ALL');

  // Form Editor States (For Adding/Editing items)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPn, setFormPn] = useState('');
  const [formSn, setFormSn] = useState('');
  const [formWarehouse, setFormWarehouse] = useState('');
  const [formLoc, setFormLoc] = useState('');
  const [formQty, setFormQty] = useState(1);
  const [formCategory, setFormCategory] = useState('VHF AM');

  // Modal Dialog Controllers
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventoryItem | null>(null);

  // Simulated Scanner States
  const [scanInputCode, setScanInputCode] = useState('');
  const [scanStatus, setScanStatus] = useState<'OK' | 'MISSING'>('OK');
  const [scanNote, setScanNote] = useState('');
  const [scanMessage, setScanMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Cloud Sync Configurations
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    webAppUrl: 'https://script.google.com/macros/s/AKfycby3ecczSKLGb81GXQSqirqM0s-qQH-jQDjJpZQohnNS_aUQgtH15KzvB8JYr7LJbYql/exec',
    autoSync: false,
    lastSynced: undefined
  });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncStatusDetail, setSyncStatusDetail] = useState('');

  // Toast Alerts State
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);

  // Custom Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Printing Layout Controllers
  const [printLayout, setPrintLayout] = useState<'NONE' | 'QR' | 'LABEL'>('NONE');

  // Theme Controller
  const [darkMode, setDarkMode] = useState(false);

  // Reference for scanning audio
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Load local theme preference
    const savedTheme = localStorage.getItem('cns_theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }

    // Load local inventory
    const localInv = localStorage.getItem('cns_inventory_v30_stable');
    if (localInv) {
      try {
        setInventory(JSON.parse(localInv));
      } catch (e) {
        setInventory(INITIAL_INVENTORY);
      }
    } else {
      setInventory(INITIAL_INVENTORY);
      localStorage.setItem('cns_inventory_v30_stable', JSON.stringify(INITIAL_INVENTORY));
    }

    // Load local session
    const savedRole = localStorage.getItem('cns_session_active');
    if (savedRole === 'admin' || savedRole === 'guest') {
      setRole(savedRole as Role);
    }

    // Load sync url
    const savedSyncUrl = localStorage.getItem('cns_sync_url');
    if (savedSyncUrl) {
      setSyncConfig(prev => ({ ...prev, webAppUrl: savedSyncUrl }));
    }
  }, []);

  // Sync to local storage
  const saveInventoryLocally = (newInv: InventoryItem[]) => {
    setInventory(newInv);
    localStorage.setItem('cns_inventory_v30_stable', JSON.stringify(newInv));
  };

  // --- HELPER METRICS ---
  const stats = useMemo<AuditStats>(() => {
    const totalItems = inventory.length;
    const totalQty = inventory.reduce((acc, item) => acc + (item.qty || 0), 0);
    const checkedCount = inventory.filter(item => item.auditStatus !== null).length;
    const okCount = inventory.filter(item => item.auditStatus === 'OK').length;
    const missingCount = inventory.filter(item => item.auditStatus === 'MISSING').length;
    const healthRate = checkedCount > 0 ? Math.round((okCount / checkedCount) * 100) : 100;

    return {
      totalItems,
      totalQty,
      checkedCount,
      okCount,
      missingCount,
      healthRate
    };
  }, [inventory]);

  // --- FILTERED DATA ---
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // Category filter
      if (selectedCategory !== 'Tất cả loại' && item.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (statusFilter === 'OK' && item.auditStatus !== 'OK') return false;
      if (statusFilter === 'MISSING' && item.auditStatus !== 'MISSING') return false;
      if (statusFilter === 'UNCHECKED' && item.auditStatus !== null) return false;

      // Text Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = item.name.toLowerCase().includes(q);
        const snMatch = item.sn.toLowerCase().includes(q);
        const pnMatch = item.pn?.toLowerCase().includes(q) || false;
        const whMatch = item.warehouse?.toLowerCase().includes(q) || false;
        const locMatch = item.loc?.toLowerCase().includes(q) || false;

        return nameMatch || snMatch || pnMatch || whMatch || locMatch;
      }

      return true;
    });
  }, [inventory, selectedCategory, statusFilter, searchQuery]);

  // --- TOAST SERVICE ---
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // --- BEEP AUDIO SYNTHESIZER ---
  const playScanBeep = (freq = 800, duration = 0.12) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio fallback silent
    }
  };

  // --- ACTIONS ---

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.toLowerCase().trim();
    const p = password;

    if ((u === 'admin' && p === 'admin') || (u === 'guest' && p === '123456')) {
      const assignedRole = u as Role;
      setRole(assignedRole);
      localStorage.setItem('cns_session_active', assignedRole);
      setLoginError('');
      setUsername('');
      setPassword('');
      addToast(`Xin chào ${u.toUpperCase()}! Đăng nhập thành công.`, 'success');
      playScanBeep(1000, 0.15);
    } else {
      setLoginError('Tài khoản hoặc mật khẩu không chính xác!');
      playScanBeep(300, 0.25);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('cns_session_active');
    setRole(null);
    setEditingItemId(null);
    clearForm();
    addToast('Đã đăng xuất tài khoản.', 'info');
  };

  // Toggle Dark Mode
  const toggleTheme = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    if (newVal) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('cns_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('cns_theme', 'light');
    }
  };

  // Clear Editor Form
  const clearForm = () => {
    setEditingItemId(null);
    setFormName('');
    setFormPn('');
    setFormSn('');
    setFormWarehouse('');
    setFormLoc('');
    setFormQty(1);
    setFormCategory('VHF AM');
  };

  // Populate form to edit
  const handleEditClick = (item: InventoryItem) => {
    if (role !== 'admin') {
      addToast('Chỉ quản lý (Admin) mới được phép chỉnh sửa thiết bị.', 'error');
      return;
    }
    setEditingItemId(item.id);
    setFormName(item.name || '');
    setFormPn(item.pn || '');
    setFormSn(item.sn || '');
    setFormWarehouse(item.warehouse || '');
    setFormLoc(item.loc || '');
    setFormQty(item.qty || 1);
    setFormCategory(item.category || 'VHF AM');
    
    // Smooth scroll to editor
    const el = document.getElementById('editor-panel');
    el?.scrollIntoView({ behavior: 'smooth' });
    addToast('Đã tải thông tin thiết bị lên biểu mẫu.', 'info');
  };

  // Save or Add Item
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSn.trim()) {
      addToast('Vui lòng điền các thông tin bắt buộc (*)', 'error');
      return;
    }

    if (editingItemId) {
      // Update existing item
      const updated = inventory.map(item => {
        if (item.id === editingItemId) {
          return {
            ...item,
            name: formName.trim(),
            pn: formPn.trim(),
            sn: formSn.trim(),
            warehouse: formWarehouse.trim().toUpperCase(),
            loc: formLoc.trim(),
            qty: Number(formQty) || 1,
            category: formCategory
          };
        }
        return item;
      });
      saveInventoryLocally(updated);
      addToast('Cập nhật dữ liệu thiết bị thành công!', 'success');
      playScanBeep(900, 0.1);
    } else {
      // Check duplicate Serial Number
      const isDuplicate = inventory.some(item => item.sn.toLowerCase() === formSn.trim().toLowerCase());
      if (isDuplicate) {
        addToast(`Cảnh báo: S/N "${formSn}" đã tồn tại trong hệ thống!`, 'error');
        return;
      }

      // Add new item
      const newItem: InventoryItem = {
        id: `item-${Date.now()}`,
        name: formName.trim(),
        pn: formPn.trim(),
        sn: formSn.trim(),
        warehouse: formWarehouse.trim().toUpperCase(),
        loc: formLoc.trim(),
        qty: Number(formQty) || 1,
        auditStatus: null,
        auditNote: '',
        category: formCategory,
        history: []
      };
      saveInventoryLocally([...inventory, newItem]);
      addToast('Đã thêm thiết bị mới vào kho thành công!', 'success');
      playScanBeep(880, 0.15);
    }
    clearForm();
  };

  // Prompt delete item
  const handleDeleteClick = (item: InventoryItem) => {
    if (role !== 'admin') {
      addToast('Chỉ quản lý (Admin) mới có quyền xóa thiết bị.', 'error');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Xác nhận xóa thiết bị',
      message: `Bạn đang chọn xóa thiết bị "${item.name}" (S/N: ${item.sn}). Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa?`,
      onConfirm: () => {
        const nextInv = inventory.filter(i => i.id !== item.id);
        saveInventoryLocally(nextInv);
        addToast('Đã xóa thiết bị khỏi cơ sở dữ liệu.', 'success');
        playScanBeep(400, 0.3);
        setConfirmDialog(null);
      }
    });
  };

  // Quick action: Toggle audit status directly from line
  const handleQuickStatusClick = (item: InventoryItem, nextStatus: 'OK' | 'MISSING' | null) => {
    const updated = inventory.map(i => {
      if (i.id === item.id) {
        const nowStr = new Date().toLocaleString('vi-VN');
        const updatedHistory: AuditHistoryEntry[] = i.history ? [...i.history] : [];
        if (nextStatus) {
          updatedHistory.unshift({
            id: `h-${Date.now()}`,
            status: nextStatus,
            date: nowStr,
            note: 'Kiểm bằng nhấp chọn nhanh trên danh sách',
            user: role || 'guest'
          });
        }
        return {
          ...i,
          auditStatus: nextStatus,
          auditDate: nextStatus ? nowStr : null,
          history: updatedHistory
        };
      }
      return i;
    });
    saveInventoryLocally(updated);
    addToast(`Đã cập nhật trạng thái kiểm kê cho thiết bị s/n ${item.sn}.`, 'success');
    playScanBeep(nextStatus === 'OK' ? 950 : 350, 0.12);
  };

  // Multi Reset: Reset entire inventory check logs
  const handleResetFiltersAndStatus = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Đặt lại trạng thái kiểm kê',
      message: 'Hành động này sẽ XÓA TOÀN BỘ trạng thái kiểm kê hiện tại của toàn bộ thiết bị trong danh sách về trạng thái CHƯA KIỂM. Bạn có đồng ý thực hiện?',
      onConfirm: () => {
        const reseted = inventory.map(item => ({
          ...item,
          auditStatus: null,
          auditDate: null,
          auditNote: ''
        }));
        saveInventoryLocally(reseted);
        addToast('Đã đặt toàn bộ thiết bị về vị trí Chưa Kiểm kê.', 'info');
        playScanBeep(300, 0.4);
        setConfirmDialog(null);
      }
    });
  };

  // --- CLOUD SYNC LOGIC ---
  const fetchCloudData = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setSyncStatusDetail('Đang tạo yêu cầu kết nối Server...');

    try {
      const url = `${syncConfig.webAppUrl}?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Yêu cầu dữ liệu thất bại từ Google Apps Script.');
      
      const resText = await res.text();
      if (resText.trim().startsWith('<!DOCTYPE') || resText.trim().startsWith('<html')) {
        throw new Error('Đường dẫn Apps Script phản hồi HTML. Vui lòng kiểm tra phân quyền truy cập public (Anyone).');
      }

      const data = JSON.parse(resText);
      if (data && Array.isArray(data)) {
        if (data.length > 0) {
          // Format incoming items (keep fields matching structure)
          const formatted: InventoryItem[] = data.map((item: any, index: number) => ({
            id: item.id || `cloud-item-${index}-${Date.now()}`,
            name: item.name || 'Thiết bị không tên',
            pn: item.pn || '',
            sn: item.sn || `SN-${index}`,
            warehouse: item.warehouse || '',
            loc: item.loc || '',
            qty: Number(item.qty) || 1,
            auditStatus: item.auditStatus === 'OK' ? 'OK' : (item.auditStatus === 'MISSING' ? 'MISSING' : null),
            auditDate: item.auditDate || null,
            auditNote: item.auditNote || '',
            category: item.category || 'Khác',
            history: item.history || []
          }));
          saveInventoryLocally(formatted);
          const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          setSyncConfig(prev => ({ ...prev, lastSynced: nowStr }));
          setSyncStatus('success');
          setSyncStatusDetail(`Đã tải xuống thành công ${formatted.length} thiết bị.`);
          addToast(`Đồng bộ thành công! Đã tải xuống ${formatted.length} thiết bị.`, 'success');
          playScanBeep(1000, 0.2);
        } else {
          setSyncStatus('success');
          setSyncStatusDetail('Kho Cloud rỗng. Có thể tiến hành đẩy lên.');
          addToast('Kho trên Cloud hiện đang trống!', 'info');
        }
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setSyncStatusDetail(err.message || 'Lỗi mạng không xác định.');
      addToast('Lỗi tải dữ liệu từ Cloud! Xem chi tiết ở phần cài đặt.', 'error');
      playScanBeep(250, 0.3);
    }
  };

  const syncToCloud = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setSyncStatusDetail('Đang tải dữ liệu của bạn lên Cloud...');

    try {
      const params = new URLSearchParams();
      params.append('data', JSON.stringify(inventory));
      params.append('timestamp', Date.now().toString());
      params.append('user', role || 'anonymous');

      // POST to script
      await fetch(syncConfig.webAppUrl, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      setSyncConfig(prev => ({ ...prev, lastSynced: nowStr }));
      setSyncStatus('success');
      setSyncStatusDetail('Đã đẩy dữ liệu thành công lên Apps Script.');
      addToast('Đã đẩy toàn bộ danh sách lên Cloud thành công!', 'success');
      playScanBeep(980, 0.15);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setSyncStatusDetail('Đẩy dữ liệu thất bại. Hãy kiểm tra kết nối mạng.');
      addToast('Không thể đẩy dữ liệu lên Cloud. Hãy thử lại.', 'error');
    }
  };

  // Save settings change
  const saveSettingsConfig = (newUrl: string) => {
    const cleanUrl = newUrl.trim();
    setSyncConfig(prev => ({ ...prev, webAppUrl: cleanUrl }));
    localStorage.setItem('cns_sync_url', cleanUrl);
    addToast('Đã lưu cấu hình Apps Script.', 'success');
  };

  // --- EXPORTS & PRINTS ---

  // Export excel
  const handleExportExcel = () => {
    if (inventory.length === 0) {
      addToast('Không có dữ liệu để xuất Excel!', 'error');
      return;
    }

    try {
      // Map friendly columns
      const excelRows = inventory.map((item, index) => ({
        'STT': index + 1,
        'Tên thiết bị': item.name,
        'Phân loại': item.category || 'Khác',
        'Part Number (P/N)': item.pn || 'N/A',
        'Serial Number (S/N)': item.sn,
        'Mã Kho (QR)': item.warehouse || '',
        'Vị trí / Tủ': item.loc || '',
        'Số lượng': item.qty,
        'Trạng thái kiểm kê': item.auditStatus === 'OK' ? 'Đủ/Tốt' : (item.auditStatus === 'MISSING' ? 'Thiếu/Hỏng' : 'Chưa kiểm'),
        'Ngày kiểm gần nhất': item.auditDate || '',
        'Ghi chú kiểm kê': item.auditNote || ''
      }));

      const ws = XLSX.utils.json_to_sheet(excelRows);
      
      // Styling and table boundaries auto dimensions
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh sach vat tu CNS");
      
      const fileDate = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Kho_Vat_Tu_CNS_ATM_${fileDate}.xlsx`);
      addToast('Xuất báo cáo Excel thành công!', 'success');
      playScanBeep(1000, 0.1);
    } catch (err) {
      addToast('Có lỗi xảy ra khi tạo file Excel!', 'error');
    }
  };

  // Handle PDF/Action audit report
  const handleExportWebBill = () => {
    const win = window.open('', '_blank');
    if (!win) {
      addToast('Vui lòng cho phép trình duyệt hiển thị tab/popup mới!', 'error');
      return;
    }
    const today = new Date().toLocaleDateString('vi-VN');
    const rowsHtml = inventory.map((item, idx) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 10px; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; font-weight: bold; text-align: left;">${item.name}</td>
        <td style="padding: 10px;">${item.category || '-'}</td>
        <td style="padding: 10px; font-family: monospace;">${item.sn}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold;">${item.warehouse || '-'}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold;">${item.qty}</td>
        <td style="padding: 10px; text-align: center;">
          <span style="font-weight: bold; color: ${item.auditStatus === 'OK' ? '#10b981' : (item.auditStatus === 'MISSING' ? '#ef4444' : '#6b7280')};">
            ${item.auditStatus === 'OK' ? 'ĐỦ/TỐT' : (item.auditStatus === 'MISSING' ? 'THIẾU/HỎNG' : 'CHƯA KIỂM')}
          </span>
        </td>
        <td style="padding: 10px; text-align: left; font-size: 11px; max-width: 155px;">${item.auditNote || ''}</td>
      </tr>
    `).join('');

    win.document.write(`
      <html>
        <head>
          <title>Biên Bản Kiểm Kê Kho CNS/ATM</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; color: #333; margin: 30px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
            .subtitle { font-size: 13px; color: #666; font-style: italic; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { background-color: #f3f4f6; border: 1px solid #cbd5e1; padding: 12px 10px; text-align: center; font-weight: bold; }
            td { border: 1px solid #e2e8f0; }
            .summary { margin-top: 30px; font-size: 13px; display: flex; justify-content: space-between; }
            .signs { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; font-size: 13px; page-break-inside: avoid; }
            .sign-box { width: 250px; font-weight: bold; }
            .sign-title { margin-bottom: 60px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 15px;">ĐỘI THÔNG TIN - KHO VẬT TƯ CNS/ATM</div>
            <div class="title">BIÊN BẢN KIỂM KÊ THIẾT BỊ VÀ VẬT TƯ CHUYÊN NGÀNH</div>
            <div class="subtitle">Ngày tạo biên bản: ${today} - Người lập: ${role ? role.toUpperCase() : 'Guest'}</div>
          </div>

          <div style="font-size: 13px; margin-bottom: 10px; border-left: 3px solid #3b82f6; padding-left: 10px;">
            Hệ thống ghi nhận tổng số <strong>${stats.totalItems}</strong> dòng thiết bị khác nhau với tổng số lượng tồn kho <strong>${stats.totalQty}</strong> đơn vị. 
            Tỷ lệ bảo toàn kiểm kê đạt <strong>${stats.healthRate}%</strong> đóng băng ở thời điểm kết xuất dữ liệu.
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">STT</th>
                <th>Tên Thiết Bị / Linh Kiện</th>
                <th style="width: 100px;">Phân Loại</th>
                <th style="width: 120px;">Serial Number</th>
                <th style="width: 100px;">Mã Kho (QR)</th>
                <th style="width: 50px;">SL</th>
                <th style="width: 100px;">Trạng Thái</th>
                <th style="width: 180px;">Ghi Chú Kiểm Kê</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary">
            <div>
              <p>Số thiết bị đạt (ĐỦ/ỐN ĐỊNH): <strong>${stats.okCount}</strong></p>
              <p>Số thiết bị lệch (THIẾU/HỎNG): <strong style="color:red">${stats.missingCount}</strong></p>
            </div>
            <div style="text-align: right;">
              <p>Đơn vị kiểm kê: Đội thông tin hàng không</p>
              <p>Giờ xuất phiếu: ${new Date().toLocaleTimeString('vi-VN')}</p>
            </div>
          </div>

          <div class="signs">
            <div class="sign-box">
              <div class="sign-title">Đại Diện Tổ Kiểm Kê</div>
              <div>(Ký, ghi rõ họ tên)</div>
            </div>
            <div class="sign-box">
              <div class="sign-title">Đội Trưởng Đội Thông Tin</div>
              <div>(Ký, đóng dấu xác nhận)</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          <\/script>
        </body>
      </html>
    `);
    win.document.close();
    addToast('Đã khởi tạo bản in biên bản chuyên nghiệp!', 'success');
  };

  // --- SCAN BARCODE / QR SIMULATOR PROCESSING ---
  const handleSimulatedScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanInputCode.trim()) {
      setScanMessage({ text: 'Vui lòng chọn hoặc nhập mã hàng rọi quét!', type: 'error' });
      playScanBeep(200, 0.3);
      return;
    }

    const cleanCode = scanInputCode.trim().toUpperCase();
    
    // Search by either Warehouse Code (Mã Kho) or Serial Number (S/N)
    const matchingItemsIdx = inventory.reduce<number[]>((acc, item, idx) => {
      if (
        (item.warehouse && item.warehouse.toUpperCase() === cleanCode) ||
        item.sn.toUpperCase() === cleanCode
      ) {
        acc.push(idx);
      }
      return acc;
    }, []);

    if (matchingItemsIdx.length === 0) {
      setScanMessage({ 
        text: `Không tìm thấy thiết bị nào khớp với mã "${cleanCode}"!`, 
        type: 'error' 
      });
      playScanBeep(200, 0.4);
      return;
    }

    // Update state of found item(s)
    const nowStr = new Date().toLocaleString('vi-VN');
    const updated = [...inventory];
    
    matchingItemsIdx.forEach(idx => {
      const i = updated[idx];
      const entry: AuditHistoryEntry = {
        id: `h-${Date.now()}-${idx}`,
        status: scanStatus,
        date: nowStr,
        note: scanNote.trim() || 'Kiểm kê tự động bằng hệ thống quét ảo',
        user: role || 'guest'
      };
      
      updated[idx] = {
        ...i,
        auditStatus: scanStatus,
        auditDate: nowStr,
        auditNote: scanNote.trim() || 'Quét mã xác nhận Đủ',
        history: i.history ? [entry, ...i.history] : [entry]
      };
    });

    saveInventoryLocally(updated);
    playScanBeep(scanStatus === 'OK' ? 1047 : 330, 0.16); // High pitch beep for OK, lower for warning
    setScanMessage({ 
      text: `Đã cập nhật trạng thái kiểm cho ${matchingItemsIdx.length} mã thiết bị khớp với: ${cleanCode}!`, 
      type: 'success' 
    });
    setScanNote('');
    setScanInputCode('');

    addToast(`Quét thành công! Thiết bị đã được đánh dấu ${scanStatus === 'OK' ? 'ĐỦ' : 'THIẾU'}.`, 'success');

    // Trigger Cloud Autosync if checked
    if (syncConfig.autoSync) {
      syncToCloud();
    }
  };

  // Immediate layout print
  const startPrintSession = (type: 'QR' | 'LABEL') => {
    setPrintLayout(type);
    addToast('Đang tạo form in... Hệ thống sẽ tự kích hoạt hộp thoại in.', 'info');
    setTimeout(() => {
      window.print();
      // Reset back afterwards
      setTimeout(() => {
        setPrintLayout('NONE');
      }, 1000);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col antialiased">
      
      {/* Toast Alert Rail */}
      <div className="fixed top-6 right-6 z-[99999] flex flex-col gap-3 w-full max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-5 py-4 rounded-2xl shadow-xl text-white font-medium text-sm flex items-start gap-3 border border-white/10 animate-slide-in transition-all duration-300 ${
              t.type === 'success' ? 'bg-emerald-600 dark:bg-emerald-700' :
              t.type === 'error' ? 'bg-rose-600 dark:bg-rose-700' : 'bg-slate-800 dark:bg-slate-900'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-150" />}
            {t.type === 'error' && <XCircle className="w-5 h-5 shrink-0 text-rose-150" />}
            {t.type === 'info' && <AlertCircle className="w-5 h-5 shrink-0 text-sky-150" />}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Printable Area - Only Visible in window.print() context */}
      {printLayout !== 'NONE' && (
        <div className="hidden printable-area">
          {printLayout === 'QR' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                <h2 style={{ textTransform: 'uppercase', fontSize: '16px', margin: '0' }}>DANH SÁCH MÃ QR TRUY XUẤT VẬT TƯ</h2>
                <span style={{ fontSize: '11px', color: '#666' }}>Đội Thông Tin CNS/ATM - Ngày in: {new Date().toLocaleDateString('vi-VN')}</span>
              </div>
              <div className="qr-print-grid">
                {inventory.filter(item => item.warehouse).map(item => (
                  <div key={item.id} className="qr-print-item">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '5px' }}>
                      <QRCodeSVG value={item.warehouse || ''} size={110} level="M" />
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{item.warehouse}</div>
                    <div style={{ fontSize: '9px', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace' }}>S/N: {item.sn}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {printLayout === 'LABEL' && (
            <div>
              <div className="label-print-grid">
                {inventory.map(item => (
                  <div key={item.id} className="label-print-item">
                    <div>
                      <div style={{ fontSize: '10px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '5px' }}>
                        TẬP ĐOÀN QUẢN LÝ BAY - ĐỘI THÔNG TIN
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '800', lineHeight: '1.2', color: '#000', textTransform: 'uppercase' }}>
                        {item.name}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontSize: '10px', color: '#333' }}>
                        <div><strong>P/N:</strong> {item.pn || 'N/A'}</div>
                        <div><strong>S/N:</strong> <span style={{ fontFamily: 'monospace' }}>{item.sn}</span></div>
                        {item.loc && <div><strong>Vị trí:</strong> {item.loc}</div>}
                      </div>
                      
                      {item.warehouse ? (
                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                          <QRCodeSVG value={item.warehouse} size={65} />
                          <div style={{ fontSize: '8px', fontWeight: 'bold', marginTop: '2px' }}>{item.warehouse}</div>
                        </div>
                      ) : (
                        <div style={{ width: '65px', height: '65px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#777' }}>
                          NO QR
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom Confirmation Overlay Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[90000] p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-800 text-center animate-scale-in">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
              {confirmDialog.title}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-2xl text-sm transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-rose-650/20 transition-colors cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- NOT LOGGED IN WRAPPER --- */}
      {!role ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 px-8 py-10 sm:px-10 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/20">
                <QrCode className="w-8 h-8 text-white animate-spin-slow" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">KHO CNS & ATM</h1>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-2.5 uppercase tracking-widest">
                Đội Thông Tin Hàng Không
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase ml-1">
                  Tài khoản đăng nhập
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm placeholder:text-slate-400"
                    placeholder="Nhập 'admin' hoặc 'guest'"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase ml-1">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm placeholder:text-slate-400"
                    placeholder="Mật khẩu tương ứng"
                  />
                </div>
              </div>

              {loginError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-xl text-xs font-medium border border-rose-100 dark:border-rose-900/40">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/35 transition-all outline-none font-sans text-sm tracking-wide mt-5 active:scale-[0.98] cursor-pointer"
              >
                ĐĂNG NHẬP HỆ THỐNG
              </button>
            </form>

            <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6 text-center text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
              <p className="font-bold">Nhãn gợi ý đăng nhập:</p>
              <p className="mt-1">Vai Quản lý: <span className="font-mono text-slate-600 dark:text-slate-300">admin / admin</span> • Vai Kiểm kê: <span className="font-mono text-slate-600 dark:text-slate-300">guest / 123456</span></p>
            </div>
          </div>
        </div>
      ) : (
        /* --- MAIN LOGGED APPLICATION --- */
        <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {/* Header Row */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-200 dark:border-slate-800/60">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500 rounded-xl text-white shadow-md shadow-indigo-500/10">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    VẬT TƯ CNS/ATM
                    <span className="text-[9px] translate-y-[-4px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-extrabold uppercase">
                      Tổ Thông Tin
                    </span>
                  </h1>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                    Hệ thống quản lý định danh & kiểm định hiện vật nội bộ
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
              {/* Sync Quick Tag */}
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-3.5 py-1.5 rounded-2xl shadow-sm text-xs font-semibold">
                <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'syncing' ? 'bg-indigo-500 animate-ping' : syncStatus === 'success' ? 'bg-emerald-500' : syncStatus === 'error' ? 'bg-rose-500' : 'bg-slate-350'}`}></span>
                <span className="text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                  {syncStatus === 'syncing' ? 'Đang sync...' : syncStatus === 'success' ? 'Đã Sync Cloud' : 'Offline'}
                </span>
                {syncConfig.lastSynced && (
                  <span className="text-[10px] text-slate-400 ml-1 font-normal">({syncConfig.lastSynced})</span>
                )}
              </div>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-sm transition-all focus:outline-none cursor-pointer"
                aria-label="Đổi giao diện"
              >
                {darkMode ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-slate-600" />}
              </button>

              {/* Settings modal button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-sm transition-all focus:outline-none cursor-pointer"
                title="Cấu hình Google Apps Script"
              >
                <Settings className="w-4.5 h-4.5 text-slate-500 hover:text-indigo-500 transition-colors" />
              </button>

              {/* Profile Card / Logout */}
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 pl-3 pr-1 py-1 rounded-2xl border border-slate-200/50 dark:border-slate-800 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-extrabold uppercase text-slate-700 dark:text-slate-200">{role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-405 font-bold rounded-xl transition-all cursor-pointer"
                  title="Đăng xuất"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </header>

          {/* Key statistical bento overview cards */}
          <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-[1.8rem] shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tổng sản phẩm</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalItems}</h3>
                <p className="text-[10px] text-slate-500">Mã danh mục lưu</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 border border-indigo-100/55 dark:border-indigo-900/35">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-[1.8rem] shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tổng số lượng</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalQty}</h3>
                <p className="text-[10px] text-slate-500">Cái / chiếc tồn kho</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 border border-emerald-100/55 dark:border-emerald-900/35">
                <CheckSquare className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-[1.8rem] shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Đã kiểm kê</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  {stats.checkedCount} <span className="text-xs font-normal text-slate-400">/ {stats.totalItems}</span>
                </h3>
                <p className="text-[10px] text-slate-500">{Math.round((stats.checkedCount / (stats.totalItems || 1)) * 100)}% hoàn thành</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center text-sky-600 border border-sky-100/55 dark:border-sky-900/35">
                <Activity className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-[1.8rem] shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Thiếu/Hỏng hóc</p>
                <h3 className={`text-2xl font-black ${stats.missingCount > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                  {stats.missingCount}
                </h3>
                <p className="text-[10px] text-slate-500">Thiết bị cần hồi báo</p>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${stats.missingCount > 0 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border-rose-100 dark:border-rose-900/35' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                <XCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white p-5 rounded-[1.8rem] shadow-sm flex items-center justify-between col-span-2 lg:col-span-1">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">Độ an toàn kho</p>
                <h3 className="text-3xl font-black tracking-tight">{stats.healthRate}%</h3>
                <p className="text-[10px] text-indigo-150">Độ khớp danh mục tốt</p>
              </div>
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <Check className="w-6 h-6 text-white" />
              </div>
            </div>
          </section>

          {/* Quick Tools & Cloud Sync Toolbar */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-[2rem] p-4.5 mt-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
            
            {/* Realtime Search with Clear Button */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-3.5 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm: Tên thiết bị, P/N, S/N, Mã Kho..."
                className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-smplaceholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* General Actions Block */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              
              {/* Cloud Sync Manual Actions */}
              <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 dark:bg-slate-850 p-1">
                <button
                  onClick={fetchCloudData}
                  disabled={syncStatus === 'syncing'}
                  className="p-2 px-3 text-[10px] uppercase font-extrabold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  title="Tải cấu trúc từ đám mây về đè đắp bộ nhớ máy"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${syncStatus==='syncing'?'animate-spin':''}`} />
                  Tải Về (PULL)
                </button>
                <button
                  onClick={syncToCloud}
                  disabled={syncStatus === 'syncing'}
                  className="p-2 px-3 text-[10px] uppercase font-extrabold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  title="Tải tất cả các bản ghi hiện có đẩy ngược lên Cloud"
                >
                  Đẩy Lên (PUSH)
                </button>
              </div>

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 hidden md:block mx-1"></div>

              {/* Advanced Scanning Trigger */}
              <button
                onClick={() => {
                  setIsScannerOpen(true);
                  setScanMessage(null);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/10 transition-colors text-xs tracking-wide cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                KIỂM KÊ (QUÉT)
              </button>

              {/* Printer Menus dropdown triggers */}
              <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-850 rounded-xl p-1">
                <button
                  onClick={() => startPrintSession('QR')}
                  className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="In bộ mã QR cho thiết bị có Mã Kho"
                >
                  <Printer className="w-3.5 h-3.5" />
                  MÃ QR
                </button>
                <button
                  onClick={() => startPrintSession('LABEL')}
                  className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="In tem dán nhãn chuẩn kỹ thuật cho tất cả các thiết bị"
                >
                  TEM NHÃN
                </button>
              </div>

              {/* Export Tools Group */}
              <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-850 rounded-xl p-1">
                <button
                  onClick={handleExportExcel}
                  className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-emerald-600 dark:text-emerald-400 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Xuất bảng Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  EXCEL
                </button>
                <button
                  onClick={handleExportWebBill}
                  className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Xuất biên bản kiểm định PDF chuyên nghiệp"
                >
                  <FileText className="w-3.5 h-3.5" />
                  BIÊN BẢN
                </button>
              </div>

            </div>
          </section>

          {/* Catalog Selection & Sub Filters Rows */}
          <div className="mt-6 flex flex-col lg:flex-row gap-5 items-start lg:items-stretch">
            
            {/* Category Pills (Left) */}
            <div className="flex-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-[2rem] p-4 shadow-sm flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mr-2 ml-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-indigo-500" /> Loại máy:
              </span>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat 
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10' 
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Verification Filters (Right) */}
            <div className="w-full lg:w-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-[2rem] p-4 shadow-sm flex flex-wrap gap-1 items-center">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mr-2 ml-1">
                Kiểm kê:
              </span>
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-[11px] font-bold">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setStatusFilter('OK')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === 'OK' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'}`}
                >
                  Tốt / Đủ ({inventory.filter(i => i.auditStatus === 'OK').length})
                </button>
                <button
                  onClick={() => setStatusFilter('MISSING')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === 'MISSING' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500'}`}
                >
                  Thiếu / Hỏng ({inventory.filter(i => i.auditStatus === 'MISSING').length})
                </button>
                <button
                  onClick={() => setStatusFilter('UNCHECKED')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === 'UNCHECKED' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-350 shadow-sm' : 'text-slate-500'}`}
                >
                  Chưa kiểm ({inventory.filter(i => i.auditStatus === null).length})
                </button>
              </div>
            </div>
          </div>

          {/* Core Body Container (Bento Grid layout: Left Form/Stats if admin, Right Main Database list) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
            
            {/* ADMIN CONTROLLER FORM (Only visible to admin) */}
            {role === 'admin' ? (
              <div id="editor-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-[2.2rem] p-6 shadow-sm h-fit">
                <div className="flex items-center gap-2 mb-4">
                  <span className="p-1 px-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-lg uppercase">
                    Admin Form
                  </span>
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                    {editingItemId ? 'Cập Nhật Thiết Bị' : 'Thêm Mới Thiết Bị'}
                  </h2>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase ml-1">Tên thiết bị *</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="VD: Máy thu phát VHF Jotron"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-xs font-semibold placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase ml-1">Phân loại</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-xs font-extrabold"
                      >
                        {CATEGORIES.slice(1).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase ml-1">Số lượng</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formQty}
                        onChange={(e) => setFormQty(Math.max(1, Number(e.target.value)))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase ml-1">P/N (Model)</label>
                      <input
                        type="text"
                        value={formPn}
                        onChange={(e) => setFormPn(e.target.value)}
                        placeholder="Mã Model"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-xs font-semibold placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase ml-1">S/N *</label>
                      <input
                        type="text"
                        required
                        value={formSn}
                        onChange={(e) => setFormSn(e.target.value)}
                        placeholder="Số Sê-ri"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-xs font-mono font-bold placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase ml-1">Mã Kho (QR)</label>
                      <input
                        type="text"
                        value={formWarehouse}
                        onChange={(e) => setFormWarehouse(e.target.value)}
                        placeholder="VD: KHO-01"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-xs font-bold placeholder:text-slate-400 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase ml-1">Vị trí tủ / ngăn</label>
                      <input
                        type="text"
                        value={formLoc}
                        onChange={(e) => setFormLoc(e.target.value)}
                        placeholder="Tủ 2 - Ngăn B"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-xs font-semibold placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm shadow-indigo-600/10 cursor-pointer text-center"
                    >
                      {editingItemId ? 'LƯU CHỈNH SỬA' : 'THÊM MỚI KHO'}
                    </button>
                    <button
                      type="button"
                      onClick={clearForm}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              // GUEST VIEW HELPER (Simple introduction block)
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-[2.2rem] p-6 shadow-sm h-fit space-y-4">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 text-[9px] font-black rounded-lg uppercase">
                    Quyền kiểm kê
                  </span>
                  <h2 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Tài khoản Guest</h2>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Bạn đang đăng nhập bằng quyền <strong className="text-slate-700 dark:text-slate-200">Kiểm kê viên (Guest)</strong>. 
                  Bạn có thể tra cứu nhanh, kiểm kê bằng QR code ngoại vi và kết xuất báo cáo Excel/Biên bản.
                </p>
                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/30 dark:border-indigo-900/40 rounded-2xl flex gap-2">
                  <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-400">
                    Để chỉnh sửa thông số kỹ thuật (S/N, P/N, Số lượng, Loại máy), vui lòng đăng nhập bằng quyền Quản trị viên (Admin).
                  </p>
                </div>
              </div>
            )}

            {/* MAIN STOCK LIST TABLE */}
            <div className={`bg-white dark:bg-slate-900 rounded-[2.2rem] border border-slate-200 dark:border-slate-850 overflow-hidden shadow-sm flex flex-col min-h-[500px] ${role === 'admin' ? 'lg:col-span-3' : 'lg:col-span-3'}`}>
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    DANH MỤC THIẾT BỊ DÀI HẠN ({filteredInventory.length})
                  </span>
                </div>
                
                {/* Reset button for all tests */}
                {role === 'admin' && (
                  <button
                    onClick={handleResetFiltersAndStatus}
                    className="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors cursor-pointer border border-dashed border-slate-200 dark:border-slate-700 hover:border-rose-400 px-2.5 py-1 rounded-lg"
                    title="Hủy kiểm kê toàn bộ thiết bị về ban đầu"
                  >
                    Reset Kiểm kê
                  </button>
                )}
              </div>

              {/* Table rendering panel */}
              <div className="table-container overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-xs text-left whitespace-nowrap min-w-[750px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-3 w-12 text-center">STT</th>
                      <th className="px-5 py-3">Danh xưng & Thông số</th>
                      <th className="px-5 py-3">Serial (S/N)</th>
                      <th className="px-5 py-3 text-center">Mã Kho (QR)</th>
                      <th className="px-5 py-3 text-center w-20">SL</th>
                      <th className="px-5 py-3 text-center">Tình hình (Kiểm)</th>
                      <th className="px-5 py-3 text-center w-24">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-slate-400" />
                          </div>
                          <p className="text-slate-400 max-w-sm mx-auto font-medium text-xs leading-relaxed">
                            Không có thiết bị vật tư nào thỏa mãn bộ lọc hiện tại. Thử xóa hoặc thay đổi từ khóa tìm kiếm.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredInventory.map((item, idx) => {
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-all group">
                            <td className="px-5 py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => setSelectedItemDetail(item)}>
                                  {item.name}
                                </span>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">{item.category || 'Khác'}</span>
                                  {item.pn && (
                                    <>
                                      <span>•</span>
                                      <span>P/N: <strong className="text-slate-600 dark:text-slate-350 font-medium">{item.pn}</strong></span>
                                    </>
                                  )}
                                  {item.loc && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 text-indigo-400" /> {item.loc}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 font-mono font-semibold text-slate-700 dark:text-slate-300">{item.sn}</td>
                            <td className="px-5 py-4 text-center">
                              {item.warehouse ? (
                                <span className="inline-block bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-450 px-2 py-0.5 rounded font-black text-[10px] border border-indigo-100/50 dark:border-indigo-900/35 uppercase">
                                  {item.warehouse}
                                </span>
                              ) : (
                                <span className="text-slate-350 italic text-[10px]">- Chưa cấp -</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center font-black text-slate-800 dark:text-slate-200">{item.qty}</td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {item.auditStatus === 'OK' ? (
                                  <span className="inline-flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-extrabold text-[10px] border border-emerald-100 dark:border-emerald-900/30">
                                    ● ĐỦ / TỐT
                                  </span>
                                ) : item.auditStatus === 'MISSING' ? (
                                  <span className="inline-flex items-center gap-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded font-extrabold text-[10px] border border-rose-100 dark:border-rose-900/30">
                                    ▲ THIẾU
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold text-[10px] border border-slate-200 dark:border-slate-750">
                                    Chưa kiểm
                                  </span>
                                )}
                                {item.auditDate && (
                                  <span className="text-[8px] text-slate-400 font-normal">
                                    {item.auditDate.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5 justify-center">
                                {/* Quick verification checkboxes */}
                                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200/50 dark:border-slate-700">
                                  <button
                                    onClick={() => handleQuickStatusClick(item, item.auditStatus === 'OK' ? null : 'OK')}
                                    className={`p-1 rounded text-[9px] font-bold cursor-pointer transition-all ${
                                      item.auditStatus === 'OK' 
                                        ? 'bg-emerald-500 text-white shadow-sm' 
                                        : 'text-slate-500 hover:text-emerald-500'
                                    }`}
                                    title="Duyệt nhanh: Đủ / Tốt"
                                  >
                                    Đủ
                                  </button>
                                  <button
                                    onClick={() => handleQuickStatusClick(item, item.auditStatus === 'MISSING' ? null : 'MISSING')}
                                    className={`p-1 rounded text-[9px] font-bold cursor-pointer transition-all ${
                                      item.auditStatus === 'MISSING' 
                                        ? 'bg-rose-500 text-white shadow-sm' 
                                        : 'text-slate-500 hover:text-rose-500'
                                    }`}
                                    title="Duyệt nhanh: Thiếu hụt"
                                  >
                                    Thiếu
                                  </button>
                                </div>

                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-750"></div>

                                {/* Custom detail lookup / view */}
                                <button
                                  onClick={() => setSelectedItemDetail(item)}
                                  className="p-1 hover:text-indigo-500 transition-colors cursor-pointer"
                                  title="Xem lịch sử kiểm kê"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete and edit standard toggles (Admin only) */}
                                {role === 'admin' && (
                                  <>
                                    <button
                                      onClick={() => handleEditClick(item)}
                                      className="p-1 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
                                      title="Chỉnh sửa thông số máy"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteClick(item)}
                                      className="p-1 text-slate-450 hover:text-rose-500 transition-colors cursor-pointer"
                                      title="Xóa thiết bị này"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table stats footer */}
              <div className="px-6 py-4.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-500 flex justify-between items-center flex-wrap gap-2">
                <span>
                  Hiển thị <strong className="text-slate-700 dark:text-slate-350">{filteredInventory.length}</strong> dòng vật tư (Tổng số lượng: <strong className="text-slate-700 dark:text-slate-350">{filteredInventory.reduce((s, i)=>s+i.qty,0)}</strong> bộ)
                </span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Cơ sở bộ nhớ an toàn</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- EXTRA ADVANCED MODAL: SCANNER SIMULATOR CLIENT --- */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/90 backdrop-blur-md flex items-center justify-center z-[80000] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.2rem] shadow-2xl w-full max-w-lg border border-slate-100 dark:border-slate-800/80 overflow-hidden animate-scale-in">
            
            {/* Header */}
            <div className="px-6 py-4.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-500" />
                Kiểm Kê Thiết Bị Qua Quét Mã (Simulated)
              </h3>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Feed Viewport */}
            <div className="relative bg-slate-900 h-44 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(0,0,0,0.4)_100%)]"></div>
              
              {/* Scan Reticle corners styling */}
              <div className="absolute w-36 h-28 border-2 border-indigo-400/40 rounded-xl flex items-center justify-center">
                <div className="absolute top-[-3px] left-[-3px] w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg"></div>
                <div className="absolute top-[-3px] right-[-3px] w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg"></div>
                <div className="absolute bottom-[-3px] left-[-3px] w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg"></div>
                <div className="absolute bottom-[-3px] right-[-3px] w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-lg"></div>
                <QrCode className="w-12 h-12 text-indigo-400/30 animate-pulse" />
              </div>

              {/* Laser line effect */}
              <div className="scanner-laser"></div>

              {/* Terminal status line overlay */}
              <div className="absolute top-3 left-4 text-[9px] font-mono text-emerald-400 tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                <span>CHÚ Ý: MODULE SCANNER ONLINE</span>
              </div>
            </div>

            {/* Form controls */}
            <form onSubmit={handleSimulatedScanSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase ml-1">
                  Nhập mã quét thiết bị (Mã Kho hoặc S/N) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={scanInputCode}
                    onChange={(e) => {
                      setScanInputCode(e.target.value);
                      if (scanMessage) setScanMessage(null);
                    }}
                    placeholder="VD: KHO-VHF-01 hoặc RS100429402"
                    className="w-full text-center px-4 py-3 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              {/* Quick simulation pills triggers */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">
                  Nhấp vào mã thử nghiệm nhanh để rọi quét (S/N / Mã Kho)
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar justify-center">
                  {inventory.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setScanInputCode(item.warehouse || item.sn);
                        setScanMessage(null);
                        playScanBeep(600, 0.05);
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-mono text-slate-600 dark:text-slate-300 font-bold hover:border-indigo-400 transition-colors shrink-0 cursor-pointer"
                    >
                      {item.warehouse || item.sn.slice(0, 6) + '...'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Radio buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all text-xs font-bold font-sans tracking-wide bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent has-checked:border-emerald-500 has-checked:bg-emerald-50/20 dark:has-checked:bg-emerald-950/20">
                  <input
                    type="radio"
                    name="scanStatus"
                    checked={scanStatus === 'OK'}
                    onChange={() => setScanStatus('OK')}
                    className="sr-only"
                  />
                  <CheckCircle2 className={`w-4 h-4 ${scanStatus==='OK'?'text-emerald-500':'text-slate-400'}`} />
                  <span className={scanStatus==='OK'?'text-emerald-500':'text-slate-500 dark:text-slate-400'}>ĐỦ / TỐT (OK)</span>
                </label>

                <label className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all text-xs font-bold font-sans tracking-wide bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent has-checked:border-rose-500 has-checked:bg-rose-50/20 dark:has-checked:bg-rose-950/20">
                  <input
                    type="radio"
                    name="scanStatus"
                    checked={scanStatus === 'MISSING'}
                    onChange={() => setScanStatus('MISSING')}
                    className="sr-only"
                  />
                  <XCircle className={`w-4 h-4 ${scanStatus==='MISSING'?'text-rose-500':'text-slate-400'}`} />
                  <span className={scanStatus==='MISSING'?'text-rose-500':'text-slate-500 dark:text-slate-400'}>THIẾU / HỎNG</span>
                </label>
              </div>

              {/* Optional comments notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase ml-1">
                  Đánh giá chi tiết (Ghi chú tùy chọn)
                </label>
                <input
                  type="text"
                  value={scanNote}
                  onChange={(e) => setScanNote(e.target.value)}
                  placeholder="Nhập tình hình máy, ghi chú kíp trực..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-xs placeholder:text-slate-400"
                />
              </div>

              {/* Status scan feedbacks */}
              {scanMessage && (
                <div className={`px-4 py-3 rounded-xl text-xs font-medium border ${
                  scanMessage.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/35' 
                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/35'
                }`}>
                  {scanMessage.text}
                </div>
              )}

              {/* Footer actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs shadow-md shadow-indigo-650/10 cursor-pointer transition-colors"
                >
                  XÁC NHẬN GHI KIỂM KÊ
                </button>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(false)}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 px-5 py-3 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SETTINGS / GOOGLE APPS SCRIPT SYNC CONFIG --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[80000] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.2rem] shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-800 overflow-hidden animate-scale-in">
            <div className="px-6 py-4.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                <Settings className="w-4.5 h-4.5 text-indigo-500" />
                Cài Đặt Đồng Bộ Google Apps Script
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/30 dark:border-indigo-900/40 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-black text-indigo-700 dark:text-indigo-400 tracking-wider">Lưu ý chuyên nghiệp:</span>
                <p className="text-[11.5px] text-indigo-750 dark:text-indigo-350 leading-relaxed">
                  Đường dẫn này kết nối trực tiếp đến Macro triển khai dịch vụ Web App của Google Sheets. Khi đẩy (PUSH) hoặc kéo (PULL), cơ sở dữ liệu sẽ tự động đồng bộ hóa thời gian thực.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase ml-1">
                  Đường dẫn triển khai Google Web App *
                </label>
                <textarea
                  rows={3}
                  value={syncConfig.webAppUrl}
                  onChange={(e) => saveSettingsConfig(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-950 dark:text-white font-mono text-xs outline-none focus:border-indigo-400 resize-none leading-relaxed"
                  placeholder="https://script.google.com/macros/s/..."
                />
              </div>

              {/* Autosync configurations */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/50 dark:border-slate-800">
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-slate-850 dark:text-white">Tự động đồng bộ</span>
                  <p className="text-[10px] text-slate-400">Đồng bộ Cloud lập tức khi quét kiểm kê hàng hoàn thành</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncConfig.autoSync}
                    onChange={(e) => setSyncConfig(prev => ({ ...prev, autoSync: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 dark:bg-slate-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650"></div>
                </label>
              </div>

              {/* Connection Status Indicator block */}
              {syncStatusDetail && (
                <div className={`p-3.5 rounded-2xl text-[11px] font-medium leading-relaxed border ${
                  syncStatus === 'syncing' ? 'bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-100/30' :
                  syncStatus === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100' :
                  'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-100'
                }`}>
                  <strong className="block uppercase text-[9px] font-extrabold tracking-wider mb-0.5">Phản hồi log:</strong>
                  {syncStatusDetail}
                </div>
              )}

              {/* Test Connections buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={fetchCloudData}
                  disabled={syncStatus === 'syncing'}
                  className="flex-1 bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-300 font-extrabold py-3 rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  PULL/LOAD CLOUD
                </button>
                <button
                  type="button"
                  onClick={syncToCloud}
                  disabled={syncStatus === 'syncing'}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl text-xs shadow-md shadow-indigo-650/10 transition-colors cursor-pointer text-center"
                >
                  PUSH LOCAL CODES
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SYSTEM WORKSPACE LOG DETAIL DRAWER (BENTO CLICK) --- */}
      {selectedItemDetail && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex justify-end z-[80000] animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md h-screen shadow-2xl flex flex-col border-l border-slate-100 dark:border-slate-800/80 animate-slide-left">
            
            {/* Drawer Header */}
            <div className="px-6 py-5 bg-slate-50 dark:bg-slate-850 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center shrink-0">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md">
                  Chi tiết thiết bị
                </span>
                <h3 className="font-black text-slate-900 dark:text-white text-sm line-clamp-1">
                  {selectedItemDetail.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="p-1 px-2.5 hover:text-slate-950 dark:hover:text-white text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable details contents */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Core metrics visual items cards */}
              <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 space-y-4">
                <div className="text-center pb-2">
                  {selectedItemDetail.warehouse ? (
                    <div className="inline-block p-2 bg-white dark:bg-slate-850 rounded-2xl shadow-sm border border-slate-150 dark:border-slate-750">
                      <QRCodeSVG value={selectedItemDetail.warehouse} size={150} level="M" />
                      <div className="text-xs font-mono font-bold mt-2 text-indigo-600 dark:text-indigo-400">{selectedItemDetail.warehouse}</div>
                    </div>
                  ) : (
                    <div className="w-24 h-24 mx-auto border-2 border-dashed border-slate-350 rounded-2xl flex items-center justify-center text-[10px] text-slate-400">
                      Chưa cấp mã QR
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 block">PART NUMBER / MODEL</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selectedItemDetail.pn || 'N/A'}</strong>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 block">SERIAL NUMBER (S/N)</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{selectedItemDetail.sn}</strong>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 block">SL TỒN / SỐ LƯỢNG MÁY</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-black">{selectedItemDetail.qty} bộ / chiếc</strong>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 block">VỊ TRÍ PHÂN KHO</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selectedItemDetail.loc || 'N/A'}</strong>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/80 grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 block">TIỂU CHUẨN ĐÁNH GIÁ</span>
                    {selectedItemDetail.auditStatus === 'OK' ? (
                      <span className="text-emerald-500 font-extrabold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-md">ĐỦ / HOẠT ĐỘNG TỐT</span>
                    ) : selectedItemDetail.auditStatus === 'MISSING' ? (
                      <span className="text-rose-500 font-extrabold text-[10px] bg-rose-500/10 px-2 py-0.5 rounded-md">THIẾU / HỎNG HÓC</span>
                    ) : (
                      <span className="text-slate-400 font-bold">CHƯA KIỂM KÊ</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 block">NGÀY KIỂM CUỐI</span>
                    <strong className="text-slate-700 dark:text-slate-350">{selectedItemDetail.auditDate || 'Chưa ghi nhận'}</strong>
                  </div>
                </div>

                {selectedItemDetail.auditNote && (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800">
                    <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider mb-0.5">Ghi chú kiểm định:</span>
                    <p className="text-slate-650 dark:text-slate-300 text-xs font-medium leading-normal italic">
                      "{selectedItemDetail.auditNote}"
                    </p>
                  </div>
                )}
              </div>

              {/* History Timeline */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 border-b border-slate-150 dark:border-slate-800 pb-1.5">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-widest">
                    LỊCH SỬ KIỂM KÊ GẦN ĐÂY
                  </span>
                </div>

                {/* List past audits check blocks */}
                {!selectedItemDetail.history || selectedItemDetail.history.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-medium text-xs">
                    Chưa có hoạt động kiểm kê lịch sử được lưu vết cho mã này.
                  </div>
                ) : (
                  <div className="relative border-l border-slate-200 dark:border-slate-750 ml-3.5 pl-4.5 space-y-4">
                    {selectedItemDetail.history.map(hist => (
                      <div key={hist.id} className="relative text-xs">
                        {/* Timeline dot node */}
                        <div className={`absolute left-[-26px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white dark:bg-slate-900 ${hist.status === 'OK' ? 'border-emerald-500' : 'border-rose-500'}`}></div>
                        
                        <div className="flex justify-between items-start">
                          <strong className={hist.status === 'OK' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                            {hist.status === 'OK' ? '● ĐỦ / TỐT' : '▲ THIẾU THIẾT BỊ'}
                          </strong>
                          <span className="text-[10px] text-slate-400 font-semibold">{hist.date}</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-relaxed mt-1">
                          {hist.note}
                        </p>
                        <div className="text-[10px] text-slate-405 italic mt-1 font-semibold block">
                          Người log: {hist.user.toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Quick Actions at footer of detail panels */}
            <div className="px-6 py-4.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-150 dark:border-slate-800 flex justify-between gap-3 shrink-0">
              <button
                onClick={() => {
                  setSelectedItemDetail(null);
                  if (role === 'admin') handleEditClick(selectedItemDetail);
                }}
                disabled={role !== 'admin'}
                className="flex-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-extrabold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center disabled:opacity-40"
              >
                Chỉnh sửa tệp
              </button>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-slate-750 dark:hover:bg-slate-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Xác nhận đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
