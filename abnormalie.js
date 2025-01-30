!function(){"use strict";

// Persistent storage for telemetry and learning data
const STORAGE_KEY = "telemetry_learning_data";
let telemetryData = {};
let useLocalStorage = true;

// Initialize telemetry data
try {
    if (!window.localStorage) throw new Error("localStorage not available");
    telemetryData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || initializeTelemetryData();
} catch {
    useLocalStorage = false;
    telemetryData = initializeTelemetryData();
}

function initializeTelemetryData() {
    return {
        networkRequests: [], // Tracks recent network requests (capped at 10,000)
        isolationForest: null, // Stores the Isolation Forest model
        totalRuns: 0, // Tracks the number of times the script has run
        repetitiveRequests: {}, // Tracks repetitive requests to the same URL
        feedback: { // Feedback loop for false positives/negatives
            falsePositives: [],
            falseNegatives: []
        },
        anomalyScores: [], // Tracks recent anomaly scores for dynamic thresholding
        lastRetrainTime: Date.now(), // Tracks the last time the model was retrained
        requestFrequency: {} // Tracks how often each URL is accessed
    };
}

// Save telemetry data to localStorage (or fallback to in-memory storage)
function saveTelemetryData() {
    if (useLocalStorage) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(telemetryData));
        } catch {}
    }
}

// Helper function to validate URLs
function isValidUrl(url) {
    try {
        new URL(url); // Attempt to construct a URL object
        return true;
    } catch {
        return false;
    }
}

// Generate a unique request ID
function generateRequestId() {
    return 'req-' + Math.random().toString(36).substr(2, 9); // Simple random ID
}

// Isolation Forest implementation
class IsolationForest {
    constructor(numTrees = 200, sampleSize = 512, maxDepth = 15) {
        this.numTrees = numTrees;
        this.sampleSize = sampleSize;
        this.maxDepth = maxDepth;
        this.trees = [];
    }

    // Train the forest on a dataset
    train(data) {
        this.trees = [];
        for (let i = 0; i < this.numTrees; i++) {
            const sample = this.getRandomSample(data, this.sampleSize);
            this.trees.push(this.buildTree(sample, 0));
        }
    }

    // Predict anomaly score for a data point
    predict(dataPoint) {
        const pathLengths = this.trees.map(tree => this.pathLength(dataPoint, tree));
        const avgPathLength = pathLengths.reduce((sum, len) => sum + len, 0) / this.numTrees;
        return 2 ** (-avgPathLength / this.c(telemetryData.networkRequests.length));
    }

    // Build an isolation tree
    buildTree(data, depth) {
        if (data.length <= 1 || depth >= this.maxDepth) {
            return { size: data.length };
        }
        const feature = Math.floor(Math.random() * data[0].length);
        const splitValue = this.getRandomValue(data, feature);
        const left = data.filter(point => point[feature] < splitValue);
        const right = data.filter(point => point[feature] >= splitValue);
        return {
            feature,
            splitValue,
            left: this.buildTree(left, depth + 1),
            right: this.buildTree(right, depth + 1)
        };
    }

    // Get the path length of a data point in a tree
    pathLength(dataPoint, tree) {
        if (tree.size <= 1) return 1;
        if (dataPoint[tree.feature] < tree.splitValue) {
            return 1 + this.pathLength(dataPoint, tree.left);
        } else {
            return 1 + this.pathLength(dataPoint, tree.right);
        }
    }

    // Get a random sample from the dataset
    getRandomSample(data, sampleSize) {
        const sample = [];
        for (let i = 0; i < sampleSize; i++) {
            sample.push(data[Math.floor(Math.random() * data.length)]);
        }
        return sample;
    }

    // Get a random value for splitting
    getRandomValue(data, feature) {
        const values = data.map(point => point[feature]);
        return Math.min(...values) + Math.random() * (Math.max(...values) - Math.min(...values));
    }

    // Average path length normalization
    c(n) {
        if (n <= 1) return 1;
        return 2 * (Math.log(n - 1) + 0.5772) - (2 * (n - 1) / n);
    }
}

// Dedicated anomaly logger
const logAnomaly = (...args) => console.log("[Anomaly]", ...args);

// Analyze network requests using Isolation Forest
function analyzeNetworkRequest(url, options, response) {
    try {
        // Validate the URL
        if (!isValidUrl(url)) {
            return; // Silently skip invalid URLs
        }

        // Generate a unique request ID
        const requestId = generateRequestId();

        // Convert request data to a feature vector
        const features = extractFeatures(url, options);

        // Add the request to the dataset
        telemetryData.networkRequests.push(features);
        if (telemetryData.networkRequests.length > 10000) telemetryData.networkRequests.shift(); // Cap at 10,000 requests

        // Track request frequency
        const baseUrl = url.split("?")[0];
        telemetryData.requestFrequency[baseUrl] = (telemetryData.requestFrequency[baseUrl] || 0) + 1;

        // Train the Isolation Forest if enough data is available
        const currentTime = Date.now();
        if (telemetryData.networkRequests.length >= 100 && (!telemetryData.isolationForest || currentTime - telemetryData.lastRetrainTime > 3600000)) {
            telemetryData.isolationForest = new IsolationForest(200, 512, 15); // More trees, larger sample size, deeper trees
            telemetryData.isolationForest.train(telemetryData.networkRequests);
            telemetryData.lastRetrainTime = currentTime;
        }

        // Predict anomaly score
        if (telemetryData.isolationForest) {
            const anomalyScore = telemetryData.isolationForest.predict(features);
            telemetryData.anomalyScores.push(anomalyScore);
            if (telemetryData.anomalyScores.length > 1000) telemetryData.anomalyScores.shift(); // Cap at 1,000 scores

            // Calculate dynamic threshold based on 95th percentile
            const dynamicThreshold = calculateDynamicThreshold(telemetryData.anomalyScores);
            if (anomalyScore > dynamicThreshold) {
                logAnomaly(`Anomalous Network Request Detected [ID: ${requestId}]: ${url} (Score: ${anomalyScore.toFixed(2)}, Threshold: ${dynamicThreshold.toFixed(2)})`);
            }
        }

        // Detect repetitive requests with different parameters
        const baseRequestUrl = url.split("?")[0];
        if (!telemetryData.repetitiveRequests[baseRequestUrl]) {
            telemetryData.repetitiveRequests[baseRequestUrl] = new Set();
        }
        const params = new URLSearchParams(url.split("?")[1] || "");
        const paramHash = Array.from(params.entries()).sort().toString();
        if (telemetryData.repetitiveRequests[baseRequestUrl].has(paramHash)) {
            logAnomaly(`Repetitive Request Detected [ID: ${requestId}]: ${url}`);
        } else {
            telemetryData.repetitiveRequests[baseRequestUrl].add(paramHash);
        }

        // Detect fingerprinting and identifiers
        const body = options?.body ? JSON.stringify(options.body) : "";
        const identifiers = extractIdentifiers(body);
        if (identifiers.length > 0) {
            logAnomaly(`Identifiers Detected in Request [ID: ${requestId}]: ${url}`, identifiers);
        }

        saveTelemetryData();
    } catch {}
}

// Function to extract richer features from network requests
function extractFeatures(url, options) {
    const headers = options?.headers || {};
    const body = options?.body || "";

    const parsedUrl = new URL(url); // This will now always succeed due to prior validation
    return [
        url.length, // URL length
        options?.method?.length || 0, // HTTP method length
        JSON.stringify(body).length, // Body size
        Object.keys(headers).length, // Number of headers
        (headers["Content-Type"] || "").length, // Content-Type header length
        (headers.Authorization || "").length, // Authorization header length
        (headers["User-Agent"] || "").length, // User-Agent header length
        parsedUrl.hostname.length, // Hostname length
        parsedUrl.pathname.split("/").length, // Path depth
        parsedUrl.searchParams.toString().length, // Query string length
        telemetryData.requestFrequency[parsedUrl.href.split("?")[0]] || 0 // Request frequency
    ];
}

// Function to extract identifiers from strings
function extractIdentifiers(data) {
    try {
        const identifierPatterns = [
            /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/g, // UUIDs
            /[a-zA-Z0-9_-]{20,}/g, // Long alphanumeric tokens
            /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g // IP addresses
        ];
        const identifiers = [];
        identifierPatterns.forEach(pattern => {
            const matches = data.match(pattern);
            if (matches) identifiers.push(...matches);
        });
        return [...new Set(identifiers)];
    } catch {
        return [];
    }
}

// Calculate dynamic threshold based on 95th percentile
function calculateDynamicThreshold(scores) {
    if (scores.length === 0) return 0.8; // Default threshold
    const sortedScores = [...scores].sort((a, b) => a - b);
    const index = Math.floor(0.95 * sortedScores.length);
    return sortedScores[index];
}

// Hook fetch API
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const [url, options] = args;
    return originalFetch.apply(this, args).then(response => {
        analyzeNetworkRequest(url, options, response.clone());
        return response;
    }).catch(() => {
        analyzeNetworkRequest(url, options, {});
    });
};

// Hook XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function(...args) {
    this._url = args[1]; // Store URL for later use in 'send'
    this._method = args[0]; // Store method for context
    return originalXHROpen.apply(this, args);
};
XMLHttpRequest.prototype.send = function(...args) {
    const body = args[0];
    this.addEventListener("loadend", () => {
        analyzeNetworkRequest(this._url, { method: this._method, body }, this.response);
    });
    return originalXHRSend.apply(this, args);
};

// Increment the total runs counter
try {
    telemetryData.totalRuns++;
    saveTelemetryData();
} catch {}

// Feedback loop for false positives/negatives
window.reportFalsePositive = function(requestId) {
    telemetryData.feedback.falsePositives.push(requestId);
    saveTelemetryData();
};

window.reportFalseNegative = function(requestId) {
    telemetryData.feedback.falseNegatives.push(requestId);
    saveTelemetryData();
};

logAnomaly("[Anomaly] Monitoring initialized with enhanced Isolation Forest!");
}();
