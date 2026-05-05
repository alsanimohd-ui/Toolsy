"use client";

import { useState, useEffect, useMemo } from "react";
import { ToolContainer, ToolHeader } from "@/components/tools";

type Separator = "comma" | "tab" | "semicolon" | "html" | "unknown";

interface ParsedResult {
  data: string[][];
  separator: Separator;
  hasHeaders: boolean;
  message?: string;
}

export default function PasteToCodeClient() {
  const [inputText, setInputText] = useState("");
  const [parsed, setParsed] = useState<ParsedResult>({ data: [], separator: "unknown", hasHeaders: true });
  const [useHeaders, setUseHeaders] = useState(true);
  const [activeTab, setActiveTab] = useState("JSON");
  const [sqlTableName, setSqlTableName] = useState("my_table");
  const [isDragging, setIsDragging] = useState(false);
  
  // Simple Mode State
  const [isSimpleMode, setIsSimpleMode] = useState(true);
  const [simpleActiveFormat, setSimpleActiveFormat] = useState("");

  // Core Parsing Engine
  const parseData = (text: string, forceHeaders?: boolean) => {
    if (!text || !text.trim()) {
      setParsed({ data: [], separator: "unknown", hasHeaders: forceHeaders ?? true });
      return;
    }

    // 1. Check HTML table
    if (text.trim().toLowerCase().startsWith("<table")) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        const table = doc.querySelector("table");
        if (table) {
          const data: string[][] = [];
          table.querySelectorAll("tr").forEach(row => {
            const rowData: string[] = [];
            row.querySelectorAll("td, th").forEach(cell => {
              rowData.push(cell.textContent?.trim() || "");
            });
            if (rowData.length > 0) data.push(rowData);
          });
          const headers = forceHeaders !== undefined ? forceHeaders : true;
          setUseHeaders(headers);
          setParsed({ data, separator: "html", hasHeaders: headers });
          return;
        }
      } catch {}
    }

    // 2. Regular CSV/TSV parsing
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length === 0) {
      setParsed({ data: [], separator: "unknown", hasHeaders: forceHeaders ?? true });
      return;
    }

    let sep = "\t";
    const firstLine = lines[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;

    if (commaCount > tabCount && commaCount > semiCount) sep = ",";
    else if (semiCount > tabCount && semiCount > commaCount) sep = ";";
    else if (tabCount > 0 || (commaCount === 0 && semiCount === 0)) sep = "\t";

    const data: string[][] = [];
    for (const line of lines) {
      const row: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; 
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === sep && !inQuotes) {
          row.push(current.trim().replace(/^"|"$/g, ''));
          current = "";
        } else {
          current += char;
        }
      }
      row.push(current.trim().replace(/^"|"$/g, ''));
      data.push(row);
    }

    // Guess headers
    let guessHeaders = true;
    if (data.length > 0) {
      // If the first row is purely numbers/booleans, it's NOT a header
      const firstRowNoStrings = data[0].every(val => {
        if (val === "") return true;
        if (!isNaN(Number(val))) return true;
        if (val.toLowerCase() === "true" || val.toLowerCase() === "false") return true;
        return false;
      });

      if (firstRowNoStrings) {
        guessHeaders = false;
      } else if (data.length > 1) {
        const firstRowHasNum = data[0].some(val => val !== "" && !isNaN(Number(val)));
        const secondRowHasNum = data[1].some(val => val !== "" && !isNaN(Number(val)));
        if (firstRowHasNum && !secondRowHasNum) guessHeaders = false;
      }
    }

    const finalHeaders = forceHeaders !== undefined ? forceHeaders : guessHeaders;
    setUseHeaders(finalHeaders);
    setParsed({ data, separator: sep === "\t" ? "tab" : sep === "," ? "comma" : "semicolon", hasHeaders: finalHeaders });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      parseData(inputText, useHeaders);
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText]);

  // If text is cleared, reset simple active format
  useEffect(() => {
    if (!inputText) setSimpleActiveFormat("");
  }, [inputText]);

  const toggleHeaders = () => {
    const next = !useHeaders;
    setUseHeaders(next);
    parseData(inputText, next);
  };

  const fixMessyData = () => {
    if (!parsed.data.length) return;
    const cleaned = parsed.data.map(row => row.map(cell => cell.replace(/\s+/g, ' ').trim()));
    setParsed(prev => ({ ...prev, data: cleaned, message: "Fixed empty spaces and normalized rows." }));
    setTimeout(() => setParsed(prev => ({ ...prev, message: undefined })), 4000);
  };

  const clearAll = () => {
    setInputText("");
    setParsed({ data: [], separator: "unknown", hasHeaders: true });
    setSimpleActiveFormat("");
  };

  const inferType = (val: string) => {
    if (val === "") return "null";
    if (!isNaN(Number(val))) return "number";
    if (val.toLowerCase() === "true" || val.toLowerCase() === "false") return "boolean";
    return "string";
  };

  const formatValue = (val: string) => {
    const t = inferType(val);
    if (t === "number" || t === "boolean") return val.toLowerCase();
    if (t === "null") return "null";
    return `"${val.replace(/"/g, '\\"')}"`;
  };

  // Output Generators
  const generatedOutputs = useMemo(() => {
    const d = parsed.data;
    if (d.length === 0) return { "JSON": "", "JavaScript": "", "TypeScript": "", "PHP Array": "", "Python": "", "SQL": "", "HTML Table": "", "Markdown": "" };

    const headers = parsed.hasHeaders ? d[0] : d[0].map((_, i) => `col_${i + 1}`);
    const rows = parsed.hasHeaders ? d.slice(1) : d;
    const is1D = d[0].length === 1;

    if (is1D) {
      // Auto Array Detection (1D Logic)
      const flatData = rows.map(r => r[0]);

      // JSON
      const jsonArr = flatData.map(val => {
        const type = inferType(val);
        if (type === "number") return Number(val);
        if (type === "boolean") return val.toLowerCase() === "true";
        if (type === "null") return null;
        return val;
      });
      const jsonStr = JSON.stringify(jsonArr, null, 2);

      // JavaScript
      const jsStr = `const data = [\n${flatData.map(val => `  ${formatValue(val)}`).join(",\n")}\n];`;

      // TypeScript
      const t = flatData.length > 0 ? inferType(flatData[0]) : "any";
      const tsType = t === "null" ? "any" : t;
      const tsStr = `const data: ${tsType}[] = [\n${flatData.map(val => `  ${formatValue(val)}`).join(",\n")}\n];`;

      // PHP
      const phpStr = `$data = [\n${flatData.map(val => `    ${formatValue(val)}`).join(",\n")}\n];`;

      // Python
      const pyStr = `data = [\n${flatData.map(val => `    ${formatValue(val).replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')}`).join(",\n")}\n]`;

      // SQL
      const sqlStr = `INSERT INTO ${sqlTableName} (${headers[0] ? `\`${headers[0]}\`` : "`col_1`"})\nVALUES\n${flatData.map(val => {
        const type = inferType(val);
        if (type === "number" || type === "boolean" || type === "null") return `(${formatValue(val)})`;
        return `('${val.replace(/'/g, "''")}')`;
      }).join(",\n")};`;

      // HTML
      const htmlStr = `<table>\n  <thead>\n    <tr>\n      <th>${headers[0] || "Value"}</th>\n    </tr>\n  </thead>\n  <tbody>\n${flatData.map(val => `    <tr>\n      <td>${val}</td>\n    </tr>`).join("\n")}\n  </tbody>\n</table>`;

      // Markdown
      const mdStr = `| ${headers[0] || "Value"} |\n| --- |\n${flatData.map(val => `| ${val} |`).join("\n")}`;

      return { "JSON": jsonStr, "JavaScript": jsStr, "TypeScript": tsStr, "PHP Array": phpStr, "Python": pyStr, "SQL": sqlStr, "HTML Table": htmlStr, "Markdown": mdStr };
    }

    // 2D Array Logic
    // JSON
    const jsonArr = rows.map(row => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        const val = row[i] || "";
        const type = inferType(val);
        if (type === "number") obj[h] = Number(val);
        else if (type === "boolean") obj[h] = val.toLowerCase() === "true";
        else if (type === "null") obj[h] = null;
        else obj[h] = val;
      });
      return obj;
    });
    const jsonStr = JSON.stringify(jsonArr, null, 2);

    // JavaScript Array
    const jsStr = `const data = [\n${rows.map(row => `  { ${headers.map((h, i) => `"${h}": ${formatValue(row[i] || "")}`).join(", ")} }`).join(",\n")}\n];`;

    // TypeScript
    const typeDef = `interface DataRow {\n${headers.map((h, i) => {
      const sample = rows[0]?.[i] || "";
      const t = inferType(sample);
      const tsType = t === "null" ? "any" : t;
      return `  "${h}": ${tsType};`;
    }).join("\n")}\n}\n\n`;
    const tsStr = `${typeDef}const data: DataRow[] = [\n${rows.map(row => `  { ${headers.map((h, i) => `"${h}": ${formatValue(row[i] || "")}`).join(", ")} }`).join(",\n")}\n];`;

    // PHP Array
    const phpStr = `$data = [\n${rows.map(row => `    [\n${headers.map((h, i) => `        '${h}' => ${formatValue(row[i] || "")}`).join(",\n")}\n    ]`).join(",\n")}\n];`;

    // Python
    const pyStr = `data = [\n${rows.map(row => `    { ${headers.map((h, i) => `"${h}": ${formatValue(row[i] || "").replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')}`).join(", ")} }`).join(",\n")}\n]`;

    // SQL
    const sqlStr = `INSERT INTO ${sqlTableName} (${headers.map(h => `\`${h}\``).join(", ")})\nVALUES\n${rows.map(row => `(${headers.map((_, i) => {
      const t = inferType(row[i] || "");
      if (t === "number" || t === "boolean" || t === "null") return formatValue(row[i] || "");
      return `'${(row[i] || "").replace(/'/g, "''")}'`;
    }).join(", ")})`).join(",\n")};`;

    // HTML
    const htmlStr = `<table>\n  <thead>\n    <tr>\n${headers.map(h => `      <th>${h}</th>`).join("\n")}\n    </tr>\n  </thead>\n  <tbody>\n${rows.map(row => `    <tr>\n${headers.map((_, i) => `      <td>${row[i] || ""}</td>`).join("\n")}\n    </tr>`).join("\n")}\n  </tbody>\n</table>`;

    // Markdown
    const mdStr = `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${rows.map(row => `| ${headers.map((_, i) => row[i] || "").join(" | ")} |`).join("\n")}`;

    return { "JSON": jsonStr, "JavaScript": jsStr, "TypeScript": tsStr, "PHP Array": phpStr, "Python": pyStr, "SQL": sqlStr, "HTML Table": htmlStr, "Markdown": mdStr };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, sqlTableName]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setParsed(prev => ({ ...prev, message: "Copied to clipboard!" }));
    setTimeout(() => setParsed(prev => ({ ...prev, message: undefined })), 3000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) setInputText(evt.target.result as string);
      };
      reader.readAsText(file);
    }
  };

  const activeContent = generatedOutputs[activeTab as keyof typeof generatedOutputs];
  const simpleContent = simpleActiveFormat ? generatedOutputs[simpleActiveFormat as keyof typeof generatedOutputs] : "";

  return (
    <ToolContainer>
      <div className="flex items-start justify-between">
        <ToolHeader
          title="Paste Data → Get Code"
          description="The cleanest, smartest data converter. Paste messy CSV, TSV, or HTML tables and instantly get structured code."
          badge="Data Converter"
        />
        
        <div className="flex gap-4 items-center">
          {inputText && <button onClick={clearAll} className="text-sm font-bold text-[var(--muted)] hover:text-white transition-colors">Clear Input</button>}
          <button 
            onClick={() => setIsSimpleMode(!isSimpleMode)}
            className="text-sm font-bold bg-[var(--surface-raised)] border border-[var(--border)] px-4 py-2 rounded-xl text-[var(--foreground)] hover:border-[var(--accent)] hover:text-white transition-all shadow-md"
          >
            {isSimpleMode ? "Switch to Advanced Mode" : "Switch to Simple Mode"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto animate-fadeIn relative">
        {/* Toast */}
        {parsed.message && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[var(--surface-raised)] border border-[var(--accent)] text-white text-sm font-bold rounded-xl shadow-2xl shadow-[var(--accent-glow)]/20 animate-slideUp">
            {parsed.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* LEFT: INPUT ZONE */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--foreground)] tracking-wide uppercase">1. Paste Messy Data</h2>

            <div className="flex flex-col gap-0 rounded-2xl overflow-hidden border border-[var(--border-subtle)] focus-within:border-[var(--accent)] transition-colors bg-[var(--surface-raised)] shadow-lg">
              
              {/* Toolbar - Only visible in Advanced Mode */}
              {!isSimpleMode && (
                <div className="flex flex-wrap items-center justify-between bg-[var(--surface)] px-4 py-2 border-b border-[var(--border)] animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[var(--muted)] bg-[var(--background)] px-2 py-1 rounded">
                      {parsed.data.length > 0 ? `Detected: ${parsed.separator}` : "Waiting for input..."}
                    </span>
                    {parsed.data.length > 0 && (
                      <span className="text-xs font-mono text-[var(--muted)] bg-[var(--background)] px-2 py-1 rounded">
                        {parsed.data.length} rows
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={fixMessyData} disabled={!parsed.data.length} className="px-3 py-1.5 bg-[var(--background)] hover:bg-[var(--accent)]/20 border border-[var(--border)] hover:border-[var(--accent)] text-xs font-bold text-[var(--foreground)] hover:text-white rounded-lg transition-all disabled:opacity-50">
                      ✨ Fix Data
                    </button>
                    <button onClick={toggleHeaders} disabled={!parsed.data.length} className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-all disabled:opacity-50 ${useHeaders ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--border-subtle)] border-[var(--border)]'}`}>
                      Headers: {useHeaders ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              )}

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                placeholder="Paste your CSV, Excel cells, TSV, or HTML table here... or drag and drop a file."
                className={`w-full min-h-[400px] p-6 bg-transparent text-[var(--foreground)] font-mono text-sm outline-none resize-none transition-colors ${isDragging ? 'bg-[var(--accent-glow)]/10' : ''}`}
                spellCheck={false}
              />
            </div>
          </div>

          {/* RIGHT: OUTPUT TABS OR SIMPLE BUTTONS */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--foreground)] tracking-wide uppercase">2. Get Clean Code</h2>
            
            {isSimpleMode ? (
              <div className="flex flex-col h-[400px] animate-fadeIn">
                {!simpleActiveFormat ? (
                  <div className="grid grid-cols-2 gap-4 h-full">
                    {["JSON", "JavaScript", "PHP Array", "Python", "SQL", "HTML Table"].map(fmt => (
                      <button 
                        key={fmt}
                        disabled={!parsed.data.length}
                        onClick={() => setSimpleActiveFormat(fmt)}
                        className="flex items-center justify-center p-6 bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--surface)] text-[var(--foreground)] hover:text-white rounded-2xl shadow-md transition-all group disabled:opacity-50 disabled:hover:border-[var(--border-subtle)] disabled:hover:bg-[var(--surface-raised)] disabled:hover:text-[var(--foreground)]"
                      >
                        <span className="text-lg font-bold group-hover:scale-105 transition-transform">Convert → {fmt}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-lg animate-fadeIn">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
                      <button onClick={() => setSimpleActiveFormat("")} className="text-sm font-bold text-[var(--muted)] hover:text-white flex items-center gap-2 transition-colors">
                        <span>←</span> Choose another format
                      </button>
                      <button onClick={() => copyToClipboard(simpleContent)} className="text-xs font-bold bg-[var(--accent)] text-white px-4 py-1.5 rounded-lg shadow-md hover:-translate-y-0.5 transition-all">
                        Copy Code
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto bg-[#0d1117] relative">
                      <pre className="p-4 text-sm font-mono leading-relaxed text-[#c9d1d9]">
                        {simpleContent || <span className="text-gray-600 italic">Waiting for data...</span>}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-lg h-[456px] animate-fadeIn">
                {/* Tab Header */}
                <div className="flex overflow-x-auto bg-[var(--surface)] border-b border-[var(--border)] hide-scrollbar">
                  {Object.keys(generatedOutputs).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`whitespace-nowrap px-4 py-3 text-sm font-bold transition-colors ${activeTab === tab ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--foreground)] border-b-2 border-transparent'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--background)]/50">
                  {activeTab === "SQL" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--muted)]">Table Name:</span>
                      <input 
                        type="text" 
                        value={sqlTableName}
                        onChange={(e) => setSqlTableName(e.target.value)}
                        className="bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--foreground)] px-2 py-1 rounded outline-none focus:border-[var(--accent)] font-mono"
                      />
                    </div>
                  ) : <div />}
                  
                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(activeContent)} disabled={!activeContent} className="text-xs font-bold text-[var(--muted)] hover:text-white px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded hover:border-[var(--accent)] transition-all disabled:opacity-50">
                      Copy Code
                    </button>
                    <button onClick={() => downloadFile(activeContent, `export.${activeTab.toLowerCase()}`)} disabled={!activeContent} className="text-xs font-bold text-[var(--muted)] hover:text-white px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded hover:border-[var(--accent)] transition-all disabled:opacity-50">
                      Download
                    </button>
                  </div>
                </div>

                {/* Code Area */}
                <div className="flex-1 overflow-auto bg-[#0d1117] relative group">
                  <pre className="p-4 text-sm font-mono leading-relaxed text-[#c9d1d9]">
                    {activeContent || <span className="text-gray-600 italic">Waiting for data...</span>}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM: PREVIEW TABLE (Advanced Only) */}
        {!isSimpleMode && parsed.data.length > 0 && (
          <div className="flex flex-col gap-3 animate-fadeIn mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--foreground)] tracking-wide uppercase">3. Clean Data Preview</h2>
            </div>
            
            <div className="w-full overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-lg">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <tr>
                    {parsed.hasHeaders ? parsed.data[0].map((h, i) => (
                      <th key={i} className="px-4 py-3 font-bold text-[var(--foreground)]">{h}</th>
                    )) : parsed.data[0].map((_, i) => (
                      <th key={i} className="px-4 py-3 font-bold text-[var(--muted)] italic">col_{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {(parsed.hasHeaders ? parsed.data.slice(1) : parsed.data).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[var(--surface)]/50 transition-colors">
                      {(parsed.hasHeaders ? parsed.data[0] : parsed.data[0]).map((_, cIdx) => (
                        <td key={cIdx} className="px-4 py-2.5 text-[var(--muted)] font-mono text-xs">
                          {row[cIdx] || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </ToolContainer>
  );
}
