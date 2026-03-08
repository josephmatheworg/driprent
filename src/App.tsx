import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileGuard } from "@/components/guards/ProfileGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProfileSetup from "./pages/ProfileSetup";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import FitDetail from "./pages/FitDetail";
import UploadFit from "./pages/UploadFit";
import MyFits from "./pages/MyFits";
import Rentals from "./pages/Rentals";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile-setup" element={<ProfileSetup />} />
            <Route path="/home" element={<ProfileGuard><Home /></ProfileGuard>} />
            <Route path="/browse" element={<ProfileGuard><Browse /></ProfileGuard>} />
            <Route path="/fit/:id" element={<ProfileGuard><FitDetail /></ProfileGuard>} />
            <Route path="/upload" element={<ProfileGuard><UploadFit /></ProfileGuard>} />
            <Route path="/my-fits" element={<ProfileGuard><MyFits /></ProfileGuard>} />
            <Route path="/rentals" element={<ProfileGuard><Rentals /></ProfileGuard>} />
            <Route path="/profile" element={<ProfileGuard><Profile /></ProfileGuard>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
