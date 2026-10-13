import { Link, Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tight"
          >
            Video<span className="text-blue-400">Search</span>
          </Link>

          <div className="flex gap-6 text-sm text-slate-300">
            <Link
              to="/"
              className="transition hover:text-white"
            >
              Search
            </Link>

            <Link
              to="/upload"
              className="transition hover:text-white"
            >
              Upload
            </Link>

            <Link
              to="/library"
              className="transition hover:text-white"
            >
              My Videos
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;