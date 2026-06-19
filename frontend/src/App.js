import React, { useState, useEffect } from 'react';
import '@/App.css';
import axios from 'axios';
import { Upload, FileText, Download, Plus, Edit, Trash2, TrendingUp, DollarSign, Smartphone } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

const formatRupiah = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatRupiahShort = (value) => {
  if (value >= 1000000) {
    return `Rp ${(value / 1000000).toFixed(1)}jt`;
  } else if (value >= 1000) {
    return `Rp ${(value / 1000).toFixed(0)}rb`;
  }
  return `Rp ${value}`;
};

const KATEGORI_OPTIONS = [
  'Makanan & Minuman',
  'Transport',
  'Belanja',
  'Hiburan',
  'Kesehatan',
  'Pendidikan',
  'Utilitas',
  'Operasional',
  'Marketing',
  'Lainnya'
];

const DIVISIONS = ['REGIS', 'BLAST', 'SEO'];
const CHART_COLORS = ['#183623', '#4A6B53', '#8A9F8D', '#D45B42', '#E8A392', '#2D5A3F', '#6E716A', '#D9D7CE'];

function App() {
  const [activeTab, setActiveTab] = useState('REGIS');
  const [dashboardStats, setDashboardStats] = useState({
    total_budget: 0,
    total_pengeluaran: 0,
    total_saldo: 0,
    divisions: []
  });
  const [expenses, setExpenses] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    nominal: '',
    kategori: '',
    keterangan: '',
    bukti_path: null,
    bukti_filename: null
  });

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success('Aplikasi berhasil diinstall!');
      setShowInstallButton(false);
    }
    
    setDeferredPrompt(null);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchDivisionData(activeTab);
  }, [activeTab]);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Gagal memuat data dashboard');
    }
  };

  const fetchDivisionData = async (divisi) => {
    try {
      const [expensesRes, chartStatsRes] = await Promise.all([
        axios.get(`${API}/expenses?divisi=${divisi}`),
        axios.get(`${API}/expenses/stats/${divisi}`)
      ]);
      
      setExpenses(expensesRes.data);
      setMonthlyData(chartStatsRes.data.monthly);
      setCategoryData(chartStatsRes.data.by_category);
    } catch (error) {
      console.error('Error fetching division data:', error);
      toast.error('Gagal memuat data divisi');
    }
  };

  const handleSetBudget = async () => {
    if (!budgetInput || parseFloat(budgetInput) < 0) {
      toast.error('Masukkan jumlah budget yang valid');
      return;
    }
    
    try {
      await axios.post(`${API}/budgets`, { 
        divisi: activeTab,
        amount: parseFloat(budgetInput) 
      });
      toast.success(`Budget ${activeTab} berhasil diatur`);
      setShowBudgetModal(false);
      setBudgetInput('');
      fetchDashboardData();
    } catch (error) {
      console.error('Error setting budget:', error);
      toast.error(error.response?.data?.detail || 'Gagal mengatur budget');
    }
  };

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadedFile(file);
      setExpenseForm(prev => ({
        ...prev,
        bukti_path: response.data.path,
        bukti_filename: response.data.filename
      }));
      toast.success('File berhasil diupload');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Gagal mengupload file');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif'] },
    maxFiles: 1
  });

  const handleSubmitExpense = async () => {
    if (!expenseForm.tanggal || !expenseForm.nominal || !expenseForm.kategori) {
      toast.error('Mohon lengkapi data yang diperlukan');
      return;
    }

    if (parseFloat(expenseForm.nominal) <= 0) {
      toast.error('Nominal harus lebih dari 0');
      return;
    }

    try {
      if (editingExpense) {
        await axios.put(`${API}/expenses/${editingExpense.id}`, {
          tanggal: expenseForm.tanggal,
          nominal: parseFloat(expenseForm.nominal),
          kategori: expenseForm.kategori,
          keterangan: expenseForm.keterangan
        });
        toast.success('Pengeluaran berhasil diupdate');
      } else {
        await axios.post(`${API}/expenses`, {
          divisi: activeTab,
          ...expenseForm,
          nominal: parseFloat(expenseForm.nominal)
        });
        toast.success('Pengeluaran berhasil ditambahkan');
      }
      
      resetExpenseForm();
      fetchDashboardData();
      fetchDivisionData(activeTab);
    } catch (error) {
      console.error('Error submitting expense:', error);
      toast.error(error.response?.data?.detail || 'Gagal menyimpan pengeluaran');
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      tanggal: expense.tanggal,
      nominal: expense.nominal.toString(),
      kategori: expense.kategori,
      keterangan: expense.keterangan,
      bukti_path: expense.bukti_path,
      bukti_filename: expense.bukti_filename
    });
    
    window.scrollTo({ top: document.getElementById('expense-form').offsetTop - 100, behavior: 'smooth' });
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Yakin ingin menghapus pengeluaran ini?')) return;
    
    try {
      await axios.delete(`${API}/expenses/${id}`);
      toast.success('Pengeluaran berhasil dihapus');
      fetchDashboardData();
      fetchDivisionData(activeTab);
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Gagal menghapus pengeluaran');
    }
  };

  const resetExpenseForm = () => {
    setEditingExpense(null);
    setUploadedFile(null);
    setExpenseForm({
      tanggal: new Date().toISOString().split('T')[0],
      nominal: '',
      kategori: '',
      keterangan: '',
      bukti_path: null,
      bukti_filename: null
    });
  };

  const handleExportExcel = async () => {
    try {
      const response = await axios.get(`${API}/export/excel/${activeTab}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `laporan_${activeTab}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel berhasil didownload');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Gagal export Excel');
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await axios.get(`${API}/export/pdf/${activeTab}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `laporan_${activeTab}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF berhasil didownload');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Gagal export PDF');
    }
  };

  const currentDivisionStats =
  (dashboardStats?.divisions ?? []).find(
    d => d.divisi === activeTab
  ) || {
    budget_awal: 0,
    total_pengeluaran: 0,
    saldo_tersisa: 0,
    persentase_terpakai: 0,
  };

  return (
    <div className="min-h-screen bg-[#F5F5F1]">
      {/* PWA Install Button */}
      {showInstallButton && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top">
          <Button
            data-testid="install-pwa-btn"
            onClick={handleInstallClick}
            className="bg-[#0F3D2E] text-white hover:bg-[#183623] rounded-lg shadow-lg px-4 py-2 flex items-center gap-2"
          >
            <Smartphone className="w-4 h-4" />
            Install Aplikasi
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#FFFFFF] border-b border-[#D9D7CE] sticky top-0 z-50">
        <div className="max-w-full px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 data-testid="page-title" className="font-['Cabinet_Grotesk'] text-3xl tracking-tight font-black text-[#1E201E]">
              Sistem Kelola Budget Multi-Divisi
            </h1>
            <div className="flex gap-3">
              <Button
                data-testid="set-budget-btn"
                onClick={() => setShowBudgetModal(true)}
                className="bg-[#D45B42] text-white hover:bg-[#B34A34] rounded-none shadow-[4px_4px_0px_#D9D7CE] hover:shadow-[2px_2px_0px_#D9D7CE] hover:-translate-y-[1px] transition-all duration-150"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Atur Budget {activeTab}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Summary */}
      <div className="bg-[#FFFFFF] border-b-2 border-[#183623] py-6 px-6">
        <div className="max-w-full grid grid-cols-1 md:grid-cols-3 gap-6">
          <div data-testid="summary-total-budget" className="text-center">
            <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-2">Total Budget Semua Divisi</div>
            <div className="metric-value text-2xl font-semibold text-[#1E201E]">{formatRupiah(Number(dashboardStats.total_budget) || 0)}</div>
          </div>
          <div data-testid="summary-total-pengeluaran" className="text-center">
            <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-2">Total Pengeluaran Semua Divisi</div>
            <div className="metric-value text-2xl font-semibold text-[#D45B42]">{formatRupiah(Number(dashboardStats.total_pengeluaran) || 0)}</div>
          </div>
          <div data-testid="summary-total-saldo" className="text-center">
            <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-2">Total Saldo Tersisa</div>
            <div className="metric-value text-2xl font-semibold text-[#2D5A3F]">{formatRupiah(Number(dashboardStats.total_saldo) || 0)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-full px-6 mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-[#FFFFFF] border border-[#D9D7CE] rounded-none p-0 h-auto grid grid-cols-3 w-full md:w-auto">
            {DIVISIONS.map(div => (
              <TabsTrigger
                key={div}
                value={div}
                data-testid={`tab-${div}`}
                className="rounded-none border-r border-[#D9D7CE] last:border-r-0 px-8 py-3 data-[state=active]:bg-[#183623] data-[state=active]:text-white font-['Cabinet_Grotesk'] font-bold text-base"
              >
                {div}
              </TabsTrigger>
            ))}
          </TabsList>

          {DIVISIONS.map(divisi => (
            <TabsContent key={divisi} value={divisi} className="mt-6">
              {/* Division Metrics */}
              <div className="border-t border-l border-[#D9D7CE] mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
                  <div data-testid={`metric-budget-${divisi}`} className="bg-[#FFFFFF] border-b border-r border-[#D9D7CE] p-6">
                    <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-2">Budget Awal</div>
                    <div className="metric-value text-2xl font-medium text-[#1E201E]">{formatRupiah(currentDivisionStats.budget_awal)}</div>
                  </div>
                  
                  <div data-testid={`metric-pengeluaran-${divisi}`} className="bg-[#FFFFFF] border-b border-r border-[#D9D7CE] p-6">
                    <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-2">Total Pengeluaran</div>
                    <div className="metric-value text-2xl font-medium text-[#D45B42]">{formatRupiah(currentDivisionStats.total_pengeluaran)}</div>
                  </div>
                  
                  <div data-testid={`metric-saldo-${divisi}`} className="bg-[#FFFFFF] border-b border-r border-[#D9D7CE] p-6">
                    <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-2">Saldo Tersisa</div>
                    <div className="metric-value text-2xl font-medium text-[#2D5A3F]">{formatRupiah(currentDivisionStats.saldo_tersisa)}</div>
                  </div>
                  
                  <div data-testid={`metric-persentase-${divisi}`} className="bg-[#FFFFFF] border-b border-r border-[#D9D7CE] p-6">
                    <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-2">Budget Terpakai</div>
                    <div className="metric-value text-2xl font-medium text-[#1E201E]">{currentDivisionStats.persentase_terpakai.toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left - Main Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div data-testid={`chart-monthly-${divisi}`} className="bg-[#FFFFFF] border border-[#D9D7CE] p-6 rounded-none">
                      <h2 className="font-['Cabinet_Grotesk'] text-lg font-bold text-[#1E201E] mb-4">Pengeluaran Per Bulan</h2>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#D9D7CE" />
                          <XAxis dataKey="bulan" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatRupiahShort} />
                          <Tooltip formatter={(value) => formatRupiah(value)} />
                          <Bar dataKey="total" fill="#183623" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div data-testid={`chart-category-${divisi}`} className="bg-[#FFFFFF] border border-[#D9D7CE] p-6 rounded-none">
                      <h2 className="font-['Cabinet_Grotesk'] text-lg font-bold text-[#1E201E] mb-4">Pengeluaran Per Kategori</h2>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={categoryData}
                            dataKey="total"
                            nameKey="kategori"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            label={(entry) => entry.kategori}
                          >
                            {(categoryData ?? []).map((entry, index) => (
  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
))}
                          </Pie>
                          <Tooltip formatter={(value) => formatRupiah(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Table */}
                  <div data-testid={`expenses-table-${divisi}`} className="bg-[#FFFFFF] border border-[#D9D7CE] rounded-none">
                    <div className="p-4 border-b-2 border-[#183623] flex justify-between items-center">
                      <h2 className="font-['Cabinet_Grotesk'] text-lg font-bold text-[#1E201E]">Riwayat Pengeluaran {divisi}</h2>
                      <div className="flex gap-2">
                        <Button
                          data-testid={`export-excel-${divisi}`}
                          onClick={handleExportExcel}
                          size="sm"
                          className="bg-[#183623] text-white hover:bg-[#112618] rounded-none"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Excel
                        </Button>
                        <Button
                          data-testid={`export-pdf-${divisi}`}
                          onClick={handleExportPDF}
                          size="sm"
                          className="bg-[#183623] text-white hover:bg-[#112618] rounded-none"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          PDF
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-[#D9D7CE] bg-[#F5F5F1]">
                            <TableHead className="font-['Manrope'] text-xs uppercase tracking-wider text-[#6E716A]">Tanggal</TableHead>
                            <TableHead className="font-['Manrope'] text-xs uppercase tracking-wider text-[#6E716A]">Nominal</TableHead>
                            <TableHead className="font-['Manrope'] text-xs uppercase tracking-wider text-[#6E716A]">Kategori</TableHead>
                            <TableHead className="font-['Manrope'] text-xs uppercase tracking-wider text-[#6E716A]">Keterangan</TableHead>
                            <TableHead className="font-['Manrope'] text-xs uppercase tracking-wider text-[#6E716A]">Bukti</TableHead>
                            <TableHead className="font-['Manrope'] text-xs uppercase tracking-wider text-[#6E716A] text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expenses.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-[#6E716A] py-8">Belum ada data pengeluaran</TableCell>
                            </TableRow>
                          ) : (
                            (Array.isArray(expenses) ? expenses : []).map((expense) => (
                              <TableRow key={expense.id} data-testid={`expense-row-${expense.id}`} className="border-b border-[#D9D7CE] hover:bg-[#F5F5F1]">
                                <TableCell className="table-number">{expense.tanggal}</TableCell>
                                <TableCell className="table-number font-medium">{formatRupiah(expense.nominal)}</TableCell>
                                <TableCell>{expense.kategori}</TableCell>
                                <TableCell className="max-w-xs truncate">{expense.keterangan}</TableCell>
                                <TableCell>
                                  {expense.bukti_filename ? (
                                    <a
                                      href={`${API}/files/${expense.bukti_path}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#183623] hover:underline text-sm"
                                    >
                                      Lihat
                                    </a>
                                  ) : (
                                    <span className="text-[#6E716A]">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <button
                                      data-testid={`edit-expense-${expense.id}`}
                                      onClick={() => handleEditExpense(expense)}
                                      className="p-2 text-[#183623] hover:bg-[#EBEBE6] transition-colors rounded"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      data-testid={`delete-expense-${expense.id}`}
                                      onClick={() => handleDeleteExpense(expense.id)}
                                      className="p-2 text-[#D45B42] hover:bg-[#EBEBE6] transition-colors rounded"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                {/* Right - Form */}
                <div id="expense-form" data-testid="expense-form-card" className="bg-[#FFFFFF] border border-[#D9D7CE] p-6 rounded-none h-fit lg:sticky lg:top-24">
                  <h2 className="font-['Cabinet_Grotesk'] text-lg font-bold text-[#1E201E] mb-4 pb-3 border-b-2 border-[#183623]">
                    {editingExpense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="tanggal" className="font-['Manrope'] text-sm text-[#1E201E] mb-1 block">Tanggal</Label>
                      <Input
                        id="tanggal"
                        data-testid="expense-tanggal-input"
                        type="date"
                        value={expenseForm.tanggal}
                        onChange={(e) => setExpenseForm({...expenseForm, tanggal: e.target.value})}
                        className="input-botanical"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="nominal" className="font-['Manrope'] text-sm text-[#1E201E] mb-1 block">Nominal (Rp)</Label>
                      <Input
                        id="nominal"
                        data-testid="expense-nominal-input"
                        type="number"
                        value={expenseForm.nominal}
                        onChange={(e) => setExpenseForm({...expenseForm, nominal: e.target.value})}
                        className="input-botanical"
                        placeholder="50000"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="kategori" className="font-['Manrope'] text-sm text-[#1E201E] mb-1 block">Kategori</Label>
                      <Select
                        value={expenseForm.kategori}
                        onValueChange={(value) => setExpenseForm({...expenseForm, kategori: value})}
                      >
                        <SelectTrigger data-testid="expense-kategori-select" className="input-botanical">
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#FFFFFF] border border-[#D9D7CE] rounded-none">
                          {KATEGORI_OPTIONS.map((kat) => (
                            <SelectItem key={kat} value={kat}>{kat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="keterangan" className="font-['Manrope'] text-sm text-[#1E201E] mb-1 block">Keterangan</Label>
                      <Input
                        id="keterangan"
                        data-testid="expense-keterangan-input"
                        type="text"
                        value={expenseForm.keterangan}
                        onChange={(e) => setExpenseForm({...expenseForm, keterangan: e.target.value})}
                        className="input-botanical"
                        placeholder="Deskripsi pengeluaran"
                      />
                    </div>
                    
                    {!editingExpense && (
                      <div>
                        <Label className="font-['Manrope'] text-sm text-[#1E201E] mb-1 block">Bukti Pembayaran</Label>
                        <div {...getRootProps()} className="file-upload-zone p-6 text-center">
                          <input {...getInputProps()} data-testid="expense-file-input" />
                          <Upload className="w-6 h-6 mx-auto mb-2 text-[#6E716A]" />
                          {uploadedFile ? (
                            <p className="text-sm text-[#183623] font-medium">{uploadedFile.name}</p>
                          ) : (
                            <p className="text-xs text-[#6E716A]">
                              {isDragActive ? 'Lepaskan file di sini' : 'Drag & drop atau klik'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        data-testid="expense-submit-btn"
                        onClick={handleSubmitExpense}
                        className="flex-1 bg-[#183623] text-white hover:bg-[#112618] rounded-none shadow-[4px_4px_0px_#D9D7CE] hover:shadow-[2px_2px_0px_#D9D7CE] hover:-translate-y-[1px] transition-all duration-150"
                      >
                        {editingExpense ? 'Update' : 'Simpan'}
                      </Button>
                      {editingExpense && (
                        <Button
                          data-testid="expense-cancel-btn"
                          onClick={resetExpenseForm}
                          variant="outline"
                          className="border-[#D9D7CE] rounded-none"
                        >
                          Batal
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Budget Modal */}
      <Dialog open={showBudgetModal} onOpenChange={setShowBudgetModal}>
        <DialogContent data-testid="budget-modal" className="bg-[#FFFFFF] border-2 border-[#183623] rounded-none">
          <DialogHeader>
            <DialogTitle className="font-['Cabinet_Grotesk'] text-2xl font-bold text-[#1E201E]">Atur Budget {activeTab}</DialogTitle>
            <DialogDescription className="font-['Manrope'] text-[#6E716A]">
              Masukkan jumlah budget untuk divisi {activeTab}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="budget-amount" className="font-['Manrope'] text-sm text-[#1E201E] mb-2 block">Jumlah Budget (Rp)</Label>
              <Input
                id="budget-amount"
                data-testid="budget-input"
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="input-botanical"
                placeholder="10000000"
              />
            </div>
            <Button
              data-testid="budget-submit-btn"
              onClick={handleSetBudget}
              className="w-full bg-[#183623] text-white hover:bg-[#112618] rounded-none shadow-[4px_4px_0px_#D9D7CE] hover:shadow-[2px_2px_0px_#D9D7CE] hover:-translate-y-[1px] transition-all duration-150"
            >
              Simpan Budget
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
