import 'server-only';
import type { ImageItem, SearchParams, SearchResponse } from '../model/search';

const themes = ['코랄', '라벤더', '민트', '옐로', '블루', '피치'];
const samples: ImageItem[] = Array.from({ length: 120 }, (_, index) => {
  const category = index < 72 ? '티셔츠' : index < 96 ? '포스터' : '패턴';
  const asset =
    (index % themes.length) + 1 + (index < 72 ? 0 : index < 96 ? 6 : 12);
  return {
    id: `sample-${index + 1}`,
    title: `${themes[index % themes.length]} ${category} ${String(index + 1).padStart(2, '0')}`,
    thumbnail: `/demo/${asset}.svg`,
    original: `/demo/${asset}.svg`,
    width: 480,
    height: 480,
  };
});

export function searchDemo(params: SearchParams): SearchResponse {
  const matched = samples.filter((item) =>
    item.title.toLowerCase().includes(params.q.toLowerCase()),
  );
  if (params.sort === 'date') matched.reverse();
  const start = (params.page - 1) * params.pageSize;
  return {
    mode: 'demo',
    total: matched.length,
    items: matched.slice(start, start + params.pageSize),
  };
}
