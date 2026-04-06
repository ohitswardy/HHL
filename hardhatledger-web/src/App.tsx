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
import { TierPricingPage } from './modules/inventory/pages/TierPricingPage';
import { POSPage } from './modules/pos/pages/POSPage';
import { TransactionsPage } from './modules/pos/pages/TransactionsPage';
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
import { RoleManagementPage } from './modules/roles/pages/RoleManagementPage';
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
          <Route path="/inventory" element={<ProtectedRoute permission="products.view"><ProductsPage /></ProtectedRoute>} />
          <Route path="/inventory/categories" element={<ProtectedRoute permission="categories.view"><CategoriesPage /></ProtectedRoute>} />
          <Route path="/inventory/stock" element={<ProtectedRoute permission="inventory.view"><StockPage /></ProtectedRoute>} />
          <Route path="/inventory/movements" element={<ProtectedRoute permission="inventory.view"><MovementsPage /></ProtectedRoute>} />
          <Route path="/inventory/pricing" element={<ProtectedRoute permission="products.edit"><TierPricingPage /></ProtectedRoute>} />

          {/* POS */}
          <Route path="/pos" element={<ProtectedRoute permission="pos.access"><POSPage /></ProtectedRoute>} />
          <Route path="/pos/transactions" element={<ProtectedRoute permission="pos.access"><TransactionsPage /></ProtectedRoute>} />
          <Route path="/purchase-orders" element={<ProtectedRoute permission="purchase-orders.view"><PurchaseOrdersPage /></ProtectedRoute>} />

          {/* Clients & Suppliers */}
          <Route path="/clients" element={<ProtectedRoute permission="clients.view"><ClientsPage /></ProtectedRoute>} />
          <Route path="/suppliers" element={<ProtectedRoute permission="suppliers.view"><SuppliersPage /></ProtectedRoute>} />

          {/* Users & Roles */}
          <Route path="/users" element={<ProtectedRoute permission="users.view"><UsersPage /></ProtectedRoute>} />
          <Route path="/roles" element={<ProtectedRoute permission="roles.view"><RoleManagementPage /></ProtectedRoute>} />

          {/* Accounting */}
          <Route path="/accounting" element={<ProtectedRoute permission="accounting.view"><AccountingDashboard /></ProtectedRoute>} />
          <Route path="/accounting/journal" element={<ProtectedRoute permission="accounting.view"><JournalEntriesPage /></ProtectedRoute>} />
          <Route path="/accounting/reports/income" element={<ProtectedRoute permission="accounting.view"><IncomeStatementPage /></ProtectedRoute>} />
          <Route path="/accounting/reports/balance-sheet" element={<ProtectedRoute permission="accounting.view"><BalanceSheetPage /></ProtectedRoute>} />
          <Route path="/accounting/reports/cash-flow" element={<ProtectedRoute permission="accounting.view"><CashFlowPage /></ProtectedRoute>} />
          <Route path="/accounting/reports/client-statements" element={<ProtectedRoute permission="accounting.view"><ClientStatementsPage /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
