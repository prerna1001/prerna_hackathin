from sqlalchemy import create_engine, Column, Integer, String, Date, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import date

Base = declarative_base()

class PressReleaseDB(Base):
    __tablename__ = "press_releases"
    id = Column(Integer, primary_key=True)
    company = Column(String)
    published_date = Column(Date)
    title = Column(String)
    category = Column(String, nullable=True)
    url = Column(String, unique=True)
    full_text = Column(Text)

class DatabaseManager:
    def __init__(self, db_url="postgresql://postgres:password@localhost:5432/pharma_db"):
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
    
    def get_session(self):
        return self.Session()
    
    def insert_press_release(self, company, published_date, title, category, url, full_text):
        session = self.get_session()
        try:
            pr = PressReleaseDB(
                company=company,
                published_date=published_date,
                title=title,
                category=category,
                url=url,
                full_text=full_text
            )
            session.add(pr)
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            print(f"Error inserting: {e}")
            return False
        finally:
            session.close()