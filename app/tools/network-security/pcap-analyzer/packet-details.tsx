"use client";

import React, { useMemo, useState } from "react";
import { Download, Filter, GitMerge } from "lucide-react";
import { describePacket, type Packet } from "@/lib/pcap";
import { ToolButton } from "@/components/tools";
import { downloadBlob } from "./format";

const HEX_LIMIT = 2048;

function HexDump({ data }: { data: Uint8Array }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? data.length : Math.min(data.length, HEX_LIMIT);

  const rows = useMemo(() => {
    const out: { offset: string; hex: string; ascii: string }[] = [];
    for (let i = 0; i < shown; i += 16) {
      const chunk = data.subarray(i, Math.min(i + 16, shown));
      let hex = "";
      let ascii = "";
      for (let j = 0; j < 16; j++) {
        if (j < chunk.length) {
          hex += chunk[j].toString(16).padStart(2, "0") + " ";
          ascii += chunk[j] >= 32 && chunk[j] < 127 ? String.fromCharCode(chunk[j]) : ".";
        } else hex += "   ";
        if (j === 7) hex += " ";
      }
      out.push({ offset: i.toString(16).padStart(4, "0"), hex, ascii });
    }
    return out;
  }, [data, shown]);

  return (
    <div className="flex flex-col gap-2">
      <pre className="overflow-x-auto font-mono text-xs leading-5 text-foreground">
        {rows.map((r) => (
          <div key={r.offset} className="whitespace-pre">
            <span className="text-muted">{r.offset}</span>
            {"  "}
            {r.hex}
            {" "}
            <span className="text-accent">{r.ascii}</span>
          </div>
        ))}
      </pre>
      {data.length > HEX_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="self-start text-xs text-accent hover:underline"
        >
          {showAll ? `Show first ${HEX_LIMIT} bytes` : `Show all ${data.length.toLocaleString()} bytes`}
        </button>
      )}
    </div>
  );
}

interface PacketDetailsProps {
  packet: Packet | null;
  onFilter: (query: string) => void;
  onFollow: (streamId: number) => void;
}

export default function PacketDetails({ packet, onFilter, onFollow }: PacketDetailsProps) {
  const layers = useMemo(() => (packet ? describePacket(packet) : []), [packet]);

  if (!packet) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted">
        Select a packet to see its layers and raw bytes. Arrow keys move through the list.
      </div>
    );
  }

  const isIp = packet.l3 === "IPv4" || packet.l3 === "IPv6";

  return (
    <div className="rounded-xl border border-border bg-[var(--card-bg)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="mr-auto text-sm font-semibold">Packet {packet.id}</h2>
        {isIp && (
          <>
            <ToolButton size="sm" variant="secondary" iconLeft={<Filter className="size-3.5" />} onClick={() => onFilter(`src:${packet.src}`)}>
              Source
            </ToolButton>
            <ToolButton size="sm" variant="secondary" iconLeft={<Filter className="size-3.5" />} onClick={() => onFilter(`dst:${packet.dst}`)}>
              Destination
            </ToolButton>
          </>
        )}
        {packet.streamId !== undefined && (
          <>
            <ToolButton size="sm" variant="secondary" iconLeft={<Filter className="size-3.5" />} onClick={() => onFilter(`stream:${packet.streamId}`)}>
              This stream
            </ToolButton>
            {packet.transport === "TCP" && (
              <ToolButton size="sm" variant="secondary" iconLeft={<GitMerge className="size-3.5" />} onClick={() => onFollow(packet.streamId!)}>
                Follow stream
              </ToolButton>
            )}
          </>
        )}
        <ToolButton
          size="sm"
          variant="ghost"
          iconLeft={<Download className="size-3.5" />}
          onClick={() => downloadBlob(packet.data as BlobPart, `packet-${packet.id}.bin`, "application/octet-stream")}
        >
          Raw bytes
        </ToolButton>
      </div>

      <div className="grid gap-px bg-border lg:grid-cols-[2fr_3fr]">
        <div className="max-h-[360px] overflow-y-auto bg-[var(--card-bg)] p-4">
          <div className="flex flex-col gap-3">
            {layers.map((layer, i) => (
              <details key={layer.name + i} open={i > 0}>
                <summary className="cursor-pointer select-none text-sm font-medium marker:text-muted">{layer.name}</summary>
                <dl className="mt-2 flex flex-col gap-1 border-l border-border pl-4">
                  {layer.fields.map((f, fi) => (
                    <div key={fi} className="flex gap-3 text-xs">
                      <dt className="w-32 shrink-0 text-muted">{f.name}</dt>
                      <dd className="min-w-0 break-all font-mono">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
          </div>
        </div>
        <div className="max-h-[360px] overflow-auto bg-[var(--card-bg)] p-4">
          <HexDump data={packet.data} />
        </div>
      </div>
    </div>
  );
}
