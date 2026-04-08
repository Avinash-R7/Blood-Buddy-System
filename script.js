// 🔄 Toggle Auth Forms
function toggleAuth(type) {
    const loginForm = document.getElementById("form-login");
    const signupForm = document.getElementById("form-signup");
    const tabLogin = document.getElementById("tab-login");
    const tabSignup = document.getElementById("tab-signup");
    const subtitle = document.getElementById("auth-subtitle");

    if (type === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        subtitle.innerText = "Welcome back to the intelligent blood network";
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        tabLogin.classList.remove('active');
        tabSignup.classList.add('active');
        subtitle.innerText = "Join the network to save lives today";
    }
}

// 🍞 Toast Notification Simulator
function showToast(title, message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === 'critical' ? '🚨' : type === 'success' ? '✅' : '🔔'}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5s
    setTimeout(() => {
        if(toast.parentElement) {
            toast.style.animation = "slideOutRight 0.3s forwards";
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// 🚨 SEND REQUEST
async function sendRequest(user) {
    const btn = event.currentTarget;
    const originalBtnHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spin-icon" style="display:inline-block; margin-right:8px;">⏳</span> Broadcasting...`;
    
    const requestData = {
        requester: user,
        blood_group: document.getElementById("blood").value,
        urgency: document.getElementById("urgency").value,
        location: document.getElementById("location").value
    }

    if (!requestData.blood_group || !requestData.location) {
        showToast("Error", "Blood group and location are required.", "critical");
        btn.innerHTML = originalBtnHtml;
        return;
    }

    const res = await fetch("/create_request", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(requestData)
    });

    const data = await res.json();
    btn.innerHTML = originalBtnHtml;

    const list = document.getElementById("results");
    list.innerHTML = "";

    if (data.error || data.length === 0) {
        list.innerHTML = `<div class="empty-state">No donors matched those criteria in that area.</div>`;
    } else {
        data.forEach(d => {
            list.innerHTML += `
                <li>
                    <div class="donor-info">
                        <strong>${d.name}</strong>
                        <span>Response Rate: ${(d.response_rate * 100).toFixed(0)}%</span>
                    </div>
                    <div class="donor-score">🏆 ${d.score} pts</div>
                </li>
            `;
        });
        showToast("Request Broadcasted", `Top ${data.length} closest donors matched and notified.`, "info");
    }
    
    const statusEl = document.getElementById("status");
    statusEl.className = "waiting mt-10";
    statusEl.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
        ⏳ Waiting for donor response...
    `;
}

// 🔔 NOTIFICATIONS (Donor side)
let notifiedSet = new Set();
function startNotifications(user) {
    setInterval(async () => {
        const res = await fetch(`/notifications/${user}`);
        const data = await res.json();

        const container = document.getElementById("notifications");
        
        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="margin-top: 60px;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; margin-bottom: 15px;"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path></svg><br>
                    You remain on standby.<br>We will alert you when a match is found.
                </div>
            `;
            return;
        }

        container.innerHTML = "";

        data.forEach(n => {
            const notifKey = `${n.from}-${n.blood}`;
            if (!notifiedSet.has(notifKey)) {
                // Simulate SMS/Email Notification alert
                showToast("Urgent Blood Need", `${n.from} needs ${n.blood} immediately in your area!`, "critical");
                notifiedSet.add(notifKey);
            }

            container.innerHTML += `
                <div class="notification" style="border-left-color: ${n.urgency === 'critical' ? 'var(--critical)' : 'var(--warning)'}">
                    <div>
                        <span class="notification-text">🚨 ${n.blood} needed by ${n.from}</span>
                        <span class="notification-sub">Priority: <strong style="color:${n.urgency === 'critical' ? 'var(--critical)' : 'var(--warning)'}">${n.urgency.toUpperCase()}</strong></span>
                    </div>
                    <button onclick="accept('${user}','${n.from}')">
                        Accept Match
                    </button>
                </div>
            `;
        });
    }, 3000);
}

// ✅ ACCEPT
async function accept(donor, requester) {
    await fetch("/accept", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            donor: donor,
            requester: requester
        })
    });

    if (typeof confetti === "function") {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ff2a4b', '#ffffff', '#ff4d68']
        });
    }

    showToast("Match Accepted", "You are a hero! The requester has been notified.", "success");
    
    // Refresh page after a short delay to update analytics and history on dashboard
    setTimeout(() => {
        window.location.reload();
    }, 2500);
}

// 📊 TRACK STATUS (Requester side)
function trackStatus(user) {
    setInterval(async () => {
        const res = await fetch(`/request_status/${user}`);
        const data = await res.json();
        
        const statusEl = document.getElementById("status");
        if (!statusEl) return;

        if (data.accepted_by) {
            if (statusEl.className !== "accepted mt-10") {
                showToast("Match Found!", `Your request was accepted by ${data.accepted_by}. They are on their way.`, "success");
            }
            statusEl.className = "accepted mt-10";
            statusEl.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                Accepted securely by: ${data.accepted_by}
            `;
        } else if (data.requester) {
            statusEl.className = "waiting mt-10";
            statusEl.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                ⏳ Waiting for donor response...
            `;
        }
    }, 3000);
}