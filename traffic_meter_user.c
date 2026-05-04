/* Author: Shivammall01 */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <signal.h>
#include <errno.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <string.h>
#include <arpa/inet.h>
#include <time.h>

#include <bpf/libbpf.h>
#include <bpf/bpf.h>

struct traffic_event {
    __u32 uid;
    __u32 bytes;
    __u32 src_ip;
    __u32 dst_ip;
    __u8 direction;
};

struct traffic_event_v6 {
    __u32 uid;
    __u32 bytes;
    __u8 src_ip[16];
    __u8 dst_ip[16];
    __u8 direction;
};

struct traffic_record {
    __u32 uid;
    __u32 bytes;
    char src_ip[INET6_ADDRSTRLEN];
    char dst_ip[INET6_ADDRSTRLEN];
    __u8 direction;
    struct timespec timestamp;
    __u64 total_in;
    __u64 total_out;
};

struct output_backend {
    int (*init)(void *config);
    int (*write)(const struct traffic_record *rec);
    void (*close)(void);
};

struct uid_stats {
    __u32 uid;
    __u64 total_in;
    __u64 total_out;
    struct uid_stats *next;
};

#define HASH_SIZE 1024

static struct uid_stats *uid_hash[HASH_SIZE];
static volatile int exiting = 0;
static const char *g_nic_id = "unknown";

static int file_init(void *config)
{
    (void)config;
    return 0;
}

static int file_write(const struct traffic_record *rec)
{
    char filename[256];
    snprintf(filename, sizeof(filename), "/tmp/traffic_user_%s_%u.log",
             g_nic_id, rec->uid);

    FILE *f = fopen(filename, "a");
    if (!f)
        return -1;

    fprintf(f, "%s,%u,%s,%s,%ld.%09ld,%llu,%llu\n",
            rec->direction ? "out" : "in",
            rec->bytes,
            rec->src_ip, rec->dst_ip,
            rec->timestamp.tv_sec, rec->timestamp.tv_nsec,
            (unsigned long long)rec->total_in,
            (unsigned long long)rec->total_out);

    fclose(f);
    return 0;
}

static void file_close(void)
{
}

static struct output_backend file_backend = {
    .init = file_init,
    .write = file_write,
    .close = file_close,
};

static struct output_backend *g_backend = &file_backend;

static struct uid_stats *find_or_create_stats(__u32 uid)
{
    unsigned int idx = uid % HASH_SIZE;

    struct uid_stats *s = uid_hash[idx];
    while (s) {
        if (s->uid == uid)
            return s;
        s = s->next;
    }

    s = calloc(1, sizeof(*s));
    if (!s)
        return NULL;

    s->uid = uid;
    s->next = uid_hash[idx];
    uid_hash[idx] = s;

    return s;
}

static void sig_handler(int sig)
{
    (void)sig;
    exiting = 1;
}

static void ip_to_str(__u32 ip, char *buf, size_t buflen)
{
    struct in_addr a = { .s_addr = ip };
    inet_ntop(AF_INET, &a, buf, buflen);
}

static int handle_event(void *ctx, void *data, size_t data_sz)
{
    (void)ctx;
    (void)data_sz;

    struct traffic_event *e = data;

    struct uid_stats *stats = find_or_create_stats(e->uid);
    if (!stats)
        return 0;

    if (e->direction)
        stats->total_out += e->bytes;
    else
        stats->total_in += e->bytes;

    struct traffic_record rec;
    rec.uid = e->uid;
    rec.bytes = e->bytes;
    rec.direction = e->direction;
    rec.total_in = stats->total_in;
    rec.total_out = stats->total_out;

    ip_to_str(e->src_ip, rec.src_ip, sizeof(rec.src_ip));
    ip_to_str(e->dst_ip, rec.dst_ip, sizeof(rec.dst_ip));

    clock_gettime(CLOCK_REALTIME, &rec.timestamp);

    g_backend->write(&rec);

    return 0;
}

static int handle_event_v6(void *ctx, void *data, size_t data_sz)
{
    (void)ctx;
    (void)data_sz;

    struct traffic_event_v6 *e = data;

    struct uid_stats *stats = find_or_create_stats(e->uid);
    if (!stats)
        return 0;

    if (e->direction)
        stats->total_out += e->bytes;
    else
        stats->total_in += e->bytes;

    struct traffic_record rec;
    rec.uid = e->uid;
    rec.bytes = e->bytes;
    rec.direction = e->direction;
    rec.total_in = stats->total_in;
    rec.total_out = stats->total_out;

    inet_ntop(AF_INET6, e->src_ip, rec.src_ip, sizeof(rec.src_ip));
    inet_ntop(AF_INET6, e->dst_ip, rec.dst_ip, sizeof(rec.dst_ip));

    clock_gettime(CLOCK_REALTIME, &rec.timestamp);

    g_backend->write(&rec);

    return 0;
}

int main(int argc, char **argv)
{
    g_nic_id = (argc > 2) ? argv[2] : "unknown";

    struct rlimit r = {RLIM_INFINITY, RLIM_INFINITY};
    if (setrlimit(RLIMIT_MEMLOCK, &r)) {
        perror("setrlimit(RLIMIT_MEMLOCK)");
        return 1;
    }

    if (g_backend->init(NULL) < 0) {
        fprintf(stderr, "Failed to initialize output backend\n");
        return 1;
    }

    signal(SIGINT, sig_handler);
    signal(SIGTERM, sig_handler);

    const char *cgroup_path = (argc > 1 && argv[1][0] != '\0')
                              ? argv[1]
                              : "/sys/fs/cgroup/user.slice";
    int cgroup_fd = open(cgroup_path, O_RDONLY);
    if (cgroup_fd < 0) {
        cgroup_path = "/sys/fs/cgroup";
        cgroup_fd = open(cgroup_path, O_RDONLY);
        if (cgroup_fd < 0) {
            perror("open cgroup");
            g_backend->close();
            return 1;
        }
    }
    printf("Using cgroup: %s\n", cgroup_path);

    struct bpf_object *obj = bpf_object__open_file("traffic_meter.bpf.o", NULL);
    if (!obj) {
        fprintf(stderr, "Failed to open BPF object file\n");
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }

    if (bpf_object__load(obj)) {
        fprintf(stderr, "Failed to load BPF object into kernel\n");
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }

    struct bpf_program *prog_egress = bpf_object__find_program_by_name(
        obj, "traffic_meter_egress");
    if (!prog_egress) {
        fprintf(stderr, "Failed to find IPv4 egress program in BPF object\n");
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }
    int prog_egress_fd = bpf_program__fd(prog_egress);
    if (bpf_prog_attach(prog_egress_fd, cgroup_fd,
                        BPF_CGROUP_INET_EGRESS, BPF_F_ALLOW_MULTI) < 0) {
        perror("bpf_prog_attach(IPv4 egress)");
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }

    struct bpf_program *prog_ingress = bpf_object__find_program_by_name(
        obj, "traffic_meter_ingress");
    if (!prog_ingress) {
        fprintf(stderr, "Failed to find IPv4 ingress program in BPF object\n");
        bpf_prog_detach2(prog_egress_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }
    int prog_ingress_fd = bpf_program__fd(prog_ingress);
    if (bpf_prog_attach(prog_ingress_fd, cgroup_fd,
                        BPF_CGROUP_INET_INGRESS, BPF_F_ALLOW_MULTI) < 0) {
        perror("bpf_prog_attach(IPv4 ingress)");
        bpf_prog_detach2(prog_egress_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }

    struct bpf_program *prog_egress_v6 = bpf_object__find_program_by_name(
        obj, "traffic_meter_egress_v6");
    if (!prog_egress_v6) {
        fprintf(stderr, "Failed to find IPv6 egress program in BPF object\n");
        bpf_prog_detach2(prog_egress_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_prog_detach2(prog_ingress_fd, cgroup_fd, BPF_CGROUP_INET_INGRESS);
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }
    int prog_egress_v6_fd = bpf_program__fd(prog_egress_v6);
    if (bpf_prog_attach(prog_egress_v6_fd, cgroup_fd,
                        BPF_CGROUP_INET_EGRESS, BPF_F_ALLOW_MULTI) < 0) {
        perror("bpf_prog_attach(IPv6 egress)");
        bpf_prog_detach2(prog_egress_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_prog_detach2(prog_ingress_fd, cgroup_fd, BPF_CGROUP_INET_INGRESS);
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }

    struct bpf_program *prog_ingress_v6 = bpf_object__find_program_by_name(
        obj, "traffic_meter_ingress_v6");
    if (!prog_ingress_v6) {
        fprintf(stderr, "Failed to find IPv6 ingress program in BPF object\n");
        bpf_prog_detach2(prog_egress_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_prog_detach2(prog_ingress_fd, cgroup_fd, BPF_CGROUP_INET_INGRESS);
        bpf_prog_detach2(prog_egress_v6_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }
    int prog_ingress_v6_fd = bpf_program__fd(prog_ingress_v6);
    if (bpf_prog_attach(prog_ingress_v6_fd, cgroup_fd,
                        BPF_CGROUP_INET_INGRESS, BPF_F_ALLOW_MULTI) < 0) {
        perror("bpf_prog_attach(IPv6 ingress)");
        bpf_prog_detach2(prog_egress_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_prog_detach2(prog_ingress_fd, cgroup_fd, BPF_CGROUP_INET_INGRESS);
        bpf_prog_detach2(prog_egress_v6_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }

    struct ring_buffer *rb = ring_buffer__new(
        bpf_object__find_map_fd_by_name(obj, "events"),
        handle_event,
        NULL,
        NULL);
    if (!rb) {
        fprintf(stderr, "Failed to create IPv4 ring buffer\n");
        bpf_prog_detach2(prog_egress_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_prog_detach2(prog_ingress_fd, cgroup_fd, BPF_CGROUP_INET_INGRESS);
        bpf_prog_detach2(prog_egress_v6_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_prog_detach2(prog_ingress_v6_fd, cgroup_fd, BPF_CGROUP_INET_INGRESS);
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }

    if (ring_buffer__add(rb,
                         bpf_object__find_map_fd_by_name(obj, "events_v6"),
                         handle_event_v6,
                         NULL) < 0) {
        fprintf(stderr, "Failed to add IPv6 ring buffer\n");
        ring_buffer__free(rb);
        bpf_prog_detach2(prog_egress_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_prog_detach2(prog_ingress_fd, cgroup_fd, BPF_CGROUP_INET_INGRESS);
        bpf_prog_detach2(prog_egress_v6_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
        bpf_prog_detach2(prog_ingress_v6_fd, cgroup_fd, BPF_CGROUP_INET_INGRESS);
        bpf_object__close(obj);
        close(cgroup_fd);
        g_backend->close();
        return 1;
    }

    printf("eBPF traffic meter loaded (cgroup mode, IPv4+IPv6). Press Ctrl+C to exit.\n");
    fflush(stdout);

    while (!exiting) {
        ring_buffer__poll(rb, 100);
    }

    ring_buffer__free(rb);
    bpf_prog_detach2(prog_egress_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
    bpf_prog_detach2(prog_ingress_fd, cgroup_fd, BPF_CGROUP_INET_INGRESS);
    bpf_prog_detach2(prog_egress_v6_fd, cgroup_fd, BPF_CGROUP_INET_EGRESS);
    bpf_prog_detach2(prog_ingress_v6_fd, cgroup_fd, BPF_CGROUP_INET_INGRESS);
    bpf_object__close(obj);
    close(cgroup_fd);

    g_backend->close();

    printf("Detached and exiting.\n");
    return 0;
}
