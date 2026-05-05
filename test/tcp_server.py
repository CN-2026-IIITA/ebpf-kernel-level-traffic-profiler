import socket

HOST = '0.0.0.0'   # Listen on all interfaces


def start_server():
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.bind((HOST, PORT))
    server_socket.listen(5)

    print(f"[+] Server listening on {HOST}:{PORT}")

    while True:
        client_socket, addr = server_socket.accept()
        print(f"[+] Connection from {addr}")

        data = client_socket.recv(1024)
        if data:
            print(f"[DATA RECEIVED] {data.decode()}")

        client_socket.sendall(b"Message received")
        client_socket.close()

if __name__ == "__main__":
    start_server()
