import React from "react";
import "./Header.scss";

interface HeaderProps {
  openModal: () => void;
}

const Header: React.FC<HeaderProps> = ({ openModal }) => {
  return (
    <header>
      <h4>📚 소재 라이브러리</h4>
      <button onClick={openModal}>+ 새 이미지 추가 </button>
    </header>
  );
};

export default Header;
