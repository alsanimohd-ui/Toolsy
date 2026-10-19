export type Vendor = "cisco" | "fortinet" | "juniper" | "paloalto" | "unknown";

export const VENDOR_LABEL: Record<Vendor, string> = {
  cisco: "Cisco",
  fortinet: "Fortinet",
  juniper: "Juniper",
  paloalto: "Palo Alto",
  unknown: "Unknown",
};

export type DeviceRole = "firewall" | "switch" | "router" | "unknown";

export type IfaceKind =
  | "physical"
  | "vlan"
  | "loopback"
  | "tunnel"
  | "aggregate"
  | "subinterface"
  | "mgmt";

export type IfaceMode = "access" | "trunk" | "routed" | "unknown";

export interface IpAddress {
  address: string;
  prefix: number;
}

export interface Iface {
  name: string;
  kind: IfaceKind;
  description: string;
  enabled: boolean;
  mode: IfaceMode;
  ips: IpAddress[];
  /** Access VLAN, or the VLAN an SVI / sub-interface belongs to. */
  vlan?: number;
  /** Trunk VLAN list: "all" or explicit ids. */
  trunkVlans?: number[] | "all";
  nativeVlan?: number;
  /** Aggregate (port-channel, ae, LAG) this port is a member of. */
  lag?: string;
  zone?: string;
  vrf?: string;
  speed?: string;
  /** Parent interface for sub-interfaces. */
  parent?: string;
}

export interface Vlan {
  id: number;
  name: string;
}

export interface Route {
  destination: string;
  nextHop?: string;
  iface?: string;
  distance?: number;
  vrf?: string;
}

export interface Zone {
  name: string;
  interfaces: string[];
}

export interface Policy {
  name: string;
  from: string[];
  to: string[];
  source: string[];
  destination: string[];
  service: string[];
  action: string;
  enabled: boolean;
}

export interface Neighbor {
  protocol: string;
  address: string;
  remoteAs?: string;
}

export interface VpnTunnel {
  name: string;
  remote?: string;
  iface?: string;
}

export interface ParsedDevice {
  vendor: Vendor;
  hostname: string;
  model: string;
  osVersion: string;
  role: DeviceRole;
  mgmtIp: string;
  interfaces: Iface[];
  vlans: Vlan[];
  routes: Route[];
  zones: Zone[];
  policies: Policy[];
  protocols: string[];
  neighbors: Neighbor[];
  vpns: VpnTunnel[];
  warnings: string[];
}

export function emptyDevice(vendor: Vendor): ParsedDevice {
  return {
    vendor,
    hostname: "",
    model: "",
    osVersion: "",
    role: "unknown",
    mgmtIp: "",
    interfaces: [],
    vlans: [],
    routes: [],
    zones: [],
    policies: [],
    protocols: [],
    neighbors: [],
    vpns: [],
    warnings: [],
  };
}

export function newIface(name: string, kind: IfaceKind = "physical"): Iface {
  return { name, kind, description: "", enabled: true, mode: "unknown", ips: [] };
}
