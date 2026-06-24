import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

DATABASE = 'mysocial.db'
DATETIME_FMT = '%Y-%m-%dT%H:%M:%S.%fZ'


def db_conn():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def dt_now():
    return datetime.utcnow().strftime(DATETIME_FMT)


def as_dict(row):
    return dict(row) if row else None


# ===== USERS & BASIC AUTH =====

@app.route('/auth/signin', methods=['POST'])
def signin():
    # For demo: accept "user_id" and "name"
    data = request.json
    user_id = data.get('user_id')
    name = data.get('name')
    avatar_url = data.get('avatar_url')
    conn = db_conn()
    user = conn.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,)).fetchone()
    if user:
        return jsonify({"ok": True, "user": as_dict(user)})
    else:
        conn.execute("INSERT INTO Users (user_id, name, avatar_url) VALUES (?, ?, ?)",
                     (user_id, name, avatar_url))
        conn.commit()
        user = conn.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,)).fetchone()
        return jsonify({"ok": True, "user": as_dict(user)})


@app.route('/users/<user_id>', methods=['GET', 'PATCH'])
def get_user(user_id):
    conn = db_conn()
    if request.method == 'GET':
        user = conn.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,)).fetchone()
        if not user: return jsonify({"error": "no such user"}), 404
        return jsonify(as_dict(user))
    if request.method == 'PATCH':
        data = request.json
        bio = data.get('bio')
        conn.execute("UPDATE Users SET bio=? WHERE user_id=?", (bio, user_id))
        conn.commit()
        return jsonify({"ok": True})


# ===== POSTS & FEED =====

@app.route('/posts', methods=['GET', 'POST'])
def posts():
    conn = db_conn()
    if request.method == 'GET':
        posts = conn.execute("""
            SELECT p.*, u.name as author_name, u.avatar_url as author_avatar, u.user_id as author_user_id,
                   (SELECT COUNT(*) FROM Likes WHERE post_id=p.post_id) as like_count,
                   (SELECT COUNT(*) FROM Dislikes WHERE post_id=p.post_id) as dislike_count,
                   (SELECT COUNT(*) FROM Comments WHERE post_id=p.post_id) as comment_count
            FROM Posts p LEFT JOIN Users u ON p.user_id = u.user_id
            ORDER BY p.created_at DESC LIMIT 100
        """).fetchall()
        return jsonify([as_dict(p) for p in posts])
    else:
        data = request.json
        title = data.get('title')
        content = data.get('content')
        user_id = data.get('user_id')
        time = dt_now()
        cur = conn.cursor()
        cur.execute("INSERT INTO Posts (title, content, user_id, created_at) VALUES (?, ?, ?, ?)",
                    (title, content, user_id, time))
        conn.commit()
        post_id = cur.lastrowid
        return jsonify({'post_id': post_id, "ok": True})


@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    conn = db_conn()
    conn.execute("DELETE FROM Posts WHERE post_id=?", (post_id,))
    conn.execute("DELETE FROM Likes WHERE post_id=?", (post_id,))
    conn.execute("DELETE FROM Dislikes WHERE post_id=?", (post_id,))
    conn.execute("DELETE FROM Comments WHERE post_id=?", (post_id,))
    conn.commit()
    return jsonify({'ok': True})


# ======= ANNOUNCEMENTS =======
@app.route('/announcements', methods=['GET', 'POST', 'DELETE'])
def announcements():
    conn = db_conn()
    if request.method == 'GET':
        anns = conn.execute(
            "SELECT * FROM Announcements WHERE active=1 ORDER BY created_at DESC LIMIT 5"
        ).fetchall()
        return jsonify([as_dict(a) for a in anns])
    elif request.method == 'POST':
        data = request.json
        title = data.get('title')
        content = data.get('content')
        active = 1
        conn.execute("INSERT INTO Announcements (title, content, created_at, active) VALUES (?, ?, ?, ?)",
                     (title, content, dt_now(), active))
        conn.commit()
        return jsonify({'ok': True})
    else:  # DELETE (clear all active)
        conn.execute("UPDATE Announcements SET active=0;")
        conn.commit()
        return jsonify({'ok': True})

# ======= COMMENTS ========
@app.route('/posts/<int:post_id>/comments', methods=['GET', 'POST'])
def comments(post_id):
    conn = db_conn()
    if request.method == 'GET':
        comments = conn.execute("""
            SELECT c.*, u.name as author_name, u.avatar_url as author_avatar, u.user_id as author_user_id
            FROM Comments c LEFT JOIN Users u ON c.user_id = u.user_id
            WHERE c.post_id=?
            ORDER BY c.created_at ASC
        """, (post_id,)).fetchall()
        return jsonify([as_dict(c) for c in comments])
    else:
        data = request.json
        content = data.get('content')
        user_id = data.get('user_id')
        time = dt_now()
        conn.execute("INSERT INTO Comments (content, user_id, post_id, created_at) VALUES (?, ?, ?, ?)",
                     (content, user_id, post_id, time))
        conn.commit()
        return jsonify({"ok": True})


@app.route('/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    conn = db_conn()
    conn.execute("DELETE FROM Comments WHERE comment_id=?", (comment_id,))
    conn.commit()
    return jsonify({'ok': True})


# ======= REPORTS ========
@app.route('/reports', methods=['POST', 'GET'])
def reports():
    conn = db_conn()
    if request.method == 'POST':
        data = request.json
        conn.execute("""INSERT INTO Reports
            (reporter_id, post_id, comment_id, reason, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?)""",
                     (data.get('reporter_id'), data.get('post_id'), data.get('comment_id'),
                      data.get('reason'), "pending", dt_now()))
        conn.commit()
        return jsonify({'ok': True})
    else:  # GET -- for a user
        user_id = request.args.get('user_id')
        reports = conn.execute("SELECT * FROM Reports WHERE reporter_id=? ORDER BY created_at DESC", (user_id,)).fetchall()
        return jsonify([as_dict(x) for x in reports])

# ======= LIKES/DISLIKES ======
@app.route('/posts/<int:post_id>/like', methods=['POST', 'DELETE'])
def toggle_like(post_id):
    data = request.json
    user_id = data.get('user_id')
    conn = db_conn()
    if request.method == 'POST':
        # Remove any dislike
        conn.execute("DELETE FROM Dislikes WHERE post_id=? AND user_id=?", (post_id, user_id))
        # Add like if not exists
        already = conn.execute("SELECT 1 FROM Likes WHERE post_id=? AND user_id=?",
                               (post_id, user_id)).fetchone()
        if not already:
            conn.execute("INSERT INTO Likes (post_id, user_id) VALUES (?, ?)", (post_id, user_id))
    else:
        conn.execute("DELETE FROM Likes WHERE post_id=? AND user_id=?", (post_id, user_id))
    conn.commit()
    return jsonify({'ok': True})


@app.route('/posts/<int:post_id>/dislike', methods=['POST', 'DELETE'])
def toggle_dislike(post_id):
    data = request.json
    user_id = data.get('user_id')
    conn = db_conn()
    if request.method == 'POST':
        # Remove any like
        conn.execute("DELETE FROM Likes WHERE post_id=? AND user_id=?", (post_id, user_id))
        # Add dislike if not exists
        already = conn.execute("SELECT 1 FROM Dislikes WHERE post_id=? AND user_id=?",
                               (post_id, user_id)).fetchone()
        if not already:
            conn.execute("INSERT INTO Dislikes (post_id, user_id) VALUES (?, ?)", (post_id, user_id))
    else:
        conn.execute("DELETE FROM Dislikes WHERE post_id=? AND user_id=?", (post_id, user_id))
    conn.commit()
    return jsonify({'ok': True})

# ======= FOLLOWS =======
@app.route('/follows', methods=['POST', 'DELETE'])
def toggle_follow():
    data = request.json
    follower_id = data.get('follower_id')
    following_id = data.get('following_id')
    conn = db_conn()
    if request.method == 'POST':
        # Only insert if not exists
        already = conn.execute("""
            SELECT 1 FROM Follows WHERE follower_id=? AND following_id=?
        """, (follower_id, following_id)).fetchone()
        if not already:
            conn.execute("INSERT INTO Follows (follower_id, following_id) VALUES (?, ?)",
                         (follower_id, following_id))
    else:
        conn.execute("DELETE FROM Follows WHERE follower_id=? AND following_id=?", (follower_id, following_id))
    conn.commit()
    return jsonify({'ok': True})


@app.route('/profile/<user_id>', methods=['GET'])
def profile(user_id):
    conn = db_conn()
    user = conn.execute(
        "SELECT * FROM Users WHERE user_id=?", (user_id,)).fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404

    followers = conn.execute(
        "SELECT COUNT(*) as cnt FROM Follows WHERE following_id=?", (user_id,)
    ).fetchone()['cnt']
    following = conn.execute(
        "SELECT COUNT(*) as cnt FROM Follows WHERE follower_id=?", (user_id,)
    ).fetchone()['cnt']
    posts = conn.execute(
        "SELECT * FROM Posts WHERE user_id=? ORDER BY created_at DESC LIMIT 30", (user_id,)
    ).fetchall()

    # Audiences ("tags" -- not implemented here)
    user_profile = as_dict(user)
    user_profile['followers'] = followers
    user_profile['following'] = following
    user_profile['posts'] = [as_dict(p) for p in posts]
    return jsonify(user_profile)


# ====== TAGS & AUTO-TAGS? =====
# Left as stub, since this would be an ML or cloud function.

# ====== INITIALISER for DB  =====
# Use once for first-time setup:
@app.route('/_initdb', methods=['GET'])
def init_db():
    with sqlite3.connect(DATABASE) as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS Users (
            user_id TEXT PRIMARY KEY,
            name TEXT,
            avatar_url TEXT,
            bio TEXT
        );
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS Posts (
            post_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            content TEXT,
            user_id TEXT,
            created_at TEXT
        );
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS Comments (
            comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT,
            user_id TEXT,
            post_id INTEGER,
            created_at TEXT
        );
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS Likes (
            post_id INTEGER,
            user_id TEXT
        ); """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS Dislikes (
            post_id INTEGER,
            user_id TEXT
        ); """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS Reports (
            report_id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter_id TEXT,
            post_id INTEGER,
            comment_id INTEGER,
            reason TEXT,
            status TEXT,
            created_at TEXT
        ); """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS Announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            content TEXT,
            created_at TEXT,
            active INTEGER
        );
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS Follows (
            follower_id TEXT,
            following_id TEXT
        );
        """)
    return "DB initialised", 200


if __name__ == '__main__':
    app.run(debug=True)
