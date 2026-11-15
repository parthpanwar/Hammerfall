'use client';

import React from 'react';

export interface NeoTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
}

export interface NeoTableProps<T> {
  columns: NeoTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  className?: string;
  emptyMessage?: string;
}

export function NeoTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  className = '',
  emptyMessage = 'No records found.',
}: NeoTableProps<T>) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-[var(--m-line)] bg-[var(--m-panel)] ${className}`}>
      <table className="w-full text-xs text-left border-collapse">
        <thead className="bg-[var(--m-panel)] border-b border-[var(--m-line)] text-[var(--m-dim)] uppercase text-[10px] font-bold tracking-wider">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`py-3 px-4 ${
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                    ? 'text-right'
                    : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--m-line)]/60 text-[var(--m-text)]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-[var(--m-dim)] font-medium">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, idx) => (
              <tr
                key={keyExtractor(item, idx)}
                onClick={() => onRowClick && onRowClick(item)}
                className={`transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-[var(--m-raised)]/70' : 'hover:bg-[var(--m-panel)]'
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2.5 px-4 ${
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                    }`}
                  >
                    {col.render ? col.render(item, idx) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
