
import json
import os

import ollama
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.concurrency import iterate_in_threadpool, run_in_threadpool

from retrieval_pipeline.rag_agent import RAG_Agent

# Define the FastAPI Router Object
router = APIRouter(prefix="")


# Define a request model using Pydantic for the chat API
class RagRequest(BaseModel):
    userQuery: str
    conversationHistory: list
    selectedModel: str
    user_id: str
    repo_id: str

@router.post("/chat/stream")
async def handle_rag_request_stream(request: Request):
    """
        Handles RAG-based chat requests with streaming responses.
        Retrieves relevant context from vector DB and graph DB before responding.
    """
    # Parse request body BEFORE creating the streaming response
    try:
        body = await request.json()
        rag_request = RagRequest(**body)
        chat_history = rag_request.conversationHistory
        user_query = rag_request.userQuery
        selected_model = rag_request.selectedModel
        user_id = rag_request.user_id
        repo_id = rag_request.repo_id

        # Validate required fields
        if not user_query or not isinstance(user_query, str):
            raise HTTPException(
                status_code=400, detail="userQuery must be a non-empty string"
            )
        if not user_id or not isinstance(user_id, str):
            raise HTTPException(
                status_code=400, detail="user_id must be a non-empty string"
            )
        if not repo_id or not isinstance(repo_id, str):
            raise HTTPException(
                status_code=400, detail="repo_id must be a non-empty string"
            )
        if not selected_model or not isinstance(selected_model, str):
            raise HTTPException(
                status_code=400, detail="selectedModel must be a non-empty string"
            )
        if not isinstance(chat_history, list):
            raise HTTPException(
                status_code=400, detail="conversationHistory must be a list"
            )

        # The frontend's model picker is cosmetic (sends names like "Claude 4.5 Sonnet");
        # chat always runs on the local Ollama model from .env.
        selected_model = os.getenv("OLLAMA_CHAT_MODEL") or selected_model

        print(
            f"[/chat/stream] user_id={user_id}, repo_id={repo_id}, model={selected_model}, query={user_query[:50]}..."
        )

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail="Invalid JSON in request body")
    except HTTPException:
        raise
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing required field: {str(e)}")
    except Exception as e:
        print(f"[/chat/stream] Request parsing error: {str(e)}")
        raise HTTPException(
            status_code=400, detail=f"Request validation error: {str(e)}"
        )

    async def generate_stream():
        agent_obj = None
        stream = None
        try:
            # Initialize the RAG Agent
            print(
                f"[/chat/stream] Initializing RAG Agent for user={user_id}, repo={repo_id}"
            )
            agent_obj = RAG_Agent(user_id, repo_id)

            # Run RAG pipeline (blocking Ollama/Chroma calls) off the event loop
            print(f"[/chat/stream] Running RAG pipeline with model={selected_model}")
            stream, chunks_list, chunks_file_paths = await run_in_threadpool(
                agent_obj.run, user_query, chat_history, selected_model
            )

            # Combine the lists into a list of snippet-like objects/tuples
            snippets_data = zip(chunks_file_paths, chunks_list)

            for file_path, chunk_content in snippets_data:
                yield f"data: {json.dumps({"type": "snippet", "file": file_path, "code": chunk_content})}\n\n"

            #Stream tokens back to client
            async for chunk in iterate_in_threadpool(stream):
                # Browser gone (refresh/navigation): stop so finally closes the Ollama stream
                if await request.is_disconnected():
                    print("[/chat/stream] Client disconnected, stopping generation")
                    return
                if "message" in chunk and "content" in chunk["message"]:
                    content = chunk["message"]["content"]
                    yield f"data: {json.dumps({'content': content})}\n\n"

            yield "data: [DONE]\n\n"
            print(f"[/chat/stream] Stream completed successfully")

        except FileNotFoundError as e:
            error_msg = f"Repository data not found for user={user_id}, repo={repo_id}. Please index the repository first."
            print(f"[/chat/stream] Error: {error_msg}")
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
        except ollama.ResponseError as e:
            error_msg = f"Ollama error: {str(e)}. Please check if the model '{selected_model}' is installed."
            print(f"[/chat/stream] Ollama error: {str(e)}")
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
        except ConnectionError as e:
            error_msg = (
                "Failed to connect to Ollama server. Please ensure Ollama is running."
            )
            print(f"[/chat/stream] Connection error: {str(e)}")
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
        except ValueError as e:
            error_msg = f"Invalid value: {str(e)}"
            print(f"[/chat/stream] ValueError: {str(e)}")
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
        except Exception as e:
            error_msg = f"Internal server error: {str(e)}"
            print(f"[/chat/stream] Unexpected error: {str(e)}")
            import traceback

            traceback.print_exc()
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
        finally:
            # Closing drops the HTTP connection, which makes Ollama stop generating.
            # Left open, an abandoned answer keeps the CPU model busy and every new question queues behind it.
            if stream is not None:
                stream.close()
            # Cleanup resources if RAG agent has cleanup method
            if agent_obj and hasattr(agent_obj, "cleanup"):
                try:
                    agent_obj.cleanup()
                    print(f"[/chat/stream] RAG Agent cleaned up successfully")
                except Exception as cleanup_error:
                    print(f"[/chat/stream] Error during cleanup: {str(cleanup_error)}")

    try:
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        print(f"[/chat/stream] Failed to create streaming response: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to initialize stream: {str(e)}"
        )
