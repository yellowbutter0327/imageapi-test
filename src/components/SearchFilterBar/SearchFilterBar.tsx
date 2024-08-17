import React from "react";
import "./SearchFilterBar.scss";
import SearchIcon from "../../assets/icons/search.svg";

interface SearchFilterBarProps {
  sort: string;
  handleSortChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  handleSearch: () => void;
}

const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  sort,
  handleSortChange,
  searchTerm,
  setSearchTerm,
  handleSearch,
}) => {
  const isSearchDisabled = searchTerm.trim().length === 0;
  return (
    <div className="search-filterbar-wrapper">
      <div className="select-wrapper">
        <select id="sort" value={sort} onChange={handleSortChange}>
          <option value="date">▾ 최신순</option>
          <option value="old">▴ 오래된 순</option>
        </select>
      </div>
      <div className="search-region">
        <img src={SearchIcon} alt="검색 돋보기 이미지" />
        <input
          type="text"
          value={searchTerm}
          placeholder="사진 이름,이미지 태그, 스타일 코드를 입력해주세요"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <button
        className="search-button"
        onClick={handleSearch}
        disabled={isSearchDisabled}
      >
        검색
      </button>
    </div>
  );
};

export default SearchFilterBar;
