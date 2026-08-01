# app/services/github_app.py
import os
import time

import jwt
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class GitHubAppService:
    def __init__(self):
        self.app_id = os.getenv("GITHUB_APP_ID")
        print(self.app_id)

        # Load private key from file
        private_key_path = os.getenv("GITHUB_APP_PRIVATE_KEY_PATH")
        print(private_key_path)
        with open(private_key_path, "r") as key_file:
            self.private_key = key_file.read()

    def generate_jwt(self) -> str:
        """Generate JWT for GitHub App authentication (valid 10 minutes)"""
        now = int(time.time())
        payload = {"iat": now, "exp": now + 600, "iss": self.app_id}
        return jwt.encode(payload, self.private_key, algorithm="RS256")

    def get_installation_token(self, installation_id: int) -> str:
        """Generate installation access token (valid 1 hour)"""
        jwt_token = self.generate_jwt()

        url = (
            f"https://api.github.com/app/installations/{installation_id}/access_tokens"
        )
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Accept": "application/vnd.github.v3+json",
        }

        response = requests.post(url, headers=headers)
        response.raise_for_status()

        return response.json()["token"]


github_app = GitHubAppService()