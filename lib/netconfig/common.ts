import type { ParsedDevice } from "./types";

/** Best-effort management address: mgmt port, then loopback, then SVI, then any. */
export function pickMgmtIp(d: ParsedDevice): string {
  const withIp = d.interfaces.filter((i) => i.ips.length && i.enabled);
  const mgmt = withIp.find((i) => i.kind === "mgmt" || /^(mgmt|management|fxp0|me0|em0|oob)/i.test(i.name));
  const loop = withIp.find((i) => i.kind === "loopback");
  const svi = withIp.find((i) => i.kind === "vlan");
  const pick = mgmt ?? loop ?? svi ?? withIp[0];
  return pick ? pick.ips[0].address : "";
}

/** Optional "# Model: x" / "! Device: x" annotation some exports carry. */
export function commentModel(text: string): string {
  const m = /^\s*(?:#|##|!|\/\*)+\s*(?:Device|Model)\s*:\s*(.+?)\s*(?:\*\/)?\s*$/im.exec(text);
  return m ? m[1] : "";
}
