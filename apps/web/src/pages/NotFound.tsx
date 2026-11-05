import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-6xl font-extrabold text-indigo-600">404</p>
      <h1 className="mt-3 text-xl font-bold">Halaman tidak ditemukan</h1>
      <Link to="/" className="mt-5 inline-block font-semibold text-indigo-600 hover:underline">
        Kembali ke beranda
      </Link>
    </div>
  );
}
