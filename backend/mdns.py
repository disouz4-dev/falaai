"""
PT-BR: Anúncio mDNS/Zeroconf do OpenLingo. Publica o host 'openlingo.local' e um serviço
       HTTP na rede local, para qualquer dispositivo achar o app pelo NOME (openlingo.local:8000)
       sem precisar saber o IP. Funciona nativamente em macOS, Windows 10+, iOS e Linux (Avahi).
EN:    OpenLingo mDNS/Zeroconf advertising. Publishes the 'openlingo.local' host and an HTTP
       service so any device finds the app by NAME (openlingo.local:8000) without knowing the IP.
"""

import socket

HOSTNAME = "openlingo"  # PT-BR: vira openlingo.local. EN: becomes openlingo.local.

_zc = None
_info = None


def _lan_ip():
    """PT-BR: descobre o IP da máquina na rede local. EN: find the machine's LAN IP."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # PT-BR: não envia nada; só descobre a interface. EN: no traffic.
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def start(port=8000, https=False):
    """
    PT-BR: Registra 'openlingo.local' e o serviço na rede. Retorna a URL amigável.
    EN:    Register 'openlingo.local' and the service on the network. Returns the friendly URL.
    """
    global _zc, _info
    try:
        from zeroconf import ServiceInfo, Zeroconf
    except Exception:
        return None

    ip = _lan_ip()
    scheme = "https" if https else "http"
    service_type = "_https._tcp.local." if https else "_http._tcp.local."
    try:
        _zc = Zeroconf()
        _info = ServiceInfo(
            service_type,
            f"OpenLingo.{service_type}",
            addresses=[socket.inet_aton(ip)],
            port=port,
            properties={"path": "/"},
            server=f"{HOSTNAME}.local.",  # PT-BR: publica o host openlingo.local. EN: publishes host.
        )
        _zc.register_service(_info, allow_name_change=True)
        return f"{scheme}://{HOSTNAME}.local:{port}"
    except Exception:
        # PT-BR: se falhar (ex.: conflito de porta mDNS), segue sem quebrar. EN: fail-safe.
        _zc = None
        return None


def stop():
    """PT-BR: Remove o anúncio ao encerrar. EN: Unregister on shutdown."""
    global _zc, _info
    try:
        if _zc and _info:
            _zc.unregister_service(_info)
        if _zc:
            _zc.close()
    except Exception:
        pass
    finally:
        _zc = None
        _info = None
