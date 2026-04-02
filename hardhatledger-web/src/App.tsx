import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './modules/auth/LoginPage';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { ProductsPage } from './modules/inventory/pages/ProductsPage';
import { CategoriesPage } from './modules/inventory/pages/CategoriesPage';
import { StockPage } from './modules/inventory/pages/StockPage';
import { MovementsPage } from './modules/inventory/pages/MovementsPage';
import { POSPage } from './modules/pos/pages/POSPage';
import { PurchaseOrdersPage } from './modules/pos/pages/PurchaseOrdersPage';
import { ClientsPage } from './modules/clients/pages/ClientsPage';
import { SuppliersPage } from './modules/suppliers/pages/SuppliersPage';
import { AccountingDashboard } from './modules/accounting/pages/AccountingDashboard';
import { JournalEntriesPage } from './modules/accounting/pages/JournalEntriesPage';
import { IncomeStatementPage } from './modules/accounting/pages/IncomeStatementPage';
import { BalanceSheetPage } from './modules/accounting/pages/BalanceSheetPage';
import { CashFlowPage } from './modules/accounting/pages/CashFlowPage';
import { ClientStatementsPage } from './modules/accounting/pages/ClientStatementsPage';
import { UsersPage } from './modules/users/pages/UsersPage';
import { useEffect } from 'react';

function App() {
  const { user, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Inventory */}
          <Route path="/inventory" element={<ProductsPage />} />
          <Route path="/inventory/categories" element={<CategoriesPage />} />
          <Route path="/inventory/stock" element={<StockPage />} />
          <Route path="/inventory/movements" element={<MovementsPage />} />

          {/* POS */}
          <Route path="/pos" element={<POSPage />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />

          {/* Clients & Suppliers */}
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />

          {/* Users */}
          <Route path="/users" element={<UsersPage />} />

          {/* Accounting */}
          <Route path="/accounting" element={<AccountingDashboard />} />
          <Route path="/accounting/journal" element={<JournalEntriesPage />} />
          <Route path="/accounting/reports/income" element={<IncomeStatementPage />} />
          <Route path="/accounting/reports/balance-sheet" element={<BalanceSheetPage />} />
          <Route path="/accounting/reports/cash-flow" element={<CashFlowPage />} />
          <Route path="/accounting/reports/client-statements" element={<ClientStatementsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
