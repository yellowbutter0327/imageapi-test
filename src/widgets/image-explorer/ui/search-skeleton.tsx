export function SearchSkeleton() {
  return (
    <div className="image-grid skeleton-grid" aria-hidden="true">
      {Array.from({ length: 40 }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <div />
          <span />
          <small />
        </div>
      ))}
    </div>
  );
}
