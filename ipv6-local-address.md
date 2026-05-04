# Local IPv6 Addresses

When working with local IPv6 addresses, the way you write them can change depending on the situation. If you’re just writing the address, the format is simple. But when using it in commands (like ping or ssh), you may also need to mention the network interface (such as eth0 or wlan0).

Below is a straightforward explanation of how local IPv6 addressing works.

### 1. Basic Format
An IPv6 address is made up of 8 groups, each containing 4 hexadecimal digits (0–9, A–F), separated by colons.

- Total size: 128 bits  
- Compression rule: A sequence of zero blocks can be shortened using `::`, but this can be done only once in a single address  

Example (full form):
2001:0db8:85a3:0000:0000:8a2e:0370:7334  

Example (shortened):
2001:db8:85a3:0:0:8a2e:370:7334  

---

### 2. Types of Local Addresses

The term “local” usually refers to two main categories:

#### A. Link-Local Address
These are used for communication within the same network (no routing involved). They always begin with `fe80:`.

Example:
fe80::1  

Since multiple interfaces can have similar link-local addresses, you often need to specify which interface to use.

---

#### B. Unique Local Address (ULA)
These are private IPv6 addresses, similar to 192.168.x.x in IPv4. They are used inside private networks.

They usually start with `fc` or `fd`.

Example:
fd12:3456:789a::1  

---

### 3. Specifying the Interface

When using link-local addresses in command-line tools, the interface must be included. Otherwise, the system cannot determine where to send the packet.

General format:
[address]%[interface]

Examples:

Linux/macOS:
ping6 fe80::1%eth0  

Windows:
ping -6 fe80::1%1  

---

### 4. Common Examples

Loopback: ::1 → refers to the same machine  
Link-Local: fe80::1 → used within a local network  
ULA: fd12:3456:789a::1 → private network use  
Compressed: 2001:db8::1 → shortened IPv6 form  

---

### Quick Notes

- Remove leading zeros in each block (write db8 instead of 0db8)  
- Use `::` to compress continuous zero sections (only once)  
- Add the interface (like %eth0) when using commands  
