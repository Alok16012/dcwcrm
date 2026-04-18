'use client'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useState, Fragment } from 'react'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  isLoading?: boolean
  onRowClick?: (row: T) => void
  onSelectionChange?: (rows: T[]) => void
  showColumnFilters?: boolean
}

export function DataTable<T>({ data, columns, isLoading, onRowClick, onSelectionChange, showColumnFilters }: DataTableProps<T>) {
  const [rowSelection, setRowSelection] = useState({})
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      ...(showColumnFilters ? { columnFilters } : {}),
    },
    onRowSelectionChange: setRowSelection,
    ...(showColumnFilters ? { onColumnFiltersChange: setColumnFilters, getFilteredRowModel: getFilteredRowModel() } : {}),
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-white overflow-x-auto w-full">
      <table className="caption-bottom text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <Fragment key={headerGroup.id}>
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
              {showColumnFilters && (
                <TableRow key={`${headerGroup.id}-filters`} className="bg-gray-50 hover:bg-gray-50 border-b-2">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={`filter-${header.id}`} className="py-1 px-2">
                      {header.column.getCanFilter() ? (
                        <input
                          value={(header.column.getFilterValue() as string) ?? ''}
                          onChange={(e) => header.column.setFilterValue(e.target.value || undefined)}
                          placeholder="🔍"
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1 h-7 bg-white focus:outline-none focus:border-blue-400 min-w-[60px]"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-gray-500">
                No records found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </table>
    </div>
  )
}
