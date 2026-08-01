"""
    This script is a single clear entry point.

    1. Creates the FastAPI app object
    2. Includes the routers from /api


    Command to run Backend for Development:
        python3 main.py

    Command to run Backend for Production:
        uvicorn main:app --host 0.0.0.0 --port 8000
        (run this command in the same directory that contains main.py)
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# import the routers
from api import routes_chat, routes_documentation, routes_indexing

from startup import run_startup_checks
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()   # Loads .env into OS environment variables

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
        - This is the startup eventhandler, this async func is run only a single time, when the backend is brought up for the first time.
        - FastAPI automatically runs startup tasks before serving requests.

        - The following Checks are made
            1. Is Ollama Installed
                If not install it/prompt User to install it.
            2. Is a ChromaDB already available
                If not create a new fresh ChromaDB
            3. Are Specific Ollama LLM models installed
                If not install them/prompt User to install the models
    """
    print(">>> RUNNING STARTUP CHECKS <<<")
    await run_startup_checks()
    print(">>> STARTUP CHECKS COMPLETED <<<")

    yield  # <-- FastAPI starts serving after this line

    print(">>> SHUTDOWN STARTED <<<")
    # You can also put cleanup logic here
    print(">>> SHUTDOWN COMPLETE <<<")

app = FastAPI(lifespan=lifespan)

# If you don’t add this, FastAPI never even receives the request.
# You will see nothing logged in the server.
# This is because the browser must send an OPTIONS preflight(without below FAastAPI endpoint doesn't allow OPTIONS) because:
# - we are making a cross-origin request (Next.js @ localhost:3000 -> FastAPI @ localhost:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
print(">>> CORS MIDDLEWARE INSTALLED <<<")

app.include_router(routes_chat.router)
app.include_router(routes_indexing.router)
app.include_router(routes_documentation.router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

    #from indexing_pipelines.indexing_script import Indexing_Pipeline_Head
    #obj = Indexing_Pipeline_Head("/home/mann/CodeCompass-RAG", "Mann","Repo-Test5")
    #obj.dispatch_files()
    
    
    #from retreival_pipeline.rag_agent import RAG_Agent
    #query = "explain how indexing works"
    #
    #agent_obj = RAG_Agent("Mann","Repo-Test5")
    #
#
#
    #stream, chunks_list, chunks_file_paths = agent_obj.run(query, [], 'DeepSeek-r1:14b')
    #
    #print("#####################################")
    #print(stream["message"]["content"])
    #print(chunks_list, chunks_file_paths)

    #tool = agent_obj.select_tool(query)
    #tool = "code_rag"
    #context = agent_obj.dispatch_to_tool(tool, query)

    #print(agent_obj.query_llm(query, [], context, 'phi3:latest')["message"]["content"])
    #print(context)