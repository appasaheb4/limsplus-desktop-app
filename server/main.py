#!/usr/bin/env python3
"""
LimsPlus Integration Gateway Server

WebSocket server (port 6000) + HTTP control server (port 9000)
Handles TCP and serial port connections for instrument integration.
"""

import asyncio
import codecs
from logger import logger
from typing import Dict, Set

import aiohttp
from aiohttp import web



ws_connections: Set[web.WebSocketResponse] = set()
tcp_servers: Dict[str, asyncio.AbstractServer] = {}
tcp_lock = asyncio.Lock()


async def broadcast_to_ws_clients(message: str):
    logger.info("Broadcasting to %d clients", len(ws_connections))
    disconnected = set()
    for ws in ws_connections:
        try:
            await ws.send_str(message)
        except Exception as e:
            logger.error("Error sending message to WebSocket client: %s", e)
            disconnected.add(ws)
    ws_connections.difference_update(disconnected)


def hex_to_ascii(hex_str: str) -> str:
    return codecs.decode(hex_str, "hex").decode("ascii", errors="replace")


# ---------- WebSocket Server (port 6000) ----------


async def ws_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    ws_connections.add(ws)
    logger.info("WebSocket connected: %s", request.remote)

    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                await broadcast_to_ws_clients(
                    f"WebSocket Received: {msg.data}\n"
                )
            elif msg.type == aiohttp.WSMsgType.ERROR:
                logger.error("WebSocket error: %s", ws.exception())
    finally:
        ws_connections.discard(ws)
        logger.info("WebSocket disconnected: %s", request.remote)

    return ws


# ---------- TCP Server ----------


async def handle_tcp_connection(
    reader: asyncio.StreamReader, writer: asyncio.StreamWriter
):
    addr = writer.get_extra_info("peername")
    logger.info("Client connected: %s", addr)

    try:
        while True:
            data = await reader.read(1024)
            if not data:
                break

            hex_data = data.hex()
            logger.info("Received (hex): %s", hex_data)
            await broadcast_to_ws_clients(hex_data)

            try:
                ascii_data = hex_to_ascii(hex_data)
                logger.info("Parsed Data (ASCII): %s", ascii_data)
            except Exception as e:
                logger.error("Error parsing hex to ASCII: %s", e)
                continue

            if hex_data == "05":
                writer.write(bytes.fromhex("06"))
                await writer.drain()
                logger.info("Sent: <ACK>")
            elif hex_data.startswith("02") and "03" in hex_data:
                logger.info("Data Frame Received: %s", ascii_data)
                writer.write(bytes.fromhex("06"))
                await writer.drain()
                logger.info("Sent: <ACK>")
            elif hex_data == "04":
                writer.write(bytes.fromhex("06"))
                await writer.drain()
                logger.info("Received: <EOT> - Sent <ACK> and closing connection")
            else:
                logger.info("Unknown or unrecognized message format")
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error("Client disconnected or read error: %s", e)
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass


async def start_tcp_server(ip: str, port: str) -> str:
    addr = f"{ip}:{port}"
    logger.info("Attempting to start TCP server on %s", addr)

    async with tcp_lock:
        if addr in tcp_servers:
            return f"TCP server already running on {addr}"

    try:
        server = await asyncio.start_server(handle_tcp_connection, ip, int(port))
        async with tcp_lock:
            tcp_servers[addr] = server

        msg = f"TCP Server listening on {addr}\n"
        logger.info(msg.strip())
        await broadcast_to_ws_clients(msg)
        return msg
    except Exception as e:
        msg = f"Error starting TCP server: {e}\n"
        logger.error(msg.strip())
        return msg


async def stop_tcp_server(ip: str, port: str) -> str:
    addr = f"{ip}:{port}"
    async with tcp_lock:
        if addr in tcp_servers:
            server = tcp_servers.pop(addr)
            server.close()
            await server.wait_closed()
            msg = f"TCP server stopped on {addr}\n"
            logger.info(msg.strip())
            await broadcast_to_ws_clients(msg)
            return msg

    msg = f"TCP server not running on {addr}\n"
    logger.info(msg.strip())
    return msg


# ---------- Serial Port ----------


async def serial_port_connection(port_name: str, baud_rate: int):
    """Handle serial port connection in a thread to avoid blocking the event loop."""
    import serial as pyserial

    loop = asyncio.get_running_loop()

    def _run_serial():
        try:
            ser = pyserial.Serial(port_name, baud_rate, timeout=1)
            logger.info("Listening on %s at %d baud rate...", port_name, baud_rate)

            while True:
                data = ser.read(1024)
                if not data:
                    continue

                hex_data = data.hex()
                logger.info("Received (hex): %s", hex_data)

                try:
                    ascii_data = hex_to_ascii(hex_data)
                    logger.info("Parsed Data (ASCII): %s", ascii_data)
                except Exception as e:
                    logger.error("Error parsing hex to ASCII: %s", e)
                    continue

                if hex_data == "05":
                    ser.write(bytes.fromhex("06"))
                    logger.info("Sent: <ACK>")
                elif hex_data.startswith("02") and "03" in hex_data:
                    logger.info("Data Frame Received: %s", ascii_data)
                    ser.write(bytes.fromhex("06"))
                    logger.info("Sent: <ACK>")
                elif hex_data == "04":
                    ser.write(bytes.fromhex("06"))
                    logger.info(
                        "Received: <EOT> - Sent <ACK> and closing connection"
                    )
                    return
                else:
                    logger.info("Unknown or unrecognized message format")
        except Exception as e:
            logger.error("Serial port error: %s", e)

    await loop.run_in_executor(None, _run_serial)


# ---------- HTTP Control Server (port 9000) ----------


async def handle_start_tcp(request: web.Request) -> web.Response:
    ip = request.query.get("ip", "")
    tcp_port = request.query.get("tcpPort", "")

    if not ip or not tcp_port:
        return web.Response(text="IP and TCP port are required", status=400)

    result = await start_tcp_server(ip, tcp_port)
    return web.Response(text=result)


async def handle_start_serial(request: web.Request) -> web.Response:
    port_name = request.query.get("port", "")
    baud_rate_str = request.query.get("baudRate", "")

    if not port_name or not baud_rate_str:
        return web.Response(text="Port and baud rate are required", status=400)

    try:
        baud_rate = int(baud_rate_str)
    except ValueError:
        return web.Response(text="Invalid baud rate", status=400)

    asyncio.create_task(serial_port_connection(port_name, baud_rate))
    msg = f"Serial port connection started on {port_name} at {baud_rate} baud rate"
    await broadcast_to_ws_clients(msg)
    return web.Response(text=msg)


async def handle_stop(request: web.Request) -> web.Response:
    ip = request.query.get("ip", "")
    tcp_port = request.query.get("tcpPort", "")

    if not ip or not tcp_port:
        return web.Response(text="IP and TCP port are required", status=400)

    await stop_tcp_server(ip, tcp_port)
    return web.Response(
        text=f"TCP server stop request processed for {ip}:{tcp_port}"
    )


# ---------- Main ----------


async def main():
    ws_app = web.Application()
    ws_app.router.add_get("/ws", ws_handler)
    ws_runner = web.AppRunner(ws_app)
    await ws_runner.setup()
    ws_site = web.TCPSite(ws_runner, "0.0.0.0", 6000)
    await ws_site.start()
    logger.info("Starting WebSocket server on :6000")

    control_app = web.Application()
    control_app.router.add_get("/start-tcp", handle_start_tcp)
    control_app.router.add_get("/start-serial", handle_start_serial)
    control_app.router.add_get("/stop", handle_stop)
    control_runner = web.AppRunner(control_app)
    await control_runner.setup()
    control_site = web.TCPSite(control_runner, "0.0.0.0", 9000)
    await control_site.start()
    logger.info("Control server started at :9000")

    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await ws_runner.cleanup()
        await control_runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server shutting down...")
