// Table: Data table with sticky header, row hover highlights, compact density toggle, and skeleton loading rows.
import React from "react";
import Skeleton from "./Skeleton";
import "./ui.css";

function Table({
  columns = [],
  data = [],
  loading = false,
  emptyState = null,
  compact = false,
  stickyHeader = true,
  onRowClick,
  className = "",
  keyField = "id",
}) {
  return (
    <div className={`ui-table-wrapper ${stickyHeader ? "ui-table-wrapper--sticky" : ""} ${className}`}>
      <table className={`ui-table ${compact ? "ui-table--compact" : ""}`}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  textAlign: col.align || "left",
                }}
                className={`ui-th ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 4 }).map((_, rIdx) => (
              <tr key={`skeleton-${rIdx}`} className="ui-tr-skeleton">
                {columns.map((col, cIdx) => (
                  <td key={`col-${cIdx}`} className="ui-td">
                    <Skeleton height="16px" width={cIdx === 0 ? "80%" : "60%"} />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="ui-td-empty">
                {emptyState || (
                  <div className="ui-table-default-empty">No records found.</div>
                )}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={row[keyField] || idx}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`ui-tr ${onRowClick ? "ui-tr--clickable" : ""}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align || "left" }}
                    className={`ui-td ${col.cellClassName || ""}`}
                  >
                    {col.render ? col.render(row[col.key], row, idx) : row[col.key]}
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

export default Table;
export { Table };
