"""
┌───────────────────────────────────────────────────────────────────────────┐
│                          INDEXING PIPELINE HEAD                           │
├───────────────────────────────────────────────────────────────────────────┤
│ `Indexing_Pipeline_Head` is responsible for scanning a directory and      │
│ dispatching each file to the correct indexing pipeline based on its type. │
│                                                                           │
│ Dispatch Flow:                                                            │
│                                                                           │
│                          ┌──────────────────────┐                         │
│        Directory  ─────> │    dispatch_files    │ ─────────────┐          │
│                          └──────────────────────┘              │          │
│                                     │                          │          │
│                                     │                          │          │
│                                     ▼                          ▼          │
│                         ┌─────────────────┐        ┌────────────────────┐ │
│                         │  Code Indexing  │        │ Documentation Index│ │
│                         │     Pipeline    │        │      Pipeline      │ │
│                         └─────────────────┘        └────────────────────┘ │
│                                                                           │
│ File Routing Rules:                                                       │
│  • Code files → .py, .js, .ts, .java, .cpp, .c, .h                        │
│  • Documentation files → .md, .txt, .pdf                                  │
│  • Other file types are currently ignored                                 │
└───────────────────────────────────────────────────────────────────────────┘
"""


import os

from .documentation_pipeline.document_indexing_script import Document_Indexing 

from .code_pipeline.code_indexing_script import Code_Indexing

#####################################
# Remove when done
from dotenv import load_dotenv

load_dotenv()   # Loads .env into OS environment variables
#####################################

class Indexing_Pipeline_Head:
    def __init__(self, dir_path: str, user_id: str, repo_id: str):
        self.dir_path = dir_path
        self.user_id = user_id
        self.repo_id = repo_id
        
    def dispatch_files(self):
        """
            This function goes through each file in the cloned folder, looks at its file extension and then decides whether it should be passed to the Document Indexing Pipeline or not.
            > Text, Markdown and PDF files are dispatched to the Docu. Indexing Pipeline
            > All files are dispatched to the Code Indexing Pipeline
                The Code Indexing Pipeline internally ignores non-code files.
            Args:
                - Doesn't take any args, all required args are passed when the obj for this class is instantiated
            Return:
                - returns Success on Indexing all files in the dir
                - Returns Internal Error if theres an Error during Indexing
        """

        directory = self.dir_path

        CODE_EXTENSIONS = {'.py', '.js', '.ts', '.java', '.cpp', '.c', '.h',}
        DOC_EXTENSIONS = {'.md', '.txt', '.pdf'}

        # Indexing the Documentation files         
        for root, dirs, files in os.walk(directory):
            for filename in files:
                full_path = os.path.join(root, filename)
                # Extract extension
                _, ext = os.path.splitext(filename)
                ext = ext.lower()
                if ext in DOC_EXTENSIONS:
                    # Pass the file to the Document Indexing Pipeline
                    self.Call_Document_Indexing_Pipeline(full_path)
                    print(filename, ext)
                else:
                    # If the file type is neither code (the languages we handle) or documentation
                    # For now we skip indexing the file, but in future we could add handling for this
                    continue
        
        print("All DOCU. FILES INDEXED SUCCESSFULLY!")

        self.Call_Code_Indexing_Pipeline()
        print("All CODE FILES INDEXED SUCCESSFULLY!")

        return

    def Call_Code_Indexing_Pipeline(self):
        """
            - This function passes the given directory directly into the Code Indexing Pipeline
        """

        code_indexer = Code_Indexing(self.dir_path, self.repo_id, self.user_id)
        
        code_indexer.index_entire_repo()

        return

    def Call_Document_Indexing_Pipeline(self, filepath: str):
        """
            - This function pass the given file into the Docu. Indexing Pipeline.
            - The single .txt/.md/.pdf file is parsed, chunked and stored as an embedding in a Chroma Vector DB
        """
        doc_indexer = Document_Indexing(self.user_id, self.repo_id)

        doc_indexer.Index_File(filepath)

        return



# This main is only for testing purposes
def main():
    obj = Indexing_Pipeline_Head("/home/mann/CodeCompass-RAG", "Mann","Repo-Test3")

    obj.dispatch_files()

    return

if __name__ == "__main__":
    main()
