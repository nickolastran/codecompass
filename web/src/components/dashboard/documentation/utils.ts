import { Page, FileTreeNode, Heading } from './types';

export function buildFileTree(pages: Page[]): FileTreeNode[] {
  const nodeMap = new Map<string, FileTreeNode>();
  const rootNodes: FileTreeNode[] = [];

  pages.forEach(page => {
    nodeMap.set(page.id, { ...page, children: [] });
  });

  pages.forEach(page => {
    const node = nodeMap.get(page.id)!;
    if (page.parent_page_id === null) {
      rootNodes.push(node);
    } else {
      const parent = nodeMap.get(page.parent_page_id);
      if (parent) {
        parent.children.push(node);
      }
    }
  });

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => a.order_index - b.order_index);
    nodes.forEach(node => {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    });
  };
  sortNodes(rootNodes);

  return rootNodes;
}

export function extractHeadings(content: string): Heading[] {
  const lines = content.split('\n');
  const extractedHeadings: Heading[] = [];
  
  lines.forEach((line) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/[^\w]+/g, '-');
      extractedHeadings.push({ id, text, level });
    }
  });
  
  return extractedHeadings;
}