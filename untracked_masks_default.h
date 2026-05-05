/* Empty masks → no IP filtering applied, so ALL IPv4 and IPv6 traffic will be tracked */
static const struct ipv4_mask untracked_ipv4[] = {
    // no entries = nothing is ignored
};
static const int untracked_ipv4_cnt = 0;

static const struct ipv6_mask untracked_ipv6[] = {
    // no entries = nothing is ignored
};
static const int untracked_ipv6_cnt = 0;
