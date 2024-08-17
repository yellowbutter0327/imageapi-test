import React, { useState, useEffect } from "react";
import Header from "../Header/Header";
import "./Layout.scss";
import Modal from "../Modal/Modal";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  return (
    <div className="layout">
      <Header openModal={openModal} />
      <main className="container">{children}</main>
      <Modal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
};

export default Layout;
