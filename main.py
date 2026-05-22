import os
from supabase import create_client, Client
from flask import Flask, request, jsonify

app = Flask(__name__)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

@app.post('/submit')
def new_row():
    #Get the data
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    name = data.get('name', 'Guest')
    return jsonify({
        "status":"success",
        "message": f'Hello, {name}!',
        "recieved": data
    }), 201