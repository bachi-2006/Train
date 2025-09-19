import requests
import json
import subprocess
import sys
import os

def run_scenario_and_get_output(scenario_file):
    """Run scenario_runner.py and capture its output"""
    try:
        result = subprocess.run([sys.executable, "scenario_runner.py", scenario_file], 
                              capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running scenario: {e}")
        return None

def call_gemini_with_scenario_output(scenario_output):
    """Send scenario output to Gemini API"""
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return "GEMINI_API_KEY not set"
    url += f"?key={api_key}"
    
    headers = {"Content-Type": "application/json"}
    
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"You are the AI Decision Engine for railway traffic control.\n\nAlgorithm Output:\n{scenario_output}\n\nYour Task:\n1) Analyze the conflicts and decisions from the algorithm output above.\n2) Explain the reasoning for these decisions (priority/headway/contention).\n3) Suggest if rerouting or staggering departures could reduce conflicts.\n4) Estimate impact on KPIs qualitatively (throughput, average delay, safety).\n5) Provide a short event log (timestamps with key actions).\n6) Check if the given decision is fair or not of algorithm. \n 7)give how ai decision optimize  in this scenario."
                    }
                ]
            }
        ]
    }
    
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        data = response.json()
        try:
            return data['candidates'][0]['content']['parts'][0]['text']
        except (KeyError, IndexError):
            return f"Unexpected response format: {json.dumps(data, indent=2)}"
    else:
        return f"Request failed with status code {response.status_code}: {response.text}"

def main():
    scenario_file = "scenario_hyb_vskp_three_trains.json"
    
    print("Running scenario algorithm...")
    scenario_output = run_scenario_and_get_output(scenario_file)
    
    if scenario_output:
        print("Algorithm output:")
        print(scenario_output)
        print("\n" + "="*50 + "\n")
        
        print("Sending to Gemini for analysis...")
        gemini_response = call_gemini_with_scenario_output(scenario_output)
        print("Gemini analysis:")
        print(gemini_response)
    else:
        print("Failed to get scenario output")

if __name__ == "__main__":
    main()
