import type { Analysis, Filter, QueryResult, Row } from "./log-store";

export type WorkerRequest =
  | { type: "loadFile"; file: File }
  | { type: "loadText"; text: string; name?: string }
  | { type: "reset" }
  | { type: "query"; id: number; filter: Filter }
  | { type: "rows"; id: number; version: number; start: number; end: number }
  | { type: "next"; id: number; from: number; dir: 1 | -1 }
  | { type: "rowOfLine"; id: number; line: number }
  | { type: "export"; id: number };

export type WorkerResponse =
  | { type: "progress"; bytes: number; total: number; lines: number }
  | { type: "loaded"; lines: number; bytes: number }
  | { type: "queryResult"; id: number; version: number; result: QueryResult }
  | { type: "rows"; id: number; version: number; start: number; rows: Row[] }
  | { type: "next"; id: number; row: number }
  | { type: "rowOfLine"; id: number; row: number }
  | { type: "export"; id: number; blob: Blob }
  | { type: "analysis"; analysis: Analysis }
  | { type: "error"; message: string };

/** Files above this size are refused; the whole file lives in memory inside the worker. */
export const MAX_FILE_BYTES = 512 * 1024 * 1024;
