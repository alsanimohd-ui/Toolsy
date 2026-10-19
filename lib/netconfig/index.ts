import { parseCisco } from "./cisco";
import { flattenCurly, flattenSetLines, flattenXml } from "./flatten";
import { parseFortinet } from "./fortinet";
import { parseJunos } from "./junos";
import { parsePaloAlto } from "./paloalto";
import { emptyDevice, type ParsedDevice, type Vendor } from "./types";

export * from "./types";
export { buildMap, groupPorts } from "./map";
export type { MapModel, MapSegment, MapPeer, PortGroup } from "./map";

export function detectVendor(text: string): Vendor {
  const head = text.slice(0, 200_000);
  if (/^\s*<\?xml|^\s*<config[\s>]/i.test(head) && /<(devices|deviceconfig|network|vsys)\b/.test(head)) return "paloalto";
  if (/^#config-version=FG|^config system (global|interface)\b/m.test(head)) return "fortinet";

  const setLines = head.match(/^set\s+\S+/gm) ?? [];
  if (setLines.length) {
    const pan = setLines.filter((l) => /^set\s+(deviceconfig|network|rulebase|zone|vsys|mgt-config|shared|address|service)$/.test(l.trim())).length;
    const jun = setLines.filter((l) => /^set\s+(interfaces|system|protocols|routing-options|security|vlans|routing-instances|firewall|policy-options|chassis|version)$/.test(l.trim())).length;
    if (pan > jun) return "paloalto";
    if (jun > 0) return "juniper";
  }
  if (/^\s*(deviceconfig|mgt-config|rulebase)\s*\{/m.test(head) || /^\s*config\s*\{[\s\S]*?\bdevices\s*\{/m.test(head)) return "paloalto";
  if (/^\s*(system|interfaces|protocols|routing-options|security|vlans|chassis)\s*\{/m.test(head) && /;\s*$/m.test(head)) return "juniper";

  if (/^(interface\s+\S+|hostname\s+\S+|switchname\s+\S+|vlan\s+\d+|router\s+(ospf|bgp|eigrp)|ip route\s)/im.test(head)) return "cisco";
  return "unknown";
}

export function parseConfig(text: string, forceVendor?: Vendor): ParsedDevice {
  const vendor = forceVendor && forceVendor !== "unknown" ? forceVendor : detectVendor(text);
  switch (vendor) {
    case "cisco":
      return parseCisco(text);
    case "fortinet":
      return parseFortinet(text);
    case "juniper": {
      const paths = /^\s*set\s/m.test(text) ? flattenSetLines(text) : flattenCurly(text);
      return parseJunos(paths, text);
    }
    case "paloalto": {
      if (/^\s*<\?xml|^\s*<config[\s>]/i.test(text)) {
        const { paths, rootAttrs } = flattenXml(text);
        return parsePaloAlto(paths, text, rootAttrs);
      }
      const paths = /^\s*set\s/m.test(text) ? flattenSetLines(text) : flattenCurly(text);
      return parsePaloAlto(paths, text);
    }
    default: {
      const d = emptyDevice("unknown");
      d.warnings.push("The vendor could not be detected. Pick one from the list, or check that this is a running-config.");
      return d;
    }
  }
}
