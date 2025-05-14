from flask import Flask, render_template, request, redirect, session, url_for
from flask_socketio import SocketIO, join_room, emit
from flask_sqlalchemy import SQLAlchemy
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
db = SQLAlchemy(app)
socketio = SocketIO(app)

# Kullanıcı modeli
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(80), nullable=False)

# Oda yapısı: room -> {"players": {username: color}}
rooms = {}
usernames = {}

# ANA SAYFA
@app.route('/')
def main():
    return render_template('main.html')

# GİRİŞ SAYFASI
@app.route('/login_page')
def login_page():
    return render_template('index.html')

# KAYIT SAYFASI
@app.route('/register_page')
def register_page():
    return render_template('register.html')

# GİRİŞ POST
@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    user = User.query.filter_by(username=username, password=password).first()
    if user:
        session['username'] = username
        return redirect('/game')
    return 'Kullanıcı bulunamadı'

# KAYIT POST
@app.route('/register', methods=['POST'])
def register():
    username = request.form['username']
    password = request.form['password']
    if User.query.filter_by(username=username).first():
        return 'Kullanıcı adı mevcut'
    user = User(username=username, password=password)
    db.session.add(user)
    db.session.commit()
    return redirect('/login_page')

# OYUN SAYFASI
@app.route('/game')
def game():
    if 'username' in session:
        return render_template('game.html', username=session['username'])
    return redirect('/login_page')

# WebSocket: Odaya katılma
@socketio.on("join")
def handle_join(data):
    username = data["username"]
    color = data.get("color")
    room = data.get("room")

    join_room(room)

    if room not in rooms:
        rooms[room] = {"players": {}}

    room_players = rooms[room]["players"]

    if username in room_players:
        emit("assign_color", room_players[username], to=request.sid)
        return

    if color in room_players.values():
        emit("assign_color", "rejected", to=request.sid)
        return

    room_players[username] = color
    usernames[request.sid] = username

    emit("assign_color", color, to=request.sid)
    emit("player_joined", room_players, room=room)

# WebSocket: Hamle
@socketio.on("make_move")
def handle_make_move(data):
    room = data["room"]
    current_color = data["color"]
    to_row = data["toRow"]
    to_col = data["toCol"]
    captured = data.get("capturedIndex")
    must_continue = data.get("mustContinue", False)

    if (current_color == "red" and to_row == 0) or (current_color == "black" and to_row == 7):
        data["becameQueen"] = True
    else:
        data["becameQueen"] = False

    emit("move_made", data, room=room)

    if not must_continue:
        next_turn = "black" if current_color == "red" else "red"
        emit("turn_update", next_turn, room=room)

    emit("check_pieces", room=room)

# WebSocket: Oyun Bitti
@socketio.on("game_over")
def handle_game_over(data):
    room = data["room"]
    winner = data["winner"]
    emit("game_over", {"winner": winner}, room=room)

# WebSocket: Oyunu Sıfırla
@socketio.on("restart_game")
def handle_restart(data):
    room = data["room"]
    # Tahtayı sıfırlama bildirimi gönder
    emit("game_reset", {
        "reset": True,
        "startingColor": "red"
    }, room=room)

# Uygulamayı başlat
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True)
