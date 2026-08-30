import json
from dotenv import load_dotenv
from app.schemas.notebook import NoteStyle
from app.services.ai.ai_service import generate_notebook

load_dotenv()

transcript = """
Today we will learn about Binary Search Trees. A Binary Search Tree is a node-based binary tree data structure which has the following properties:
The left subtree of a node contains only nodes with keys lesser than the node's key.
The right subtree of a node contains only nodes with keys greater than the node's key.
The left and right subtree each must also be a binary search tree.
Search time complexity in a balanced BST is O(log n).
"""

notebook = generate_notebook(
    transcript = transcript,
    style      = NoteStyle.DETAILED,
    subject    = "Data Structures",
)

print(json.dumps(notebook.model_dump(), indent=2))