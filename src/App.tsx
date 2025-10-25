import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import Index from "./pages/Index";
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
import ParticipantPage from "./pages/ParticipantPage";
import NotFound from "./pages/NotFound";
import { LangProvider } from "./hooks/use-lang";
import { AuthProvider } from "./hooks/use-auth";
import RequireAdmin from "@/components/RequireAdmin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LangProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<div />}> 
              <Routes>
                {/* Public voucher page */}
                <Route path="/events" element={<ParticipantPage />} />
                {/* Admin-only pages */}
                <Route path="/" element={<RequireAdmin><Index /></RequireAdmin>} />
                <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </LangProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
