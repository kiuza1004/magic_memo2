export type Memo = {
  id: string;
  text: string;
  createdAt: number;
  tags: string[];
};

export type SearchResult = {
  memo: Memo;
  score: number;
};
