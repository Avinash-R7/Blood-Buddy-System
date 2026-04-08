from flask import Flask, request, jsonify, render_template, redirect

app = Flask(__name__)

users = {}
donors = []
requests_db = []
notifications = []

def get_donor_badge(d):
    donations = d.get('donation_count', 0)
    if donations >= 10: return "Hero"
    if donations >= 5: return "Gold"
    if donations >= 2: return "Silver"
    return "Bronze"

# 🧠 Smart Score
def calculate_score(d, req):
    score = 0

    if d.get("available"):
        score += 40

    score += d.get("response_rate", 0) * 30
    score += d.get("donation_count", 0) * 10

    if req.get("urgency") == "critical":
        score += 20

    donor_loc = str(d.get("location", "")).lower().strip()
    req_loc = str(req.get("location", "")).lower().strip()

    if donor_loc and req_loc:
        if donor_loc == req_loc:
            score += 30 # exact pin/area match
        elif donor_loc in req_loc or req_loc in donor_loc and len(req_loc)>2:
            score += 15 # partial match
        else:
            score -= 10
            
    return score

# 🏠 Login / Register Page
@app.route('/')
def home():
    return render_template("register.html")

# 🔑 Login User
@app.route('/login', methods=['POST'])
def login():
    data = request.form
    email = data.get("email")
    password = data.get("password")
    
    # find user by email
    found_user = None
    for u in users.values():
        if u.get("email") == email and u.get("password") == password:
            found_user = u
            break
            
    if found_user:
        found_user['last_active'] = "Just now" # Update last active
        if found_user["role"] == "donor":
            return redirect(f"/donor/{found_user['name']}")
        else:
            return redirect(f"/requester/{found_user['name']}")
            
    # Failed login - redirect back 
    # In a real app we'd flash an error message
    return redirect("/")

# ➕ Register User
@app.route('/register', methods=['POST'])
def register_user():
    data = request.form

    user_name = data.get("name")
    user = {
        "name": user_name,
        "email": data.get("email"),
        "phone": data.get("phone"),
        "password": data.get("password"),
        "role": data.get("role"),
        "blood_group": data.get("blood"),
        "location": data.get("location"),
        "available": True,
        "history": [],
        "last_active": "Just now"
    }

    users[user["name"]] = user

    if user["role"] == "donor":
        user["response_rate"] = 1.0 # Start with perfect response rate
        user["donation_count"] = 0
        user["badge"] = get_donor_badge(user)
        donors.append(user)
        return redirect(f"/donor/{user['name']}")
    else:
        return redirect(f"/requester/{user['name']}")

# 🧑‍⚕️ Donor Dashboard
@app.route('/donor/<name>')
def donor_dashboard(name):
    user_data = users.get(name, {"name": name, "role": "donor", "blood_group": "?", "history": []})
    user_data['badge'] = get_donor_badge(user_data)
    return render_template("donor_dashboard.html", user=name, user_data=user_data)

# 🩸 Requester Dashboard
@app.route('/requester/<name>')
def requester_dashboard(name):
    user_data = users.get(name, {"name": name, "role": "requester", "blood_group": "?", "history": []})
    return render_template("requester_dashboard.html", user=name, user_data=user_data)

# 👤 User Profile
@app.route('/profile/<name>')
def user_profile(name):
    user_data = users.get(name)
    if not user_data:
        return redirect("/")
    # Get badge if donor
    if user_data.get("role") == "donor":
        user_data['badge'] = get_donor_badge(user_data)
    else:
        user_data['badge'] = None
    return render_template("profile.html", user=name, user_data=user_data)

# 🚨 Create Request
@app.route('/create_request', methods=['POST'])
def create_request():
    data = request.json

    # 🛑 VALIDATION
    if not data.get("blood_group"):
        return jsonify({"error": "Blood group required"}), 400

    if not data.get("location"):
        return jsonify({"error": "Location required"}), 400

    if not data.get("requester"):
        return jsonify({"error": "Requester missing"}), 400

    req_entity = {
        "requester": data["requester"],
        "blood_group": data["blood_group"],
        "location": data["location"],
        "urgency": data.get("urgency", "normal"),
        "accepted_by": None,
        "timestamp": "Just now"
    }
    requests_db.append(req_entity)
    
    # Store in requester history
    req_user = users.get(data["requester"])
    if req_user:
        req_user["history"].insert(0, f"Requested {data['blood_group']} ({data.get('urgency')})")

    matched = []
    for d in donors:
        if d.get("blood_group") == data.get("blood_group"):
            d["score"] = calculate_score(d, data)
            matched.append(d)

    matched.sort(key=lambda x: x["score"], reverse=True)
    top = matched[:3]

    # 🔔 notify top donors
    for d in top:
        notifications.append({
            "to": d.get("name"),
            "from": data.get("requester"),
            "blood": data.get("blood_group"),
            "urgency": data.get("urgency")
        })

    return jsonify(top)

# 🔔 Get Notifications
@app.route('/notifications/<name>')
def get_notifications(name):
    user_notifs = [n for n in notifications if n["to"] == name]
    return jsonify(user_notifs)

# ✅ Accept Request
@app.route('/accept', methods=['POST'])
def accept():
    data = request.json
    donor_name = data["donor"]
    requester_name = data["requester"]

    for req in requests_db:
        if req["requester"] == requester_name:
            req["accepted_by"] = donor_name

    # Update donor stats
    donor = users.get(donor_name)
    if donor:
        donor["donation_count"] = donor.get("donation_count", 0) + 1
        donor["badge"] = get_donor_badge(donor)
        donor["history"].insert(0, f"Accepted request from {requester_name}")
        
    # Update requester history
    req_user = users.get(requester_name)
    if req_user:
        req_user["history"].insert(0, f"Request accepted by {donor_name}")

    # Remove notifications for this request
    global notifications
    notifications = [n for n in notifications if n["from"] != requester_name]

    return jsonify({
        "msg": f"{donor_name} accepted request"
    })

# 📊 Request Status
@app.route('/request_status/<name>')
def request_status(name):
    for req in requests_db:
        if req["requester"] == name:
            return jsonify(req)
    return jsonify({})

app.run(debug=True)