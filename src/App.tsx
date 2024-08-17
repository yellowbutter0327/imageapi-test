import React from "react";
import "./App.css";
import Header from "./components/Header/Header";
import Layout from "./components/Layout/Layout";
import ImagePage from "./pages/ImagePage/ImagePage";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const App: React.FC = () => {
  return (
    <>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<ImagePage />}></Route>
          </Routes>
        </Layout>
      </BrowserRouter>
    </>
  );
};

export default App;
