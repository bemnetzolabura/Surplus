import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Browse from './pages/Browse';
import ListingDetail from './pages/ListingDetail';
import SellerProfile from './pages/SellerProfile';
import AuthPage from './pages/AuthPage';
import Checkout from './pages/Checkout';
import Messages from './pages/Messages';
import Dashboard from './pages/Dashboard';
import Receipt from './pages/Receipt';
import PriceIndex from './pages/PriceIndex';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/listing/:id" element={<ListingDetail />} />
              <Route path="/seller/:id" element={<SellerProfile />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/checkout/:transactionId" element={<Checkout />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:conversationId" element={<Messages />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/receipt/:transactionId" element={<Receipt />} />
              <Route path="/price-index" element={<PriceIndex />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
