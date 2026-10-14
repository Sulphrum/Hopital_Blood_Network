import os
import json
import urllib.request
import urllib.error
from pathlib import Path

# Helper to load variables from environment or .env file
def load_env_var(name: str, default: str = "") -> str:
    val = os.environ.get(name)
    if val:
        return val

    # Try reading .env file in the project root
    try:
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            with open(env_path, "r") as f:
                for line in f:
                    if line.startswith(f"{name}="):
                        return line.strip().split("=", 1)[1]
    except Exception:
        pass
    return default

def send_transfer_request_email(
    deficient_name: str,
    rich_name: str,
    blood_type: str,
    deficient_stock: int,
    rich_stock: int,
    threshold: int,
    recipient_emails: list[str],
) -> bool:
    api_key = load_env_var("BREVO_API_KEY")
    if not api_key:
        print("[EMAIL MOCK] No Brevo API Key configured. Logging email data instead:")
        print(f"  To: {recipient_emails}")
        print(f"  Deficient Hospital: {deficient_name} ({blood_type}: {deficient_stock}/{threshold} bags)")
        print(f"  Rich Hospital: {rich_name} ({blood_type}: {rich_stock} bags)")
        return False

    sender_email = load_env_var("SENDER_EMAIL", "alerts@jeevansetu.demo")
    sender_name = load_env_var("SENDER_NAME", "JeevanSetu Alerts")

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    dashboard_url = "http://localhost:8000/app/transfers"

    # HTML Email Template
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Urgent Blood Transfer Request</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f8;
      color: #1a1f36;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }}
    .wrapper {{
      width: 100%;
      background-color: #f4f6f8;
      padding: 20px 0;
    }}
    .container {{
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }}
    .header {{
      background: linear-gradient(135deg, #e11d48, #be123c);
      padding: 30px 20px;
      text-align: center;
    }}
    .header h1 {{
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      letter-spacing: 0.5px;
    }}
    .header p {{
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin: 5px 0 0 0;
    }}
    .content {{
      padding: 30px 20px;
    }}
    .alert-banner {{
      background-color: #fff1f2;
      border-left: 4px solid #e11d48;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 25px;
    }}
    .alert-banner p {{
      margin: 0;
      font-size: 15px;
      line-height: 1.5;
      color: #9f1239;
    }}
    .section-title {{
      font-size: 16px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 12px;
      margin-top: 0;
    }}
    .details-table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }}
    .details-table th, .details-table td {{
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #f1f5f9;
    }}
    .details-table th {{
      background-color: #f8fafc;
      color: #475569;
      font-size: 13px;
      font-weight: 600;
    }}
    .details-table td {{
      font-size: 14px;
      color: #334155;
    }}
    .badge {{
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      background-color: #ffe4e6;
      color: #e11d48;
    }}
    .badge-rich {{
      background-color: #dcfce7;
      color: #15803d;
    }}
    .btn-container {{
      text-align: center;
      margin: 30px 0 10px 0;
    }}
    .btn {{
      display: inline-block;
      background-color: #e11d48;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      box-shadow: 0 4px 6px rgba(225, 29, 72, 0.2);
    }}
    .footer {{
      background-color: #f8fafc;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #f1f5f9;
    }}
    .footer p {{
      font-size: 12px;
      color: #94a3b8;
      margin: 5px 0;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>JeevanSetu Alerts</h1>
        <p>Automated Hospital Blood Network Notification</p>
      </div>
      <div class="content">
        <div class="alert-banner">
          <p><strong>Urgent Alert:</strong> A critical shortage has occurred in the network. A nearby hospital requires immediate assistance for blood group <strong>{blood_type}</strong>.</p>
        </div>
        
        <h2 class="section-title">Request Summary</h2>
        <table class="details-table">
          <thead>
            <tr>
              <th>Hospital Role</th>
              <th>Name</th>
              <th>Current Stock</th>
              <th>Min Threshold</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Requesting (Deficient)</strong></td>
              <td>{deficient_name}</td>
              <td><span class="badge">{deficient_stock} bags</span></td>
              <td>{threshold} bags</td>
            </tr>
            <tr>
              <td><strong>Assisting (Your Bank)</strong></td>
              <td>{rich_name}</td>
              <td><span class="badge badge-rich">{rich_stock} bags</span></td>
              <td>{threshold} bags</td>
            </tr>
          </tbody>
        </table>
        
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
          As the hospital with the richest available stock of <strong>{blood_type}</strong> in the network, your facility is requested to initiate/approve a blood transfer. Please navigate to the transfers dashboard to review and process the transfer suggestions.
        </p>
        
        <div class="btn-container">
          <a href="{dashboard_url}" class="btn">View Transfer Dashboard</a>
        </div>
      </div>
      <div class="footer">
        <p>This is an automated request generated by the JeevanSetu Hospital Blood Network engine.</p>
        <p>© 2026 JeevanSetu Blood Network. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
"""

    to_items = [{"email": email} for email in recipient_emails]

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": to_items,
        "subject": f"Urgent: Blood Transfer Request - {deficient_name} ({blood_type} Deficient)",
        "htmlContent": html_content
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            print(f"[EMAIL] Email sent successfully to {recipient_emails}: {res_body}")
            return True
    except urllib.error.HTTPError as e:
        print(f"[EMAIL] HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        return False
    except Exception as e:
        print(f"[EMAIL] Failed to send email: {e}")
        return False
