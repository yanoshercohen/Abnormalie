# Abnormalie

> [!NOTE]  
> This project was created as an experimental proof-of-concept with the assistance of **Qwen2.5-Max LLM**. It is designed to demonstrate lightweight, real-time anomaly detection in web applications using JavaScript and local storage.

---

## Overview

This script monitors outgoing network requests in web applications and detects anomalies using an **Isolation Forest** machine learning model. It hooks into the `fetch` API and `XMLHttpRequest` to analyze requests, extract meaningful features, and flag suspicious activity. The system dynamically adjusts its anomaly detection threshold based on recent data and provides feedback mechanisms for continuous improvement.

The script is self-contained, requiring no external libraries or dependencies, and uses `localStorage` for persistent telemetry data.

---

## Features

- **Real-Time Monitoring:** Hooks into `fetch` and `XMLHttpRequest` to analyze all outgoing network requests.
- **Anomaly Detection:** Uses an Isolation Forest model to detect anomalous requests based on extracted features.
- **Dynamic Thresholding:** Automatically adjusts the anomaly detection threshold based on the 95th percentile of recent scores.
- **Repetitive Request Detection:** Identifies repetitive requests with different parameters to potential malicious activity.
- **Identifier Extraction:** Detects sensitive identifiers (e.g., UUIDs, IP addresses) in request bodies.
- **Feedback Loop:** Allows users to report false positives and negatives for future improvements.
- **Error-Free Execution:** Suppresses all errors and logs only detected anomalies, ensuring clean output.

---

## Installation

### Manual Setup

1. **Open Developer Console:**
   - Press `F12` to open the browser's developer console.
   - Navigate to the "Console" tab.

2. **Paste the Script:**
   - Copy the entire script and paste it into the console.
   - Press `Enter` to execute the script.

3. **Automatic Monitoring:**
   - Once executed, the script will automatically monitor all outgoing network requests made via `fetch` or `XMLHttpRequest`.

---

## Usage

### 1. **Automatic Monitoring**
Once included, the script will automatically monitor all outgoing network requests. Detected anomalies will be logged to the console with details such as the URL, anomaly score, threshold, and a unique request ID.

Example log:
```
[Anomaly] Anomalous Network Request Detected [ID: req-abc123]: https://example.com/api (Score: 0.85, Threshold: 0.75)
```

### 2. **Reporting Feedback**
You can provide feedback on detected anomalies using the following global functions:

- **Report False Positives:**
  ```javascript
  window.reportFalsePositive("req-abc123");
  ```
  This marks a flagged request as a false positive.

- **Report False Negatives:**
  ```javascript
  window.reportFalseNegative("req-def456");
  ```
  This marks a missed anomaly as a false negative.

Feedback is stored in `localStorage` and can be used to improve the model in future iterations.

---

## Configuration

While the script is designed to work out-of-the-box, you can customize its behavior by modifying the following constants in the code:

- **STORAGE_KEY:** The key used to store telemetry data in `localStorage`.
- **MAX_REQUESTS:** The maximum number of network requests stored in memory (default: 10,000).
- **ANOMALY_SCORE_CAP:** The maximum number of anomaly scores stored for dynamic thresholding (default: 1,000).
- **MODEL_PARAMETERS:** Adjust the Isolation Forest's `numTrees`, `sampleSize`, and `maxDepth` for better performance.

---

## License

This project is licensed under the **Mozilla Public License 2.0**. See the [LICENSE](LICENSE) file for details. If you use this script, you must credit the original author:

- **Author:** Yan O. Cohen  

---

## Acknowledgments

- Inspired by the need for lightweight, real-time anomaly detection in web applications.
- Developed with assistance from **Qwen2.5-Max LLM** as part of an experimental project.

---

## Contributing

Contributions are welcome! If you have ideas for improvements or bug fixes, feel free to open an issue or submit a pull request.

---

Feel free to use this script as a foundation for building more advanced anomaly detection systems!
