import React, { useEffect, useState } from "react";
import axios from "axios";
import "./ImagePage.scss";
import SearchFilterBar from "components/SearchFilterBar/SearchFilterBar";
import ImageGrid from "components/ImageGrid/ImageGrid";
import Pagination from "components/Pagination/Pagination";

interface Image {
  thumbnail: string;
  title: string;
}

interface ApiImageItem {
  thumbnail: string;
  title: string;
  link: string;
}

interface ApiResponse {
  items: ApiImageItem[];
  total: number;
}

const ImagePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("티셔츠");
  const [display, setDisplay] = useState<number | null>(null);
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const [images, setImages] = useState<Image[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const clientId = process.env.REACT_APP_NAVER_CLIENT_ID;
  const clientSecret = process.env.REACT_APP_NAVER_CLIENT_SECRET;

  const fetchImages = async (
    query: string,
    limit: number,
    sort: string,
    start: number
  ) => {
    setLoading(true);
    try {
      const url = `/v1/search/image?query=${encodeURIComponent(
        query
      )}&display=${limit}&sort=date&start=${start}`;
      console.log("Fetching URL:", url);
      const response = await axios.get<ApiResponse>(url, {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      });
      // console.log("API:", response.data);

      let fetchedImages: Image[] = response.data.items.map((item) => ({
        thumbnail: item.thumbnail,
        title: item.title,
      }));

      if (sort === "old") {
        fetchedImages = fetchedImages.reverse();
      }
      setImages(fetchedImages);
      const totalPageNumber = response.data.total;
      const totalAvailablePosts = Math.min(totalPageNumber, 550);
      setTotalPosts(totalAvailablePosts);
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResize = () => {
    const width = window.innerWidth;
    let newDisplay;
    if (width >= 1900) {
      newDisplay = 40;
    } else if (width >= 1440) {
      newDisplay = 28;
    } else if (width >= 1200) {
      newDisplay = 20;
    } else {
      newDisplay = 12;
    }
    return newDisplay;
  };

  useEffect(() => {
    const newDisplay = handleResize();
    setDisplay(newDisplay);
  }, []);

  useEffect(() => {
    if (display !== null) {
      fetchImages(query, display, sort, (page - 1) * display + 1);
    }
  }, [query, display, page, sort]);

  useEffect(() => {
    const handleResizeAndFetch = () => {
      const newDisplay = handleResize();
      setDisplay((prevDisplay) => {
        const currentFirstItemIndex = (page - 1) * (prevDisplay || newDisplay);
        const newPage = Math.floor(currentFirstItemIndex / newDisplay) + 1;
        setPage(newPage);
        return newDisplay;
      });
    };

    window.addEventListener("resize", handleResizeAndFetch);
    return () => {
      window.removeEventListener("resize", handleResizeAndFetch);
    };
  }, [page]);

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value);
    setPage(1);
  };

  const handleSearch = () => {
    setSort("date");
    setQuery(searchTerm);
    setPage(1);
  };

  return (
    <div>
      <SearchFilterBar
        sort={sort}
        handleSortChange={handleSortChange}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        handleSearch={handleSearch}
      />
      <div className="content-container">
        {loading ? (
          <div className="content-text">로딩 중...</div>
        ) : totalPosts > 0 ? (
          <ImageGrid images={images} />
        ) : (
          <div className="content-text">검색 결과가 없습니다.</div>
        )}
        {totalPosts > 0 && !loading && (
          <Pagination
            limit={display!}
            page={page}
            setPage={setPage}
            totalPosts={totalPosts}
          />
        )}
      </div>
    </div>
  );
};

export default ImagePage;
