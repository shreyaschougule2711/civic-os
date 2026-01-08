let selectedLat = null;
let selectedLng = null;
let selectedMarker = null;
let resolvedIssues = JSON.parse(localStorage.getItem("resolvedIssues")) || [];
let issues = JSON.parse(localStorage.getItem("issues")) || [];
let ADMIN_PASSWORD = "admin123";
let GEMINI_API_KEY = "AIzaSyB2ja56eRCEDJ2qzkZYCVn_b09QN1C8ozk";
let map, markers = [];

// ---------- LOGIN ----------
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
    } else alert("Wrong password");
}

// ---------- LOAD ----------
function loadUser() {
    let user = JSON.parse(localStorage.getItem("user"));
    if (!user) return location.href = "index.html";
    userInfo.innerText = `Logged in as ${user.name} (${user.mobile})`;
    initMap();
}

function loadAdmin() {
    if (!localStorage.getItem("admin")) return location.href = "index.html";
    initMap();
    displayIssues();
}

// ---------- LOGOUT ----------
function logoutUser() {
    localStorage.removeItem("user");
    location.href = "index.html";
}

function logoutAdmin() {
    localStorage.removeItem("admin");
    location.href = "index.html";
}

// ---------- DARK MODE ----------
function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
}

if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark-mode");
}

// ---------- MAP ----------
function initMap() {
    map = L.map("map").setView([20.5937, 78.9629], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(map);

    refreshMap();

    // 👇 ADD THIS (manual location selection)
    map.on("click", function (e) {
        selectedLat = e.latlng.lat;
        selectedLng = e.latlng.lng;

        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }

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

    if (issues.length === 0) return;

    let bounds = [];

    issues.forEach(i => {
        if (!i.lat || !i.lng) return;

        let marker = L.circleMarker([i.lat, i.lng], {
            radius: 8,
            color: i.severity >= 4 ? "red" : "orange",
            fillOpacity: 0.8
        })
            .addTo(map)
            .bindPopup(`
        <b>${i.title}</b><br>
        ${i.desc}<br>
        Status: ${i.status}
      `);

        markers.push(marker);
        bounds.push([i.lat, i.lng]);
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}


// ---------- LOCATION ----------
function getLocation(callback) {
    if (!navigator.geolocation) {
        alert("Geolocation not supported");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        pos => {
            callback(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
            alert("Please allow location access to report issue");
        }
    );
}


// ---------- AI ----------
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
                            text:
                                `Classify issue and severity (1-5). Respond JSON: { "severity": number }.
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

// ---------- SUBMIT ISSUE ----------
async function submitIssue() {
    if (!title.value || !desc.value || !image.files[0]) {
        alert("Fill all fields");
        return;
    }

    // Priority: manual selection
    if (selectedLat !== null && selectedLng !== null) {
        saveIssue(selectedLat, selectedLng);
    } else {
        // fallback to GPS
        getLocation((lat, lng) => {
            saveIssue(lat, lng);
        });
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
            status: "Open"
        });

        localStorage.setItem("issues", JSON.stringify(issues));
        refreshMap();
        alert("Issue submitted successfully");

        // Reset manual selection
        selectedLat = null;
        selectedLng = null;

        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }
    };

    reader.readAsDataURL(image.files[0]);
}


// ---------- ADMIN ----------
function displayIssues() {
    const issuesDiv = document.getElementById("issues");
    const searchInput = document.getElementById("searchBox");
    const statusSelect = document.getElementById("statusFilter");

    if (!issuesDiv) return;

    const query = searchInput ? searchInput.value.toLowerCase() : "";
    const filter = statusSelect ? statusSelect.value : "all";

    issuesDiv.innerHTML = "";

    if (issues.length === 0) {
        issuesDiv.innerHTML = "<p class='text-muted'>No issues reported yet.</p>";
        return;
    }

    issues.forEach((i, index) => {
        if (
            (filter !== "all" && i.status !== filter) ||
            (!i.title.toLowerCase().includes(query) &&
                !i.desc.toLowerCase().includes(query))
        ) {
            return;
        }

        issuesDiv.innerHTML += `
      <div class="issue">
        <b>${i.title}</b>
        <p>${i.desc}</p>
        <span class="badge bg-${i.status === "Open" ? "warning" : "success"}">
          ${i.status}
        </span>
        <br><br>
        <button class="btn btn-success btn-sm" onclick="resolveIssue(${index})">
          Resolve
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteIssue(${index})">
          Delete
        </button>
      </div>
    `;
    });

    renderSeverityChart();
}


function resolveIssue(index) {
    // Create hidden file input for proof
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";

    fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (!file) {
            alert("Proof image is required to resolve the issue");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const resolvedIssue = {
                ...issues[index],
                resolvedAt: new Date().toLocaleString(),
                proofImage: reader.result
            };

            // Save to resolvedIssues
            resolvedIssues.push(resolvedIssue);
            localStorage.setItem("resolvedIssues", JSON.stringify(resolvedIssues));

            // Remove from active issues
            issues.splice(index, 1);
            localStorage.setItem("issues", JSON.stringify(issues));

            // Update UI
            displayIssues();
            refreshMap();

            alert("Issue resolved and archived successfully");
        };

        reader.readAsDataURL(file);
    };

    // Trigger file selector
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

// ---------- EXPORT CSV ----------
function exportCSV() {
    let csv = "Title,Description,Severity,Status\n";
    issues.forEach(i => {
        csv += `"${i.title}","${i.desc}",${i.severity},${i.status}\n`;
    });
    let blob = new Blob([csv], { type: "text/csv" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "civic-os-issues.csv";
    a.click();
}

function showResolvedIssues() {
    let container = document.getElementById("issues");
    container.innerHTML = "<h6>Resolved Issues</h6>";

    if (resolvedIssues.length === 0) {
        container.innerHTML += "<p class='text-muted'>No resolved issues yet.</p>";
        return;
    }

    resolvedIssues.forEach(i => {
        container.innerHTML += `
      <div class="issue">
        <b>${i.title}</b>
        <p>${i.desc}</p>
        <p><small>Resolved at: ${i.resolvedAt}</small></p>
        <img src="${i.proofImage}" width="200">
      </div>
    `;
    });
}

// ================= CHART (UI ONLY) =================
let severityChart = null;

function renderSeverityChart() {
    const ctx = document.getElementById("severityChart");
    if (!ctx) return;

    const severityCount = [0, 0, 0, 0, 0];

    issues.forEach(i => {
        if (i.severity >= 1 && i.severity <= 5) {
            severityCount[i.severity - 1]++;
        }
    });

    if (severityChart) severityChart.destroy();

    severityChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Very Low", "Low", "Medium", "High", "Critical"],
            datasets: [{
                label: "Issues",
                data: severityCount,
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
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

