import socket
import time

SERVER_IP = '127.0.0.1'  # Change if server is on another machine
PORT = 9090

def start_client():
    while True:
        try:
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client_socket.connect((SERVER_IP, PORT))

            message = "Hello from client!"
            client_socket.sendall(message.encode())

            response = client_socket.recv(1024)
            print(f"[SERVER RESPONSE] {response.decode()}")

            client_socket.close()
            time.sleep(1)  # Delay to generate steady traffic

        except Exception as e:
            print(f"[ERROR] {e}")
            time.sleep(2)

if __name__ == "__main__":
    start_client()
