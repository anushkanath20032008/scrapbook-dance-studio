import { useEffect, useState, type ClipboardEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  COLUMNS,
  DEFAULT_VISIBLE,
  MAX_GRID_ROWS,
  emptyRow,
  pasteIntoGrid,
  type ColumnId,
  type GridRow,
} from "@/lib/dancer-grid";

const STORAGE_KEY = "choreo-dancer-grid";
type Layout = { shown: ColumnId[]; widths: Partial<Record<ColumnId, number>> };

function loadLayout(): Layout {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Layout | null;
    const ids = new Set<string>(COLUMNS.map((c) => c.id));
    if (parsed && Array.isArray(parsed.shown) && parsed.shown.every((id) => ids.has(id)) && parsed.shown.includes("name"))
      return { shown: parsed.shown, widths: parsed.widths ?? {} };
  } catch {
    // Storage can be blocked; the default columns are fine.
  }
  return { shown: DEFAULT_VISIBLE, widths: {} };
}

export const startRows = (count = 5): GridRow[] => Array.from({ length: count }, emptyRow);

/**
 * A table to type or paste dancers into: rows can be added and removed, columns can be shown, hidden, reordered and
 * resized. The layout is remembered in this browser. Problems are marked on the row; the parent decides what to do.
 */
export function DancerGrid({
  rows,
  onChange,
  problems,
}: {
  rows: GridRow[];
  onChange: (rows: GridRow[]) => void;
  /** Row index to message, for rows that cannot be added yet. */
  problems: Map<number, string>;
}) {
  const [layout, setLayout] = useState<Layout>({ shown: DEFAULT_VISIBLE, widths: {} });
  const [picker, setPicker] = useState(false);
  useEffect(() => setLayout(loadLayout()), []);
  const save = (next: Layout) => {
    setLayout(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Not remembering the layout is harmless.
    }
  };

  const columns = layout.shown.map((id) => COLUMNS.find((c) => c.id === id)!);
  const widthOf = (id: ColumnId) => layout.widths[id] ?? COLUMNS.find((c) => c.id === id)!.width;

  const setCell = (row: number, column: ColumnId, value: string) =>
    onChange(rows.map((r, i) => (i === row ? { ...r, [column]: value } : r)));

  const focusCell = (row: number, column: ColumnId) => {
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>(`[data-cell="${row}:${column}"]`)?.focus(),
    );
  };

  function onKey(event: KeyboardEvent<HTMLInputElement>, row: number, column: ColumnId) {
    if (event.key !== "Enter" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const target = event.key === "ArrowUp" ? row - 1 : row + 1;
    if (target < 0) return;
    if (target >= rows.length) {
      if (rows.length >= MAX_GRID_ROWS) return;
      onChange([...rows, emptyRow()]);
    }
    focusCell(target, column);
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>, row: number, column: ColumnId) {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\n") && !text.includes("\t") && !/\d{6,}/.test(text)) return;
    event.preventDefault();
    const result = pasteIntoGrid(rows, row, column, layout.shown, text);
    onChange(result.rows);
    if (result.shown !== layout.shown) save({ ...layout, shown: result.shown });
  }

  function startResize(event: PointerEvent<HTMLSpanElement>, id: ColumnId) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthOf(id);
    const move = (e: globalThis.PointerEvent) =>
      setLayout((current) => ({
        ...current,
        widths: { ...current.widths, [id]: Math.max(80, Math.min(480, startWidth + e.clientX - startX)) },
      }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLayout((current) => {
        save(current);
        return current;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const toggle = (id: ColumnId) => {
    if (id === "name") return;
    save({
      ...layout,
      shown: layout.shown.includes(id)
        ? layout.shown.filter((c) => c !== id)
        : COLUMNS.map((c) => c.id).filter((c) => c === id || layout.shown.includes(c)),
    });
  };
  const move = (id: ColumnId, by: -1 | 1) => {
    const at = layout.shown.indexOf(id);
    const to = at + by;
    if (to < 0 || to >= layout.shown.length) return;
    const shown = [...layout.shown];
    [shown[at], shown[to]] = [shown[to]!, shown[at]!];
    save({ ...layout, shown });
  };

  return (
    <div className="dancer-grid">
      <div className="dancer-grid-bar">
        <Button variant="retroPaper" type="button" onClick={() => setPicker((open) => !open)} aria-expanded={picker}>
          Columns
        </Button>
        <Button
          variant="retroPaper"
          type="button"
          disabled={rows.length >= MAX_GRID_ROWS}
          onClick={() => onChange([...rows, emptyRow()])}
        >
          Add row
        </Button>
        <span className="console-hint">Paste from Excel, Sheets or a list. Enter moves down.</span>
      </div>
      {picker && (
        <ul className="dancer-grid-picker" aria-label="Columns">
          {COLUMNS.map((c) => (
            <li key={c.id}>
              <label>
                <input
                  type="checkbox"
                  checked={layout.shown.includes(c.id)}
                  disabled={c.id === "name"}
                  onChange={() => toggle(c.id)}
                />{" "}
                {c.label}
              </label>
              {layout.shown.includes(c.id) && (
                <span>
                  <button type="button" aria-label={`Move ${c.label} left`} onClick={() => move(c.id, -1)}>
                    ←
                  </button>
                  <button type="button" aria-label={`Move ${c.label} right`} onClick={() => move(c.id, 1)}>
                    →
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="dancer-grid-scroll">
        <table className="dancer-grid-table">
          <colgroup>
            <col style={{ width: 36 }} />
            {columns.map((c) => (
              <col key={c.id} style={{ width: widthOf(c.id) }} />
            ))}
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">#</th>
              {columns.map((c) => (
                <th key={c.id} scope="col">
                  {c.label}
                  <span
                    className="dancer-grid-resize"
                    role="separator"
                    aria-label={`Resize ${c.label}`}
                    onPointerDown={(event) => startResize(event, c.id)}
                  />
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const problem = problems.get(r);
              return (
                <tr key={r} data-bad={problem !== undefined}>
                  <td className="dancer-grid-num">{r + 1}</td>
                  {columns.map((c) => (
                    <td key={c.id}>
                      <input
                        className="dancer-grid-cell"
                        data-cell={`${r}:${c.id}`}
                        value={row[c.id]}
                        aria-label={`${c.label}, row ${r + 1}`}
                        aria-invalid={problem !== undefined && c.id === "name" ? true : undefined}
                        inputMode={c.id === "phone" || c.id === "emergencyPhone" || c.id === "fee" ? "tel" : undefined}
                        placeholder={c.id === "joinedOn" ? "dd/mm/yyyy" : ""}
                        spellCheck={false}
                        autoComplete="off"
                        onChange={(event) => setCell(r, c.id, event.target.value)}
                        onKeyDown={(event) => onKey(event, r, c.id)}
                        onPaste={(event) => onPaste(event, r, c.id)}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="dancer-grid-remove"
                      aria-label={`Remove row ${r + 1}`}
                      onClick={() => onChange(rows.length > 1 ? rows.filter((_, i) => i !== r) : [emptyRow()])}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
