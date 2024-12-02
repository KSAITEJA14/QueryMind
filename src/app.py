import os
import logging

from flask import Flask, request, jsonify
from flask_cors import CORS

import numpy as np
import torch

from google.cloud import aiplatform
from google.cloud import bigquery

from sentence_transformers import SentenceTransformer

# Suppress tokenizer parallelism warning
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Configure logging
logging.basicConfig(level=logging.INFO)

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# Device and Model Initialization
if torch.cuda.is_available():
    device = torch.device("cuda")
    logging.info("Using CUDA")
elif torch.backends.mps.is_available():
    device = torch.device("mps")
    logging.info("Using MPS")
else:
    device = torch.device("cpu")
    logging.info("Using CPU")

model = SentenceTransformer("Alibaba-NLP/gte-base-en-v1.5", trust_remote_code=True).to(device)

# GCP Configuration
PROJECT_ID = ""
REGION = ""
DEPLOYED_INDEX_ID = ""
DATASET_ID = ""
TABLE_ID = ""
ENDPOINT_ID = ""
INDEX_ENDPOINT_NAME = f"projects/{PROJECT_ID}/locations/{REGION}/indexEndpoints/{ENDPOINT_ID}"

# Initialize Vertex AI client globally
aiplatform.init(project=PROJECT_ID, location=REGION)
index_endpoint = aiplatform.MatchingEngineIndexEndpoint(index_endpoint_name=INDEX_ENDPOINT_NAME)

# Initialize BigQuery client globally
bigquery_client = bigquery.Client(project=PROJECT_ID)

# Helper Function to Generate Embeddings
def generate_embeddings(text_list):
    embeddings = model.encode(
        text_list,
        batch_size=32,
        normalize_embeddings=True,
        show_progress_bar=False
    )
    return embeddings

# Helper Function for Vector Search
def vector_search(query_embedding, top_k=5):
    """Perform vector search on the Vertex AI Matching Engine."""
    try:
        # Query the index for nearest neighbors
        response = index_endpoint.find_neighbors(
            deployed_index_id=DEPLOYED_INDEX_ID,
            queries=[query_embedding.tolist()],
            num_neighbors=top_k,
        )
        
        # Extract neighbors
        neighbors = response[0]

        # Prepare results
        results = [{"id": neighbor.id, "distance": neighbor.distance} for neighbor in neighbors]
        
        return results
    except Exception as e:
        logging.error(f"Error querying Vertex AI Matching Engine: {e}")
        return []

# Helper Function to Fetch Metadata from BigQuery
def get_metadata_from_bigquery(dataset_id, table_id, embedding_ids):
    """
    Fetch metadata for given embedding IDs from BigQuery.

    Args:
        dataset_id (str): The BigQuery dataset ID.
        table_id (str): The BigQuery table ID.
        embedding_ids (list[str]): List of embedding IDs to query.

    Returns:
        dict: Dictionary mapping IDs to metadata.
    """
    try:
        # Build the SQL query
        query = f"""
            SELECT id, title, abstract, authors, categories
            FROM `{PROJECT_ID}.{dataset_id}.{table_id}`
            WHERE id IN UNNEST(@embedding_ids)
        """
        
        # Configure query parameters
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ArrayQueryParameter("embedding_ids", "STRING", embedding_ids)
            ]
        )

        # Execute the query
        query_job = bigquery_client.query(query, job_config=job_config)

        # Convert the results to a dictionary mapping id to metadata
        metadata = {}
        for row in query_job.result():
            metadata[row.id] = {
                "title": row.title,
                "abstract": row.abstract,
                "authors": row.authors,
                "categories": row.categories,
            }
        return metadata

    except Exception as e:
        logging.error(f"Error querying BigQuery: {e}")
        return {}

@app.route('/api/search', methods=['POST'])
def search():
    try:
        # Parse input query from the request
        input_text = request.json.get("query", "")
        
        if not input_text:
            return jsonify({"error": "No query provided"}), 400
        
        # Generate embedding for the input query
        input_embedding = generate_embeddings([input_text])[0]
        
        # Perform vector search to get top K neighbors
        neighbors = vector_search(
            query_embedding=input_embedding,
            top_k=5,
        )
        
        if not neighbors:
            return jsonify({"error": "No neighbors found"}), 500
        
        # Extract IDs of neighbors
        neighbor_ids = [neighbor["id"] for neighbor in neighbors]

        # Query BigQuery for metadata
        metadata_dict = get_metadata_from_bigquery(
            dataset_id=DATASET_ID,
            table_id=TABLE_ID,
            embedding_ids=neighbor_ids,
        )
        
        # Combine neighbors with metadata
        combined_results = []
        for neighbor in neighbors:
            neighbor_id = neighbor["id"]
            distance = neighbor["distance"]
            metadata = metadata_dict.get(neighbor_id, {})
            combined_results.append({
                "id": neighbor_id,
                "distance": distance,
                "title": metadata.get("title"),
                "abstract": metadata.get("abstract"),
                "categories": metadata.get("categories"),
                "authors": metadata.get("authors"),
            })
        
        return jsonify({"results": combined_results})
    except Exception as e:
        logging.error(f"Error processing search request: {e}")
        return jsonify({"error": str(e)}), 500

# Start Flask App
if __name__ == '__main__':
    app.run(debug=True)
