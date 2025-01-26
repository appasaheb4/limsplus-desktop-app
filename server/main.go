package main

import (
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/tarm/serial"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}
var tcpServers = make(map[string]net.Listener)

var (
	wsConnections = struct {
		sync.RWMutex
		connections []*websocket.Conn
	}{connections: make([]*websocket.Conn, 0)}
	listener   net.Listener
	tcpRunning = false
	mu         sync.Mutex
	done       chan struct{}
)

func handler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("Error upgrading to websocket:", err)
		return
	}
	defer conn.Close()

	wsConnections.Lock()
	wsConnections.connections = append(wsConnections.connections, conn)
	wsConnections.Unlock()

	fmt.Printf("WebSocket connected: %s\n", conn.RemoteAddr().String())
	defer func() {
		wsConnections.Lock()
		for i, c := range wsConnections.connections {
			if c == conn {
				wsConnections.connections = append(wsConnections.connections[:i], wsConnections.connections[i+1:]...)
				break
			}
		}
		wsConnections.Unlock()
		fmt.Printf("WebSocket disconnected: %s\n", conn.RemoteAddr().String())
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Println("Error reading message:", err)
			break
		}
		broadcastToWebSocketClients(fmt.Sprintf("WebSocket Received: %s\n", message))
	}
}

func startWebSocketServer() {
	addr := ":6000"
	http.HandleFunc("/ws", handler)
	fmt.Printf("Starting WebSocket server on %s\n", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		fmt.Printf("Error starting WebSocket server: %s\n", err)
	}
}

func startTCPServer(ip, port string, wg *sync.WaitGroup, messages chan<- string) {
	defer wg.Done()
	addr := fmt.Sprintf("%s:%s", ip, port)
	fmt.Printf("Attempting to start TCP server on %s\n", addr)
	var err error
	listener, err = net.Listen("tcp", addr)
	if err != nil {
		messages <- fmt.Sprintf("Error starting TCP server: %s\n", err)
		fmt.Printf("Error starting TCP server: %s\n", err)
		return
	}
	defer listener.Close()

	mu.Lock()
	tcpRunning = true
	done = make(chan struct{})
	mu.Unlock()

	messages <- fmt.Sprintf("TCP Server listening on %s\n", addr)
	fmt.Println("TCP Server listening on", addr)
	broadcastToWebSocketClients(fmt.Sprintf("TCP Server listening on %s\n", addr))

	for {
		conn, err := listener.Accept()
		if err != nil {
			select {
			case <-done:
				fmt.Println("TCP server stopped")
				return
			default:
				fmt.Println("Error accepting connection:", err)
				continue
			}
		}
		go handleTCPConnection(conn, messages)
	}
}

func handleTCPConnection(conn net.Conn, messages chan<- string) {
	defer conn.Close()
	fmt.Println("Client connected:", conn.RemoteAddr().String())

	buffer := make([]byte, 1024)
	for {
		n, err := conn.Read(buffer)
		if err != nil {
			log.Println("Client disconnected or read error:", err)
			return
		}

		// Convert the incoming data to hex string
		hexData := hex.EncodeToString(buffer[:n])
		fmt.Printf("Received (hex): %s\n", hexData)
		broadcastToWebSocketClients(hexData)

		// Parse hex data to ASCII
		asciiData, parseErr := hexToASCII(hexData)
		if parseErr != nil {
			log.Println("Error parsing hex to ASCII:", parseErr)
			continue
		}
		message := asciiData
		fmt.Printf("Parsed Data (ASCII): %s\n", asciiData)
		// broadcastToWebSocketClients(message)
		messages <- fmt.Sprintf("TCP Received: %s\n", message)

		// if hexData == "05" {
		// 	sendMessage(conn, "06")
		// 	fmt.Println("Sent: <ACK>")
		// } else if strings.HasPrefix(hexData, "02") && strings.Contains(hexData, "03") {
		// 	fmt.Println("Data Frame Received:", asciiData)
		// 	sendMessage(conn, "06")
		// 	fmt.Println("Sent: <ACK>")
		// } else if hexData == "04" {
		// 	sendMessage(conn, "06")
		// 	fmt.Println("Received: <EOT> - Sent <ACK> and closing connection")
		// } else {
		// 	fmt.Println("Unknown or unrecognized message format")
		// }
	}
}

func serialPortConnection(portName string, baudRate int) {
	// Open the serial port
	c := &serial.Config{Name: portName, Baud: baudRate}
	s, err := serial.OpenPort(c)
	if err != nil {
		log.Fatalf("failed to open port: %v", err)
	}

	fmt.Printf("Listening on %s at %d baud rate...\n", portName, baudRate)

	buffer := make([]byte, 1024)
	for {
		// Read data from the serial port
		n, err := s.Read(buffer)
		if err != nil {
			log.Printf("Error reading from serial port: %v", err)
			return
		}

		// Convert the incoming data to hex string
		hexData := hex.EncodeToString(buffer[:n])
		fmt.Printf("Received (hex): %s\n", hexData)

		// Parse hex data to ASCII
		asciiData, parseErr := hexToASCII(hexData)
		if parseErr != nil {
			log.Println("Error parsing hex to ASCII:", parseErr)
			continue
		}
		fmt.Printf("Parsed Data (ASCII): %s\n", asciiData)

		// Handle specific protocol commands in hex
		if hexData == "05" { // <ENQ> in hex
			sendSerialMessage(s, "06") // Send <ACK> as hex "06"
			fmt.Println("Sent: <ACK>")
		} else if strings.HasPrefix(hexData, "02") && strings.Contains(hexData, "03") {
			fmt.Println("Data Frame Received:", asciiData)
			sendSerialMessage(s, "06") // Send <ACK> as hex "06"
			fmt.Println("Sent: <ACK>")
		} else if hexData == "04" { // <EOT> in hex
			sendSerialMessage(s, "06") // Send <ACK> as hex "06" in response to <EOT>
			fmt.Println("Received: <EOT> - Sent <ACK> and closing connection")
			return
		} else {
			fmt.Println("Unknown or unrecognized message format")
		}
	}
}

func broadcastToWebSocketClients(message string) {
	wsConnections.RLock()
	defer wsConnections.RUnlock()
	fmt.Printf("Broadcasting to %d clients\n", len(wsConnections.connections))
	for _, conn := range wsConnections.connections {
		err := conn.WriteMessage(websocket.TextMessage, []byte(message))
		if err != nil {
			fmt.Printf("Error sending message to WebSocket client: %s\n", err)
		}
	}
}

func main() {
	// Start the WebSocket server
	go startWebSocketServer()

	// Define HTTP handlers for starting either TCP/IP or Serial Port connections
	http.HandleFunc("/start-tcp", func(w http.ResponseWriter, r *http.Request) {
		ip := r.URL.Query().Get("ip")
		tcpPort := r.URL.Query().Get("tcpPort")

		if ip == "" || tcpPort == "" {
			http.Error(w, "IP and TCP port are required", http.StatusBadRequest)
			return
		}

		addr := fmt.Sprintf("%s:%s", ip, tcpPort)
		mu.Lock()
		if _, exists := tcpServers[addr]; exists {
			mu.Unlock()
			http.Error(w, "TCP server already running on this address", http.StatusBadRequest)
			return
		}
		mu.Unlock()

		messages := make(chan string)
		var wg sync.WaitGroup
		wg.Add(1)

		go startTCPServer(ip, tcpPort, &wg, messages)

		go func() {
			wg.Wait()
			close(messages)
		}()

		w.Header().Set("Content-Type", "text/plain")
		for msg := range messages {
			w.Write([]byte(msg))
		}
	})

	http.HandleFunc("/start-serial", func(w http.ResponseWriter, r *http.Request) {
		portName := r.URL.Query().Get("port")
		baudRateStr := r.URL.Query().Get("baudRate")

		// Convert baudRate from string to integer
		baudRate, err := strconv.Atoi(baudRateStr)
		if err != nil {
			http.Error(w, "Invalid baud rate", http.StatusBadRequest)
			return
		}

		// Run serial connection in a goroutine
		go serialPortConnection(portName, baudRate)
		broadcastToWebSocketClients(fmt.Sprintf("Serial port connection started on %s at %d baud rate", portName, baudRate))

	})
	// Endpoint to stop either TCP or Serial connection
	http.HandleFunc("/stop", func(w http.ResponseWriter, r *http.Request) {
		ip := r.URL.Query().Get("ip")
		tcpPort := r.URL.Query().Get("tcpPort")

		if ip == "" || tcpPort == "" {
			http.Error(w, "IP and TCP port are required", http.StatusBadRequest)
			return
		}

		stopTCPServer(ip, tcpPort)
		w.Write([]byte(fmt.Sprintf("TCP server stop request processed for %s:%s", ip, tcpPort)))
	})

	fmt.Println("Control server started at :9000")
	if err := http.ListenAndServe(":9000", nil); err != nil {
		fmt.Printf("Error starting control server: %s\n", err)
	}
}

func stopTCPServer(ip, port string) {
	addr := fmt.Sprintf("%s:%s", ip, port)
	mu.Lock()
	defer mu.Unlock()
	if listener, exists := tcpServers[addr]; exists {
		listener.Close()
		delete(tcpServers, addr)
		fmt.Printf("TCP server stopped on %s\n", addr)
		broadcastToWebSocketClients(fmt.Sprintf("TCP server stopped on %s\n", addr))
	} else {
		fmt.Printf("TCP server not running on %s\n", addr)
	}
}

func sendMessage(conn net.Conn, hexMessage string) {
	// Decode hex message back to bytes for sending
	msg, err := hex.DecodeString(hexMessage)
	if err != nil {
		log.Println("Error decoding hex message:", err)
		return
	}

	_, err = conn.Write(msg)
	if err != nil {
		log.Println("Error sending message:", err)
	}
}

func hexToASCII(hexStr string) (string, error) {
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// Helper function to send a hex-encoded message over the serial connection
func sendSerialMessage(s *serial.Port, hexMessage string) {
	msg, err := hex.DecodeString(hexMessage)
	if err != nil {
		log.Printf("Error decoding hex message: %v", err)
		return
	}

	_, err = s.Write(msg)
	if err != nil {
		log.Printf("Error sending message: %v", err)
	}
}
