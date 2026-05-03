/*
 * Author: Rahul
 */

/*
 * traffic_meter.bpf.c - eBPF program to meter network traffic per UID.
 *
 * Attaches to cgroup_skb hooks (not XDP) to get socket UID access.
 * Emits per-packet events (uid, bytes, src/dst IP, direction) to user
 * space via separate IPv4/IPv6 ring buffers.
 */

#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>

/* IPv4 network + netmask pair (network byte order) for untracked filter */
struct ipv4_mask {
    __u32 net;
    __u32 mask;
};

/* IPv6 network prefix for untracked filter */
struct ipv6_mask {
    __u8 net[16];
    __u8 prefix_len; // number of leading bits in mask
};

/*
 * Example untracked_ipv4 entries:
 *   { __builtin_bswap32(0x0a000000), __builtin_bswap32(0xff000000) }, // 10.0.0.0/8
 *   { __builtin_bswap32(0xc0a80100), __builtin_bswap32(0xffffff00) }, // 192.168.1.0/24
 *
 * Example untracked_ipv6 entries:
 *   2001:db8::/32 -> net = {0x20,0x01,0x0d,0xb8,...}, prefix_len = 32
 *
 * Use ipmask_tool to generate untracked_masks.h from CIDR notation.
 */
#include "untracked_masks.h"

/* Returns 1 if ip matches any entry in untracked_ipv4 */
static __always_inline int ipv4_is_untracked(__u32 ip) {
    #pragma unroll
    for (int i = 0; i != untracked_ipv4_cnt; i++) {
        if ((ip & untracked_ipv4[i].mask) == untracked_ipv4[i].net)
            return 1;
    }
    return 0;
}

/* Returns 1 if ip matches any entry in untracked_ipv6 */
static __always_inline int ipv6_is_untracked(const __u8 ip[16]) {
    #pragma unroll
    for (int i = 0; i != untracked_ipv6_cnt; i++) {
        const struct ipv6_mask *m = &untracked_ipv6[i];
        int full_bytes = m->prefix_len / 8;
        int remaining_bits = m->prefix_len % 8;
        int match = 1;
        for (int b = 0; b < full_bytes; b++) {
            if (ip[b] != m->net[b]) { match = 0; break; }
        }
        if (match && remaining_bits) {
            __u8 mask = (__u8)(0xFF << (8 - remaining_bits));
            if ((ip[full_bytes] & mask) != (m->net[full_bytes] & mask))
                match = 0;
        }
        if (match) return 1;
    }
    return 0;
}

struct traffic_event {
    __u32 uid;
    __u32 bytes;
    __u32 src_ip;    /* network byte order */
    __u32 dst_ip;    /* network byte order */
    __u8 direction;  /* 0 = ingress, 1 = egress */
};

struct traffic_event_v6 {
    __u32 uid;
    __u32 bytes;
    __u8 src_ip[16];
    __u8 dst_ip[16];
    __u8 direction;  /* 0 = ingress, 1 = egress */
};

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024);
} events SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024);
} events_v6 SEC(".maps");

SEC("cgroup_skb/egress")
int traffic_meter_egress(struct __sk_buff *skb)
{
    __u8 ip_ver = 0;
    bpf_skb_load_bytes(skb, 0, &ip_ver, 1);
    if ((ip_ver >> 4) != 4)
        return 1;

    struct traffic_event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e)
        return 1;

    e->uid = bpf_get_socket_uid(skb);
    e->bytes = skb->len;
    e->direction = 1;
    /* IPv4 header: src @ offset 12, dst @ offset 16 */
    bpf_skb_load_bytes(skb, 12, &e->src_ip, 4);
    bpf_skb_load_bytes(skb, 16, &e->dst_ip, 4);

    if (ipv4_is_untracked(e->src_ip) && ipv4_is_untracked(e->dst_ip)) {
        bpf_ringbuf_discard(e, 0);
        return 1;
    }

    bpf_ringbuf_submit(e, 0);
    return 1;
}

SEC("cgroup_skb/ingress")
int traffic_meter_ingress(struct __sk_buff *skb)
{
    __u8 ip_ver = 0;
    bpf_skb_load_bytes(skb, 0, &ip_ver, 1);
    if ((ip_ver >> 4) != 4)
        return 1;

    struct traffic_event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e)
        return 1;

    e->uid = bpf_get_socket_uid(skb);
    e->bytes = skb->len;
    e->direction = 0;
    /* IPv4 header: src @ offset 12, dst @ offset 16 */
    bpf_skb_load_bytes(skb, 12, &e->src_ip, 4);
    bpf_skb_load_bytes(skb, 16, &e->dst_ip, 4);

    if (ipv4_is_untracked(e->src_ip) && ipv4_is_untracked(e->dst_ip)) {
        bpf_ringbuf_discard(e, 0);
        return 1;
    }

    bpf_ringbuf_submit(e, 0);
    return 1;
}

SEC("cgroup_skb/egress")
int traffic_meter_egress_v6(struct __sk_buff *skb)
{
    __u8 ip_ver = 0;
    bpf_skb_load_bytes(skb, 0, &ip_ver, 1);
    if ((ip_ver >> 4) != 6)
        return 1;

    struct traffic_event_v6 *e = bpf_ringbuf_reserve(&events_v6, sizeof(*e), 0);
    if (!e)
        return 1;

    e->uid = bpf_get_socket_uid(skb);
    e->bytes = skb->len;
    e->direction = 1;
    /* IPv6 header: src @ offset 8, dst @ offset 24 */
    bpf_skb_load_bytes(skb, 8, &e->src_ip, 16);
    bpf_skb_load_bytes(skb, 24, &e->dst_ip, 16);

    if (ipv6_is_untracked(e->src_ip) && ipv6_is_untracked(e->dst_ip)) {
        bpf_ringbuf_discard(e, 0);
        return 1;
    }

    bpf_ringbuf_submit(e, 0);
    return 1;
}

SEC("cgroup_skb/ingress")
int traffic_meter_ingress_v6(struct __sk_buff *skb)
{
    __u8 ip_ver = 0;
    bpf_skb_load_bytes(skb, 0, &ip_ver, 1);
    if ((ip_ver >> 4) != 6)
        return 1;

    struct traffic_event_v6 *e = bpf_ringbuf_reserve(&events_v6, sizeof(*e), 0);
    if (!e)
        return 1;

    e->uid = bpf_get_socket_uid(skb);
    e->bytes = skb->len;
    e->direction = 0;
    /* IPv6 header: src @ offset 8, dst @ offset 24 */
    bpf_skb_load_bytes(skb, 8, &e->src_ip, 16);
    bpf_skb_load_bytes(skb, 24, &e->dst_ip, 16);

    if (ipv6_is_untracked(e->src_ip) && ipv6_is_untracked(e->dst_ip)) {
        bpf_ringbuf_discard(e, 0);
        return 1;
    }

    bpf_ringbuf_submit(e, 0);
    return 1;
}

/* GPL required for bpf_get_socket_uid and other GPL-only helpers */
char _license[] SEC("license") = "GPL";