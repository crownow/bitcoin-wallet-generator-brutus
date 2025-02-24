from flask import Flask, request, jsonify
import json
import socket
import hashlib
import base58
import segwit_addr

FULCRUM_HOST = "127.0.0.1"
FULCRUM_PORT = 50001

app = Flask(__name__)

def address_to_scripthash(address):
    try:
        if address.startswith("1"):  # P2PKH (Legacy)
            decoded = base58.b58decode_check(address)
            script = b'\x76\xa9\x14' + decoded[1:] + b'\x88\xac'
        elif address.startswith("3"):  # P2SH
            decoded = base58.b58decode_check(address)
            script = b'\xa9\x14' + decoded[1:] + b'\x87'
        elif address.startswith("bc1q"):  # P2WPKH (Bech32)
            hrp, data = segwit_addr.decode_segwit_address("bc", address)
            script = bytes([0x00, len(data)]) + bytes(data)
        elif address.startswith("bc1p"):  # P2TR (Taproot, Bech32m)
            hrp, data = segwit_addr.decode_segwit_address("bc", address)
            script = bytes([0x01, len(data)]) + bytes(data)
        else:
            return None
        return hashlib.sha256(script).digest()[::-1].hex()
    except:
        return None

def fulcrum_request(method, params):
    try:
        request_data = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}) + "\n"
        with socket.create_connection((FULCRUM_HOST, FULCRUM_PORT), timeout=5) as sock:
            sock.sendall(request_data.encode())
            response_data = b""
            while True:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                response_data += chunk
        return json.loads(response_data.decode())
    except:
        return None

@app.route("/get_balance", methods=["POST"])
def get_balance():
    data = request.json
    address = data.get("address")

    if not address:
        return jsonify({"error": "No address provided"}), 400

    scripthash = address_to_scripthash(address)
    if not scripthash:
        return jsonify({"error": "Invalid address"}), 400

    balance_response = fulcrum_request("blockchain.scripthash.get_balance", [scripthash])
    history_response = fulcrum_request("blockchain.scripthash.get_history", [scripthash])

    if not balance_response or not history_response:
        return jsonify({"error": "Fulcrum error"}), 500

    balance = balance_response.get("result", {})
    transaction_count = len(history_response.get("result", []))

    return jsonify({
        "address": address,
        "confirmed_balance": balance.get("confirmed", 0),
        "unconfirmed_balance": balance.get("unconfirmed", 0),
        "transaction_count": transaction_count
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
