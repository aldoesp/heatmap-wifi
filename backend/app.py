from flask import Flask, jsonify, send_from_directory
import subprocess, json, os

app = Flask(__name__, static_folder="../frontend/build", static_url_path="/")

@app.route("/api/rssi")
def rssi():
    # Termux API : nécessite termux-api installé (voir §3)
    out = subprocess.check_output(["termux-wifi-connectioninfo"])
    data = json.loads(out)
    return jsonify({"ssid": data.get("ssid"), "rssi": data.get("rssi")})

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    full = os.path.join(app.static_folder, path)
    if path and os.path.exists(full):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
