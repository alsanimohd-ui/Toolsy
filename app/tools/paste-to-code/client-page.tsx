"use client";

import { useState, useMemo, useRef } from "react";
import { ToolContainer, ToolHeader } from "@/components/tools";
import GlassCard from "@/components/ui/GlassCard";
import { 
  FileText, 
  Upload, 
  Settings2, 
  ChevronDown, 
  Copy, 
  Download, 
  Check, 
  Code2,
  Database,
  AlignLeft,
  List,
  Table as TableIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ─────────────────────────────────────────────
   Types
  ───────────────────────────────────────────── */

type FormatId = 
  | 'json_array' 
  | 'json_objects' 
  | 'js_array' 
  | 'php_array' 
  | 'python_list'
  | 'sql_in' 
  | 'single_quotes' 
  | 'double_quotes' 
  | 'single_quotes_lines'
  | 'double_quotes_lines'
  | 'csv_line'
  | 'html_list'
  | 'html_table'
  | 'markdown_list'
  | 'markdown_table';

interface FormatOption {
  id: FormatId;
  label: string;
  icon: React.ElementType;
  example: string;
  type: '1d' | '2d';
  desc: string;
}

const FORMATS: FormatOption[] = [
  { id: 'json_array', label: 'JSON Array', icon: Code2, example: '["a", "b"]', type: '1d', desc: 'Standard JSON array of strings/numbers.' },
  { id: 'json_objects', label: 'JSON Objects', icon: Code2, example: '[{"x": "a"}]', type: '2d', desc: 'Array of JSON objects (uses first row as keys).' },
  { id: 'js_array', label: 'JS/TS Array', icon: Code2, example: "['a', 'b']", type: '1d', desc: 'JavaScript array with single quotes.' },
  { id: 'php_array', label: 'PHP Array', icon: Code2, example: "['a', 'b']", type: '1d', desc: 'PHP shorthand array syntax.' },
  { id: 'python_list', label: 'Python List', icon: Code2, example: "['a', 'b']", type: '1d', desc: 'Python list syntax.' },
  { id: 'sql_in', label: 'SQL IN (...)', icon: Database, example: "('a', 'b')", type: '1d', desc: 'Ready for SQL WHERE IN clauses.' },
  { id: 'single_quotes', label: 'Single Quotes', icon: AlignLeft, example: "'a', 'b'", type: '1d', desc: 'Comma-separated with single quotes.' },
  { id: 'double_quotes', label: 'Double Quotes', icon: AlignLeft, example: '"a", "b"', type: '1d', desc: 'Comma-separated with double quotes.' },
  { id: 'single_quotes_lines', label: 'Single Quotes (Lines)', icon: List, example: "'a',\n'b'", type: '1d', desc: 'One item per line, single quoted.' },
  { id: 'double_quotes_lines', label: 'Double Quotes (Lines)', icon: List, example: '"a",\n"b"', type: '1d', desc: 'One item per line, double quoted.' },
  { id: 'csv_line', label: 'CSV Line', icon: AlignLeft, example: "a,b,c", type: '1d', desc: 'Simple comma separated values.' },
  { id: 'html_list', label: 'HTML List', icon: Code2, example: "<li>a</li>", type: '1d', desc: 'HTML <ul>/<li> structure.' },
  { id: 'html_table', label: 'HTML Table', icon: TableIcon, example: "<table>...</table>", type: '2d', desc: 'Semantic HTML table structure.' },
  { id: 'markdown_list', label: 'Markdown List', icon: List, example: "- a", type: '1d', desc: 'Markdown bulleted list.' },
  { id: 'markdown_table', label: 'Markdown Table', icon: TableIcon, example: "| col |", type: '2d', desc: 'GitHub flavored markdown table.' },
];

/* ─────────────────────────────────────────────
   Component
  ───────────────────────────────────────────── */

export default function PasteToCodeClient() {
  const [inputText, setInputText] = useState("");
  const [format, setFormat] = useState<FormatId>('json_array');
  const [isDragging, setIsDragging] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  // Advanced Settings
  const [trimSpaces, setTrimSpaces] = useState(true);
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [textCase, setTextCase] = useState<'original' | 'lower' | 'upper'>('original');
  const [indentation] = useState(2);
  const [hasHeaders, setHasHeaders] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─────────────────────────────────────────────
     Data Processing
    ───────────────────────────────────────────── */
  
  const processedData = useMemo(() => {
    if (!inputText.trim()) return { flat: [], grid: [], headers: [] };

    // Basic TSV/CSV Parser
    const lines = inputText.split(/\r?\n/).filter(line => line.trim() !== "");
    let sep = "\t";
    const firstLine = lines[0] || "";
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    if (commaCount > tabCount) sep = ",";

    let grid = lines.map(line => {
      // Simple split, doesn't handle complex quoted CSVs perfectly, but works for "messy data"
      let row = line.split(sep);
      if (trimSpaces) row = row.map(cell => cell.trim());
      if (textCase === 'lower') row = row.map(cell => cell.toLowerCase());
      if (textCase === 'upper') row = row.map(cell => cell.toUpperCase());
      return row;
    });

    let flat = grid.flat();
    
    if (removeDuplicates) {
      flat = Array.from(new Set(flat));
      // for grid, we don't easily remove duplicates without losing structure, 
      // but let's leave grid as is, or remove duplicate rows. Let's remove duplicate rows based on first col.
      const seen = new Set();
      grid = grid.filter(row => {
        const key = row.join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    const headers = hasHeaders && grid.length > 0 ? grid[0] : grid[0]?.map((_, i) => `col_${i+1}`) || [];
    const dataGrid = hasHeaders && grid.length > 0 ? grid.slice(1) : grid;

    return { flat, grid: dataGrid, headers };
  }, [inputText, trimSpaces, removeDuplicates, textCase, hasHeaders]);

  const outputCode = useMemo(() => {
    if (!processedData.flat.length) return "";

    const indent = " ".repeat(indentation);
    const { flat, grid, headers } = processedData;

    const formatVal = (val: string, type: 'single' | 'double' | 'none') => {
      if (type === 'none') return val;
      if (type === 'single') return `'${val.replace(/'/g, "\\'")}'`;
      return `"${val.replace(/"/g, '\\"')}"`;
    };

    switch (format) {
      case 'json_array': {
        const arr = flat.map(v => {
          if (!isNaN(Number(v)) && v !== "") return Number(v);
          if (v.toLowerCase() === "true") return true;
          if (v.toLowerCase() === "false") return false;
          if (v === "null") return null;
          return v;
        });
        return JSON.stringify(arr, null, indentation);
      }
      case 'json_objects': {
        const arr = grid.map(row => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const obj: any = {};
          headers.forEach((h, i) => {
            const v = row[i] || "";
            if (!isNaN(Number(v)) && v !== "") obj[h] = Number(v);
            else if (v.toLowerCase() === "true") obj[h] = true;
            else if (v.toLowerCase() === "false") obj[h] = false;
            else if (v === "null") obj[h] = null;
            else obj[h] = v;
          });
          return obj;
        });
        return JSON.stringify(arr, null, indentation);
      }
      case 'js_array':
      case 'php_array':
      case 'python_list': {
        const isPHP = format === 'php_array';
        const start = isPHP ? "[" : "[";
        const end = isPHP ? "]" : "]";
        return `${start}\n${flat.map(v => `${indent}${formatVal(v, 'single')}`).join(",\n")}\n${end}`;
      }
      case 'sql_in':
        return `(\n${flat.map(v => `${indent}${formatVal(v, 'single')}`).join(",\n")}\n)`;
      case 'single_quotes':
        return flat.map(v => formatVal(v, 'single')).join(", ");
      case 'double_quotes':
        return flat.map(v => formatVal(v, 'double')).join(", ");
      case 'single_quotes_lines':
        return flat.map(v => `${formatVal(v, 'single')},`).join("\n").replace(/,$/, '');
      case 'double_quotes_lines':
        return flat.map(v => `${formatVal(v, 'double')},`).join("\n").replace(/,$/, '');
      case 'csv_line':
        return flat.join(",");
      case 'html_list':
        return `<ul>\n${flat.map(v => `${indent}<li>${v}</li>`).join("\n")}\n</ul>`;
      case 'html_table':
        return `<table>\n${indent}<thead>\n${indent}${indent}<tr>\n${headers.map(h => `${indent}${indent}${indent}<th>${h}</th>`).join("\n")}\n${indent}${indent}</tr>\n${indent}</thead>\n${indent}<tbody>\n${grid.map(row => `${indent}${indent}<tr>\n${row.map(cell => `${indent}${indent}${indent}<td>${cell}</td>`).join("\n")}\n${indent}${indent}</tr>`).join("\n")}\n${indent}</tbody>\n</table>`;
      case 'markdown_list':
        return flat.map(v => `- ${v}`).join("\n");
      case 'markdown_table':
        return `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${grid.map(row => `| ${headers.map((_, i) => row[i] || "").join(" | ")} |`).join("\n")}`;
      default:
        return "";
    }
  }, [processedData, format, indentation]);

  /* ─────────────────────────────────────────────
     Handlers
    ───────────────────────────────────────────── */

  const handleCopy = async () => {
    if (!outputCode) return;
    await navigator.clipboard.writeText(outputCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!outputCode) return;
    const blob = new Blob([outputCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${format}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) setInputText(evt.target.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) setInputText(evt.target.result as string);
      };
      reader.readAsText(file);
    }
  };

  /* ─────────────────────────────────────────────
     Render
    ───────────────────────────────────────────── */

  return (
    <ToolContainer categoryId="dev-automation">
      <ToolHeader
        title="Paste to Code"
        description="The fastest data formatting studio. Paste messy CSV, JSON, or text and instantly convert it to structured code arrays, lists, or tables."
        categoryId="dev-automation"
      />

      <div className="flex flex-col gap-10">
        
        {/* STEP 1: INPUT ZONE */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted/60 ml-2">1. Paste Raw Data</span>
          <GlassCard className="flex flex-col h-[400px] p-0 overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-accent">
                <FileText className="size-4" /> Input Editor
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  accept=".txt,.csv,.tsv,.json"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-md hover:bg-white/10 text-muted hover:text-foreground transition-colors"
                  title="Upload File"
                >
                  <Upload className="size-4" />
                </button>
                {inputText && (
                  <button 
                    onClick={() => setInputText("")}
                    className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 ml-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                placeholder="Paste data here... (CSV, TSV, Excel cells, JSON, etc.) or drag & drop a file."
                className={`absolute inset-0 w-full h-full p-6 bg-transparent text-foreground font-mono text-sm outline-none resize-none transition-colors placeholder:text-muted/40 custom-scrollbar
                  ${isDragging ? 'bg-accent/5' : ''}`}
                spellCheck={false}
              />
              {isDragging && (
                <div className="absolute inset-0 border-2 border-dashed border-accent pointer-events-none" />
              )}
            </div>

            {/* Advanced Controls Toggle */}
            <div className="border-t border-white/5 bg-black/20 p-4">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted hover:text-foreground transition-colors w-max"
              >
                <Settings2 className="size-3" />
                Data Modifiers
                <ChevronDown className={`size-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 mt-4 border-t border-white/5">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted/80 cursor-pointer hover:text-foreground transition-colors">
                        <input type="checkbox" checked={trimSpaces} onChange={e => setTrimSpaces(e.target.checked)} className="accent-accent" />
                        Trim Spaces
                      </label>
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted/80 cursor-pointer hover:text-foreground transition-colors">
                        <input type="checkbox" checked={removeDuplicates} onChange={e => setRemoveDuplicates(e.target.checked)} className="accent-accent" />
                        Remove Duplicates
                      </label>
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted/80 cursor-pointer hover:text-foreground transition-colors">
                        <input type="checkbox" checked={hasHeaders} onChange={e => setHasHeaders(e.target.checked)} className="accent-accent" />
                        Has Headers (2D)
                      </label>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted/80">
                        Case:
                        <select 
                          value={textCase} 
                          onChange={e => setTextCase(e.target.value as 'original' | 'lower' | 'upper')}
                          className="bg-black/40 border border-white/10 rounded px-2 py-1 outline-none focus:border-accent"
                        >
                          <option value="original">Original</option>
                          <option value="lower">lowercase</option>
                          <option value="upper">UPPERCASE</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
        </div>

        {/* STEP 2: FORMAT SELECTION */}
        <div className="flex flex-col gap-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted/60 ml-2">2. Choose Target Structure</span>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {FORMATS.map(fmt => {
              const Icon = fmt.icon;
              return (
              <button
                key={fmt.id}
                onClick={() => setFormat(fmt.id)}
                className={`flex flex-col gap-2 p-4 rounded-xl border text-left transition-all
                  ${format === fmt.id 
                    ? "bg-accent/10 border-accent/40 shadow-[0_0_30px_rgba(var(--accent-rgb),0.15)] scale-[1.02]" 
                    : "bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/[0.02]"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black uppercase tracking-widest ${format === fmt.id ? "text-accent" : "text-muted"}`}>
                    {fmt.label}
                  </span>
                  <Icon className={`size-4 ${format === fmt.id ? "text-accent" : "text-muted/40"}`} />
                </div>
                <span className="font-mono text-[10px] text-foreground/70 truncate mt-1">{fmt.example}</span>
              </button>
            )})}
          </div>
        </div>

        {/* STEP 3: OUTPUT ZONE */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted/60 ml-2">3. Export Code</span>
          <GlassCard className="flex flex-col h-[500px] p-0 overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Preview</span>
                </div>
                <div className="h-4 w-px bg-white/10" />
                <span className="text-[10px] font-bold text-muted/60">{processedData.flat.length} items</span>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-black/40 hover:bg-white/10 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground transition-all"
                >
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  {copied ? "Copied" : "Copy Code"}
                </button>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-black/40 hover:bg-white/10 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground transition-all"
                >
                  <Download className="size-3" />
                  Save File
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#0d1117] relative overflow-hidden group">
              <textarea
                readOnly
                value={outputCode || "Waiting for data..."}
                className="absolute inset-0 w-full h-full p-6 bg-transparent text-[#c9d1d9] font-mono text-sm outline-none resize-none custom-scrollbar"
              />
            </div>
          </GlassCard>
        </div>

        {/* Documentation Section */}
        <section className="mt-12 pt-12 border-t border-white/5 flex flex-col gap-8">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-foreground">Format Engine Manual</h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">How the parsing works</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <GlassCard className="p-6 bg-white/[0.01]">
              <h4 className="text-[11px] font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                <List className="size-4 text-accent" />
                1D vs 2D Arrays
              </h4>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                Most formats (like JavaScript Array or SQL IN) are 1-dimensional. If you paste a multi-column table and select a 1D format, we automatically flatten all cells into a single list.
              </p>
            </GlassCard>
            
            <GlassCard className="p-6 bg-white/[0.01]">
              <h4 className="text-[11px] font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                <Code2 className="size-4 text-emerald-400" />
                Type Inference
              </h4>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                When targeting JSON, we automatically infer data types. &quot;123&quot; becomes a number, &quot;true&quot; becomes a boolean, and &quot;null&quot; becomes an actual null primitive.
              </p>
            </GlassCard>

            <GlassCard className="p-6 bg-white/[0.01]">
              <h4 className="text-[11px] font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                <Database className="size-4 text-blue-400" />
                SQL Prepping
              </h4>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                Use the &quot;SQL IN (...)&quot; format to quickly convert an Excel column of IDs into a format you can immediately paste into your database queries. Single quotes are automatically escaped.
              </p>
            </GlassCard>
          </div>
        </section>

      </div>
    </ToolContainer>
  );
}
