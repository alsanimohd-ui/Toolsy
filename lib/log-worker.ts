import { LogStore } from "./log-store";
import { MAX_FILE_BYTES, type WorkerRequest, type WorkerResponse } from "./log-worker-protocol";

const store = new LogStore();
let loadGen = 0;
let queryGen = 0;
let version = 0;

const post = (msg: WorkerResponse) => (self as unknown as Worker).postMessage(msg);

async function finishLoad(gen: number, bytes: number): Promise<void> {
  store.end();
  post({ type: "loaded", lines: store.lineCount, bytes });
  const analysis = await store.analyze(() => gen !== loadGen);
  if (analysis && gen === loadGen) post({ type: "analysis", analysis });
}

async function loadFile(file: File): Promise<void> {
  const gen = ++loadGen;
  queryGen++;
  store.reset();
  if (file.size > MAX_FILE_BYTES) {
    post({ type: "error", message: `File is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${MAX_FILE_BYTES / 1048576} MB.` });
    return;
  }
  const reader = file.stream().getReader();
  const decoder = new TextDecoder("utf-8");
  let read = 0;
  let lastPost = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (gen !== loadGen) {
      void reader.cancel();
      return;
    }
    if (done) break;
    read += value.byteLength;
    store.push(decoder.decode(value, { stream: true }));
    const now = performance.now();
    if (now - lastPost > 100) {
      lastPost = now;
      post({ type: "progress", bytes: read, total: file.size, lines: store.lineCount });
    }
  }
  store.push(decoder.decode());
  await finishLoad(gen, file.size);
}

async function loadText(text: string): Promise<void> {
  const gen = ++loadGen;
  queryGen++;
  store.reset();
  store.push(text);
  await finishLoad(gen, text.length);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case "loadFile":
        await loadFile(msg.file);
        break;
      case "loadText":
        await loadText(msg.text);
        break;
      case "reset":
        loadGen++;
        queryGen++;
        store.reset();
        break;
      case "query": {
        const gen = ++queryGen;
        const result = await store.query(msg.filter, () => gen !== queryGen);
        if (result) {
          version++;
          post({ type: "queryResult", id: msg.id, version, result });
        }
        break;
      }
      case "rows":
        post({ type: "rows", id: msg.id, version, start: msg.start, rows: store.getRows(msg.start, msg.end) });
        break;
      case "next":
        post({ type: "next", id: msg.id, row: store.nextMatch(msg.from, msg.dir) });
        break;
      case "rowOfLine":
        post({ type: "rowOfLine", id: msg.id, row: store.rowOfLine(msg.line) });
        break;
      case "export":
        post({ type: "export", id: msg.id, blob: new Blob([store.exportText()], { type: "text/plain" }) });
        break;
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : "Worker failed" });
  }
};
