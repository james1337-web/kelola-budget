import React, { useState, useEffect } from 'react';
import '@/App.css';
import axios from 'axios';
import { Upload, FileText, Download, Plus, Edit, Trash2, TrendingUp } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const formatRupiah = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const KATEGORI_OPTIONS = [
  'Makanan & Minuman',
  'Transport',
  'Belanja',
  'Hiburan',
  'Kesehatan',
  'Pendidikan',
  'Utilitas',
  'Lainnya'
];

const CHART_COLORS = ['#183623', '#4A6B53', '#8A9F8D', '#D45B42', '#E8A392', '#2D5A3F', '#6E716A', '#D9D7CE'];

function App() {
  const [stats, setStats] = useState({
    budget_awal: 0,
    total_pengeluaran: 0,
    saldo_tersisa: 0,
    persentase_terpakai: 0
  });
  const [expenses, setExpenses] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, expensesRes, chartStatsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/expenses`),
        axios.get(`${API}/expenses/stats`)
      ]);
      
      setStats(statsRes.data);
      setExpenses(expensesRes.data);
      setMonthlyData(chartStatsRes.data.monthly);
      setCategoryData(chartStatsRes.data.by_category);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    }
  };

  const handleSetBudget = async () => {
    try {
      await axios.post(`${API}/budget`, { amount: parseFloat(budgetInput) });
      toast.success('Budget berhasil diatur');
      setShowBudgetModal(false);
      fetchData();
    } catch (error) {
      console.error('Error setting budget:', error);
      toast.error('Gagal mengatur budget');
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
          ...expenseForm,
          nominal: parseFloat(expenseForm.nominal)
        });
        toast.success('Pengeluaran berhasil ditambahkan');
      }
      
      setShowExpenseModal(false);
      resetExpenseForm();
      fetchData();
    } catch (error) {
      console.error('Error submitting expense:', error);
      toast.error('Gagal menyimpan pengeluaran');
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
    setShowExpenseModal(true);
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Yakin ingin menghapus pengeluaran ini?')) return;
    
    try {
      await axios.delete(`${API}/expenses/${id}`);
      toast.success('Pengeluaran berhasil dihapus');
      fetchData();
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
      const response = await axios.get(`${API}/export/excel`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'laporan_budget.xlsx');
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
      const response = await axios.get(`${API}/export/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'laporan_budget.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF berhasil didownload');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Gagal export PDF');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F1]">
      {/* Header */}
      <div className="bg-[#FFFFFF] border-b border-[#D9D7CE]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <h1 data-testid="page-title" className="font-['Cabinet_Grotesk'] text-4xl tracking-tight font-black text-[#1E201E]">
              Laporan Budget
            </h1>
            <div className="flex gap-3">
              <Button
                data-testid="export-excel-btn"
                onClick={handleExportExcel}
                className="bg-[#183623] text-white hover:bg-[#112618] rounded-none shadow-[4px_4px_0px_#D9D7CE] hover:shadow-[2px_2px_0px_#D9D7CE] hover:-translate-y-[1px] transition-all duration-150"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
              <Button
                data-testid="export-pdf-btn"
                onClick={handleExportPDF}
                className="bg-[#183623] text-white hover:bg-[#112618] rounded-none shadow-[4px_4px_0px_#D9D7CE] hover:shadow-[2px_2px_0px_#D9D7CE] hover:-translate-y-[1px] transition-all duration-150"
              >
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button
                data-testid="set-budget-btn"
                onClick={() => setShowBudgetModal(true)}
                className="bg-[#D45B42] text-white hover:bg-[#B34A34] rounded-none shadow-[4px_4px_0px_#D9D7CE] hover:shadow-[2px_2px_0px_#D9D7CE] hover:-translate-y-[1px] transition-all duration-150"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Atur Budget
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Metrics */}
      <div className="max-w-7xl mx-auto mt-10 border-t border-l border-[#D9D7CE]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
          <div data-testid="metric-budget-awal" className="bg-[#FFFFFF] border-b border-r border-[#D9D7CE] p-8">
            <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-3">Budget Awal</div>
            <div className="metric-value text-3xl font-medium text-[#1E201E]">{formatRupiah(stats.budget_awal)}</div>
          </div>
          
          <div data-testid="metric-total-pengeluaran" className="bg-[#FFFFFF] border-b border-r border-[#D9D7CE] p-8">
            <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-3">Total Pengeluaran</div>
            <div className="metric-value text-3xl font-medium text-[#D45B42]">{formatRupiah(stats.total_pengeluaran)}</div>
          </div>
          
          <div data-testid="metric-saldo-tersisa" className="bg-[#FFFFFF] border-b border-r border-[#D9D7CE] p-8">
            <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-3">Saldo Tersisa</div>
            <div className="metric-value text-3xl font-medium text-[#2D5A3F]">{formatRupiah(stats.saldo_tersisa)}</div>
          </div>
          
          <div data-testid="metric-persentase" className="bg-[#FFFFFF] border-b border-r border-[#D9D7CE] p-8">
            <div className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] mb-3">Budget Terpakai</div>
            <div className="metric-value text-3xl font-medium text-[#1E201E]">{stats.persentase_terpakai.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8 px-6 pb-10">
        {/* Left Column - Charts & Table */}
        <div className="lg:col-span-2 space-y-8">
          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly Chart */}
            <div data-testid="chart-monthly" className="bg-[#FFFFFF] border border-[#D9D7CE] p-6 rounded-none">
              <h2 className="font-['Cabinet_Grotesk'] text-xl font-bold text-[#1E201E] mb-4">Pengeluaran Per Bulan</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D9D7CE" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatRupiah(value)} />
                  <Bar dataKey="total" fill="#183623" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Chart */}
            <div data-testid="chart-category" className="bg-[#FFFFFF] border border-[#D9D7CE] p-6 rounded-none">
              <h2 className="font-['Cabinet_Grotesk'] text-xl font-bold text-[#1E201E] mb-4">Pengeluaran Per Kategori</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="total"
                    nameKey="kategori"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => entry.kategori}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatRupiah(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div data-testid="expenses-table" className="bg-[#FFFFFF] border border-[#D9D7CE] rounded-none overflow-hidden">
            <div className="p-6 border-b-2 border-[#183623] flex justify-between items-center">
              <h2 className="font-['Cabinet_Grotesk'] text-xl font-bold text-[#1E201E]">Riwayat Pengeluaran</h2>
              <Button
                data-testid="add-expense-btn"
                onClick={() => {
                  resetExpenseForm();
                  setShowExpenseModal(true);
                }}
                className="bg-[#183623] text-white hover:bg-[#112618] rounded-none shadow-[4px_4px_0px_#D9D7CE] hover:shadow-[2px_2px_0px_#D9D7CE] hover:-translate-y-[1px] transition-all duration-150"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Pengeluaran
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-[#183623]">
                    <TableHead className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A]">Tanggal</TableHead>
                    <TableHead className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A]">Nominal</TableHead>
                    <TableHead className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A]">Kategori</TableHead>
                    <TableHead className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A]">Keterangan</TableHead>
                    <TableHead className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A]">Bukti</TableHead>
                    <TableHead className="font-['Manrope'] text-xs uppercase tracking-[0.2em] text-[#6E716A] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-[#6E716A] py-8">Belum ada data pengeluaran</TableCell>
                    </TableRow>
                  ) : (
                    expenses.map((expense) => (
                      <TableRow key={expense.id} data-testid={`expense-row-${expense.id}`} className="border-b border-[#D9D7CE]">
                        <TableCell className="table-number">{expense.tanggal}</TableCell>
                        <TableCell className="table-number">{formatRupiah(expense.nominal)}</TableCell>
                        <TableCell>{expense.kategori}</TableCell>
                        <TableCell className="max-w-xs truncate">{expense.keterangan}</TableCell>
                        <TableCell>
                          {expense.bukti_filename ? (
                            <a
                              href={`${API}/files/${expense.bukti_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#183623] hover:underline"
                            >
                              Lihat
                            </a>
                          ) : (
                            <span className="text-[#6E716A]">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              data-testid={`edit-expense-${expense.id}`}
                              onClick={() => handleEditExpense(expense)}
                              className="p-2 text-[#183623] hover:bg-[#F5F5F1] transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              data-testid={`delete-expense-${expense.id}`}
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="p-2 text-[#D45B42] hover:bg-[#F5F5F1] transition-colors"
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

        {/* Right Column - Add Expense Form */}
        <div data-testid="expense-form-card" className="bg-[#FFFFFF] border border-[#D9D7CE] p-6 rounded-none h-fit lg:sticky lg:top-6">
          <h2 className="font-['Cabinet_Grotesk'] text-xl font-bold text-[#1E201E] mb-6 pb-4 border-b-2 border-[#183623]">
            Tambah Pengeluaran Cepat
          </h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="quick-tanggal" className="font-['Manrope'] text-sm text-[#1E201E] mb-2 block">Tanggal</Label>
              <Input
                id="quick-tanggal"
                data-testid="quick-tanggal-input"
                type="date"
                value={expenseForm.tanggal}
                onChange={(e) => setExpenseForm({...expenseForm, tanggal: e.target.value})}
                className="input-botanical"
              />
            </div>
            
            <div>
              <Label htmlFor="quick-nominal" className="font-['Manrope'] text-sm text-[#1E201E] mb-2 block">Nominal (Rp)</Label>
              <Input
                id="quick-nominal"
                data-testid="quick-nominal-input"
                type="number"
                value={expenseForm.nominal}
                onChange={(e) => setExpenseForm({...expenseForm, nominal: e.target.value})}
                className="input-botanical"
                placeholder="50000"
              />
            </div>
            
            <div>
              <Label htmlFor="quick-kategori" className="font-['Manrope'] text-sm text-[#1E201E] mb-2 block">Kategori</Label>
              <Select
                value={expenseForm.kategori}
                onValueChange={(value) => setExpenseForm({...expenseForm, kategori: value})}
              >
                <SelectTrigger data-testid="quick-kategori-select" className="input-botanical">
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
              <Label htmlFor="quick-keterangan" className="font-['Manrope'] text-sm text-[#1E201E] mb-2 block">Keterangan</Label>
              <Input
                id="quick-keterangan"
                data-testid="quick-keterangan-input"
                type="text"
                value={expenseForm.keterangan}
                onChange={(e) => setExpenseForm({...expenseForm, keterangan: e.target.value})}
                className="input-botanical"
                placeholder="Deskripsi pengeluaran"
              />
            </div>
            
            <div>
              <Label className="font-['Manrope'] text-sm text-[#1E201E] mb-2 block">Bukti Pembayaran</Label>
              <div {...getRootProps()} className="file-upload-zone p-8 text-center">
                <input {...getInputProps()} data-testid="quick-file-input" />
                <Upload className="w-8 h-8 mx-auto mb-2 text-[#6E716A]" />
                {uploadedFile ? (
                  <p className="text-sm text-[#183623] font-medium">{uploadedFile.name}</p>
                ) : (
                  <p className="text-sm text-[#6E716A]">
                    {isDragActive ? 'Lepaskan file di sini' : 'Drag & drop atau klik untuk upload'}
                  </p>
                )}
              </div>
            </div>
            
            <Button
              data-testid="quick-submit-btn"
              onClick={handleSubmitExpense}
              className="w-full bg-[#183623] text-white hover:bg-[#112618] rounded-none shadow-[4px_4px_0px_#D9D7CE] hover:shadow-[2px_2px_0px_#D9D7CE] hover:-translate-y-[1px] transition-all duration-150 mt-6"
            >
              Simpan Pengeluaran
            </Button>
          </div>
        </div>
      </div>

      {/* Budget Modal */}
      <Dialog open={showBudgetModal} onOpenChange={setShowBudgetModal}>
        <DialogContent data-testid="budget-modal" className="bg-[#FFFFFF] border-2 border-[#183623] rounded-none">
          <DialogHeader>
            <DialogTitle className="font-['Cabinet_Grotesk'] text-2xl font-bold text-[#1E201E]">Atur Budget Awal</DialogTitle>
            <DialogDescription className="font-['Manrope'] text-[#6E716A]">
              Masukkan jumlah budget yang ingin Anda kelola
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
