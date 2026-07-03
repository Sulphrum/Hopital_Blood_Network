import sys
import os
from pathlib import Path

# Add project root to sys.path
project_root = str(Path(__file__).resolve().parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from api.emails import send_transfer_request_email

def main():
    recipient = "shreyasrajure559@gmail.com"
    print(f"Testing Brevo Email delivery to: {recipient}...")
    
    # Send a mock transfer request email
    success = send_transfer_request_email(
        deficient_name="Sassoon General Hospital Blood Centre",
        rich_name="Aditya Birla Memorial Hospital Blood Bank",
        blood_type="O-",
        deficient_stock=4,
        rich_stock=11,
        threshold=5,
        recipient_emails=[recipient]
    )
    
    if success:
        print("Success! The request email has been successfully dispatched via Brevo.")
    else:
        print("Error: Could not send the email. Please ensure your BREVO_API_KEY in the .env file is correct.")

if __name__ == "__main__":
    main()
