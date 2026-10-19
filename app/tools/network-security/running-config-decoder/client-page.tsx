"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileUp, Trash2 } from "lucide-react";
import { ToolButton, ToolContainer, ToolHeader, ToolSection, ToolTextarea } from "@/components/tools";
import {
  VENDOR_LABEL,
  buildMap,
  groupPorts,
  parseConfig,
  type Iface,
  type ParsedDevice,
  type Vendor,
} from "@/lib/netconfig";
import { SAMPLES } from "@/lib/netconfig/samples";
import { fmtIp } from "@/lib/netconfig/util";
import TopoMap from "./TopoMap";

type TabId = "map" | "interfaces" | "vlans" | "zones" | "routes" | "policies" | "routing";

const MAX_FILE = 10 * 1024 * 1024;
const ROW_CAP = 400;

const ROLE_LABEL: Record<ParsedDevice["role"], string> = {
  firewall: "Firewall",
  switch: "Switch",
  router: "Router",
  unknown: "Unknown",
};

function vlanText(f: { mode: Iface["mode"]; vlan?: number; trunkVlans?: number[] | "all"; nativeVlan?: number }): string {
  if (f.mode === "trunk") {
    const list = f.trunkVlans === "all" || !f.trunkVlans ? "all" : f.trunkVlans.join(", ");
    return f.nativeVlan ? `${list} (native ${f.nativeVlan})` : list;
  }
  return f.vlan ? String(f.vlan) : "";
}

const th = "text-left text-[11px] font-semibold uppercase tracking-wider text-muted py-2 pr-4 whitespace-nowrap";
const td = "py-2 pr-4 align-top text-sm";

function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            {head.map((h) => (
              <th key={h} className={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-border-subtle">{children}</tbody>
      </table>
      {empty && <p className="py-6 text-center text-sm text-muted">Nothing matches.</p>}
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[13px]">{children}</span>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-block rounded-md border border-border px-1.5 py-0.5 text-xs text-muted">{children}</span>;
}

export default function TopoMapClient() {
  const [text, setText] = useState("");
  const [vendor, setVendor] = useState<Vendor | "auto">("auto");
  const [fileName, setFileName] = useState("");
  const [tab, setTab] = useState<TabId>("map");
  const [query, setQuery] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const deferred = useDeferredValue(text);
  const device = useMemo<ParsedDevice | null>(
    () => (deferred.trim() ? parseConfig(deferred, vendor === "auto" ? undefined : vendor) : null),
    [deferred, vendor],
  );
  const model = useMemo(() => (device ? buildMap(device) : null), [device]);

  const loadFile = async (file: File) => {
    if (file.size > MAX_FILE) {
      setError("That file is larger than 10 MB. Paste only the part you need.");
      return;
    }
    setError("");
    setFileName(file.name.replace(/\.[^.]+$/, ""));
    setText(await file.text());
    setVendor("auto");
    setTab("map");
  };

  const tabs = useMemo(() => {
    if (!device) return [] as { id: TabId; label: string; count?: number }[];
    const t: { id: TabId; label: string; count?: number }[] = [
      { id: "map", label: "Map" },
      { id: "interfaces", label: "Interfaces", count: device.interfaces.length },
    ];
    if (device.vlans.length) t.push({ id: "vlans", label: "VLANs", count: device.vlans.length });
    if (device.zones.length) t.push({ id: "zones", label: "Zones", count: device.zones.length });
    if (device.routes.length) t.push({ id: "routes", label: "Routes", count: device.routes.length });
    if (device.policies.length) t.push({ id: "policies", label: "Policies", count: device.policies.length });
    if (device.protocols.length || device.neighbors.length || device.vpns.length) t.push({ id: "routing", label: "Routing & VPN" });
    return t;
  }, [device]);

  const activeTab: TabId = tabs.some((t) => t.id === tab) ? tab : "map";
  const q = query.trim().toLowerCase();
  const match = (...parts: (string | number | undefined)[]) => !q || parts.some((p) => String(p ?? "").toLowerCase().includes(q));

  const exportJson = () => {
    if (!device) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(device, null, 2)], { type: "application/json" }));
    a.download = `${device.hostname || fileName || "device"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const stats = device
    ? [
        { label: "Interfaces", value: `${device.interfaces.filter((i) => i.enabled).length} / ${device.interfaces.length}`, hint: "enabled / total" },
        device.vlans.length ? { label: "VLANs", value: String(device.vlans.length) } : null,
        device.zones.length ? { label: "Zones", value: String(device.zones.length) } : null,
        { label: "Routes", value: String(device.routes.length) },
        device.policies.length ? { label: "Policies", value: String(device.policies.length) } : null,
        device.vpns.length ? { label: "VPN tunnels", value: String(device.vpns.length) } : null,
      ].filter((s): s is { label: string; value: string; hint?: string } => !!s)
    : [];

  /* ------------------------------- tab bodies ------------------------------- */

  const interfacesBody = (() => {
    if (!device) return null;
    const list = device.interfaces.filter((f) => match(f.name, f.description, f.zone, f.lag, f.vrf, f.vlan, f.ips.map(fmtIp).join(" ")));
    const rows = grouped
      ? groupPorts(list)
      : list.map((f) => ({ ...groupPorts([f])[0] }));
    const shown = rows.slice(0, ROW_CAP);
    return (
      <>
        <Table head={["Interface", "Description", "Mode", "VLAN", "IP address", "Zone / LAG", "State"]} empty={!rows.length}>
          {shown.map((g) => (
            <tr key={g.names[0]}>
              <td className={td}>
                <Mono>{g.label}</Mono>
                {g.names.length > 1 && <span className="ml-2 text-xs text-muted">{g.names.length} ports</span>}
              </td>
              <td className={`${td} text-muted`}>{g.description}</td>
              <td className={td}>{g.mode === "unknown" ? <span className="text-muted">–</span> : g.mode}</td>
              <td className={td}><Mono>{vlanText(g)}</Mono></td>
              <td className={td}><Mono>{g.ips.join(", ")}</Mono></td>
              <td className={`${td} text-muted`}>{[g.zone, g.lag && `in ${g.lag}`].filter(Boolean).join(" · ")}</td>
              <td className={td}>{g.enabled ? <span className="text-accent">Enabled</span> : <span className="text-muted">Shut down</span>}</td>
            </tr>
          ))}
        </Table>
        {rows.length > ROW_CAP && <p className="text-xs text-muted">Showing the first {ROW_CAP} of {rows.length} rows. Use the search box to narrow it down.</p>}
      </>
    );
  })();

  const vlansBody = device && (
    <Table head={["VLAN", "Name", "Gateway (SVI)", "Access ports", "Trunk ports"]} empty={!device.vlans.some((v) => match(v.id, v.name))}>
      {device.vlans.filter((v) => match(v.id, v.name)).map((v) => {
        const svi = device.interfaces.find((i) => i.kind === "vlan" && i.vlan === v.id && i.ips.length);
        const access = device.interfaces.filter((i) => i.mode === "access" && i.vlan === v.id && !i.lag).length;
        const trunks = device.interfaces.filter((i) => i.mode === "trunk" && !i.lag && (i.trunkVlans === "all" || (i.trunkVlans ?? []).includes(v.id))).length;
        return (
          <tr key={v.id}>
            <td className={td}><Mono>{v.id}</Mono></td>
            <td className={td}>{v.name}</td>
            <td className={td}>{svi ? <Mono>{svi.ips.map(fmtIp).join(", ")}</Mono> : <span className="text-muted">–</span>}</td>
            <td className={td}>{access}</td>
            <td className={td}>{trunks}</td>
          </tr>
        );
      })}
    </Table>
  );

  const zonesBody = device && (
    <Table head={["Zone", "Interfaces"]} empty={!device.zones.some((z) => match(z.name, z.interfaces.join(" ")))}>
      {device.zones.filter((z) => match(z.name, z.interfaces.join(" "))).map((z) => (
        <tr key={z.name}>
          <td className={`${td} font-semibold`}>{z.name}</td>
          <td className={td}>
            <div className="flex flex-wrap gap-1.5">
              {z.interfaces.map((n) => {
                const f = device.interfaces.find((i) => i.name === n);
                return <Chip key={n}>{n}{f?.ips.length ? ` · ${fmtIp(f.ips[0])}` : ""}</Chip>;
              })}
              {!z.interfaces.length && <span className="text-muted">–</span>}
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );

  const routesBody = device && (
    <Table head={["Destination", "Next hop", "Interface", "Distance", "VRF"]} empty={!device.routes.some((r) => match(r.destination, r.nextHop, r.iface, r.vrf))}>
      {device.routes.filter((r) => match(r.destination, r.nextHop, r.iface, r.vrf)).slice(0, ROW_CAP).map((r, i) => (
        <tr key={i}>
          <td className={td}><Mono>{r.destination}</Mono></td>
          <td className={td}><Mono>{r.nextHop ?? "–"}</Mono></td>
          <td className={td}>{r.iface ?? <span className="text-muted">–</span>}</td>
          <td className={td}>{r.distance ?? <span className="text-muted">–</span>}</td>
          <td className={`${td} text-muted`}>{r.vrf ?? ""}</td>
        </tr>
      ))}
    </Table>
  );

  const policiesBody = device && (
    <Table head={["#", "Name", "From", "To", "Source", "Destination", "Service", "Action"]} empty={!device.policies.some((p) => match(p.name, p.from.join(" "), p.to.join(" "), p.source.join(" "), p.destination.join(" "), p.service.join(" ")))}>
      {device.policies.map((p, i) => ({ p, i })).filter(({ p }) => match(p.name, p.from.join(" "), p.to.join(" "), p.source.join(" "), p.destination.join(" "), p.service.join(" "))).slice(0, ROW_CAP).map(({ p, i }) => {
        const allow = /^(accept|allow|permit)$/i.test(p.action);
        const cell = (xs: string[]) => <span className="break-words">{xs.join(", ") || "–"}</span>;
        return (
          <tr key={i} className={p.enabled ? "" : "opacity-50"}>
            <td className={`${td} text-muted`}>{i + 1}</td>
            <td className={td}>{p.name}{!p.enabled && <span className="ml-2 text-xs text-muted">disabled</span>}</td>
            <td className={td}>{cell(p.from)}</td>
            <td className={td}>{cell(p.to)}</td>
            <td className={td}>{cell(p.source)}</td>
            <td className={td}>{cell(p.destination)}</td>
            <td className={td}>{cell(p.service)}</td>
            <td className={td}><span className={allow ? "text-accent font-semibold" : "text-muted"}>{p.action}</span></td>
          </tr>
        );
      })}
    </Table>
  );

  const routingBody = device && (
    <div className="flex flex-col gap-6">
      {device.protocols.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="toolsy-label">Routing protocols</h3>
          <div className="flex flex-wrap gap-2">{device.protocols.map((p) => <Chip key={p}>{p}</Chip>)}</div>
        </div>
      )}
      {device.neighbors.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="toolsy-label">Neighbors</h3>
          <Table head={["Protocol", "Address", "Remote AS"]}>
            {device.neighbors.map((n, i) => (
              <tr key={i}>
                <td className={td}>{n.protocol}</td>
                <td className={td}><Mono>{n.address}</Mono></td>
                <td className={td}>{n.remoteAs ?? "–"}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
      {device.vpns.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="toolsy-label">VPN tunnels</h3>
          <Table head={["Name", "Peer", "Interface"]}>
            {device.vpns.map((v, i) => (
              <tr key={i}>
                <td className={td}>{v.name}</td>
                <td className={td}><Mono>{v.remote ?? "–"}</Mono></td>
                <td className={td}>{v.iface ?? "–"}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );

  const showSearch = ["interfaces", "vlans", "zones", "routes", "policies"].includes(activeTab);

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="TopoMap"
        description="Paste or drop a config from a Cisco, Fortinet, Juniper or Palo Alto device. Mi lists its interfaces, VLANs, zones, routes and policies, and draws a map of what it connects to."
        badge="Runs in your browser"
        categoryId="network-security"
      />

      <ToolSection title="Configuration" description="Nothing is uploaded. The config is parsed on this page and never leaves your browser.">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".txt,.cfg,.conf,.config,.xml,.log,.json,text/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
              e.target.value = "";
            }}
          />
          <ToolButton variant="secondary" size="sm" iconLeft={<FileUp className="size-4" />} onClick={() => fileRef.current?.click()}>
            Open file
          </ToolButton>
          <select
            aria-label="Load a sample config"
            className="toolsy-input !w-auto !py-1.5 text-xs"
            value=""
            onChange={(e) => {
              const s = SAMPLES.find((x) => x.id === e.target.value);
              if (s) {
                setText(s.text);
                setVendor("auto");
                setFileName(s.id);
                setTab("map");
                setError("");
              }
            }}
          >
            <option value="">Load a sample…</option>
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <select
            aria-label="Vendor"
            className="toolsy-input !w-auto !py-1.5 text-xs"
            value={vendor}
            onChange={(e) => setVendor(e.target.value as Vendor | "auto")}
          >
            <option value="auto">Vendor: auto-detect</option>
            {(["cisco", "fortinet", "juniper", "paloalto"] as Vendor[]).map((v) => (
              <option key={v} value={v}>{VENDOR_LABEL[v]}</option>
            ))}
          </select>
          {text && (
            <ToolButton variant="ghost" size="sm" iconLeft={<Trash2 className="size-4" />} onClick={() => { setText(""); setFileName(""); setError(""); }}>
              Clear
            </ToolButton>
          )}
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void loadFile(f);
          }}
        >
          <ToolTextarea
            aria-label="Device configuration"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Paste a running-config here, or drop a file.\n\nCisco IOS / NX-OS · FortiOS · Junos (set or curly) · PAN-OS (set, curly or XML)"}
            spellCheck={false}
            showCount
            error={error || undefined}
            className="!min-h-[12rem]"
          />
        </div>
      </ToolSection>

      {device && model && (
        <>
          <ToolSection>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-foreground">{device.hostname || "Unnamed device"}</h2>
                <p className="text-sm text-muted">
                  {[VENDOR_LABEL[device.vendor], device.model, ROLE_LABEL[device.role], device.osVersion].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {device.mgmtIp && (
                  <div className="text-right">
                    <div className="toolsy-label">Management IP</div>
                    <Mono>{device.mgmtIp}</Mono>
                  </div>
                )}
                <ToolButton variant="secondary" size="sm" iconLeft={<Download className="size-4" />} onClick={exportJson}>JSON</ToolButton>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-surface px-4 py-3" title={s.hint}>
                  <div className="toolsy-label">{s.label}</div>
                  <div className="text-lg font-bold tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>
            {device.warnings.map((w) => (
              <div key={w} className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
                <AlertTriangle className="size-4 mt-0.5 shrink-0 text-accent" />
                {w}
              </div>
            ))}
          </ToolSection>

          <ToolSection>
            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border -mt-2">
              <div role="tablist" className="flex gap-1 overflow-x-auto">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={activeTab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                      activeTab === t.id ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    {t.label}
                    {t.count !== undefined && <span className="ml-1.5 text-xs text-muted tabular-nums">{t.count}</span>}
                  </button>
                ))}
              </div>
              {showSearch && (
                <div className="flex items-center gap-3 pb-2">
                  {activeTab === "interfaces" && (
                    <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                      <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} className="accent-[var(--accent)]" />
                      Group similar ports
                    </label>
                  )}
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    aria-label="Search"
                    className="toolsy-input !w-48 !py-1.5 text-sm"
                  />
                </div>
              )}
            </div>

            {activeTab === "map" && <TopoMap model={model} fileName={device.hostname || fileName || "topology"} />}
            {activeTab === "interfaces" && interfacesBody}
            {activeTab === "vlans" && vlansBody}
            {activeTab === "zones" && zonesBody}
            {activeTab === "routes" && routesBody}
            {activeTab === "policies" && policiesBody}
            {activeTab === "routing" && routingBody}
          </ToolSection>
        </>
      )}
    </ToolContainer>
  );
}
