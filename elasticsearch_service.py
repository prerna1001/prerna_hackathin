from elasticsearch import Elasticsearch
from elasticsearch.exceptions import ConnectionError, RequestError, NotFoundError
from typing import List, Dict, Optional
import json
import ssl
import os
import importlib
import re

try:
    dotenv_module = importlib.import_module("dotenv")
    dotenv_module.load_dotenv()
except Exception:
    pass

class ElasticsearchService:
    def __init__(self, host='localhost', port=9200, 
                 username=None, password=None,
                 ca_fingerprint='42e84f052048c3ed524278a39368647ed367f8e3b55ca02be52c74e27528c20c'):
        """
        Initialize Elasticsearch client with security enabled.
        """
        self.index_name = 'press_releases'
        self.filter_config_index = 'press_release_filter_config'
        host = os.getenv('ELASTIC_HOST', host)
        port = int(os.getenv('ELASTIC_PORT', str(port)))
        scheme = os.getenv('ELASTIC_SCHEME', 'https')

        env_username = os.getenv('ELASTIC_USERNAME')
        env_password = os.getenv('ELASTIC_PASSWORD')

        username = username if username is not None else (env_username if env_username is not None else 'elastic')
        password = password if password is not None else (env_password if env_password is not None else 'w7btNpyMiL6FOvpHzJ7u')
        basic_auth = (username, password) if username and password else None
        
        # Create SSL context that trusts the self-signed cert
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        try:
            self.client = Elasticsearch(
                hosts=[f'{scheme}://{host}:{port}'],
                basic_auth=basic_auth,
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
                        "company": {"type": "keyword"},
                        "title": {"type": "text", "analyzer": "standard"},
                        "published_date": {"type": "date"},
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

    def ensure_filter_config_index(self):
        """Create filter config index and default config if missing."""
        if not self.client:
            print("Elasticsearch client not initialized")
            return False

        try:
            if not self.client.indices.exists(index=self.filter_config_index):
                mapping = {
                    "mappings": {
                        "properties": {
                            "fields": {
                                "type": "nested",
                                "properties": {
                                    "key": {"type": "keyword"},
                                    "label": {"type": "keyword"},
                                    "type": {"type": "keyword"},
                                    "enabled": {"type": "boolean"},
                                    "placeholder": {"type": "text"},
                                },
                            },
                            "limit": {"type": "integer"},
                        }
                    }
                }
                self.client.indices.create(index=self.filter_config_index, body=mapping)

            if not self.client.exists(index=self.filter_config_index, id="default"):
                default_config = {
                    "fields": [
                        {
                            "key": "query",
                            "label": "Search",
                            "type": "text",
                            "enabled": True,
                            "placeholder": "Search by title or full text...",
                        },
                        {
                            "key": "company",
                            "label": "Company",
                            "type": "multi-select",
                            "enabled": True,
                        },
                        {
                            "key": "start_date",
                            "label": "Start Date",
                            "type": "date",
                            "enabled": True,
                        },
                        {
                            "key": "end_date",
                            "label": "End Date",
                            "type": "date",
                            "enabled": True,
                        },
                    ],
                    "limit": 1000,
                }
                self.client.index(index=self.filter_config_index, id="default", document=default_config)
                self.client.indices.refresh(index=self.filter_config_index)

            return True
        except Exception as e:
            print(f"Error ensuring filter config index: {e}")
            return False

    def get_filter_options(self) -> Dict:
        """Return dynamic options for filters from press release data."""
        if not self.client:
            return {"companies": [], "date_range": {"min": None, "max": None}}

        try:
            response = self.client.search(
                index=self.index_name,
                body={
                    "size": 0,
                    "aggs": {
                        "companies": {"terms": {"field": "company", "size": 200}},
                        "min_date": {"min": {"field": "published_date"}},
                        "max_date": {"max": {"field": "published_date"}},
                    },
                },
            )

            companies = [bucket["key"] for bucket in response["aggregations"]["companies"]["buckets"]]
            min_date_val = response["aggregations"]["min_date"]["value_as_string"]
            max_date_val = response["aggregations"]["max_date"]["value_as_string"]

            min_date = min_date_val[:10] if min_date_val else None
            max_date = max_date_val[:10] if max_date_val else None

            return {
                "companies": companies,
                "date_range": {"min": min_date, "max": max_date},
            }
        except Exception as e:
            print(f"Error fetching filter options: {e}")
            return {"companies": [], "date_range": {"min": None, "max": None}}

    def get_filter_config(self) -> Dict:
        """Fetch filter config table from Elasticsearch and merge with live options."""
        if not self.ensure_filter_config_index():
            return {
                "fields": [],
                "limit": 1000,
                "options": {"companies": [], "date_range": {"min": None, "max": None}},
            }

        try:
            response = self.client.get(index=self.filter_config_index, id="default")
            source = response.get("_source", {})
            options = self.get_filter_options()
            return {
                "fields": source.get("fields", []),
                "limit": source.get("limit", 1000),
                "options": options,
            }
        except Exception as e:
            print(f"Error fetching filter config: {e}")
            return {
                "fields": [],
                "limit": 1000,
                "options": self.get_filter_options(),
            }

    def query_documents(
        self,
        query_text: Optional[str] = None,
        companies: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000,
        include_highlights: bool = True,
    ) -> List[Dict]:
        """Unified search + filter query for press releases."""
        if not self.client:
            print("Elasticsearch client not initialized")
            return []

        def query_terms(text: Optional[str]) -> List[str]:
            if not text:
                return []
            base_terms = [part.lower() for part in str(text).split() if len(part.strip()) > 1]
            expanded = []
            seen = set()
            for term in base_terms:
                variants = [term]
                if len(term) > 2:
                    if term.endswith("s"):
                        variants.append(term[:-1])
                    else:
                        variants.append(f"{term}s")
                for variant in variants:
                    normalized = variant.strip()
                    if len(normalized) <= 1 or normalized in seen:
                        continue
                    seen.add(normalized)
                    expanded.append(normalized)
            return expanded

        def contains_query(text: Optional[str], terms: List[str]) -> bool:
            normalized = " ".join(str(text or "").lower().split())
            if not normalized or not terms:
                return False
            return any(term in normalized for term in terms)

        def extract_context_snippet(text: Optional[str], terms: List[str], max_len: int = 240) -> str:
            source = " ".join(str(text or "").split())
            if not source:
                return ""
            if not terms:
                return source[:max_len]

            lowered = source.lower()
            first_index = -1
            for term in terms:
                idx = lowered.find(term)
                if idx != -1 and (first_index == -1 or idx < first_index):
                    first_index = idx

            if first_index == -1:
                return source[:max_len]

            half = max_len // 2
            start = max(0, first_index - half)
            end = min(len(source), start + max_len)
            if end - start < max_len:
                start = max(0, end - max_len)

            prefix = "..." if start > 0 else ""
            suffix = "..." if end < len(source) else ""
            return f"{prefix}{source[start:end].strip()}{suffix}"

        try:
            must_clauses = []
            filter_clauses = []
            terms = query_terms(query_text)

            if query_text:
                should_clauses = [
                    {
                        "multi_match": {
                            "query": query_text,
                            "fields": ["title^2", "full_text"],
                        }
                    }
                ]

                for term in terms:
                    if len(term) < 3:
                        continue
                    should_clauses.append(
                        {
                            "wildcard": {
                                "full_text": {
                                    "value": f"*{term}*",
                                    "case_insensitive": True,
                                }
                            }
                        }
                    )
                    should_clauses.append(
                        {
                            "wildcard": {
                                "title": {
                                    "value": f"*{term}*",
                                    "case_insensitive": True,
                                }
                            }
                        }
                    )

                must_clauses.append(
                    {
                        "bool": {
                            "should": should_clauses,
                            "minimum_should_match": 1,
                        }
                    }
                )

            if companies:
                filter_clauses.append({"terms": {"company": companies}})

            if start_date or end_date:
                range_clause = {"range": {"published_date": {}}}
                if start_date:
                    range_clause["range"]["published_date"]["gte"] = start_date
                if end_date:
                    range_clause["range"]["published_date"]["lte"] = end_date
                filter_clauses.append(range_clause)

            query_body = {
                "bool": {
                    "must": must_clauses,
                    "filter": filter_clauses,
                }
            }

            search_body = {
                "query": query_body,
                "size": limit,
                "sort": [{"published_date": {"order": "desc"}}],
            }

            if include_highlights and query_text:
                search_body["highlight"] = {
                    "pre_tags": ["<mark>"],
                    "post_tags": ["</mark>"],
                    "fields": {
                        "title": {"number_of_fragments": 1},
                        "full_text": {"fragment_size": 180, "number_of_fragments": 3},
                    },
                }

            response = self.client.search(
                index=self.index_name,
                body=search_body,
            )

            raw_results = []
            snippet_frequency: Dict[str, int] = {}

            for hit in response["hits"]["hits"]:
                doc = hit["_source"]
                highlight = hit.get("highlight", {})
                matches = []

                for field_name in ["title", "full_text"]:
                    snippets = highlight.get(field_name, [])
                    for snippet in snippets:
                        plain_text = re.sub(r"</?mark>", "", snippet)
                        normalized = " ".join(plain_text.lower().split())
                        snippet_frequency[normalized] = snippet_frequency.get(normalized, 0) + 1
                        matches.append(
                            {
                                "field": field_name,
                                "field_label": "Title" if field_name == "title" else "Content",
                                "snippet": snippet,
                                "plain_text": plain_text,
                                "normalized": normalized,
                            }
                        )

                raw_results.append(
                    {
                        "title": doc.get("title"),
                        "company": doc.get("company"),
                        "published_date": doc.get("published_date"),
                        "url": doc.get("url"),
                        "full_text": doc.get("full_text"),
                        "matches": matches,
                    }
                )

            results = []
            for item in raw_results:
                matches = item.get("matches", [])

                def rank_key(match: Dict):
                    is_title_match = 0 if match.get("field") == "title" else 1
                    frequency = snippet_frequency.get(match.get("normalized", ""), 0)
                    snippet_length = len(match.get("plain_text", ""))
                    return (is_title_match, frequency, snippet_length)

                ranked_matches = sorted(matches, key=rank_key)
                cleaned_matches = []
                seen_norm = set()
                for match in ranked_matches:
                    norm = match.get("normalized")
                    plain_text = match.get("plain_text", "")

                    if query_text and terms and not contains_query(plain_text, terms):
                        continue

                    if norm in seen_norm:
                        continue
                    frequency = snippet_frequency.get(norm, 0)
                    if match.get("field") == "full_text" and frequency > 1:
                        continue
                    seen_norm.add(norm)
                    cleaned_matches.append(
                        {
                            "field": match.get("field"),
                            "field_label": match.get("field_label"),
                            "snippet": match.get("snippet"),
                            "plain_text": plain_text,
                        }
                    )

                if not cleaned_matches and ranked_matches:
                    fallback = ranked_matches[0]
                    fallback_text = fallback.get("plain_text", "")
                    if not query_text or contains_query(fallback_text, terms):
                        cleaned_matches.append(
                            {
                                "field": fallback.get("field"),
                                "field_label": fallback.get("field_label"),
                                "snippet": fallback.get("snippet"),
                                "plain_text": fallback_text,
                            }
                        )

                if query_text and not cleaned_matches:
                    fallback_text = extract_context_snippet(item.get("full_text"), terms)
                    if contains_query(fallback_text, terms):
                        cleaned_matches.append(
                            {
                                "field": "full_text",
                                "field_label": "Content",
                                "snippet": fallback_text,
                                "plain_text": fallback_text,
                            }
                        )

                item["matches"] = cleaned_matches[:3]
                summary = cleaned_matches[0]["plain_text"] if cleaned_matches else ""
                if query_text and terms and not contains_query(summary, terms):
                    query_context = extract_context_snippet(item.get("full_text"), terms)
                    if contains_query(query_context, terms):
                        summary = query_context

                item["summary"] = summary
                results.append(item)

            return results
        except Exception as e:
            print(f"Error querying documents: {e}")
            return []
    
    def bulk_index(self, documents: List[Dict]) -> int:
        """
        Bulk index documents into Elasticsearch.
        Returns count of successfully indexed documents.
        """
        if not self.client:
            print("Elasticsearch client not initialized")
            return 0
        
        if not documents:
            print("  No documents to index")
            return 0
        
        try:
            from elasticsearch.helpers import bulk
            
            # Prepare bulk operations
            operations = []
            for doc in documents:
                doc_id = doc.get('url') or f"{doc.get('company','')}-{doc.get('published_date','')}-{doc.get('title','')}"
                operations.append({
                    "_index": self.index_name,
                    "_id": doc_id,
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
                                "fields": ["title^2", "full_text"]
                            }
                        }
                    ]
                }
            }
             
            # Add company filter if provided
            if company:
                es_query["bool"]["filter"] = [
                    {"term": {"company": company}}
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
                    'title': doc.get('title'),
                    'company': doc.get('company'),
                    'published_date': doc.get('published_date'),
                    'url': doc.get('url'),
                    'full_text': doc.get('full_text'),
                    'score': hit['_score']
                })
            
            return results
        except Exception as e:
            print(f"Error during search: {e}")
            return []

    def get_all_paginated(self, page: int = 1, size: int = 10) -> Dict:
        """Retrieve paginated press releases from Elasticsearch."""
        if not self.client:
            print("Elasticsearch client not initialized")
            return {"results": [], "total": 0}

        try:
            from_value = (page - 1) * size
            response = self.client.search(
                index=self.index_name,
                body={
                    "query": {"match_all": {}},
                    "from": from_value,
                    "size": size,
                    "sort": [
                        {"published_date": {"order": "desc"}}
                    ]
                }
            )

            hits = response["hits"]["hits"]
            total = response["hits"]["total"]["value"]

            results = []
            for hit in hits:
                doc = hit["_source"]
                results.append({
                    "company": doc.get("company"),
                    "title": doc.get("title"),
                    "published_date": doc.get("published_date"),
                    "url": doc.get("url")
                })

            return {"results": results, "total": total}
        except Exception as e:
            print(f"Error fetching paginated results: {e}")
            return {"results": [], "total": 0}

    def get_all(self, limit: int = 1000) -> List[Dict]:
        """Retrieve all press releases from Elasticsearch."""
        if not self.client:
            print("Elasticsearch client not initialized")
            return []

        try:
            response = self.client.search(
                index=self.index_name,
                body={
                    "query": {"match_all": {}},
                    "size": limit,
                    "sort": [{"published_date": {"order": "desc"}}]
                }
            )

            results = []
            for hit in response["hits"]["hits"]:
                doc = hit["_source"]
                results.append({
                    "title": doc.get("title"),
                    "company": doc.get("company"),
                    "published_date": doc.get("published_date"),
                    "url": doc.get("url"),
                    "full_text": doc.get("full_text"),
                })
            return results
        except Exception as e:
            print(f"Error fetching all documents: {e}")
            return []

    def filter_documents(
        self,
        company: Optional[str] = None,
        title: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000,
    ) -> List[Dict]:
        """Filter press releases in Elasticsearch using company/title/date fields."""
        if not self.client:
            print("Elasticsearch client not initialized")
            return []

        try:
            must_clauses = []
            filter_clauses = []

            if company:
                filter_clauses.append({
                    "bool": {
                        "should": [
                            {"term": {"company": company}},
                            {"wildcard": {"company": {"value": f"*{company}*", "case_insensitive": True}}}
                        ],
                        "minimum_should_match": 1,
                    }
                })

            if title:
                must_clauses.append({
                    "match": {"title": {"query": title, "operator": "and"}}
                })

            if start_date or end_date:
                range_clause = {"range": {"published_date": {}}}
                if start_date:
                    range_clause["range"]["published_date"]["gte"] = start_date
                if end_date:
                    range_clause["range"]["published_date"]["lte"] = end_date
                filter_clauses.append(range_clause)

            query_body = {
                "bool": {
                    "must": must_clauses,
                    "filter": filter_clauses,
                }
            }

            response = self.client.search(
                index=self.index_name,
                body={
                    "query": query_body,
                    "size": limit,
                    "sort": [{"published_date": {"order": "desc"}}]
                }
            )

            results = []
            for hit in response["hits"]["hits"]:
                doc = hit["_source"]
                results.append({
                    "title": doc.get("title"),
                    "company": doc.get("company"),
                    "published_date": doc.get("published_date"),
                    "url": doc.get("url"),
                    "full_text": doc.get("full_text"),
                })
            return results
        except Exception as e:
            print(f"Error filtering documents: {e}")
            return []

    def get_by_url(self, press_release_url: str) -> Optional[Dict]:
        """Retrieve one press release by URL from Elasticsearch."""
        if not self.client:
            print("Elasticsearch client not initialized")
            return None

        try:
            response = self.client.search(
                index=self.index_name,
                body={
                    "query": {"term": {"url": press_release_url}},
                    "size": 1,
                },
            )
            hits = response.get("hits", {}).get("hits", [])
            if not hits:
                return None

            doc = hits[0].get("_source", {})
            return {
                "title": doc.get("title"),
                "company": doc.get("company"),
                "published_date": doc.get("published_date"),
                "url": doc.get("url"),
                "full_text": doc.get("full_text"),
            }
        except Exception as e:
            print(f"Error fetching document by url: {e}")
            return None

    def get_by_id(self, press_release_id: int) -> Optional[Dict]:
        """Retrieve one press release by id from Elasticsearch."""
        if not self.client:
            print("Elasticsearch client not initialized")
            return None

        try:
            response = self.client.get(index=self.index_name, id=press_release_id)
            doc = response.get("_source", {})
            return {
                "title": doc.get("title"),
                "company": doc.get("company"),
                "published_date": doc.get("published_date"),
                "url": doc.get("url"),
                "full_text": doc.get("full_text"),
            }
        except NotFoundError:
            return None
        except Exception as e:
            print(f"Error fetching document by id: {e}")
            return None