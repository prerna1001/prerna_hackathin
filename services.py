from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from typing import Optional, List
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

def press_release_to_dict(pr):
    return {
        'title': pr.get('title'),
        'company': pr.get('company'),
        'published_date': pr.get('published_date'),
        'url': pr.get('url'),
        'summary': pr.get('summary', ''),
        'matches': pr.get('matches', []),
    }


def press_release_detail_to_dict(pr):
    return {
        'title': pr.get('title'),
        'company': pr.get('company'),
        'published_date': pr.get('published_date'),
        'url': pr.get('url'),
        'full_text': pr.get('full_text'),
    }

# API 1: Get ALL Press Releases
@app.get('/api/press-releases')
def get_all_press_releases():
    try:
        results = es_service.get_all()
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


@app.get('/api/filter-config')
def get_filter_config():
    try:
        config = es_service.get_filter_config()
        return {
            'status': 'success',
            'data': config,
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={'status': 'error', 'message': str(e)}
        )


@app.get('/api/initial-data')
def get_initial_data():
    try:
        results = es_service.get_all()
        releases = [press_release_to_dict(r) for r in results]
        config = es_service.get_filter_config()

        return {
            'status': 'success',
            'data': {
                'releases': releases,
                'filter_config': config,
            }
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={'status': 'error', 'message': str(e)}
        )


@app.get('/api/query-press-releases')
def query_press_releases(
    query: Optional[str] = Query(None),
    company: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    try:
        config = es_service.get_filter_config()
        limit = config.get('limit', 1000)
        results = es_service.query_documents(
            query_text=query,
            companies=company,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
        )

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


@app.get('/api/press-releases/detail')
def get_press_release_by_url(url: str = Query(..., description="Press release URL")):
    try:
        result = es_service.get_by_url(url)

        if not result:
            return JSONResponse(
                status_code=404,
                content={'status': 'error', 'message': 'Press release not found'}
            )

        return {
            'status': 'success',
            'data': press_release_detail_to_dict(result)
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={'status': 'error', 'message': str(e)}
        )


@app.get('/press-releases/all')
def get_all_press_releases_paginated(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1)
):
    try:
        result = es_service.get_all_paginated(page=page, size=size)
        total = result["total"]

        return {
            "status": "success",
            "page": page,
            "size": size,
            "total": total,
            "total_pages": (total + size - 1) // size,
            "data": result["results"]
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )

# API 2: Filter Press Releases
@app.get('/api/filter-press-releases')
def filter_press_releases(
    company: Optional[List[str]] = Query(None),
    title: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    try:
        query_text = title if title else None
        results = es_service.query_documents(
            query_text=query_text,
            companies=company,
            start_date=start_date,
            end_date=end_date,
            limit=1000,
        )
        
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
    limit: int = Query(20, ge=1, description="Max results")
):
    try:
        if not q:
            return JSONResponse(
                status_code=400,
                content={'status': 'error', 'message': 'Query parameter "q" is required'}
            )
        
        companies = [company] if company else None
        results = es_service.query_documents(
            query_text=q,
            companies=companies,
            limit=limit,
        )
        
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