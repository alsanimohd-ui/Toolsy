import { describe, it, expect } from "vitest";
import { buildMap, detectVendor, groupPorts, parseConfig } from "@/lib/netconfig";
import {
  CISCO_SAMPLE,
  FORTINET_SAMPLE,
  JUNIPER_SAMPLE,
  JUNIPER_SWITCH_SAMPLE,
  PALOALTO_SAMPLE,
} from "@/lib/netconfig/samples";
import { expandVlanList, maskToPrefix, networkOf } from "@/lib/netconfig/util";

describe("util", () => {
  it("converts masks and networks", () => {
    expect(maskToPrefix("255.255.255.0")).toBe(24);
    expect(maskToPrefix("255.0.255.0")).toBe(-1);
    expect(networkOf("10.1.2.77", 24)).toBe("10.1.2.0/24");
    expect(networkOf("10.1.2.77", 0)).toBe("0.0.0.0/0");
  });
  it("expands vlan lists", () => {
    expect(expandVlanList("10,20-22")).toEqual([10, 20, 21, 22]);
  });
});

describe("detectVendor", () => {
  it("recognises each vendor", () => {
    expect(detectVendor(CISCO_SAMPLE)).toBe("cisco");
    expect(detectVendor(FORTINET_SAMPLE)).toBe("fortinet");
    expect(detectVendor(JUNIPER_SAMPLE)).toBe("juniper");
    expect(detectVendor(JUNIPER_SWITCH_SAMPLE)).toBe("juniper");
    expect(detectVendor(PALOALTO_SAMPLE)).toBe("paloalto");
    expect(detectVendor('<?xml version="1.0"?><config version="10.1.0"><devices/></config>')).toBe("paloalto");
    expect(detectVendor("hello world")).toBe("unknown");
  });
});

describe("cisco", () => {
  const d = parseConfig(CISCO_SAMPLE);
  it("reads identity", () => {
    expect(d.hostname).toBe("core-sw01");
    expect(d.model).toBe("Catalyst 9300-48P");
    expect(d.osVersion).toBe("IOS-XE 17.6.4");
    expect(d.role).toBe("switch");
  });
  it("reads vlans, svis and port modes", () => {
    expect(d.vlans.map((v) => v.id)).toEqual([10, 20, 30, 99]);
    expect(d.vlans[0].name).toBe("Users");
    const svi = d.interfaces.find((i) => i.name === "Vlan10")!;
    expect(svi.kind).toBe("vlan");
    expect(svi.vlan).toBe(10);
    expect(svi.ips).toEqual([{ address: "10.10.10.1", prefix: 24 }]);
    const trunk = d.interfaces.find((i) => i.name === "Port-channel1")!;
    expect(trunk.trunkVlans).toEqual([10, 20, 30, 99]);
    expect(d.interfaces.find((i) => i.name === "GigabitEthernet1/0/47")!.lag).toBe("Port-channel1");
    expect(d.interfaces.find((i) => i.name === "GigabitEthernet1/0/6")!.enabled).toBe(false);
  });
  it("reads routes, protocols and neighbors", () => {
    expect(d.routes).toContainEqual(expect.objectContaining({ destination: "0.0.0.0/0", nextHop: "10.10.99.1" }));
    expect(d.routes).toContainEqual(expect.objectContaining({ destination: "172.16.0.0/16" }));
    expect(d.protocols).toEqual(["OSPF 1", "BGP 65010"]);
    expect(d.neighbors).toEqual([{ protocol: "BGP", address: "10.10.99.1", remoteAs: "65000" }]);
  });
  it("treats the vrf mgmt port as management", () => {
    expect(d.interfaces.find((i) => i.name === "GigabitEthernet0/0")!.kind).toBe("mgmt");
    expect(d.mgmtIp).toBe("192.168.100.11");
  });
});

describe("fortinet", () => {
  const d = parseConfig(FORTINET_SAMPLE);
  it("reads identity", () => {
    expect(d.hostname).toBe("edge-fw01");
    expect(d.model).toBe("FGT60F");
    expect(d.osVersion).toBe("7.2.5");
    expect(d.role).toBe("firewall");
  });
  it("reads interfaces and zones", () => {
    const wan2 = d.interfaces.find((i) => i.name === "wan2")!;
    expect(wan2.enabled).toBe(false);
    expect(wan2.ips[0]).toEqual({ address: "198.51.100.2", prefix: 30 });
    const v = d.interfaces.find((i) => i.name === "vlan100")!;
    expect(v.vlan).toBe(100);
    expect(v.parent).toBe("lan1");
    expect(v.zone).toBe("LAN-ZONE");
    expect(d.zones.find((z) => z.name === "WAN-ZONE")!.interfaces).toEqual(["wan1", "wan2"]);
  });
  it("reads routes, bgp, vpn and policies", () => {
    expect(d.routes).toHaveLength(3);
    expect(d.routes[2]).toMatchObject({ destination: "192.168.50.0/24", nextHop: "10.1.0.254", iface: "lan1" });
    expect(d.protocols).toEqual(["BGP 65020"]);
    expect(d.neighbors[0]).toMatchObject({ address: "203.0.113.1", remoteAs: "64500" });
    expect(d.vpns[0]).toEqual({ name: "to-branch", remote: "198.51.100.77", iface: "wan1" });
    expect(d.policies).toHaveLength(2);
    expect(d.policies[0]).toMatchObject({ name: "LAN-to-Internet", action: "accept", from: ["LAN-ZONE"], to: ["WAN-ZONE"] });
    expect(d.policies[1].action).toBe("deny");
  });
});

describe("juniper", () => {
  it("parses an SRX in set format", () => {
    const d = parseConfig(JUNIPER_SAMPLE);
    expect(d.hostname).toBe("srx-edge01");
    expect(d.osVersion).toBe("21.4R3-S2");
    expect(d.role).toBe("firewall");
    const ge0 = d.interfaces.find((i) => i.name === "ge-0/0/0")!;
    expect(ge0.ips[0]).toEqual({ address: "203.0.113.10", prefix: 29 });
    expect(ge0.zone).toBe("untrust");
    expect(d.interfaces.find((i) => i.name === "ge-0/0/3")!.enabled).toBe(false);
    expect(d.interfaces.find((i) => i.name === "lo0.0")!.kind).toBe("loopback");
    expect(d.interfaces.find((i) => i.name === "fxp0.0")!.kind).toBe("mgmt");
    expect(d.mgmtIp).toBe("192.168.1.10");
    expect(d.routes[0]).toMatchObject({ destination: "0.0.0.0/0", nextHop: "203.0.113.9" });
    expect(d.protocols).toEqual(["OSPF", "BGP 65030"]);
    expect(d.neighbors[0]).toEqual({ protocol: "BGP", address: "203.0.113.9", remoteAs: "64501" });
    expect(d.vpns[0]).toEqual({ name: "branch-gw", remote: "198.51.100.50", iface: "ge-0/0/0.0" });
    expect(d.policies.map((p) => [p.name, p.action])).toEqual([
      ["allow-out", "permit"],
      ["deny-in", "deny"],
    ]);
    expect(d.zones.find((z) => z.name === "trust")!.interfaces).toEqual(["ge-0/0/1.0", "ge-0/0/2.0"]);
  });
  it("parses an EX in curly format with interface-range and lists", () => {
    const d = parseConfig(JUNIPER_SWITCH_SAMPLE);
    expect(d.hostname).toBe("ex-access01");
    expect(d.role).toBe("switch");
    expect(d.vlans).toEqual([
      { id: 10, name: "users" },
      { id: 20, name: "voip" },
    ]);
    const ports = d.interfaces.filter((i) => i.mode === "access");
    expect(ports.map((p) => p.name)).toEqual(["ge-0/0/0", "ge-0/0/1", "ge-0/0/2", "ge-0/0/3"]);
    expect(ports.every((p) => p.vlan === 10)).toBe(true);
    const up = d.interfaces.find((i) => i.name === "ge-0/0/10")!;
    expect(up.mode).toBe("trunk");
    expect(up.trunkVlans).toEqual([10, 20]);
    const irb = d.interfaces.find((i) => i.name === "irb.10")!;
    expect(irb.vlan).toBe(10);
    expect(irb.ips[0].address).toBe("10.50.10.1");
  });
});

describe("palo alto", () => {
  it("parses set format", () => {
    const d = parseConfig(PALOALTO_SAMPLE);
    expect(d.hostname).toBe("pa-edge01");
    expect(d.mgmtIp).toBe("192.168.1.5");
    expect(d.role).toBe("firewall");
    const e1 = d.interfaces.find((i) => i.name === "ethernet1/1")!;
    expect(e1.ips[0]).toEqual({ address: "203.0.113.20", prefix: 28 });
    expect(e1.description).toBe("Internet");
    expect(e1.zone).toBe("untrust");
    const sub = d.interfaces.find((i) => i.name === "ethernet1/3.100")!;
    expect(sub).toMatchObject({ kind: "subinterface", vlan: 100, parent: "ethernet1/3", zone: "trust" });
    expect(d.interfaces.find((i) => i.name === "loopback.1")!.kind).toBe("loopback");
    expect(d.interfaces.find((i) => i.name === "tunnel.1")!.zone).toBe("vpn");
    expect(d.zones.find((z) => z.name === "trust")!.interfaces).toHaveLength(3);
    expect(d.routes).toContainEqual(
      expect.objectContaining({ destination: "0.0.0.0/0", nextHop: "203.0.113.17", iface: "ethernet1/1" }),
    );
    expect(d.protocols).toEqual(["BGP"]);
    expect(d.neighbors[0]).toEqual({ protocol: "BGP", address: "203.0.113.17", remoteAs: "64502" });
    expect(d.vpns[0]).toEqual({ name: "branch-gw", remote: "198.51.100.60", iface: "ethernet1/1" });
    expect(d.policies).toHaveLength(2);
    expect(d.policies[0]).toMatchObject({ name: "Allow-Out", action: "allow", from: ["trust"], to: ["untrust"] });
  });

  it("parses the XML export", () => {
    const xml = `<?xml version="1.0"?>
<config version="10.2.0" urldb="paloaltonetworks">
 <devices><entry name="localhost.localdomain">
  <deviceconfig><system><hostname>pa-xml</hostname><ip-address>10.9.9.9</ip-address></system></deviceconfig>
  <network><interface><ethernet>
    <entry name="ethernet1/1"><layer3><ip><entry name="10.1.1.1/24"/></ip></layer3><comment>LAN</comment></entry>
  </ethernet></interface></network>
  <vsys><entry name="vsys1">
    <zone><entry name="trust"><network><layer3><member>ethernet1/1</member></layer3></network></entry></zone>
    <rulebase><security><rules><entry name="r1"><from><member>trust</member></from><to><member>any</member></to>
      <source><member>any</member></source><destination><member>any</member></destination>
      <application><member>any</member></application><action>allow</action></entry></rules></security></rulebase>
  </entry></vsys>
 </entry></devices>
</config>`;
    const d = parseConfig(xml);
    expect(d.vendor).toBe("paloalto");
    expect(d.osVersion).toBe("10.2.0");
    expect(d.hostname).toBe("pa-xml");
    expect(d.interfaces[0]).toMatchObject({ name: "ethernet1/1", description: "LAN", zone: "trust" });
    expect(d.interfaces[0].ips[0]).toEqual({ address: "10.1.1.1", prefix: 24 });
    expect(d.policies[0]).toMatchObject({ name: "r1", action: "allow", from: ["trust"] });
  });
});

describe("groupPorts", () => {
  it("collapses runs with the same config", () => {
    const d = parseConfig(CISCO_SAMPLE);
    const groups = groupPorts(d.interfaces.filter((i) => i.kind === "physical"));
    const g = groups.find((x) => x.names[0] === "GigabitEthernet1/0/1")!;
    expect(g.names).toHaveLength(3);
    expect(g.label).toBe("GigabitEthernet1/0/1–3");
    expect(groups.find((x) => x.names[0] === "GigabitEthernet1/0/4")!.names).toHaveLength(2);
    expect(groups.find((x) => x.names[0] === "GigabitEthernet1/0/6")!.names).toHaveLength(1);
  });
});

describe("buildMap", () => {
  it("builds zone cards for a firewall", () => {
    const m = buildMap(parseConfig(FORTINET_SAMPLE));
    expect(m.segments.map((s) => s.title)).toEqual(["LAN-ZONE", "WAN-ZONE"]);
    expect(m.peers.some((p) => p.kind === "next-hop" && p.title === "Next hop 203.0.113.1")).toBe(true);
    expect(m.peers.some((p) => p.kind === "vpn")).toBe(true);
    expect(m.peers.some((p) => p.kind === "bgp")).toBe(true);
  });
  it("builds vlan cards and trunks for a switch", () => {
    const m = buildMap(parseConfig(CISCO_SAMPLE));
    const v10 = m.segments.find((s) => s.id === "vlan:10")!;
    expect(v10.rows.map((r) => r.text)).toContain("3 access ports");
    expect(m.peers.some((p) => p.kind === "trunk" && p.title === "Port-channel1")).toBe(true);
    expect(m.peers.some((p) => p.title.startsWith("GigabitEthernet1/0/47"))).toBe(false);
  });
});
