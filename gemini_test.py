import requests
import json
import os

# Gemini API endpoint
url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# API key from environment
api_key = os.getenv("GEMINI_API_KEY", "")
if api_key:
    url += f"?key={api_key}"

# Headers
headers = {
    "Content-Type": "application/json"
}

# Sample request payload for Gemini API
payload = {
    "contents": [
        {
            "parts": [
                {
                    "text": "You are the AI Decision Engine for railway traffic control.\n\nCurrent Scenario Summary\n- Source file: scenario_ndls_patna_routes.json\n- Constraints: min_headway = 2 min\n\nDetected Conflicts\n- Conflict on block M-N between T1 and T2 during [4.0, 5.0] min\n- Conflict on block N-O between T1 and T2 during [9.0, 10.0] min\n\nDecision\n- T2 → PROCEED\n- T1 → HOLD\n\nYour Task\n1) Briefly explain the reasoning for these decisions (priority/headway/contention).\n2) Suggest if rerouting or staggering departures could reduce conflicts.\n3) Estimate impact on KPIs qualitatively (throughput, average delay, safety).\n4) Provide a short event log (timestamps with key actions). \n 5)check the given decison is fair or not "
                }
            ]
        }
    ]
}

def test_gemini_api():
    if not api_key:
        print("GEMINI_API_KEY not set")
        return
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        data = response.json()
        # Extract the text content from the response
        try:
            text_output = data['candidates'][0]['content']['parts'][0]['text']
            print(text_output)
        except (KeyError, IndexError):
            print("Unexpected response format:")
            print(json.dumps(data, indent=2))
    else:
        print(f"Request failed with status code {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_gemini_api()
