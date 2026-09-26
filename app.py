from __future__ import annotations

import json
import os
import re
import smtplib
import sqlite3
from datetime import datetime
from functools import wraps
from email.message import EmailMessage
from pathlib import Path

from flask import (
    Flask,
    abort,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename


BASE_DIR = Path(__file__).resolve().parent
PRIMARY_DB_PATH = BASE_DIR / "database.db"
FALLBACK_DB_PATH = Path(os.environ.get("TEMP", str(BASE_DIR))) / "found_lost_database.db"
UPLOAD_DIR = BASE_DIR / "static" / "uploads"
ALLOWED_UPLOADS = {"png", "jpg", "jpeg", "gif", "webp"}
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "found-and-lost-dev-key")
app.config["UPLOAD_FOLDER"] = str(UPLOAD_DIR)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024
app.config["DATABASE_PATH"] = str(PRIMARY_DB_PATH)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(app.config["DATABASE_PATH"])
    conn.row_factory = sqlite3.Row
    return conn


def ensure_database_path() -> None:
    preferred = Path(app.config["DATABASE_PATH"])
    try:
        with sqlite3.connect(preferred) as conn:
            conn.execute("PRAGMA user_version = 1")
        return
    except (sqlite3.OperationalError, sqlite3.DatabaseError, OSError):
        fallback = FALLBACK_DB_PATH
        fallback.parent.mkdir(parents=True, exist_ok=True)
        app.config["DATABASE_PATH"] = str(fallback)


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row else None


def dicts(rows) -> list[dict]:
    return [dict(row) for row in rows]


def now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_UPLOADS


def is_valid_email(address: str | None) -> bool:
    return bool(address and EMAIL_REGEX.match(address.strip()))


def first_valid_email(*addresses: str | None) -> str | None:
    for address in addresses:
        if is_valid_email(address):
            return address.strip().lower()
    return None


def send_email_message(to_email: str, subject: str, body: str) -> tuple[bool, str]:
    # SMTP email sending is configured only through environment variables.
    # Never hardcode SMTP passwords or Gmail app passwords in this file.
    to_email = (to_email or "").strip().lower()
    if not is_valid_email(to_email):
        return False, "Invalid recipient email."

    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = int(os.environ.get("SMTP_PORT", "587") or 587)
    smtp_username = os.environ.get("SMTP_USERNAME", "").strip()
    smtp_password = os.environ.get("SMTP_PASSWORD", "")
    smtp_from_email = os.environ.get("SMTP_FROM_EMAIL", "").strip() or smtp_username
    smtp_from_name = os.environ.get("SMTP_FROM_NAME", "Found & Lost").strip() or "Found & Lost"
    use_tls = os.environ.get("SMTP_USE_TLS", "1").strip().lower() not in {"0", "false", "no"}

    if not smtp_host or not smtp_from_email:
        app.logger.warning("SMTP is not configured. Skipping email to %s.", to_email)
        return False, "SMTP not configured."

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{smtp_from_name} <{smtp_from_email}>"
    message["To"] = to_email
    message.set_content(body)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as smtp:
            if use_tls:
                smtp.starttls()
            if smtp_username:
                smtp.login(smtp_username, smtp_password)
            smtp.send_message(message)
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        app.logger.exception("Failed to send email to %s.", to_email)
        return False, str(exc)

    return True, "Email sent."


def parse_claim_message(message: str | None) -> dict:
    if not message:
        return {}
    try:
        parsed = json.loads(message)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def claim_notification_context(conn: sqlite3.Connection, claim_id: int) -> dict | None:
    claim = conn.execute(
        """
        SELECT claims.*, users.name AS claimant_name, users.email AS claimant_email, users.phone AS claimant_phone
        FROM claims
        LEFT JOIN users ON users.id = claims.user_id
        WHERE claims.id = ?
        """,
        (claim_id,),
    ).fetchone()
    if not claim:
        return None

    claim_dict = dict(claim)
    claim_payload = parse_claim_message(claim_dict.get("message"))
    item_table = "lost_items" if claim_dict.get("item_type") == "lost" else "found_items"
    item = conn.execute(f"SELECT * FROM {item_table} WHERE id = ?", (claim_dict["item_id"],)).fetchone()

    return {
        "claim": claim_dict,
        "claim_payload": claim_payload,
        "item": dict(item) if item else None,
        "recipient_email": first_valid_email(
            claim_payload.get("email"),
            claim_dict.get("claimant_email"),
        ),
        "claimant_name": claim_payload.get("name") or claim_dict.get("claimant_name") or "User",
        "claimant_phone": claim_payload.get("phone") or claim_dict.get("claimant_phone") or "",
    }


def build_claim_email(context: dict, decision: str, admin_info: dict) -> tuple[tuple[str, str, str], tuple[str, str, str]]:
    claim = context["claim"]
    item = context.get("item") or {}
    claimant_name = context["claimant_name"]
    claimant_phone = context["claimant_phone"]
    recipient_email = context.get("recipient_email")
    admin_name = admin_info.get("name") or "Admin"
    admin_email = admin_info.get("email") or ""
    admin_phone = admin_info.get("phone") or ""

    item_name = item.get("item_name") or f"Item #{claim.get('item_id')}"
    category = item.get("category") or "Unknown"
    location = item.get("location") or "Unknown"
    item_status = "Found" if claim.get("item_type") == "found" else "Lost"
    decision_label = "approved" if decision.lower() == "approved" else "rejected"
    decision_title = decision_label.title()

    user_subject = f"Your claim was {decision_label} for {item_name}"
    user_body = (
        f"Hello {claimant_name},\n\n"
        f"Your claim for \"{item_name}\" has been {decision_label} by the admin team.\n\n"
        f"Claim details:\n"
        f"- Item: {item_name}\n"
        f"- Category: {category}\n"
        f"- Status: {item_status}\n"
        f"- Location: {location}\n"
        f"- Claim status: {claim.get('status')}\n"
        f"- Your email: {recipient_email or 'Not provided'}\n"
        f"- Your phone: {claimant_phone or 'Not provided'}\n\n"
        f"Admin contact:\n"
        f"- Name: {admin_name}\n"
        f"- Email: {admin_email or 'Not provided'}\n"
        f"- Phone: {admin_phone or 'Not provided'}\n\n"
        + (
            "Your claim was approved. Please contact the admin above to arrange pickup or verification.\n"
            if decision_label == "approved"
            else "Your claim was rejected. If you believe this is a mistake, reply to this email or contact the admin above for review.\n"
        )
        + "\nThank you,\nFound & Lost Team"
    )

    admin_subject = f"Claim {decision_title}: {item_name}"
    admin_body = (
        f"Hello {admin_name},\n\n"
        f"The claim below has been {decision_label}.\n\n"
        f"Item: {item_name}\n"
        f"Category: {category}\n"
        f"Location: {location}\n"
        f"Claim status: {claim.get('status')}\n"
        f"Claimant: {claimant_name}\n"
        f"Claimant email: {recipient_email or 'Not provided'}\n"
        f"Claimant phone: {claimant_phone or 'Not provided'}\n\n"
        f"Admin contact used in the user email:\n"
        f"- Email: {admin_email or 'Not provided'}\n"
        f"- Phone: {admin_phone or 'Not provided'}\n\n"
        f"Claim record id: {claim.get('id')}\n"
        f"Submitted at: {claim.get('created_at')}\n"
    )

    return (recipient_email or "", user_subject, user_body), (admin_email or "", admin_subject, admin_body)


def login_required(role: str | None = None):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if "account_id" not in session:
                if request.headers.get("X-Requested-With") == "fetch":
                    return jsonify({"ok": False, "message": "Please log in first.", "redirect": url_for("login_page")}), 401
                return redirect(url_for("login_page"))
            if role and session.get("role") != role:
                if request.headers.get("X-Requested-With") == "fetch":
                    return jsonify({"ok": False, "message": "You do not have access to this page.", "redirect": url_for("login_page")}), 403
                return redirect(url_for("login_page"))
            return func(*args, **kwargs)

        return wrapper

    return decorator


def init_db() -> None:
    ensure_database_path()
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT NOT NULL,
                password TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT NOT NULL,
                password TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS lost_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                item_name TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                location TEXT NOT NULL,
                date_lost TEXT NOT NULL,
                photo TEXT,
                status TEXT NOT NULL DEFAULT 'Pending',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS found_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                item_name TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                location TEXT NOT NULL,
                date_found TEXT NOT NULL,
                photo TEXT,
                status TEXT NOT NULL DEFAULT 'Pending',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS claims (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                item_id INTEGER NOT NULL,
                item_type TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL,
                email TEXT NOT NULL,
                rating INTEGER NOT NULL DEFAULT 5,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        if conn.execute("SELECT COUNT(*) FROM admins").fetchone()[0] == 0:
            conn.execute(
                """
                INSERT INTO admins (admin_name, email, phone, password)
                VALUES (?, ?, ?, ?)
                """,
                (
                    "Founder Admin",
                    "admin@founder.com",
                    "9999999999",
                    generate_password_hash("admin123"),
                ),
            )

        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            conn.execute(
                """
                INSERT INTO users (name, email, phone, password)
                VALUES (?, ?, ?, ?)
                """,
                (
                    "Demo User",
                    "user@founder.com",
                    "8888888888",
                    generate_password_hash("user123"),
                ),
            )

        demo_item_names = (
            "Graphing Calculator",
            "Black Laptop Bag",
            "Dell Laptop",
            "Student ID",
            "Casio Calculator",
            "Apple AirPods",
        )
        placeholders = ",".join("?" for _ in demo_item_names)
        conn.execute(
            f"DELETE FROM lost_items WHERE item_name IN ({placeholders}) AND status = 'Pending'",
            demo_item_names,
        )
        conn.execute(
            f"DELETE FROM found_items WHERE item_name IN ({placeholders}) AND status = 'Pending'",
            demo_item_names,
        )

        # Keep the search page empty until users report real lost/found items.


def current_user():
    if "account_id" not in session:
        return None
    role = session.get("role")
    with get_conn() as conn:
        if role == "admin":
            row = conn.execute("SELECT * FROM admins WHERE id = ?", (session["account_id"],)).fetchone()
        else:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (session["account_id"],)).fetchone()
    return row_to_dict(row)


def fetch_items(search: str = "", status: str = "", category: str = "") -> list[dict]:
    with get_conn() as conn:
        lost = conn.execute(
            """
            SELECT id, user_id, item_name, category, description, location, date_lost AS item_date,
                   photo, status, created_at, 'lost' AS item_type
            FROM lost_items
            """
        ).fetchall()
        found = conn.execute(
            """
            SELECT id, user_id, item_name, category, description, location, date_found AS item_date,
                   photo, status, created_at, 'found' AS item_type
            FROM found_items
            """
        ).fetchall()

    items = dicts(lost) + dicts(found)
    query = search.strip().lower()
    cat_query = category.strip().lower()
    status_query = status.strip().lower()
    if query or cat_query or status_query:
        filtered = []
        for item in items:
            haystack = " ".join(
                [
                    str(item.get("item_name", "")),
                    str(item.get("category", "")),
                    str(item.get("description", "")),
                    str(item.get("location", "")),
                    str(item.get("status", "")),
                ]
            ).lower()
            if query and query not in haystack:
                continue
            if cat_query and cat_query not in str(item.get("category", "")).lower():
                continue
            if status_query and status_query != str(item.get("item_type", "")).lower():
                continue
            filtered.append(item)
        items = filtered
    items.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return items


def item_owner_label(item: dict) -> str:
    return "User Report" if item.get("item_type") == "lost" else "Finder Report"


@app.context_processor
def inject_globals():
    return {
        "logged_in": "account_id" in session,
        "account_role": session.get("role"),
        "account_name": session.get("name"),
        "current_user": current_user(),
    }


@app.route("/")
def index():
    return redirect(url_for("home_page"))


@app.route("/site-actions.js")
def site_actions_js():
    return send_from_directory(BASE_DIR / "static" / "js", "site-actions.js")


@app.route("/assets/<path:filename>")
def assets(filename: str):
    return send_from_directory(BASE_DIR / "assets", filename)


@app.route("/uploads/<path:filename>")
def uploads(filename: str):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route("/Home.html", methods=["GET", "POST"])
def home_page():
    if request.method == "POST":
        user_name = request.form.get("review_name", "").strip()
        email = request.form.get("review_email", "").strip()
        rating = int(request.form.get("review_rating", "5") or 5)
        message = request.form.get("review_message", "").strip()
        if not user_name or not email or not message:
            return jsonify({"ok": False, "message": "Please fill in all review fields."}), 400
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO reviews (user_name, email, rating, message, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_name, email, rating, message, now()),
            )
        if request.is_json:
            return jsonify({"ok": True, "message": "Review submitted."})
        flash("Review submitted.", "success")
        return redirect(url_for("home_page"))

    with get_conn() as conn:
        reviews = conn.execute("SELECT * FROM reviews ORDER BY created_at DESC LIMIT 4").fetchall()
        review_count = conn.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]
    return render_template(
        "Home.html",
        reviews=dicts(reviews),
        review_count=review_count,
    )


@app.route("/Login.html")
def login_page():
    return render_template("Login.html")


def auth_response(message: str, redirect_to: str | None = None, status: int = 200):
    payload = {"ok": status < 400, "message": message}
    if redirect_to:
        payload["redirect"] = redirect_to
    return jsonify(payload), status


@app.route("/auth", methods=["POST"])
def auth():
    mode = request.form.get("mode", "user")
    action = request.form.get("action", "login")

    if mode == "user":
        if action == "register":
            name = request.form.get("name", "").strip()
            email = request.form.get("email", "").strip().lower()
            phone = request.form.get("phone", "").strip()
            password = request.form.get("password", "")
            confirm = request.form.get("confirm_password", "")
            if not name or not email or not phone or not password or not confirm:
                return auth_response("Please fill in all user registration fields.", status=400)
            if password != confirm:
                return auth_response("Passwords do not match.", status=400)
            with get_conn() as conn:
                exists = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
                if exists:
                    return auth_response("An account already exists with that email.", status=400)
                conn.execute(
                    """
                    INSERT INTO users (name, email, phone, password, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (name, email, phone, generate_password_hash(password), now()),
                )
            return auth_response("User account created. Please log in.", redirect_to=url_for("login_page"))

        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        if not email or not password:
            return auth_response("Please enter your email and password.", status=400)
        with get_conn() as conn:
            user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not user or not check_password_hash(user["password"], password):
            return auth_response("Invalid user credentials.", status=401)
        session.clear()
        session.update(
            {
                "account_id": user["id"],
                "role": "user",
                "name": user["name"],
                "email": user["email"],
                "phone": user["phone"],
            }
        )
        return auth_response("Login successful.", redirect_to=url_for("user_dashboard"))

    if action == "register":
        admin_name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        phone = request.form.get("phone", "").strip()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")
        admin_id = request.form.get("admin_id", "").strip()
        if not admin_name or not email or not phone or not password or not confirm or not admin_id:
            return auth_response("Please fill in all admin registration fields.", status=400)
        if password != confirm:
            return auth_response("Passwords do not match.", status=400)
        with get_conn() as conn:
            exists = conn.execute("SELECT id FROM admins WHERE email = ?", (email,)).fetchone()
            if exists:
                return auth_response("An admin account already exists with that email.", status=400)
            conn.execute(
                """
                INSERT INTO admins (admin_name, email, phone, password, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (admin_name, email, phone, generate_password_hash(password), now()),
            )
        return auth_response("Admin account created. Please log in.", redirect_to=url_for("login_page"))

    identifier = request.form.get("identifier", "").strip().lower()
    password = request.form.get("password", "")
    if not identifier or not password:
        return auth_response("Please enter your admin ID or email and password.", status=400)
    with get_conn() as conn:
        admin = conn.execute(
            "SELECT * FROM admins WHERE email = ? OR CAST(id AS TEXT) = ?",
            (identifier, identifier),
        ).fetchone()
    if not admin or not check_password_hash(admin["password"], password):
        return auth_response("Invalid admin credentials.", status=401)
    session.clear()
    session.update(
        {
            "account_id": admin["id"],
            "role": "admin",
            "name": admin["admin_name"],
            "email": admin["email"],
            "phone": admin["phone"],
        }
    )
    return auth_response("Admin login successful.", redirect_to=url_for("admin_dashboard"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login_page"))


def save_upload(file_storage):
    if not file_storage or not file_storage.filename:
        return None
    if not allowed_file(file_storage.filename):
        return None
    filename = secure_filename(file_storage.filename)
    stem = Path(filename).stem
    suffix = Path(filename).suffix
    unique_name = f"{stem}-{int(datetime.utcnow().timestamp())}{suffix}"
    target = UPLOAD_DIR / unique_name
    file_storage.save(target)
    return unique_name


@app.route("/Reportlost.html", methods=["GET", "POST"])
@login_required("user")
def report_lost():
    if request.method == "POST":
        item_name = request.form.get("item_name", "").strip()
        category = request.form.get("category", "").strip()
        description = request.form.get("description", "").strip()
        location = request.form.get("location", "").strip()
        date_lost = request.form.get("date_lost", "").strip()
        photo_file = request.files.get("photo")
        reporter_name = request.form.get("reporter_name", "").strip()
        reporter_phone = request.form.get("reporter_phone", "").strip()
        reporter_email = request.form.get("reporter_email", "").strip().lower()
        if not item_name or not category or not description or not location or not date_lost:
            return jsonify({"ok": False, "message": "Please complete all required fields."}), 400
        photo_name = save_upload(photo_file)
        with get_conn() as conn:
            if reporter_name or reporter_phone or reporter_email:
                conn.execute(
                    """
                    UPDATE users
                    SET name = COALESCE(NULLIF(?, ''), name),
                        phone = COALESCE(NULLIF(?, ''), phone),
                        email = COALESCE(NULLIF(?, ''), email)
                    WHERE id = ?
                    """,
                    (reporter_name, reporter_phone, reporter_email, session["account_id"]),
                )
            conn.execute(
                """
                INSERT INTO lost_items (user_id, item_name, category, description, location, date_lost, photo, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session["account_id"],
                    item_name,
                    category,
                    description,
                    location,
                    date_lost,
                    photo_name,
                    "Pending",
                    now(),
                ),
            )
        return jsonify({"ok": True, "message": "Lost item reported successfully.", "redirect": url_for("user_dashboard")})

    return render_template("Reportlost.html")


@app.route("/Reportfound.html", methods=["GET", "POST"])
@login_required("user")
def report_found():
    if request.method == "POST":
        item_name = request.form.get("item_name", "").strip()
        category = request.form.get("category", "").strip()
        description = request.form.get("description", "").strip()
        location = request.form.get("location", "").strip()
        date_found = request.form.get("date_found", "").strip()
        photo_file = request.files.get("photo")
        photo_data = request.form.get("photo_data", "").strip()
        reporter_name = request.form.get("reporter_name", "").strip()
        reporter_phone = request.form.get("reporter_phone", "").strip()
        reporter_email = request.form.get("reporter_email", "").strip().lower()
        if not item_name or not category or not description or not location or not date_found:
            return jsonify({"ok": False, "message": "Please complete all required fields."}), 400
        photo_name = photo_data or save_upload(photo_file)
        with get_conn() as conn:
            if reporter_name or reporter_phone or reporter_email:
                conn.execute(
                    """
                    UPDATE users
                    SET name = COALESCE(NULLIF(?, ''), name),
                        phone = COALESCE(NULLIF(?, ''), phone),
                        email = COALESCE(NULLIF(?, ''), email)
                    WHERE id = ?
                    """,
                    (reporter_name, reporter_phone, reporter_email, session["account_id"]),
                )
            conn.execute(
                """
                INSERT INTO found_items (user_id, item_name, category, description, location, date_found, photo, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session["account_id"],
                    item_name,
                    category,
                    description,
                    location,
                    date_found,
                    photo_name,
                    "Pending",
                    now(),
                ),
            )
        return jsonify({"ok": True, "message": "Found item reported successfully.", "redirect": url_for("user_dashboard")})

    return render_template("Reportfound.html")


@app.route("/Items&search.html")
def items_search():
    items = fetch_items(
        search=request.args.get("q", ""),
        status=request.args.get("status", ""),
        category=request.args.get("category", ""),
    )
    return render_template("Items&search.html", items=items, items_json=json.dumps(items))


@app.route("/claim", methods=["POST"])
@login_required("user")
def claim_item():
    item_id = request.form.get("item_id", "").strip()
    item_type = request.form.get("item_type", "").strip()
    message = request.form.get("message", "").strip()
    if not item_id or not item_type or not message:
        return jsonify({"ok": False, "message": "Please complete the claim form."}), 400
    if item_type not in {"lost", "found"}:
        return jsonify({"ok": False, "message": "Invalid item type."}), 400

    with get_conn() as conn:
        table = "lost_items" if item_type == "lost" else "found_items"
        item = conn.execute(f"SELECT id FROM {table} WHERE id = ?", (item_id,)).fetchone()
        if not item:
            return jsonify({"ok": False, "message": "Item not found."}), 404
        claim_payload = {
            "name": request.form.get("claim_name", "").strip(),
            "phone": request.form.get("claim_phone", "").strip(),
            "email": request.form.get("claim_email", "").strip(),
            "message": message,
        }
        conn.execute(
            """
            INSERT INTO claims (user_id, item_id, item_type, message, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (session["account_id"], int(item_id), item_type, json.dumps(claim_payload), "Pending", now()),
        )
    return jsonify({"ok": True, "message": "Claim submitted successfully. Await admin approval."})


@app.route("/userdash.html")
@login_required("user")
def user_dashboard():
    user_id = session["account_id"]
    with get_conn() as conn:
        lost_items = conn.execute(
            "SELECT * FROM lost_items WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        found_items = conn.execute(
            "SELECT * FROM found_items WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        claims = conn.execute(
            "SELECT * FROM claims WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return render_template(
        "userdash.html",
        user_lost_items=dicts(lost_items),
        user_found_items=dicts(found_items),
        user_claims=dicts(claims),
    )


@app.route("/Admindash.html")
@login_required("admin")
def admin_dashboard():
    with get_conn() as conn:
        users = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
        admins = conn.execute("SELECT * FROM admins ORDER BY created_at DESC").fetchall()
        lost_items = conn.execute(
            "SELECT lost_items.*, users.name AS reporter_name, users.email AS reporter_email FROM lost_items LEFT JOIN users ON users.id = lost_items.user_id ORDER BY lost_items.created_at DESC"
        ).fetchall()
        found_items = conn.execute(
            "SELECT found_items.*, users.name AS reporter_name, users.email AS reporter_email FROM found_items LEFT JOIN users ON users.id = found_items.user_id ORDER BY found_items.created_at DESC"
        ).fetchall()
        claims = conn.execute(
            """
            SELECT claims.*, users.name AS claimant_name, users.email AS claimant_email
            FROM claims
            LEFT JOIN users ON users.id = claims.user_id
            ORDER BY claims.created_at DESC
            """
        ).fetchall()
        reviews = conn.execute("SELECT * FROM reviews ORDER BY created_at DESC").fetchall()

    return render_template(
        "Admindash.html",
        users=dicts(users),
        admins=dicts(admins),
        lost_items=dicts(lost_items),
        found_items=dicts(found_items),
        claims=dicts(claims),
        reviews=dicts(reviews),
        counts={
            "users": len(users),
            "lost_items": len(lost_items),
            "found_items": len(found_items),
            "claims": len(claims),
            "reviews": len(reviews),
        },
    )


@app.route("/admin/action", methods=["POST"])
@login_required("admin")
def admin_action():
    target_type = request.form.get("type", "").strip()
    target_id = request.form.get("id", "").strip()
    action = request.form.get("action", "").strip().lower()
    item_type = request.form.get("item_type", "").strip().lower()
    if target_type not in {"report", "claim", "review"} or not target_id:
        return jsonify({"ok": False, "message": "Invalid admin action."}), 400
    if not target_id.isdigit():
        return jsonify({"ok": False, "message": "Invalid record id."}), 400

    notification_context = None
    decision = None
    numeric_target_id = int(target_id)
    with get_conn() as conn:
        if target_type == "report":
            if item_type not in {"lost", "found"}:
                return jsonify({"ok": False, "message": "Invalid report type."}), 400
            table = "lost_items" if item_type == "lost" else "found_items"
            exists = conn.execute(f"SELECT id FROM {table} WHERE id = ?", (numeric_target_id,)).fetchone()
            if not exists:
                return jsonify({"ok": False, "message": "Report not found."}), 404
            if action == "delete":
                conn.execute(f"DELETE FROM {table} WHERE id = ?", (numeric_target_id,))
            elif action in {"approved", "rejected"}:
                conn.execute(f"UPDATE {table} SET status = ? WHERE id = ?", (action.title(), numeric_target_id))
        elif target_type == "claim":
            if action == "delete":
                conn.execute("DELETE FROM claims WHERE id = ?", (target_id,))
            elif action in {"approved", "rejected"}:
                notification_context = claim_notification_context(conn, numeric_target_id)
                if not notification_context:
                    return jsonify({"ok": False, "message": "Claim not found."}), 404
                decision = action.title()
                conn.execute("UPDATE claims SET status = ? WHERE id = ?", (decision, target_id))
                notification_context["claim"]["status"] = decision
        elif target_type == "review":
            if action == "delete":
                conn.execute("DELETE FROM reviews WHERE id = ?", (target_id,))

    response_message = "Admin action completed."
    notification_results = None
    if target_type == "claim" and decision and notification_context:
        admin_info = {
            "name": session.get("name", "Admin"),
            "email": session.get("email", ""),
            "phone": session.get("phone", ""),
        }
        user_email_data, admin_email_data = build_claim_email(notification_context, decision, admin_info)
        user_email, user_subject, user_body = user_email_data
        admin_email, admin_subject, admin_body = admin_email_data

        user_sent = False
        admin_sent = False
        user_status = "skipped"
        admin_status = "skipped"

        # Send the automatic approve/reject notification to the claimant.
        if user_email:
            user_sent, user_status = send_email_message(user_email, user_subject, user_body)
        else:
            user_status = "invalid claimant email"

        # Send a copy to the logged-in admin so the decision has an email trail.
        if admin_email:
            admin_sent, admin_status = send_email_message(admin_email, admin_subject, admin_body)
        else:
            admin_status = "invalid admin email"

        notification_results = {
            "recipient_email": user_email,
            "admin_email": admin_email,
            "user_sent": user_sent,
            "admin_sent": admin_sent,
            "user_status": user_status,
            "admin_status": admin_status,
        }

        claim_name = notification_context["item"]["item_name"] if notification_context.get("item") else f"Claim #{target_id}"
        response_message = f"Claim {decision.lower()} for {claim_name}."
        if user_email:
            response_message += f" User email {'sent' if user_sent else user_status.rstrip('.')}."
        else:
            response_message += " User email skipped because no valid recipient email was available."
        if admin_email:
            response_message += f" Admin copy {'sent' if admin_sent else admin_status.rstrip('.')}."

    payload = {"ok": True, "message": response_message}
    if notification_results is not None:
        payload["notification"] = notification_results
    return jsonify(payload)


@app.route("/api/bootstrap")
def bootstrap():
    with get_conn() as conn:
        counts = {
            "users": conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
            "admins": conn.execute("SELECT COUNT(*) FROM admins").fetchone()[0],
            "lost_items": conn.execute("SELECT COUNT(*) FROM lost_items").fetchone()[0],
            "found_items": conn.execute("SELECT COUNT(*) FROM found_items").fetchone()[0],
            "claims": conn.execute("SELECT COUNT(*) FROM claims").fetchone()[0],
            "reviews": conn.execute("SELECT COUNT(*) FROM reviews").fetchone()[0],
        }
    return jsonify(counts)


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
