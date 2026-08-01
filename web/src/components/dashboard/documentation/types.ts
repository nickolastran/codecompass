export interface Page {
  id: string;
  documentation_id: string;
  title: string;
  slug: string;
  content: string;
  order_index: number;
  parent_page_id: string | null;
  referenced_files: string[] | null;
  referenced_symbols: string[] | null;
  metadata: JSON | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface FileTreeNode extends Page {
  children: FileTreeNode[];
}

export interface Heading {
  id: string;
  text: string;
  level: number;
}

