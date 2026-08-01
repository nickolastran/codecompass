"""
    All The Fucntions you would need to interact with Ollama(which is a service to host llms locally)
        - Check if Ollama is installed
        - Check if Ollam Server is running
        - Check if a given LLM is installed and available to use
    
    The Backend absolutely cannot work without OLLAMA!!
"""

import subprocess   # allows running system commands(like starting the Ollama Server)
import time     # provides time related funcs like sleep()
import socket   # used for network communication, in our case to check if Ollama server is running
import sys

class Ollama_Manager:
    def __init__(self):
        pass

    def is_ollama_installed(self):
        """
            Checks if Ollama is installed on the Backend Machine.
            Ollama MUST be installed to run models locally
        """
        try:
            subprocess.run(
                ["ollama", "--version"],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )            
            print("Ollama is already installed!")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            #print("Ollama not found. Installing...")
            print("Ollama not found. Please download and install it from https://ollama.com/download/linux")
            return False

    def is_ollama_running(self, host="127.0.0.1", port=11434):
        """
            Checks If the Ollama server is running or not
        """
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except OSError:
            return False

    def parse_installed_models(self, raw_list):
        """
            Takes the raw output of `ollama list` (a list of strings) and returns clean model names.
        """
        models = []
        for line in raw_list[1:]:  # skip the header line
            if line.strip():  # skip empty lines
                # Split by whitespace and take the first column (the model name)
                model_name = line.split()[0]
                models.append(model_name)
        return models

    def is_model_available(self, model_name: str):
        """
            Checks if the given llm is installed and accessible through Ollama
            Args:
                model_name (str): model name
            Return:
                bool: True if LLM is installed & available through Ollama, False otherwise
        """
        try:
            # Run `ollama list` to get all installed models
            result = subprocess.run(
                ["ollama", "list"],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            installed_models = self.parse_installed_models(result.stdout.splitlines())
            print(installed_models)
            # Check if the requested model is in the list
            if model_name in installed_models:
                print(f"Model '{model_name}' is installed.")
                return True
            else:
                print(f"Model '{model_name}' is NOT installed.")
                return False
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Ollama CLI is not installed or failed to run.")
            return False        

# This main() is only for testing purposes
def main():
    obj = Ollama_Manager()
    #print(obj.is_ollama_installed())
    #print(obj.is_ollama_running())
    #print(obj.is_model_available("bhurh_model"))
    #print(obj.is_model_available("qwen2.5:3b"))


    return

if __name__ == "__main__":
    main()
