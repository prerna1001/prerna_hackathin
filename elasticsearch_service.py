from elasticsearch import Elasticsearch
from elasticsearch.exceptions import ConnectionError, RequestError
from typing import List, Dict, Optional
import json
import ssl

class ElasticsearchService:
    def __init__(self, host='localhost', port=9200, 
                 username='elastic', password='w7btNpyMiL6FOvpHzJ7u',
                 ca_fingerprint='42e84f052048c3ed524278a39368647ed367f8e3b55ca02be52c74e27528c20c'):
        """
        Initialize Elasticsearch client with security enabled.
        """
        self.index_name = 'press_releases'
        
        # Create SSL context that trusts the self-signed cert
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        try:
            self.client = Elasticsearch(
                hosts=[f'https://{host}:{port}'],
                basic_auth=(username, password),
                verify_certs=False,
                ssl_show_warn=False,
            )
            # Test connection
            if self.client.info():
                print(" Connected to Elasticsearch")
        except ConnectionError as e:
            print(f"Failed to connect to Elasticsearch: {e}")
            self.client = None
    
    def ensure_index(self):
        """Create index with mappings if it doesn't exist."""
        if not self.client:
            print("Elasticsearch client not initialized")
            return False
        
        try:
            if self.client.indices.exists(index=self.index_name):
                print(f"Index '{self.index_name}' already exists")
                return True
            
            mapping = {
                "mappings": {
                    "properties": {
                        "id": {"type": "integer"},
                        "company": {"type": "keyword"},
                        "title": {"type": "text", "analyzer": "standard"},
                        "published_date": {"type": "date"},
                        "category": {"type": "keyword"},
                        "url": {"type": "keyword"},
                        "full_text": {"type": "text", "analyzer": "standard"}
                    }
                }
            }
            
            self.client.indices.create(index=self.index_name, body=mapping)
            print(f"Created index '{self.index_name}'")
            return True
        except RequestError as e:
            if e.error == 'resource_already_exists_exception':
                print(f"Index '{self.index_name}' already exists")
                return True
            print(f"Error creating index: {e}")
            return False
    
    def bulk_index(self, documents: List[Dict]) -> int:
        """
        Bulk index documents into Elasticsearch.
        Returns count of successfully indexed documents.
        """
        if not self.client:
            print("Elasticsearch client not initialized")
            return 0
        
        if not documents:
            print("⚠️  No documents to index")
            return 0
        
        try:
            from elasticsearch.helpers import bulk
            
            # Prepare bulk operations
            operations = []
            for doc in documents:
                operations.append({
                    "_index": self.index_name,
                    "_id": doc.get('id'),
                    "_source": doc
                })
            
            success, failed = bulk(self.client, operations, raise_on_error=False)
            print(f"Indexed {success} documents, {failed} failed")
            return success
        except Exception as e:
            print(f"Error during bulk indexing: {e}")
            return 0
    
    def search(self, query_text: str, company: Optional[str] = None, 
               limit: int = 20) -> List[Dict]:
        """
        Full-text search across press releases.
        Optionally filter by company.
        """
        if not self.client:
            print("Elasticsearch client not initialized")
            return []
        
        try:
            es_query = {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query_text,
                                "fields": ["title^2", "full_text", "category"]
                            }
                        }
                    ]
                }
            }
            
            # Add company filter if provided
            if company:
                es_query["bool"]["filter"] = [
                    {"term": {"company.keyword": company}}
                ]
            
            response = self.client.search(
                index=self.index_name,
                body={
                    "query": es_query,
                    "size": limit
                }
            )
            
            # Format results
            results = []
            for hit in response['hits']['hits']:
                doc = hit['_source']
                results.append({
                    'id': doc.get('id'),
                    'title': doc.get('title'),
                    'company': doc.get('company'),
                    'published_date': doc.get('published_date'),
                    'url': doc.get('url'),
                    'score': hit['_score']
                })
            
            return results
        except Exception as e:
            print(f"Error during search: {e}")
            return []