import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "./components/Layout";
import Search from "./pages/Search";
import Upload from "./pages/Upload";
import Library from "./pages/Library";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Search />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/library" element={<Library />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;