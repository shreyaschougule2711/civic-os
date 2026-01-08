/***********************
 GLOBAL STATE
***********************/
let selectedLat = null;
let selectedLng = null;
let selectedMarker = null;

let issues = JSON.parse(localStorage.getItem("issues")) || [];
let resolvedIssues = JSON.parse(localStorage.getItem("resolvedIssues")) || [];
let upvotes = JSON.parse(localStorage.getItem("upvotes")) || {};

let ADMIN_PASSWORD = "admin123";
let GEMINI_API_KEY = "AIzaSyB2ja56eRCEDJ2qzkZYCVn_b09QN1C8ozk";

let map;
let markers = [];

/***********************
 LOGIN (UNCHANGED)
***********************/
function userLogin() {
    const nameInput = document.getElementById("username");
    const mobileInput = document.getElementById("mobile");

    if (!nameInput || !mobileInput) {
        alert("Login form error. Please refresh.");
        return;
    }

    const name = nameInput.value.trim();
    const mobile = mobileInput.value.trim();

    if (name === "") {
        alert("Please enter your name");
        return;
    }

    if (mobile === "" || mobile.length !== 10 || isNaN(mobile)) {
        alert("Please enter a valid 10-digit mobile number");
        return;
    }

    localStorage.setItem("user", JSON.stringify({ name, mobile }));
    window.location.href = "user.html";
}


function adminLogin() {
    if (adminPass.value === ADMIN_PASSWORD) {
        localStorage.setItem("admin", "true");
        location.href = "admin.html";
    } else {
        alert("Wrong password");
    }
}

/***********************
 LOAD
***********************/
function loadUser() {
    let user = JSON.parse(localStorage.getItem("user"));
    if (!user) return location.href = "index.html";

    userInfo.innerText = `Logged in as ${user.name} (${user.mobile})`;
    initMap();
    displayUserIssues(); // show issues + upvotes
}

function loadAdmin() {
    if (!localStorage.getItem("admin")) return location.href = "index.html";
    initMap();
    displayIssues();
}

/***********************
 LOGOUT
***********************/
function logoutUser() {
    localStorage.removeItem("user");
    location.href = "index.html";
}

function logoutAdmin() {
    localStorage.removeItem("admin");
    location.href = "index.html";
}

/***********************
 DARK MODE
***********************/
function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem(
        "darkMode",
        document.body.classList.contains("dark-mode")
    );
}

if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark-mode");
}

/***********************
 MAP
***********************/
function initMap() {
    map = L.map("map").setView([20.5937, 78.9629], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(map);

    refreshMap();

    // manual selection
    map.on("click", e => {
        selectedLat = e.latlng.lat;
        selectedLng = e.latlng.lng;

        if (selectedMarker) map.removeLayer(selectedMarker);

        selectedMarker = L.marker([selectedLat, selectedLng])
            .addTo(map)
            .bindPopup("Selected Issue Location")
            .openPopup();
    });
}

function refreshMap() {
    if (!map) return;

    markers.forEach(m => map.removeLayer(m));
    markers = [];

    issues.forEach(i => {
        if (!i.lat || !i.lng) return;

        let color = i.status === "Resolved" ? "green" : "orange";

        let marker = L.circleMarker([i.lat, i.lng], {
            radius: 8,
            color,
            fillOpacity: 0.8
        })
            .addTo(map)
            .bindPopup(`
                <b>${i.title}</b><br>
                Status: ${i.status}<br>
                Progress: ${getProgress(i.status)}%<br>
                👍 ${i.votes || 0}
            `);

        markers.push(marker);
    });
}

/***********************
 LOCATION (RESTORED)
***********************/
function getLocation(callback) {
    if (!navigator.geolocation) {
        alert("Geolocation not supported");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        pos => callback(pos.coords.latitude, pos.coords.longitude),
        () => alert("Please allow location access to report issue")
    );
}

/***********************
 AI ANALYSIS (RESTORED)
***********************/
async function analyzeIssue(text) {
    try {
        let res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Classify severity 1-5. Respond JSON: { "severity": number }.
Issue: ${text}`
                        }]
                    }]
                })
            }
        );

        let data = await res.json();
        return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch {
        return { severity: Math.floor(Math.random() * 3) + 3 };
    }
}

/***********************
 SUBMIT ISSUE (UNCHANGED)
***********************/
async function submitIssue() {
    if (!title.value || !desc.value || !image.files[0]) {
        alert("Fill all fields");
        return;
    }

    if (selectedLat !== null && selectedLng !== null) {
        saveIssue(selectedLat, selectedLng);
    } else {
        getLocation((lat, lng) => saveIssue(lat, lng));
    }
}

function saveIssue(lat, lng) {
    let reader = new FileReader();

    reader.onload = async () => {
        let ai = await analyzeIssue(desc.value);

        issues.push({
            title: title.value,
            desc: desc.value,
            image: reader.result,
            lat,
            lng,
            severity: ai.severity,
            status: "Open",
            votes: 0
        });

        localStorage.setItem("issues", JSON.stringify(issues));
        refreshMap();
        displayUserIssues();
        alert("Issue submitted successfully");

        selectedLat = selectedLng = null;
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }
    };

    reader.readAsDataURL(image.files[0]);
}

/***********************
 PROGRESS
***********************/
function getProgress(status) {
    if (status === "Resolved") return 100;
    if (status === "In Progress") return 75;
    if (status === "In Review") return 50;
    return 25;
}

/***********************
 UPVOTES
***********************/
function upvoteIssue(index) {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return alert("Login required");

    const key = `${user.mobile}_${index}`;
    if (upvotes[key]) return alert("You already upvoted");

    issues[index].votes = (issues[index].votes || 0) + 1;
    upvotes[key] = true;

    localStorage.setItem("issues", JSON.stringify(issues));
    localStorage.setItem("upvotes", JSON.stringify(upvotes));

    displayUserIssues();
    displayIssues();
}

/***********************
 USER ISSUE FEED
***********************/
function displayUserIssues() {
    const box = document.getElementById("userIssues");
    if (!box) return;

    box.innerHTML = "";

    if (issues.length === 0) {
        box.innerHTML = "<p class='text-muted'>No issues yet.</p>";
        return;
    }

    issues.forEach((i, index) => {
        box.innerHTML += `
            <div class="issue">
                <b>${i.title}</b>
                <p>${i.desc}</p>

                <div class="progress mb-2">
                    <div class="progress-bar" style="width:${getProgress(i.status)}%">
                        ${getProgress(i.status)}%
                    </div>
                </div>

                <div class="d-flex justify-content-between">
                    <span>👍 ${i.votes || 0}</span>
                    <button class="btn btn-outline-primary btn-sm"
                        onclick="upvoteIssue(${index})">Upvote</button>
                </div>
            </div>
        `;
    });
}

/***********************
 ADMIN: DISPLAY ISSUES
***********************/
function displayIssues() {
    const issuesDiv = document.getElementById("issues");
    const searchBox = document.getElementById("searchBox");
    const statusFilter = document.getElementById("statusFilter");

    if (!issuesDiv) return;

    const query = searchBox ? searchBox.value.toLowerCase() : "";
    const filter = statusFilter ? statusFilter.value : "all";

    issuesDiv.innerHTML = "";

    if (issues.length === 0) {
        issuesDiv.innerHTML = "<p class='text-muted'>No issues.</p>";
        renderSeverityChart();
        return;
    }

    issues.forEach((i, index) => {
        if (
            (filter !== "all" && i.status !== filter) ||
            (!i.title.toLowerCase().includes(query) &&
                !i.desc.toLowerCase().includes(query))
        ) return;

        issuesDiv.innerHTML += `
            <div class="issue">
                <b>${i.title}</b>
                <p>${i.desc}</p>

                <span class="badge bg-warning">${i.status}</span>

                <div class="progress mt-2">
                    <div class="progress-bar" style="width:${getProgress(i.status)}%">
                        ${getProgress(i.status)}%
                    </div>
                </div>

                <p class="mt-2">👍 ${i.votes || 0}</p>

                <button class="btn btn-success btn-sm"
                    onclick="resolveIssue(${index})">Resolve</button>

                <button class="btn btn-danger btn-sm"
                    onclick="deleteIssue(${index})">Delete</button>
            </div>
        `;
    });

    renderSeverityChart();
}

/***********************
 ADMIN ACTIONS
***********************/
function resolveIssue(index) {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";

    fileInput.onchange = () => {
        const reader = new FileReader();
        reader.onload = () => {
            resolvedIssues.push({
                ...issues[index],
                status: "Resolved",
                resolvedAt: new Date().toLocaleString(),
                proofImage: reader.result
            });

            issues.splice(index, 1);

            localStorage.setItem("issues", JSON.stringify(issues));
            localStorage.setItem("resolvedIssues", JSON.stringify(resolvedIssues));

            displayIssues();
            refreshMap();
        };
        reader.readAsDataURL(fileInput.files[0]);
    };

    fileInput.click();
}

function deleteIssue(i) {
    if (confirm("Delete issue?")) {
        issues.splice(i, 1);
        localStorage.setItem("issues", JSON.stringify(issues));
        displayIssues();
        refreshMap();
    }
}

/***********************
 RESOLVED VIEW
***********************/
function showResolvedIssues() {
    const container = document.getElementById("issues");
    container.innerHTML = "<h6>Resolved Issues</h6>";

    if (resolvedIssues.length === 0) {
        container.innerHTML += "<p class='text-muted'>None yet.</p>";
        return;
    }

    resolvedIssues.forEach(i => {
        container.innerHTML += `
            <div class="issue">
                <b>${i.title}</b>
                <p>${i.desc}</p>
                <small>${i.resolvedAt}</small><br>
                <img src="${i.proofImage}" width="200">
            </div>
        `;
    });
}

/***********************
 SEVERITY CHART
***********************/
let severityChart = null;

function renderSeverityChart() {
    const ctx = document.getElementById("severityChart");
    if (!ctx) return;

    const count = [0, 0, 0, 0, 0];
    issues.forEach(i => {
        if (i.severity >= 1 && i.severity <= 5) {
            count[i.severity - 1]++;
        }
    });

    if (severityChart) severityChart.destroy();

    severityChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Very Low", "Low", "Medium", "High", "Critical"],
            datasets: [{
                data: count,
                backgroundColor: [
                    "#0dcaf0",
                    "#198754",
                    "#ffc107",
                    "#fd7e14",
                    "#dc3545"
                ],
                borderRadius: 8
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}


// ---------- EXPORT ISSUES TO CSV ----------
function exportCSV() {
    if (!issues || issues.length === 0) {
        alert("No issues available to export");
        return;
    }

    let csv = "Title,Description,Severity,Status,Votes,Latitude,Longitude\n";

    issues.forEach(i => {
        const row = [
            `"${(i.title || "").replace(/"/g, '""')}"`,
            `"${(i.desc || "").replace(/"/g, '""')}"`,
            i.severity ?? "",
            i.status ?? "",
            i.votes ?? 0,
            i.lat ?? "",
            i.lng ?? ""
        ];

        csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "civic-os-issues.csv";
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
