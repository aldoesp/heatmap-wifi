# Backend

API Flask du projet Heatmap WiFi. Le backend récupère les informations Wi-Fi via l’API Termux et peut servir le frontend compilé.

## Prérequis

- Python 3.10 ou supérieur
- [Termux](https://termux.dev/) sur Android
- L’application [Termux:API](https://github.com/termux/termux-api)
- Le paquet Termux `termux-api` installé :

```bash
pkg update
pkg install python termux-api
```

Le paquet Termux et l’application Termux:API doivent provenir de la même source, par exemple F-Droid.

## Installation

Depuis le dossier `backend/` :

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Sous Windows, l’activation de l’environnement virtuel se fait avec :

```powershell
venv\\Scripts\\Activate.ps1
```

## Lancement

Depuis `backend/`, avec l’environnement virtuel activé :

```bash
python app.py
```

Le serveur écoute sur toutes les interfaces à l’adresse `http://localhost:5000`.

> Le backend sert le frontend depuis `../frontend/build`. Pour utiliser l’interface complète, compilez d’abord le frontend avec `npm run build` dans le dossier `frontend/`.

## API

### `GET /api/rssi`

Retourne le SSID et la puissance du signal Wi-Fi courant :

```bash
curl http://localhost:5000/api/rssi
```

Réponse :

```json
{
  "ssid": "Mon reseau",
  "rssi": -54
}
```

Cette route nécessite que `termux-wifi-connectioninfo` soit disponible et autorisé sur l’appareil Android.

### Frontend

Les routes qui ne correspondent pas à un fichier statique sont redirigées vers `frontend/build/index.html`, ce qui permet au backend de gérer le frontend React en production.

## Dépannage

- **`termux-wifi-connectioninfo: command not found`** : installez le paquet Termux `termux-api`.
- **Informations Wi-Fi indisponibles** : ouvrez Termux:API et accordez les permissions demandées, puis vérifiez que le Wi-Fi est activé.
- **Page blanche** : exécutez `npm run build` dans `frontend/` et vérifiez que le dossier `frontend/build` existe.
