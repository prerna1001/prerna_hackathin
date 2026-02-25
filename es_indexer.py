#!/usr/bin/env python3
"""
One-time script to index all press releases from PostgreSQL into Elasticsearch.
Run: python3 es_indexer.py
"""

from database import DatabaseManager, PressReleaseDB
from elasticsearch_service import ElasticsearchService

def index_press_releases():
    """Fetch all press releases from DB and index into Elasticsearch."""
    
    # Initialize services
    db_manager = DatabaseManager()
    es_service = ElasticsearchService()
    
    if not es_service.client:
        print("Cannot connect to Elasticsearch. Make sure it's running.")
        return

    # Recreate index to avoid stale documents from previous runs
    if es_service.client.indices.exists(index=es_service.index_name):
        es_service.client.indices.delete(index=es_service.index_name)
        print(f"Deleted existing index '{es_service.index_name}'")

    # Ensure fresh index exists
    es_service.ensure_index()
    
    # Fetch all press releases from DB
    try:
        session = db_manager.get_session()
        press_releases = session.query(PressReleaseDB).all()
        session.close()
        
        if not press_releases:
            print("⚠️  No press releases found in database")
            return
        
        # Convert to dict format for ES
        documents = []
        for pr in press_releases:
            documents.append({
                'company': pr.company,
                'published_date': pr.published_date.isoformat() if pr.published_date else None,
                'title': pr.title,
                'url': pr.url,
                'full_text': pr.full_text
            })
        
        print(f" Found {len(documents)} press releases in database")
        print("Indexing into Elasticsearch...")
        
        # Bulk index
        indexed_count = es_service.bulk_index(documents)
        
        if indexed_count > 0:
            print(f"Successfully indexed {indexed_count} documents into '{es_service.index_name}'")
        else:
            print(" Failed to index documents")
    
    except Exception as e:
        print(f"Error during indexing: {e}")

if __name__ == '__main__':
    index_press_releases()