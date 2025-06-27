import os
import psycopg2
from datetime import datetime

def ping_postgres():
    # 获取 DB_URL 环境变量
    db_url = os.environ.get("DB_URL")
    
    if not db_url:
        print("Error: DB_URL not set")
        exit(1)
    
    try:
        # 建立数据库连接
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # 检查 keep_alive 表是否存在
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'keep_alive'
            )
        """)
        table_exists = cursor.fetchone()[0]
        
        # 如果表不存在，创建 keep_alive 表
        if not table_exists:
            cursor.execute("""
                CREATE TABLE keep_alive (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            print("Created keep_alive table")
        
        # 插入活跃记录
        cursor.execute("INSERT INTO keep_alive (timestamp) VALUES (CURRENT_TIMESTAMP) RETURNING id, timestamp")
        result = cursor.fetchone()
        
        print(f"Ping successful at {datetime.utcnow()}: Recorded ID {result[0]}, Timestamp {result[1]}")
        
        # 提交事务
        conn.commit()
        
        # 清理
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error pinging PostgreSQL: {str(e)}")
        exit(1)

if __name__ == "__main__":
    ping_postgres()
