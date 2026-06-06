import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "./lib/queryClient";
import { AuthGuard } from "./components/auth/AuthGuard";
import { AdminGuard } from "./components/auth/AdminGuard";
import { LoginPage } from "./pages/LoginPage";
import { QuotesHistoryPage } from "./pages/QuotesHistoryPage";
import { CalculatorV3Page } from "./pages/CalculatorV3Page";
import { AnyfenceCalculatorPage } from "./pages/AnyfenceCalculatorPage";
import { CalculatorV4Page } from "./pages/CalculatorV4Page";
import { SupplierPortalPage } from "./pages/SupplierPortalPage";
import { ContractorPortalPage } from "./pages/ContractorPortalPage";
import { ContractorEmbedQuotePage } from "./pages/ContractorEmbedQuotePage";
import { CalculatorBuilderPage } from "./pages/CalculatorBuilderPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { AdminModerationPage } from "./pages/admin/AdminModerationPage";
import { ProductsIndexPage } from "./pages/admin/ProductsIndexPage";
import { ProductDetailPage } from "./pages/admin/ProductDetailPage";
import { ComponentsIndexPage } from "./pages/admin/ComponentsIndexPage";
import { ColoursAdminPage } from "./pages/admin/ColoursAdminPage";
import { SuppliersListPage } from "./pages/admin/SuppliersListPage";
import { SupplierEditPage } from "./pages/admin/SupplierEditPage";
import { SystemInstancesListPage } from "./pages/admin/SystemInstancesListPage";
import { SystemInstanceEditPage } from "./pages/admin/SystemInstanceEditPage";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { ProfileProvider } from "./context/ProfileContext";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminPortalPage } from "./pages/admin/AdminPortalPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { BookingFlowPage } from "./pages/BookingFlowPage";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-right" richColors />;
}

const router = createBrowserRouter([
  {
    errorElement: <NotFoundPage />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/onboarding", element: <OnboardingPage /> },
      { path: "/", element: <AnyfenceCalculatorPage /> },
      { path: "/book/:quoteId", element: <BookingFlowPage /> },
      {
        path: "/fence-calculator",
        element: <AnyfenceCalculatorPage />,
      },
      {
        path: "/calculator",
        element: (
          <AuthGuard>
            <AnyfenceCalculatorPage />
          </AuthGuard>
        ),
      },
      {
        path: "/calculator/:instanceSlug",
        element: (
          <AuthGuard>
            <CalculatorV3Page />
          </AuthGuard>
        ),
      },
      {
        path: "/fence-calculator-v4",
        element: (
          <AuthGuard>
            <CalculatorV4Page />
          </AuthGuard>
        ),
      },
      {
        path: "/quotes",
        element: (
          <AuthGuard>
            <QuotesHistoryPage />
          </AuthGuard>
        ),
      },
      {
        path: "/quote/:quoteId",
        element: (
          <AuthGuard>
            <CalculatorV3Page />
          </AuthGuard>
        ),
      },
      {
        path: "/s/:supplierSlug",
        element: <SupplierPortalPage />,
      },
      {
        path: "/s/:supplierSlug/calculator/:instanceSlug",
        element: <CalculatorV3Page />,
      },
      {
        path: "/embed/:contractorSlug",
        element: <ContractorEmbedQuotePage />,
      },
      {
        path: "/embed",
        element: <Navigate to="/embed/skybrook-fencing" replace />,
      },
      {
        path: "/contractor",
        element: (
          <AuthGuard>
            <ContractorPortalPage />
          </AuthGuard>
        ),
      },
      {
        path: "/builder",
        element: (
          <AuthGuard>
            <CalculatorBuilderPage />
          </AuthGuard>
        ),
      },
      {
        path: "/builder/:instanceId",
        element: (
          <AuthGuard>
            <CalculatorBuilderPage />
          </AuthGuard>
        ),
      },
      {
        path: "/marketplace",
        element: (
          <AuthGuard>
            <MarketplacePage />
          </AuthGuard>
        ),
      },
      {
        path: "/admin/portal",
        element: (
          <AdminGuard>
            <AdminPortalPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/moderation",
        element: (
          <AdminGuard>
            <AdminModerationPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/products",
        element: (
          <AdminGuard>
            <ProductsIndexPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/products/:id",
        element: (
          <AdminGuard>
            <ProductDetailPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/components",
        element: (
          <AdminGuard>
            <ComponentsIndexPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/colours",
        element: (
          <AdminGuard>
            <ColoursAdminPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/suppliers",
        element: (
          <AdminGuard>
            <SuppliersListPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/suppliers/new",
        element: (
          <AdminGuard>
            <SupplierEditPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/suppliers/:slug/edit",
        element: (
          <AdminGuard>
            <SupplierEditPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/system-instances",
        element: (
          <AdminGuard>
            <SystemInstancesListPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/system-instances/new",
        element: (
          <AdminGuard>
            <SystemInstanceEditPage />
          </AdminGuard>
        ),
      },
      {
        path: "/admin/system-instances/:id/edit",
        element: (
          <AdminGuard>
            <SystemInstanceEditPage />
          </AdminGuard>
        ),
      },
      { path: "*", element: <NotFoundPage asNotFound /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ProfileProvider>
          <ThemedToaster />
          <RouterProvider router={router} />
        </ProfileProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
