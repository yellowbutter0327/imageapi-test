import React from "react";
import "./ImageGrid.scss";

interface Image {
  thumbnail: string;
  title: string;
}

interface ImageGridProps {
  images: Image[];
}

const ImageGrid: React.FC<ImageGridProps> = ({ images }) => {
  return (
    <div className="grid-container">
      <div className="image-grid">
        {images.map((image, index) => (
          <div key={index} className="item-img-wrapper">
            <img className="item-img" src={image.thumbnail} alt={image.title} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageGrid;
