'use client';

import { useState } from 'react';
import type { MappedPage } from '@/types/multi-page';

interface PageSelectorProps {
  pages: MappedPage[];
  onSelectionChange: (selected: MappedPage[]) => void;
  onStartClone: () => void;
  isMapLoading?: boolean;
  useOriginalUrls?: boolean;
  onImageSourceChange?: (useOriginal: boolean) => void;
}

export default function PageSelector({
  pages,
  onSelectionChange,
  onStartClone,
  isMapLoading = false,
  useOriginalUrls = false,
  onImageSourceChange,
}: PageSelectorProps) {
  // Default: select root + depth 1
  const defaultSelected = new Set(
    pages.filter(p => p.depth <= 1).map(p => p.path)
  );
  const [selected, setSelected] = useState<Set<string>>(defaultSelected);
  const [selectAll, setSelectAll] = useState(false);

  const togglePage = (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelected(next);
    const selectedPages = pages.filter(p => next.has(p.path));
    onSelectionChange(selectedPages);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelected(new Set());
      onSelectionChange([]);
    } else {
      const all = new Set(pages.map(p => p.path));
      setSelected(all);
      onSelectionChange(pages);
    }
    setSelectAll(!selectAll);
  };

  if (isMapLoading) {
    return (
      <div className="py-4 px-2">
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-6 bg-gray-200 rounded w-3/4" />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Discovering pages...</p>
      </div>
    );
  }

  if (pages.length === 0) return null;

  // Group pages by depth for indentation
  const renderPage = (page: MappedPage) => {
    const indent = page.depth * 20;
    return (
      <label
        key={page.path}
        className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
        style={{ marginLeft: `${indent}px` }}
      >
        <input
          type="checkbox"
          checked={selected.has(page.path)}
          onChange={() => togglePage(page.path)}
          className="rounded border-gray-300 text-heat-100 focus:ring-heat-100"
        />
        <span className="text-sm text-gray-800">{page.title}</span>
        <span className="text-xs text-gray-400 ml-auto">{page.path}</span>
      </label>
    );
  };

  const sortedPages = [...pages].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.path.localeCompare(b.path);
  });

  return (
    <div className="border-t border-gray-100 pt-3 mt-2">
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-xs font-medium text-gray-600">
          已选 {selected.size}/{pages.length} 页
        </span>
        <button
          onClick={toggleSelectAll}
          className="text-xs text-heat-100 hover:text-heat-200 transition-colors"
        >
          {selectAll ? '取消全选' : '全选'}
        </button>
      </div>
      {/* Image source toggle */}
      <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-50 mt-1 pt-2">
        <span className="text-xs font-medium text-gray-600">图片来源:</span>
        <div className="flex gap-1 bg-gray-50 rounded-md p-0.5">
          <button
            onClick={() => onImageSourceChange?.(true)}
            className={`px-2 py-1 text-[11px] font-medium rounded transition-all ${
              useOriginalUrls
                ? 'bg-white text-gray-800 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Use original URLs
          </button>
          <button
            onClick={() => onImageSourceChange?.(false)}
            className={`px-2 py-1 text-[11px] font-medium rounded transition-all ${
              !useOriginalUrls
                ? 'bg-white text-gray-800 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Download to local
          </button>
        </div>
      </div>
      <div className="overflow-y-auto border border-gray-100 rounded-lg" style={{maxHeight: '280px'}}>
        {sortedPages.map(renderPage)}
      </div>
      <button
        onClick={onStartClone}
        disabled={selected.size === 0}
        className={`mt-3 w-full py-2 px-4 rounded-lg text-sm font-medium transition-all ${
          selected.size > 0
            ? 'bg-heat-100 hover:bg-heat-200 text-white'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        克隆所选 {selected.size > 0 ? `(${selected.size} 页)` : ''} 🚀
      </button>
    </div>
  );
}
