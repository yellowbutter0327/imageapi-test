import React, { useState, useEffect } from "react";
import "./Pagination.scss";

interface PaginationProps {
  page: number;
  totalPosts: number;
  limit: number;
  setPage: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPosts,
  limit,
  setPage,
}) => {
  const numPages = Math.ceil(totalPosts / limit);

  const firstNum = Math.floor((page - 1) / 5) * 5 + 1;
  const lastNum = Math.min(firstNum + 4, numPages);

  const handleClick = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="pagination-wrapper">
      <button
        className="pagination-button move"
        onClick={() => handleClick(page - 1)}
        disabled={page === 1}
        aria-label="Previous Page"
      >
        〈
      </button>
      {Array.from(
        { length: lastNum - firstNum + 1 },
        (_, i) => firstNum + i
      ).map((num) => (
        <button
          key={num}
          className={
            page === num ? "pagination-button on" : "pagination-button"
          }
          onClick={() => handleClick(num)}
        >
          {num}
        </button>
      ))}
      <button
        className="pagination-button move"
        onClick={() => handleClick(page + 1)}
        disabled={page === numPages}
      >
        〉
      </button>
    </div>
  );
};

export default Pagination;
