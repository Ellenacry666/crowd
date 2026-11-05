import { Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';
import AdminLayout from './components/AdminLayout';
import MainLayout from './components/MainLayout';
import Checkout from './pages/Checkout';
import EventDetail from './pages/EventDetail';
import Events from './pages/Events';
import Home from './pages/Home';
import Login from './pages/Login';
import MyOrders from './pages/MyOrders';
import MyTickets from './pages/MyTickets';
import NotFound from './pages/NotFound';
import Profile from './pages/Profile';
import Register from './pages/Register';
import AdminEventForm from './pages/admin/AdminEventForm';
import AdminEvents from './pages/admin/AdminEvents';
import AdminOrders from './pages/admin/AdminOrders';
import AdminReports from './pages/admin/AdminReports';
import AdminStaff from './pages/admin/AdminStaff';
import AdminTickets from './pages/admin/AdminTickets';
import Dashboard from './pages/admin/Dashboard';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="events" element={<Events />} />
        <Route path="events/:slug" element={<EventDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        {/* Halaman pengunjung. Pembatasan ini hanya tampilan; backend memvalidasi setiap endpoint. */}
        <Route element={<RequireAuth roles={['CUSTOMER']} />}>
          <Route path="checkout/:orderId" element={<Checkout />} />
          <Route path="orders" element={<MyOrders />} />
          <Route path="tickets" element={<MyTickets />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="admin" element={<RequireAuth roles={['ADMIN']} />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="events/new" element={<AdminEventForm />} />
          <Route path="events/:id" element={<AdminEventForm />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="staff" element={<AdminStaff />} />
          <Route path="reports" element={<AdminReports />} />
        </Route>
      </Route>
    </Routes>
  );
}
