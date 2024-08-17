import { BrowserRouter, Routes, Route } from "react-router-dom";
import "Router.css";

const Router = () => {
  return (
    <BrowserRouter>
      <div className="container">
        <Routes>
          <>
            <Route path="/" element={<ImagePage />} />
          </>
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default Router;
