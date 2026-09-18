from flask import Flask, jsonify, send_from_directory
import subprocess, json, os

app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")


def safe_termux_json(command):
    try:
        out = subprocess.check_output(command, stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as exc:
        raise ValueError(f"{command[0]} a échoué: {exc.output.decode('utf-8', 'replace').strip()}")
    except FileNotFoundError as exc:
        raise ValueError(f"Commande introuvable: {command[0]}") from exc

    raw = out.decode("utf-8", errors="replace").strip()
    if not raw:
        raise ValueError("La commande Termux a retourné une réponse vide.")

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Réponse JSON invalide pour {command[0]}: {raw[:200]}") from exc


@app.route("/api/rssi")
def rssi():
    try:
        data = safe_termux_json(["termux-wifi-connectioninfo"])
    except ValueError as exc:
        return jsonify({"error": "rssi_unavailable", "details": str(exc)}), 500

    if isinstance(data, dict):
        return jsonify({"ssid": data.get("ssid"), "rssi": data.get("rssi")})

    return jsonify({"error": "rssi_unavailable", "details": "Format Wi‑Fi invalide."}), 500


@app.route("/api/scan")
def scan():
    try:
        data = safe_termux_json(["termux-wifi-scaninfo"])
    except ValueError as exc:
        return jsonify({"error": "scan_failed", "details": str(exc)}), 500

    if isinstance(data, list):
        return jsonify(data)

    if isinstance(data, dict):
        if data.get("error"):
            return jsonify({"error": "scan_failed", "details": data.get("error")}), 500
        for key in ("wifi", "networks", "results"):
            if isinstance(data.get(key), list):
                return jsonify(data[key])
        return jsonify({"error": "scan_failed", "details": "Format de scan invalide."}), 500

    return jsonify({"error": "scan_failed", "details": "Format de scan non supporté."}), 500

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    full = os.path.join(app.static_folder, path)
    if path and os.path.exists(full):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
