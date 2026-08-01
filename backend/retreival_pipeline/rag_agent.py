
"""
    - The RAG agent acts as the brain of the pipeline.
        It Orchestrates:
        - Retreival from all the Data Sources:
            1. Vector DB
            2. Graph DB
            3. Keyword Search
        - Prompting the LLM
        - Response Post Processing
            
    - It receives `query` & `chat_history`
    - It retreives relevant context from the Knowledge Base
    - It Prompts the LLM with retreived context
    - It Streams back LLM response

    - An “orchestrator agent” in a RAG system is usually just a normal LLM that has tool-calling abilities.
"""

import ollama

from dotenv import load_dotenv
import os

from .system_prompts import AGENT_SYS_PROMPT

from .documentation_retreival_script import Documentation_Retreival
from .code_retreival_script import Code_Retreival

from typing import List

# Load the .env file
load_dotenv()



class RAG_Agent:
    """
        An orchestrator agent for selecting the appropriate retrieval tool
        based on the user's query. The agent decides between:

        1. Codebase Documentation RAG Pipeline
        2. Code RAG Pipeline
        3. Keyword Search
        4. No retreival necessary

        The agent:
        - Receives a natural language query
        - Uses an LLM classifier(lightweight LLM)
        - Executes the chosen retrieval pipeline
        - Prompts the selected LLM with the assembled response context & query
        - Streams the final LLM response back to the user
    """
    def __init__(self, user_id: str, repo_id: str): 

        self.agent_llm = os.getenv("OLLAMA_AGENT_MODEL")

        self.user_id = user_id
        self.repo_id = repo_id

    def select_tool(self, query: str):
        """
            LLM Decides which Knowledge Source to retrieve from, for given user query.

            Args:
                query (str): Entered User Query

            Returns one of:
                - "docs_rag"
                - "code_rag"
                - "keyword_search"
                - "conversation_history"
        """

        agent_response = ollama.chat(
            model=os.getenv("OLLAMA_AGENT_MODEL"),
            messages=[
                {"role":"system", "content": AGENT_SYS_PROMPT},
                {"role":"user", "content": query}
            ],
        )

        #print("AGENT CHOSE TOOL=",agent_response["message"]["content"])

        return agent_response["message"]["content"]

    def dispatch_to_tool(self, tool_name, query):
        """
            Executes the selected tool & returns the retreived context.

            Args:
                tool_name (str): 
                query (str): Entered User Query

            Returns:
                Retrieved context (str)
        """

        match tool_name:
            case "docs_rag":
                doc_ret_obj = Documentation_Retreival(self.user_id, self.repo_id)

                context, chunks_list, chunks_file_paths = doc_ret_obj.retreive_from_DB(query)
                
            case "code_rag":
                code_ret_obj = Code_Retreival(self.user_id, self.repo_id)

                context, chunks_list, chunks_file_paths = code_ret_obj.retreive_from_DB(query)

            case "conversation_history":
                context = ""
                chunks_list, chunks_file_paths = [], []
            case _:
                # Will never enter here
                # just book keeping
                context = ""
                chunks_list, chunks_file_paths = [], []

        print("RETREIVED CONTEXT: ", context)

        return context, chunks_list, chunks_file_paths

    def query_llm(self, query: str, chat_history: List, context: str, selected_llm: str):
        """
            Query Ollama LLM with the retrieved context
            
            Args:
                query (str): User Query
                chat_history (List): Past Conversation in ChatML(Chat Markup Language) format
                context (str): Retreived context
                selected_llm (str): The selected LLM
            Returns:
                stream (generator): Ollama streaming generator object
        """

        # TODO
        # Check if the first element in `chat_history` is the system prompt if not add it!!

        stream = ollama.chat(
            model=selected_llm,
            messages=[
                {"role": "system", "content": "Use the provided context to answer the user."},
                {"role": "user", "content": f"Context:\n{context}\n\nUser question: {query}"},
            ]
            + chat_history,
            stream=True    # ENSURE TRUE!!
        )

        return stream

    def run(self, query: str, chat_history: List, selected_llm: str):
        """
            This function is called when the route handler (handle_rag_request) executes after the /chat endpoint is hit
            
            Args:
                query (str): Entered User Query
                chat_history (list): Entire Conversation History

            Returns:
                stream (generator): The Ollama Generator Object (which is used for streaming the LLM response)
                chunks_list (List[str]): List of the retreived code chunks
                chunks_file_paths (List[str]):List of the files from the which the code chunks belong
        """

        # Ask Agent which Knowledge Source to retreive Context from
        selected_tool = self.select_tool(query)

        # Retreive Context from Selected Knowledge Source
        context, chunks_list, chunks_file_paths = self.dispatch_to_tool(selected_tool, query)

        # Query the LLM through Ollama with provided context
        stream = self.query_llm(query, chat_history, context, selected_llm)

        return stream, chunks_list, chunks_file_paths

# This main() is only for testing purposes
def main():
    print(OLLAMA_AGENT_LLM)
    print(AGENT_SYS_PROMPT)

    obj = RAG_Agent()

    query = "what is RAG_AGENT(self)?"

    obj.select_tool(query)

    print("context=", obj.dispatch_to_tool(query))

    return

if __name__ == "__main__":
    main()

