import type { Vendor } from "./types";

export const CISCO_SAMPLE = `! Device: Catalyst 9300-48P
! Software: IOS-XE 17.6.4
hostname core-sw01
!
vlan 10
 name Users
vlan 20
 name Voice
vlan 30
 name Servers
vlan 99
 name Management
!
interface Port-channel1
 description Uplink to dist-sw02
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,99
!
interface GigabitEthernet1/0/1
 description Reception PC
 switchport mode access
 switchport access vlan 10
!
interface GigabitEthernet1/0/2
 description Reception PC
 switchport mode access
 switchport access vlan 10
!
interface GigabitEthernet1/0/3
 description Reception PC
 switchport mode access
 switchport access vlan 10
!
interface GigabitEthernet1/0/4
 switchport mode access
 switchport access vlan 20
!
interface GigabitEthernet1/0/5
 switchport mode access
 switchport access vlan 20
!
interface GigabitEthernet1/0/6
 switchport mode access
 switchport access vlan 30
 shutdown
!
interface GigabitEthernet1/0/47
 description Uplink to dist-sw02 (member)
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,99
 channel-group 1 mode active
!
interface GigabitEthernet1/0/48
 description Uplink to dist-sw02 (member)
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,99
 channel-group 1 mode active
!
interface GigabitEthernet0/0
 description Out-of-band management
 vrf forwarding Mgmt-vrf
 ip address 192.168.100.11 255.255.255.0
!
interface Vlan10
 description Users gateway
 ip address 10.10.10.1 255.255.255.0
!
interface Vlan20
 ip address 10.10.20.1 255.255.255.0
!
interface Vlan30
 ip address 10.10.30.1 255.255.255.0
!
interface Vlan99
 ip address 10.10.99.2 255.255.255.0
!
interface Loopback0
 ip address 10.255.255.1 255.255.255.255
!
router ospf 1
 router-id 10.255.255.1
 network 10.10.0.0 0.0.255.255 area 0
!
router bgp 65010
 neighbor 10.10.99.1 remote-as 65000
!
ip route 0.0.0.0 0.0.0.0 10.10.99.1
ip route 172.16.0.0 255.255.0.0 10.10.99.254
ip route 172.17.0.0 255.255.0.0 10.10.99.254
end
`;

export const FORTINET_SAMPLE = `#config-version=FGT60F-7.2.5-FW-build1517-230217:opmode=0:vdom=0:user=admin
config system global
    set hostname "edge-fw01"
end
config system interface
    edit "wan1"
        set vdom "root"
        set ip 203.0.113.2 255.255.255.248
        set allowaccess ping
        set alias "ISP-A"
        set role wan
    next
    edit "wan2"
        set vdom "root"
        set ip 198.51.100.2 255.255.255.252
        set alias "ISP-B"
        set role wan
        set status down
    next
    edit "lan1"
        set vdom "root"
        set ip 10.1.0.1 255.255.255.0
        set allowaccess ping https ssh
        set role lan
    next
    edit "lan2"
        set vdom "root"
        set ip 10.2.0.1 255.255.255.0
        set role lan
    next
    edit "vlan100"
        set vdom "root"
        set ip 10.100.0.1 255.255.255.0
        set interface "lan1"
        set vlanid 100
        set alias "Guests"
    next
    edit "ssl.root"
        set vdom "root"
        set type tunnel
    next
end
config system zone
    edit "LAN-ZONE"
        set interface "lan1" "lan2" "vlan100"
    next
    edit "WAN-ZONE"
        set interface "wan1" "wan2"
    next
end
config router static
    edit 1
        set gateway 203.0.113.1
        set device "wan1"
    next
    edit 2
        set gateway 198.51.100.1
        set device "wan2"
        set distance 20
    next
    edit 3
        set dst 192.168.50.0 255.255.255.0
        set gateway 10.1.0.254
        set device "lan1"
    next
end
config router bgp
    set as 65020
    config neighbor
        edit "203.0.113.1"
            set remote-as 64500
        next
    end
end
config vpn ipsec phase1-interface
    edit "to-branch"
        set interface "wan1"
        set remote-gw 198.51.100.77
    next
end
config firewall policy
    edit 1
        set name "LAN-to-Internet"
        set srcintf "LAN-ZONE"
        set dstintf "WAN-ZONE"
        set srcaddr "all"
        set dstaddr "all"
        set action accept
        set service "ALL"
    next
    edit 2
        set name "Guests-isolated"
        set srcintf "vlan100"
        set dstintf "lan1"
        set srcaddr "all"
        set dstaddr "all"
        set service "ALL"
    next
end
`;

export const JUNIPER_SAMPLE = `set version 21.4R3-S2
set system host-name srx-edge01
set interfaces ge-0/0/0 description "Internet"
set interfaces ge-0/0/0 unit 0 family inet address 203.0.113.10/29
set interfaces ge-0/0/1 description "Servers"
set interfaces ge-0/0/1 unit 0 family inet address 10.20.0.1/24
set interfaces ge-0/0/2 description "Users"
set interfaces ge-0/0/2 unit 0 family inet address 10.30.0.1/24
set interfaces ge-0/0/3 disable
set interfaces lo0 unit 0 family inet address 10.255.0.1/32
set interfaces fxp0 unit 0 family inet address 192.168.1.10/24
set interfaces st0 unit 0 family inet address 169.254.0.1/30
set routing-options autonomous-system 65030
set routing-options static route 0.0.0.0/0 next-hop 203.0.113.9
set routing-options static route 192.168.77.0/24 next-hop 10.20.0.254
set protocols ospf area 0.0.0.0 interface ge-0/0/1.0
set protocols bgp group ISP type external
set protocols bgp group ISP peer-as 64501
set protocols bgp group ISP neighbor 203.0.113.9
set security zones security-zone untrust interfaces ge-0/0/0.0
set security zones security-zone trust interfaces ge-0/0/1.0
set security zones security-zone trust interfaces ge-0/0/2.0
set security zones security-zone vpn interfaces st0.0
set security ike gateway branch-gw address 198.51.100.50
set security ike gateway branch-gw external-interface ge-0/0/0.0
set security policies from-zone trust to-zone untrust policy allow-out match source-address any
set security policies from-zone trust to-zone untrust policy allow-out match destination-address any
set security policies from-zone trust to-zone untrust policy allow-out match application any
set security policies from-zone trust to-zone untrust policy allow-out then permit
set security policies from-zone untrust to-zone trust policy deny-in match source-address any
set security policies from-zone untrust to-zone trust policy deny-in match destination-address any
set security policies from-zone untrust to-zone trust policy deny-in match application any
set security policies from-zone untrust to-zone trust policy deny-in then deny
`;

export const JUNIPER_SWITCH_SAMPLE = `system {
    host-name ex-access01;
}
interfaces {
    interface-range USERS {
        member-range ge-0/0/0 to ge-0/0/3;
        unit 0 {
            family ethernet-switching {
                interface-mode access;
                vlan {
                    members users;
                }
            }
        }
    }
    ge-0/0/10 {
        description "Uplink to core";
        unit 0 {
            family ethernet-switching {
                interface-mode trunk;
                vlan {
                    members [ users voip ];
                }
            }
        }
    }
    irb {
        unit 10 {
            family inet {
                address 10.50.10.1/24;
            }
        }
    }
}
vlans {
    users {
        vlan-id 10;
        l3-interface irb.10;
    }
    voip {
        vlan-id 20;
    }
}
`;

export const PALOALTO_SAMPLE = `set deviceconfig system hostname pa-edge01
set deviceconfig system ip-address 192.168.1.5
set network interface ethernet ethernet1/1 layer3 ip 203.0.113.20/28
set network interface ethernet ethernet1/1 comment "Internet"
set network interface ethernet ethernet1/2 layer3 ip 10.10.0.1/24
set network interface ethernet ethernet1/2 comment "Servers"
set network interface ethernet ethernet1/3 layer3 units ethernet1/3.100 tag 100
set network interface ethernet ethernet1/3 layer3 units ethernet1/3.100 ip 10.20.0.1/24
set network interface ethernet ethernet1/3 layer3 units ethernet1/3.200 tag 200
set network interface ethernet ethernet1/3 layer3 units ethernet1/3.200 ip 10.30.0.1/24
set network interface loopback units loopback.1 ip 10.255.1.1/32
set network interface tunnel units tunnel.1 ip 169.254.10.1/30
set zone untrust network layer3 ethernet1/1
set zone trust network layer3 [ ethernet1/2 ethernet1/3.100 ethernet1/3.200 ]
set zone vpn network layer3 tunnel.1
set network virtual-router default interface [ ethernet1/1 ethernet1/2 ethernet1/3.100 ethernet1/3.200 loopback.1 tunnel.1 ]
set network virtual-router default routing-table ip static-route default destination 0.0.0.0/0
set network virtual-router default routing-table ip static-route default nexthop ip-address 203.0.113.17
set network virtual-router default routing-table ip static-route default interface ethernet1/1
set network virtual-router default routing-table ip static-route branch destination 192.168.90.0/24
set network virtual-router default routing-table ip static-route branch nexthop ip-address 169.254.10.2
set network virtual-router default protocol bgp enable yes
set network virtual-router default protocol bgp peer-group ISP peer isp1 peer-address ip 203.0.113.17
set network virtual-router default protocol bgp peer-group ISP peer isp1 peer-as 64502
set network ike gateway branch-gw peer-address ip 198.51.100.60
set network ike gateway branch-gw local-address interface ethernet1/1
set rulebase security rules Allow-Out from trust
set rulebase security rules Allow-Out to untrust
set rulebase security rules Allow-Out source any
set rulebase security rules Allow-Out destination any
set rulebase security rules Allow-Out application web-browsing
set rulebase security rules Allow-Out service application-default
set rulebase security rules Allow-Out action allow
set rulebase security rules Block-All from any
set rulebase security rules Block-All to any
set rulebase security rules Block-All source any
set rulebase security rules Block-All destination any
set rulebase security rules Block-All application any
set rulebase security rules Block-All service any
set rulebase security rules Block-All action deny
`;

export interface Sample {
  id: string;
  label: string;
  vendor: Vendor;
  text: string;
}

export const SAMPLES: Sample[] = [
  { id: "cisco", label: "Cisco switch (IOS-XE)", vendor: "cisco", text: CISCO_SAMPLE },
  { id: "fortinet", label: "FortiGate firewall", vendor: "fortinet", text: FORTINET_SAMPLE },
  { id: "juniper", label: "Juniper SRX (set)", vendor: "juniper", text: JUNIPER_SAMPLE },
  { id: "juniper-ex", label: "Juniper EX (curly)", vendor: "juniper", text: JUNIPER_SWITCH_SAMPLE },
  { id: "paloalto", label: "Palo Alto (set)", vendor: "paloalto", text: PALOALTO_SAMPLE },
];
