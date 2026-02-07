from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from database import DatabaseManager, PressReleaseDB
from datetime import datetime
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from elasticsearch_service import ElasticsearchService

es_service = ElasticsearchService()

app = FastAPI()

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_manager = DatabaseManager()

# Helper function to convert DB object to dict (only title, date, url)
def press_release_to_dict(pr):
    return {
        'id': pr.id,
        'title': pr.title,
        'company': pr.company,
        'published_date': pr.published_date.isoformat() if pr.published_date else None,
        'url': pr.url
    }

# API 1: Get ALL Press Releases
@app.get('/api/press-releases')
def get_all_press_releases():
    try:
        session = db_manager.get_session()
        results = session.query(PressReleaseDB).all()
        session.close()
        
        data = [press_release_to_dict(r) for r in results]
        
        return {
            'status': 'success',
            'data': data,
            'count': len(data)
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={'status': 'error', 'message': str(e)}
        )

# API 2: Filter Press Releases
@app.get('/api/filter-press-releases')
def filter_press_releases(
    company: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    try:
        session = db_manager.get_session()
        query = session.query(PressReleaseDB)
        
        # Filter by company
        if company:
            query = query.filter(PressReleaseDB.company.ilike(f'%{company}%'))
        
        # Filter by title
        if title:
            query = query.filter(PressReleaseDB.title.ilike(f'%{title}%'))
        
        # Filter by start_date
        if start_date:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(PressReleaseDB.published_date >= start_date_obj)
        
        # Filter by end_date
        if end_date:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(PressReleaseDB.published_date <= end_date_obj)
        
        results = query.all()
        session.close()
        
        data = [press_release_to_dict(r) for r in results]
        
        return {
            'status': 'success',
            'data': data,
            'count': len(data)
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={'status': 'error', 'message': str(e)}
        )

# Health check endpoint
@app.get('/health')
def health_check():
    return {'status': 'ok'}


# API 3: Full-text search via Elasticsearch
@app.get('/api/search')
def search_press_releases(
    q: Optional[str] = Query(None, description="Search query"),
    company: Optional[str] = Query(None, description="Filter by company"),
    limit: int = Query(20, ge=1, le=100, description="Max results")
):
    try:
        if not q:
            return JSONResponse(
                status_code=400,
                content={'status': 'error', 'message': 'Query parameter "q" is required'}
            )
        
        results = es_service.search(query_text=q, company=company, limit=limit)
        
        return {
            'status': 'success',
            'data': results,
            'count': len(results)
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={'status': 'error', 'message': str(e)}
        )
    
if __name__ == '__main__':
    import uvicorn
    import sys
    
    # Get port from command line or default to 8000
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    
    print(f"Starting API server on port {port}...")
    uvicorn.run(app, host='0.0.0.0', port=port)