from sqlalchemy import create_engine, Column, String, Date, Text
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

class PressReleaseDB(Base):
    __tablename__ = "press_releases"
    company = Column(String)
    published_date = Column(Date)
    title = Column(String)
    url = Column(String, primary_key=True)
    full_text = Column(Text)

class DatabaseManager:
    def __init__(self, db_url="postgresql://postgres:password@localhost:5432/pharma_db"):
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
        Base.metadata.create_all(self.engine)
    
    def get_session(self):
        return self.Session()

    def reset_press_releases_table(self):
        Base.metadata.drop_all(self.engine, tables=[PressReleaseDB.__table__])
        Base.metadata.create_all(self.engine, tables=[PressReleaseDB.__table__])
    
    def insert_press_release(self, company, published_date, title, url, full_text):
        session = self.get_session()
        try:
            pr = PressReleaseDB(
                company=company,
                published_date=published_date,
                title=title,
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